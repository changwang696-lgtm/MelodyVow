import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const app = express()

const PORT = Number(process.env.PORT ?? 8787)
const DEEPSEEK_API_BASE = process.env.DEEPSEEK_API_BASE ?? 'https://api.deepseek.com/v1'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'
const SUNO_MODEL = process.env.SUNO_MODEL ?? 'chirp-v4-5'
const SUNO_GENERATE_URL = process.env.SUNO_GENERATE_URL ?? 'https://api.wike.cc/api/suno/generate'
const SUNO_FEED_URL = process.env.SUNO_FEED_URL ?? 'https://api.wike.cc/api/suno/feed'
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '')
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN?.replace(/\/$/, '')
const JOB_TTL_MS = 1000 * 60 * 60 * 6
const POLL_INTERVAL_MS = Number(process.env.SUNO_POLL_INTERVAL_MS ?? 12000)
const MAX_POLL_ATTEMPTS = Number(process.env.SUNO_POLL_MAX_ATTEMPTS ?? 40)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const ADMIN_DATA_FILE = path.join(DATA_DIR, 'admin-data.json')
const DEBUG_ENV_FILE = path.join(process.cwd(), '.dbg', 'suno-expired-url.env')

const jobs = new Map()
const sunoTaskToJob = new Map()
const activePolls = new Set()
const adminSessions = new Map()

app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin

  if (FRONTEND_ORIGIN && requestOrigin === FRONTEND_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN)
  }
  else if (!FRONTEND_ORIGIN && requestOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
  }

  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  next()
})

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function createDefaultAdminData() {
  return {
    orders: [
      {
        id: 'ord-demo-001',
        couple: 'Hao & Xin',
        plan: 'Pro',
        amount: 199,
        status: 'paid',
        email: 'hao@example.com',
        note: '婚礼开场曲，需提前交付伴奏版。',
        createdAt: nowIso(),
      },
      {
        id: 'ord-demo-002',
        couple: 'Luna & Ethan',
        plan: 'Premium',
        amount: 499,
        status: 'processing',
        email: 'luna@example.com',
        note: '需要双语版本和 first dance mix。',
        createdAt: nowIso(),
      },
    ],
    songs: [],
    config: {
      deepseekProvider: 'DeepSeek',
      sunoProvider: 'Suno',
      publicBaseUrl: PUBLIC_BASE_URL || '',
      allowSignup: true,
      notes: '后台 MVP 阶段使用本地 JSON 持久化，后续可直接迁移到数据库。',
    },
  }
}

function loadAdminData() {
  ensureDataDir()

  if (!fs.existsSync(ADMIN_DATA_FILE)) {
    const initialData = createDefaultAdminData()
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8')
    return initialData
  }

  try {
    const raw = fs.readFileSync(ADMIN_DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      ...createDefaultAdminData(),
      ...parsed,
      orders: Array.isArray(parsed?.orders) ? parsed.orders : createDefaultAdminData().orders,
      songs: Array.isArray(parsed?.songs) ? parsed.songs : [],
      config: {
        ...createDefaultAdminData().config,
        ...(parsed?.config ?? {}),
      },
    }
  } catch {
    const fallback = createDefaultAdminData()
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

let adminData = loadAdminData()

function saveAdminData() {
  ensureDataDir()
  fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(adminData, null, 2), 'utf8')
}

function syncJobToAdminData(job) {
  const playbackUrl = pickPreferredAudioUrl(
    job.tracks?.[0]?.audioUrl,
    job.tracks?.[0]?.downloadUrl,
  )
  const downloadUrl = pickPreferredAudioUrl(
    job.tracks?.[0]?.downloadUrl,
    job.tracks?.[0]?.audioUrl,
  )
  const entry = {
    id: job.id,
    title: job.title || `${job.input.groom} & ${job.input.bride}`,
    couple: `${job.input.groom} & ${job.input.bride}`,
    email: job.input.userEmail || '',
    languageLabel: job.input.languageLabel,
    styleLabel: job.input.styleLabel || job.input.style,
    vocalLabel: job.input.vocalLabel,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    audioUrl: playbackUrl,
    downloadUrl,
    lyricSnippet: String(job.lyrics || '').slice(0, 160),
    lyrics: job.lyrics || '',
    error: job.error || '',
    story: {
      loveStory: job.input.loveStory || '',
      meetingStory: job.input.meetingStory || '',
      vowKeywords: job.input.vowKeywords || '',
    },
  }

  // #region debug-point B:sync-job-admin-data
  reportDebugEvent({
    hypothesisId: 'B',
    location: 'web/server/index.mjs:syncJobToAdminData',
    msg: '[DEBUG] Sync job entry to persisted admin data',
    data: {
      jobId: job.id,
      status: job.status,
      taskId: job.sunoTaskId || '',
      trackCount: Array.isArray(job.tracks) ? job.tracks.length : 0,
      firstTrackAudioUrl: job.tracks?.[0]?.audioUrl || '',
      firstTrackDownloadUrl: job.tracks?.[0]?.downloadUrl || '',
      persistedAudioUrl: entry.audioUrl,
      persistedDownloadUrl: entry.downloadUrl,
      email: entry.email,
    },
  })
  // #endregion

  const nextSongs = [entry, ...adminData.songs.filter((item) => item.id !== entry.id)].slice(0, 100)
  adminData = {
    ...adminData,
    songs: nextSongs,
  }
  saveAdminData()
}

function readAdminToken(req) {
  const header = req.headers['x-admin-token']
  if (Array.isArray(header)) {
    return header[0] || ''
  }

  return String(header || '')
}

function requireAdminAuth(req, res, next) {
  const token = readAdminToken(req)
  const session = token ? adminSessions.get(token) : null

  if (!session) {
    res.status(401).json({ message: '后台登录已失效，请重新登录。' })
    return
  }

  req.adminSession = session
  next()
}

function nowIso() {
  return new Date().toISOString()
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value
    }
  }

  return undefined
}

function isExpiredSunoStreamUrl(value) {
  return /^https?:\/\/audiopipe\.suno\.ai/i.test(String(value || '').trim())
}

function pickPreferredAudioUrl(...values) {
  const candidates = values
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return candidates.find((value) => !isExpiredSunoStreamUrl(value)) || candidates[0] || ''
}

function sanitizeDownloadFilename(name) {
  const base = String(name || 'melodyvow-song')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)

  return base || 'melodyvow-song'
}

function guessAudioExtension(sourceUrl, contentType) {
  const normalizedType = String(contentType || '').toLowerCase()
  if (normalizedType.includes('mpeg') || normalizedType.includes('mp3')) {
    return 'mp3'
  }
  if (normalizedType.includes('wav')) {
    return 'wav'
  }
  if (normalizedType.includes('x-m4a') || normalizedType.includes('mp4')) {
    return 'm4a'
  }
  if (normalizedType.includes('ogg')) {
    return 'ogg'
  }

  const pathname = (() => {
    try {
      return new URL(String(sourceUrl || '')).pathname
    } catch {
      return ''
    }
  })()
  const matched = pathname.match(/\.([a-z0-9]{2,5})$/i)
  return matched?.[1]?.toLowerCase() || 'mp3'
}

function reportDebugEvent(event) {
  let debugServerUrl = 'http://127.0.0.1:7777/event'
  let debugSessionId = 'suno-expired-url'

  try {
    const envContent = fs.readFileSync(DEBUG_ENV_FILE, 'utf8')
    debugServerUrl = envContent.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() || debugServerUrl
    debugSessionId = envContent.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() || debugSessionId
  } catch {}

  void fetch(debugServerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: debugSessionId,
      runId: 'pre-fix',
      ts: Date.now(),
      ...event,
    }),
  }).catch(() => {})
}

function getDeepSeekKey() {
  return String(process.env.DEEPSEEK_API_KEY || '').trim()
}

function getSunoAuthToken() {
  return String(process.env.SUNO_AUTH || process.env.SUNO_API_KEY || '').trim()
}

function getSunoAuthHeader() {
  const token = getSunoAuthToken()
  if (!token) {
    return ''
  }

  return token.startsWith('Bearer ') ? token : token
}

function createJob(input) {
  const id = crypto.randomUUID()
  const job = {
    id,
    status: 'queued',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    error: null,
    input,
    lyrics: null,
    title: null,
    stylePrompt: null,
    sunoTaskId: null,
    callbackEnabled: Boolean(PUBLIC_BASE_URL),
    tracks: [],
  }

  jobs.set(id, job)
  syncJobToAdminData(job)
  return job
}

function updateJob(jobId, patch) {
  const current = jobs.get(jobId)
  if (!current) {
    return null
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  }

  jobs.set(jobId, next)
  syncJobToAdminData(next)
  return next
}

function validateGenerateInput(body) {
  const groom = typeof body.groom === 'string' ? body.groom.trim() : ''
  const bride = typeof body.bride === 'string' ? body.bride.trim() : ''
  const userEmail = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : ''
  const occasion = body.occasion === 'proposal' ? 'proposal' : 'wedding'
  const style = typeof body.style === 'string' ? body.style.trim() : ''
  const styleLabel = typeof body.styleLabel === 'string' ? body.styleLabel.trim() : ''
  const languageCode = typeof body.languageCode === 'string' ? body.languageCode.trim() : ''
  const languageLabel = typeof body.languageLabel === 'string' ? body.languageLabel.trim() : ''
  const vocal = typeof body.vocal === 'string' ? body.vocal.trim() : ''
  const vocalLabel = typeof body.vocalLabel === 'string' ? body.vocalLabel.trim() : ''
  const loveStory = typeof body.loveStory === 'string' ? body.loveStory.trim() : ''
  const meetingStory = typeof body.meetingStory === 'string' ? body.meetingStory.trim() : ''
  const vowKeywords = typeof body.vowKeywords === 'string' ? body.vowKeywords.trim() : ''

  if (!groom || !bride || !style || !languageCode || !languageLabel || !vocal || !vocalLabel) {
    throw new Error('请完整填写新郎、新娘、歌曲语言、曲风和歌唱声音。')
  }

  return {
    groom,
    bride,
    userEmail,
    occasion,
    style,
    styleLabel,
    languageCode,
    languageLabel,
    vocal,
    vocalLabel,
    loveStory,
    meetingStory,
    vowKeywords,
  }
}

function mapSongToMemberHistory(song) {
  const playbackUrl = pickPreferredAudioUrl(song.audioUrl, song.downloadUrl)
  const downloadUrl = pickPreferredAudioUrl(song.downloadUrl, song.audioUrl)

  return {
    id: song.id,
    title: song.title,
    subtitle: song.couple,
    status: song.status === 'ready' ? '已生成' : song.status,
    action: '下载音频',
    audioUrl: playbackUrl,
    downloadUrl,
    createdAt: song.updatedAt || song.createdAt,
    languageLabel: song.languageLabel || '',
    styleLabel: song.styleLabel || '',
    vocalLabel: song.vocalLabel || '',
    lyricSnippet: song.lyricSnippet || '',
  }
}

async function requestJson(url, options, label) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message = data?.error?.message ?? data?.msg ?? data?.error ?? `${label}请求失败`
    throw new Error(message)
  }

  return data
}

function sanitizeTitle(title, groom, bride) {
  const base = String(title || '').trim()
  if (base) {
    return base.slice(0, 80)
  }

  return `${groom} & ${bride}`.slice(0, 80)
}

function buildStyleTags(stylePrompt) {
  return String(stylePrompt || '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(' ')
}

async function generateLyrics({ groom, bride, occasion, style, styleLabel, languageLabel, vocalLabel, loveStory, meetingStory, vowKeywords }) {
  const isProposal = occasion === 'proposal'
  const sceneLabel = isProposal ? '求婚' : '婚礼'
  const prompt = [
    isProposal ? '你是顶级求婚词作人和音乐制作统筹。' : '你是顶级婚礼词作人和音乐制作统筹。',
    `请为一对恋人创作一首${sceneLabel}歌曲歌词：男主角 ${groom}，女主角 ${bride}。`,
    `歌曲语言必须完整使用 ${languageLabel}，不要夹杂其他语言，除非该语言本身需要借词。`,
    isProposal
      ? `曲风为 ${styleLabel || style}，歌唱声音为 ${vocalLabel}，整体要适合求婚现场播放，情绪层层推进，先告白、再承诺、最后落到“想和你结婚”。`
      : `曲风为 ${styleLabel || style}，歌唱声音为 ${vocalLabel}，整体要适合婚礼现场播放，浪漫、真诚、易于演唱。`,
    loveStory
      ? `爱情故事参考：${loveStory}`
      : isProposal
        ? '爱情故事参考：未提供，请补足一段适合求婚的真实回忆与告白动机。'
        : '爱情故事参考：未提供，请用温暖真实的婚礼叙事补足。',
    meetingStory
      ? `相识经历参考：${meetingStory}`
      : isProposal
        ? '相识经历参考：未提供，请自行补出自然相遇、逐渐确认心意的过程。'
        : '相识经历参考：未提供，请自行补出自然的相遇桥段。',
    vowKeywords
      ? `誓言关键词：${vowKeywords}`
      : isProposal
        ? '誓言关键词：未提供，请补充求婚常见的坚定选择、未来计划、一起组建家庭、marry me 等承诺。'
        : '誓言关键词：未提供，请补充婚礼常见的陪伴、守护、未来承诺。',
    '请输出 JSON 对象，字段必须是：title、lyrics、stylePrompt。',
    'title：歌曲标题。',
    'lyrics：完整歌词，按 [Verse] [Chorus] [Bridge] 分段。',
    `stylePrompt：给 SUNO 的英文风格标签，简短、可直接塞进 tags，需包含 ${isProposal ? 'proposal' : 'wedding'}、love、romantic、声线提示以及曲风关键词。`,
  ].join('\n')

  const data = await requestJson(
    `${DEEPSEEK_API_BASE}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getDeepSeekKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        response_format: { type: 'json_object' },
        temperature: 1,
        stream: false,
        messages: [
          {
            role: 'system',
            content: isProposal
              ? 'You write proposal song lyrics and always respond with valid JSON only.'
              : 'You write wedding song lyrics and always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: `${prompt}\n\n重要：不要输出解释，只输出 JSON 对象。`,
          },
        ],
      }),
    },
    'DeepSeek',
  )

  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('DeepSeek 没有返回歌词内容。')
  }

  let parsed = null
  try {
    parsed = JSON.parse(content)
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    }
  }

  if (!parsed?.title || !parsed?.lyrics || !parsed?.stylePrompt) {
    throw new Error('DeepSeek 返回的歌词格式不完整。')
  }

  return {
    title: sanitizeTitle(parsed.title, groom, bride),
    lyrics: String(parsed.lyrics).trim(),
    stylePrompt: String(parsed.stylePrompt).trim(),
  }
}

async function createSunoTask(job, { title, lyrics, stylePrompt }) {
  const payload = {
    mv: SUNO_MODEL,
    custom_mode: 1,
    make_instrumental: 0,
    title: sanitizeTitle(title, job.input.groom, job.input.bride),
    tags: buildStyleTags(`${stylePrompt}, ${job.input.vocalLabel} vocal`),
    prompt: lyrics,
  }

  if (PUBLIC_BASE_URL) {
    payload.callback_url = `${PUBLIC_BASE_URL}/api/suno/callback`
  }

  const data = await requestJson(
    SUNO_GENERATE_URL,
    {
      method: 'POST',
      headers: {
        Authorization: getSunoAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    'Suno',
  )

  const taskId = pickFirstDefined(
    data?.data?.[0]?.task_id,
    data?.data?.[0]?.id,
    data?.data?.task_id,
    data?.data?.taskId,
  )

  // #region debug-point A:create-suno-task
  reportDebugEvent({
    hypothesisId: 'A',
    location: 'web/server/index.mjs:createSunoTask',
    msg: '[DEBUG] Created Suno task from generate API response',
    data: {
      jobId: job.id,
      taskId: String(taskId || ''),
      hasAudioUrl: Boolean(data?.data?.[0]?.audio_url || data?.data?.audio_url || data?.audio_url),
      hasStreamAudioUrl: Boolean(data?.data?.[0]?.stream_audio_url || data?.data?.stream_audio_url || data?.stream_audio_url),
      responseKeys: Object.keys(data || {}).slice(0, 12),
    },
  })
  // #endregion

  if (!taskId) {
    throw new Error('Suno 没有返回 taskId。')
  }

  sunoTaskToJob.set(String(taskId), job.id)
  return String(taskId)
}

function normalizeTracksFromRaw(trackOrTracks) {
  const array = Array.isArray(trackOrTracks)
    ? trackOrTracks
    : trackOrTracks
      ? [trackOrTracks]
      : []

  return array
    .map((track) => {
      const playbackUrl = pickPreferredAudioUrl(
        track?.audio_url,
        track?.audioUrl,
        track?.download_url,
        track?.downloadUrl,
        track?.stream_audio_url,
      )
      const downloadUrl = pickPreferredAudioUrl(
        track?.download_url,
        track?.downloadUrl,
        track?.audio_url,
        track?.audioUrl,
        track?.stream_audio_url,
      )

      return {
        id: String(track?.id || track?.clip_id || track?.task_id || '').trim(),
        title: String(track?.title || '').trim(),
        duration: Number(track?.duration || 0) || 0,
        audioUrl: playbackUrl,
        downloadUrl,
        imageUrl: String(track?.image_url || track?.imageUrl || '').trim(),
        tags: String(track?.tags || '').trim(),
        prompt: String(track?.prompt || track?.text || track?.lyrics || '').trim(),
        modelName: String(track?.model_name || track?.mv || SUNO_MODEL).trim(),
      }
    })
    .filter((track) => track.id || track.audioUrl || track.title)
}

function getNormalizedTaskState(payload) {
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload
  const rawStatus = pickFirstDefined(data?.status, payload?.status)
  const audioUrl = pickPreferredAudioUrl(
    data?.download_url,
    data?.downloadUrl,
    data?.audio_url,
    data?.audioUrl,
    payload?.download_url,
    payload?.downloadUrl,
    payload?.audio_url,
    payload?.audioUrl,
    data?.stream_audio_url,
    payload?.stream_audio_url,
  )
  const state = String(pickFirstDefined(data?.state, payload?.state) || '').trim().toLowerCase()

  if (rawStatus === 3 || rawStatus === '3' || state === 'completed' || audioUrl) {
    return 'ready'
  }

  if (rawStatus === 2 || rawStatus === '2' || state === 'failed') {
    return 'error'
  }

  return 'generating_song'
}

function applySunoStatus(jobId, sunoPayload) {
  const current = jobs.get(jobId)
  if (!current) {
    return null
  }

  const normalizedState = getNormalizedTaskState(sunoPayload)
  const tracks = normalizeTracksFromRaw(sunoPayload?.data ?? sunoPayload?.response?.data ?? sunoPayload)
  const lyrics = String(
    pickFirstDefined(
      sunoPayload?.lyrics,
      sunoPayload?.text,
      sunoPayload?.lyric,
      sunoPayload?.data?.lyrics,
      sunoPayload?.data?.text,
      sunoPayload?.data?.lyric,
    ) || '',
  ).trim()

  // #region debug-point B:apply-suno-status
  reportDebugEvent({
    hypothesisId: 'B',
    location: 'web/server/index.mjs:applySunoStatus',
    msg: '[DEBUG] Normalized Suno payload into track candidates',
    data: {
      jobId,
      normalizedState,
      payloadKeys: Object.keys((sunoPayload && typeof sunoPayload === 'object') ? sunoPayload : {}).slice(0, 12),
      payloadDataType: Array.isArray(sunoPayload?.data) ? 'array' : typeof sunoPayload?.data,
      trackCount: tracks.length,
      firstTrackAudioUrl: tracks[0]?.audioUrl || '',
      firstTrackDownloadUrl: tracks[0]?.downloadUrl || '',
      firstTrackTitle: tracks[0]?.title || '',
      currentStoredAudioUrl: current.tracks?.[0]?.audioUrl || '',
      currentStoredDownloadUrl: current.tracks?.[0]?.downloadUrl || '',
    },
  })
  // #endregion

  if (normalizedState === 'ready') {
    const primaryTrack = tracks[0] ?? null
    return updateJob(jobId, {
      status: 'ready',
      title: primaryTrack?.title || current.title,
      lyrics: current.lyrics || lyrics || null,
      tracks: tracks.length ? tracks : current.tracks,
      error: null,
    })
  }

  if (normalizedState === 'error') {
    return updateJob(jobId, {
      status: 'error',
      error: String(sunoPayload?.msg || sunoPayload?.error || 'Suno 生成失败，请稍后再试。'),
    })
  }

  return updateJob(jobId, {
    status: 'generating_song',
    lyrics: current.lyrics || lyrics || null,
  })
}

async function fetchSunoTask(taskId) {
  const data = await requestJson(
    `${SUNO_FEED_URL}?task_id=${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: getSunoAuthHeader(),
      },
    },
    'Suno 状态查询',
  )

  // #region debug-point A:fetch-suno-task
  reportDebugEvent({
    hypothesisId: 'A',
    location: 'web/server/index.mjs:fetchSunoTask',
    msg: '[DEBUG] Fetched Suno task status payload',
    data: {
      taskId,
      rootKeys: Object.keys(data || {}).slice(0, 12),
      dataKeys: Object.keys((data && typeof data.data === 'object' && !Array.isArray(data.data)) ? data.data : {}).slice(0, 12),
      hasRootAudioUrl: Boolean(data?.audio_url || data?.audioUrl),
      hasRootStreamAudioUrl: Boolean(data?.stream_audio_url),
      hasNestedAudioUrl: Boolean(data?.data?.audio_url || data?.data?.audioUrl),
      hasNestedStreamAudioUrl: Boolean(data?.data?.stream_audio_url),
      nestedType: Array.isArray(data?.data) ? 'array' : typeof data?.data,
    },
  })
  // #endregion

  return data?.data ?? data
}

async function pollSunoTask(jobId, taskId) {
  if (activePolls.has(taskId)) {
    return
  }

  activePolls.add(taskId)

  try {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const statusPayload = await fetchSunoTask(taskId)
      const current = jobs.get(jobId)

      if (!current) {
        break
      }

      const next = applySunoStatus(jobId, statusPayload)

      if (next?.status === 'ready' || next?.status === 'error') {
        break
      }

      await sleep(POLL_INTERVAL_MS)
    }
  } catch (error) {
    updateJob(jobId, {
      status: 'error',
      error: error instanceof Error ? error.message : '轮询 Suno 结果失败。',
    })
  } finally {
    activePolls.delete(taskId)
  }
}

function cleanupJobs() {
  const cutoff = Date.now() - JOB_TTL_MS

  for (const [jobId, job] of jobs.entries()) {
    if (new Date(job.updatedAt).getTime() < cutoff) {
      jobs.delete(jobId)
      if (job.sunoTaskId) {
        sunoTaskToJob.delete(job.sunoTaskId)
      }
    }
  }
}

setInterval(cleanupJobs, 1000 * 60 * 30).unref()

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    callbackEnabled: Boolean(PUBLIC_BASE_URL),
    deepseekConfigured: Boolean(getDeepSeekKey()),
    sunoConfigured: Boolean(getSunoAuthToken()),
    sunoProvider: SUNO_GENERATE_URL,
  })
})

app.post('/api/admin/login', (req, res) => {
  const username = String(req.body?.username || '').trim()
  const password = String(req.body?.password || '').trim()

  if (!username || !password) {
    res.status(400).json({ message: '请填写后台账号和密码。' })
    return
  }

  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    res.status(401).json({ message: '后台账号或密码错误。' })
    return
  }

  const token = crypto.randomUUID()
  const session = {
    token,
    username,
    role: 'super_admin',
    createdAt: nowIso(),
  }

  adminSessions.set(token, session)

  res.json({
    token,
    profile: {
      username,
      role: 'Super Admin',
    },
  })
})

app.get('/api/admin/overview', requireAdminAuth, (_req, res) => {
  const songs = adminData.songs
  const orders = adminData.orders
  const readySongs = songs.filter((item) => item.status === 'ready').length
  const totalRevenue = orders
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)

  res.json({
    profile: _req.adminSession,
    metrics: {
      totalSongs: songs.length,
      readySongs,
      totalOrders: orders.length,
      paidOrders: orders.filter((item) => item.status === 'paid').length,
      totalRevenue,
    },
    latestSongs: songs.slice(0, 8),
    latestOrders: orders.slice(0, 8),
  })
})

app.get('/api/admin/songs', requireAdminAuth, (_req, res) => {
  res.json({
    items: adminData.songs,
  })
})

app.get('/api/admin/songs/:songId', requireAdminAuth, (req, res) => {
  const song = adminData.songs.find((item) => item.id === req.params.songId)

  if (!song) {
    res.status(404).json({ message: '歌曲记录不存在。' })
    return
  }

  res.json(song)
})

app.get('/api/admin/orders', requireAdminAuth, (_req, res) => {
  res.json({
    items: adminData.orders,
  })
})

app.get('/api/admin/orders/:orderId', requireAdminAuth, (req, res) => {
  const order = adminData.orders.find((item) => item.id === req.params.orderId)

  if (!order) {
    res.status(404).json({ message: '订单不存在。' })
    return
  }

  res.json(order)
})

app.patch('/api/admin/orders/:orderId', requireAdminAuth, (req, res) => {
  const orderIndex = adminData.orders.findIndex((item) => item.id === req.params.orderId)

  if (orderIndex === -1) {
    res.status(404).json({ message: '订单不存在。' })
    return
  }

  const current = adminData.orders[orderIndex]
  const patch = req.body && typeof req.body === 'object' ? req.body : {}
  const next = {
    ...current,
    ...patch,
    id: current.id,
  }

  adminData = {
    ...adminData,
    orders: adminData.orders.map((item, index) => (index === orderIndex ? next : item)),
  }
  saveAdminData()
  res.json(next)
})

app.get('/api/admin/config', requireAdminAuth, (_req, res) => {
  res.json(adminData.config)
})

app.patch('/api/admin/config', requireAdminAuth, (req, res) => {
  adminData = {
    ...adminData,
    config: {
      ...adminData.config,
      ...(req.body && typeof req.body === 'object' ? req.body : {}),
    },
  }
  saveAdminData()
  res.json(adminData.config)
})

app.post('/api/generate-song', async (req, res) => {
  if (!getDeepSeekKey()) {
    res.status(500).json({ message: '缺少 DEEPSEEK_API_KEY。' })
    return
  }

  if (!getSunoAuthToken()) {
    res.status(500).json({ message: '缺少 SUNO_AUTH 或 SUNO_API_KEY。' })
    return
  }

  let input

  try {
    input = validateGenerateInput(req.body)
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : '请求参数错误。' })
    return
  }

  const job = createJob(input)

  try {
    updateJob(job.id, { status: 'generating_lyrics' })
    const lyrics = await generateLyrics(input)
    updateJob(job.id, {
      status: 'lyrics_ready',
      title: lyrics.title,
      lyrics: lyrics.lyrics,
      stylePrompt: lyrics.stylePrompt,
    })

    const sunoTaskId = await createSunoTask(job, lyrics)
    updateJob(job.id, {
      status: 'generating_song',
      sunoTaskId,
    })

    if (!PUBLIC_BASE_URL) {
      void pollSunoTask(job.id, sunoTaskId)
    }

    res.json({
      jobId: job.id,
      callbackEnabled: Boolean(PUBLIC_BASE_URL),
    })
  } catch (error) {
    updateJob(job.id, {
      status: 'error',
      error: error instanceof Error ? error.message : '生成失败，请稍后再试。',
    })

    res.status(500).json({
      message: error instanceof Error ? error.message : '生成失败，请稍后再试。',
      jobId: job.id,
    })
  }
})

app.get('/api/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)

  if (!job) {
    res.status(404).json({ message: '任务不存在或已过期。' })
    return
  }

  res.json(job)
})

app.get('/api/member/songs', (req, res) => {
  const email = String(req.query?.email || '').trim().toLowerCase()

  if (!email) {
    res.status(400).json({ message: '缺少会员邮箱。' })
    return
  }

  const items = adminData.songs
    .filter((song) => String(song.email || '').trim().toLowerCase() === email)
    .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())
    .map(mapSongToMemberHistory)

  // #region debug-point E:member-songs-response
  reportDebugEvent({
    hypothesisId: 'E',
    location: 'web/server/index.mjs:/api/member/songs',
    msg: '[DEBUG] Returned member song history items',
    data: {
      email,
      itemCount: items.length,
      firstItemId: items[0]?.id || '',
      firstItemAudioUrl: items[0]?.audioUrl || '',
      firstItemDownloadUrl: items[0]?.downloadUrl || '',
      firstItemStatus: items[0]?.status || '',
    },
  })
  // #endregion

  res.json({ items })
})

app.get('/api/songs/:songId/download', async (req, res) => {
  const songId = String(req.params.songId || '').trim()
  const job = jobs.get(songId)
  const storedSong = adminData.songs.find((item) => item.id === songId)
  const title = job?.title || storedSong?.title || 'MelodyVow Song'
  const sourceUrl = pickPreferredAudioUrl(
    job?.tracks?.[0]?.downloadUrl,
    storedSong?.downloadUrl,
    job?.tracks?.[0]?.audioUrl,
    storedSong?.audioUrl,
  )

  if (!sourceUrl) {
    res.status(404).json({ message: '当前歌曲还没有可下载的音频链接。' })
    return
  }

  try {
    const upstream = await fetch(sourceUrl)
    if (!upstream.ok) {
      throw new Error(`音频源响应异常: ${upstream.status}`)
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mpeg'
    const extension = guessAudioExtension(sourceUrl, contentType)
    const filename = `${sanitizeDownloadFilename(title)}.${extension}`
    const buffer = Buffer.from(await upstream.arrayBuffer())

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', String(buffer.length))
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`)
    res.end(buffer)
  } catch (error) {
    res.status(502).json({
      message: error instanceof Error ? error.message : '音频下载失败，请稍后再试。',
    })
  }
})

app.post('/api/suno/callback', (req, res) => {
  const payload = req.body && typeof req.body === 'object' ? req.body : {}
  const taskId = String(
    pickFirstDefined(
      payload?.taskId,
      payload?.task_id,
      payload?.data?.taskId,
      payload?.data?.task_id,
    ) || '',
  ).trim()

  if (!taskId) {
    res.status(400).json({ ok: false, message: '缺少 taskId。' })
    return
  }

  const jobId = sunoTaskToJob.get(taskId)
  if (!jobId) {
    res.json({ ok: true })
    return
  }

  applySunoStatus(jobId, payload)
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`MelodyVow API server listening on http://127.0.0.1:${PORT}`)
})
