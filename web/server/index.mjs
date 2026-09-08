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
const memberSessions = new Map()

const productShowcaseTracks = [
  {
    id: 'showcase-soft-pop',
    title: { zh: '爱的誓言', en: 'Our Vow in Melody' },
    meta: {
      zh: '婚礼样片 · 温柔流行 · 女声',
      en: 'Wedding Demo · Soft Pop · Female Vocal',
    },
    blurb: {
      zh: '适合婚礼开场与仪式入场，旋律温柔、情绪稳定。',
      en: 'Ideal for ceremony entrances with a soft and uplifting mood.',
    },
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  },
  {
    id: 'showcase-cinematic',
    title: { zh: '星光告白', en: 'Starlight Promise' },
    meta: {
      zh: '求婚样片 · 电影配乐感 · 男女对唱',
      en: 'Proposal Demo · Cinematic · Duet',
    },
    blurb: {
      zh: '更适合求婚视频和情绪递进场景，层次感更强。',
      en: 'Built for proposal videos with a more cinematic emotional arc.',
    },
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  },
  {
    id: 'showcase-folk',
    title: { zh: '把名字写成歌', en: 'Your Names as a Song' },
    meta: {
      zh: '婚礼样片 · 清新民谣 · 男声',
      en: 'Wedding Demo · Folk Pop · Male Vocal',
    },
    blurb: {
      zh: '适合婚礼暖场、成长回顾和轻松互动环节播放。',
      en: 'A lighter folk-pop demo for warm-up moments and story recaps.',
    },
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  },
]

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-token, x-member-token')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')

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

function normalizePositiveNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function getDefaultHeartBeansForPlan(input) {
  const key = `${String(input?.id || '').trim()} ${String(input?.name || '').trim()}`.toLowerCase()

  if (key.includes('starter')) {
    return 5
  }

  if (key.includes('premium')) {
    return 40
  }

  if (key.includes('pro')) {
    return 15
  }

  return 0
}

function createDefaultAdminData() {
  return {
    members: [],
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        price: 89,
        heartBeans: 5,
        currency: 'CNY',
        badge: '',
        features: ['5 点订阅服务额度', 'AI 歌词生成', '名字入歌', 'MP3 下载'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: 199,
        heartBeans: 15,
        currency: 'CNY',
        badge: '推荐',
        features: ['15 点订阅服务额度', '完整歌词', '婚礼版本', '高清音频'],
      },
      {
        id: 'premium',
        name: 'Premium',
        price: 499,
        heartBeans: 40,
        currency: 'CNY',
        badge: '',
        features: ['40 点订阅服务额度', '真人演唱', '高级编曲', '双版本混音'],
      },
    ],
    showcaseTracks: productShowcaseTracks,
    paymentMethods: [
      {
        id: 'paypal',
        name: 'PayPal',
        enabled: true,
        envKey: 'PAYPAL_CHECKOUT_URL',
        description: 'PayPal Checkout',
      },
      {
        id: 'alipay',
        name: '支付宝',
        enabled: false,
        envKey: 'ALIPAY_CHECKOUT_URL',
        description: 'Alipay payment link',
      },
    ],
    orders: [
      {
        id: 'ord-demo-001',
        couple: 'Hao & Xin',
        plan: 'Pro',
        amount: 199,
        heartBeans: 15,
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
        heartBeans: 40,
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
      heartBeansPerGeneration: 1,
      paypalCheckoutUrl: '',
      notes: '后台 MVP 阶段使用本地 JSON 持久化，后续可直接迁移到数据库。',
    },
  }
}

function loadAdminData() {
  ensureDataDir()
  const defaults = createDefaultAdminData()

  if (!fs.existsSync(ADMIN_DATA_FILE)) {
    const initialData = defaults
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8')
    return initialData
  }

  try {
    const raw = fs.readFileSync(ADMIN_DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      ...defaults,
      ...parsed,
      members: Array.isArray(parsed?.members)
        ? parsed.members.map((member) => ({
            ...member,
            email: String(member?.email || '').trim().toLowerCase(),
            heartBeansBalance: normalizePositiveNumber(member?.heartBeansBalance, 0),
          }))
        : [],
      plans: Array.isArray(parsed?.plans) && parsed.plans.length
        ? parsed.plans.map((plan) => ({
            ...plan,
            id: String(plan?.id || ''),
            name: String(plan?.name || ''),
            price: normalizePositiveNumber(plan?.price, 0),
            heartBeans: normalizePositiveNumber(plan?.heartBeans, getDefaultHeartBeansForPlan(plan)),
            currency: String(plan?.currency || 'CNY'),
            badge: String(plan?.badge || ''),
            features: Array.isArray(plan?.features) ? plan.features.map((item) => String(item || '').trim()).filter(Boolean) : [],
          }))
        : defaults.plans,
      showcaseTracks: Array.isArray(parsed?.showcaseTracks) && parsed.showcaseTracks.length ? parsed.showcaseTracks : defaults.showcaseTracks,
      paymentMethods: Array.isArray(parsed?.paymentMethods) && parsed.paymentMethods.length ? parsed.paymentMethods : defaults.paymentMethods,
      orders: Array.isArray(parsed?.orders)
        ? parsed.orders.map((order) => ({
            ...order,
            heartBeans: normalizePositiveNumber(order?.heartBeans, getDefaultHeartBeansForPlan({ name: order?.plan })),
            heartBeansGrantedAt: String(order?.heartBeansGrantedAt || '').trim(),
          }))
        : createDefaultAdminData().orders,
      songs: Array.isArray(parsed?.songs) ? parsed.songs : [],
      config: {
        ...defaults.config,
        ...(parsed?.config ?? {}),
        heartBeansPerGeneration: normalizePositiveNumber(parsed?.config?.heartBeansPerGeneration, defaults.config.heartBeansPerGeneration),
      },
    }
  } catch {
    const fallback = defaults
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(fallback, null, 2), 'utf8')
    return fallback
  }
}

let adminData = loadAdminData()

function saveAdminData() {
  ensureDataDir()
  fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(adminData, null, 2), 'utf8')
}

function getPaymentCheckoutUrl(method) {
  const envKey = String(method?.envKey || '').trim()
  const fromEnv = envKey ? String(process.env[envKey] || '').trim() : ''
  if (fromEnv) {
    return fromEnv
  }

  if (String(method?.id || '').trim() === 'paypal') {
    return String(adminData.config.paypalCheckoutUrl || '').trim()
  }

  return ''
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
  const sourceAudioUrl = pickPreferredAudioUrl(job.tracks?.[0]?.sourceAudioUrl)
  const sourceDownloadUrl = pickPreferredAudioUrl(job.tracks?.[0]?.sourceDownloadUrl)
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
    sourceAudioUrl,
    sourceDownloadUrl,
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
      firstTrackSourceAudioUrl: job.tracks?.[0]?.sourceAudioUrl || '',
      firstTrackSourceDownloadUrl: job.tracks?.[0]?.sourceDownloadUrl || '',
      persistedAudioUrl: entry.audioUrl,
      persistedDownloadUrl: entry.downloadUrl,
      persistedSourceAudioUrl: entry.sourceAudioUrl,
      persistedSourceDownloadUrl: entry.sourceDownloadUrl,
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

function readMemberToken(req) {
  const header = req.headers['x-member-token']
  if (Array.isArray(header)) {
    return header[0] || ''
  }

  return String(header || '')
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function findMemberByEmail(email) {
  const normalizedEmail = normalizeEmail(email)
  return adminData.members.find((item) => normalizeEmail(item.email) === normalizedEmail) || null
}

function upsertMember(member) {
  const nextMember = {
    ...member,
    email: normalizeEmail(member.email),
    heartBeansBalance: normalizePositiveNumber(member.heartBeansBalance, 0),
  }

  adminData = {
    ...adminData,
    members: [nextMember, ...adminData.members.filter((item) => normalizeEmail(item.email) !== normalizeEmail(member.email))].slice(0, 5000),
  }
  saveAdminData()
}

function awardHeartBeansToMember(email, amount, planName) {
  const normalizedEmail = normalizeEmail(email)
  const heartBeans = normalizePositiveNumber(amount, 0)

  if (!normalizedEmail || heartBeans <= 0) {
    return null
  }

  const member = findMemberByEmail(normalizedEmail) || { email: normalizedEmail }
  const nextMember = {
    ...member,
    email: normalizedEmail,
    plan: String(planName || member.plan || '').trim(),
    heartBeansBalance: normalizePositiveNumber(member.heartBeansBalance, 0) + heartBeans,
    updatedAt: nowIso(),
  }

  upsertMember(nextMember)
  return nextMember
}

function refundHeartBeansToMember(member, amount) {
  const heartBeans = normalizePositiveNumber(amount, 0)
  const currentBalance = normalizePositiveNumber(member?.heartBeansBalance, 0)

  if (heartBeans <= 0) {
    return {
      ...member,
      heartBeansBalance: currentBalance,
    }
  }

  const nextMember = {
    ...member,
    heartBeansBalance: currentBalance + heartBeans,
    updatedAt: nowIso(),
  }

  upsertMember(nextMember)
  return nextMember
}

function consumeHeartBeansFromMember(member, amount) {
  const heartBeans = normalizePositiveNumber(amount, 0)
  const currentBalance = normalizePositiveNumber(member?.heartBeansBalance, 0)

  if (heartBeans <= 0) {
    return {
      ...member,
      heartBeansBalance: currentBalance,
    }
  }

  if (currentBalance < heartBeans) {
    throw new Error(`订阅服务额度不足：当前剩余 ${currentBalance}，本次需要 ${heartBeans}。`)
  }

  const nextMember = {
    ...member,
    heartBeansBalance: currentBalance - heartBeans,
    updatedAt: nowIso(),
  }

  upsertMember(nextMember)
  return nextMember
}

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, storedValue) {
  const raw = String(storedValue || '').trim()
  if (!raw) {
    return false
  }

  const [salt, storedHash] = raw.split(':')
  if (!salt || !storedHash) {
    return false
  }

  const storedBuffer = Buffer.from(storedHash, 'hex')
  const derivedBuffer = crypto.scryptSync(password, salt, storedBuffer.length)
  return storedBuffer.length === derivedBuffer.length && crypto.timingSafeEqual(storedBuffer, derivedBuffer)
}

function createMemberSession(member) {
  const token = crypto.randomUUID()
  const session = {
    token,
    email: normalizeEmail(member.email),
    createdAt: nowIso(),
  }

  memberSessions.set(token, session)

  return {
    token,
    profile: {
      email: normalizeEmail(member.email),
      partnerName: String(member.partnerName || '').trim(),
      plan: String(member.plan || '').trim(),
      heartBeansBalance: normalizePositiveNumber(member.heartBeansBalance, 0),
      lastAuthAt: member.lastAuthAt || nowIso(),
      avatarUrl: String(member.avatarUrl || '').trim(),
    },
  }
}

function requireMemberAuth(req, res, next) {
  const token = readMemberToken(req)
  const session = token ? memberSessions.get(token) : null

  if (!session) {
    res.status(401).json({ message: '会员登录已失效，请重新登录。' })
    return
  }

  const member = findMemberByEmail(session.email)
  if (!member) {
    memberSessions.delete(token)
    res.status(401).json({ message: '会员账号不存在，请重新登录。' })
    return
  }

  if (member.disabled) {
    memberSessions.delete(token)
    res.status(403).json({ message: '该会员账号已被禁用，请联系管理员。' })
    return
  }

  req.memberSession = session
  req.member = member
  next()
}

function getValidMemberFromToken(token) {
  const session = token ? memberSessions.get(token) : null
  if (!session) {
    return { session: null, member: null, error: '请先登录会员后再继续。', status: 401 }
  }

  const member = findMemberByEmail(session.email)
  if (!member) {
    memberSessions.delete(token)
    return { session: null, member: null, error: '会员账号不存在，请重新登录。', status: 401 }
  }

  if (member.disabled) {
    memberSessions.delete(token)
    return { session: null, member: null, error: '该会员账号已被禁用，请联系管理员。', status: 403 }
  }

  return { session, member, error: '', status: 200 }
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

  return candidates.find((value) => !isExpiredSunoStreamUrl(value)) || ''
}

function getObjectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function buildSunoCallbackPayload(req) {
  const queryPayload = getObjectValue(req.query)
  const bodyPayload = getObjectValue(req.body)
  const nestedQuery = {
    ...getObjectValue(bodyPayload.queryStringParameters),
    ...getObjectValue(bodyPayload.query),
    ...getObjectValue(bodyPayload.params),
  }

  return {
    ...queryPayload,
    ...nestedQuery,
    ...bodyPayload,
  }
}

function handleSunoCallback(req, res) {
  const payload = buildSunoCallbackPayload(req)
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
    sourceAudioUrl: pickPreferredAudioUrl(song.sourceAudioUrl, song.audioUrl),
    sourceDownloadUrl: pickPreferredAudioUrl(song.sourceDownloadUrl, song.downloadUrl),
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
      const sourceAudioUrl = pickPreferredAudioUrl(track?.audio_url, track?.audioUrl)
      const sourceDownloadUrl = pickPreferredAudioUrl(track?.download_url, track?.downloadUrl)
      const playbackUrl = pickPreferredAudioUrl(sourceAudioUrl, sourceDownloadUrl)
      const downloadUrl = pickPreferredAudioUrl(sourceDownloadUrl, sourceAudioUrl)

      return {
        id: String(track?.id || track?.clip_id || track?.task_id || '').trim(),
        title: String(track?.title || '').trim(),
        duration: Number(track?.duration || 0) || 0,
        audioUrl: playbackUrl,
        downloadUrl,
        sourceAudioUrl,
        sourceDownloadUrl,
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

app.post('/api/member/signup', (req, res) => {
  if (!adminData.config.allowSignup) {
    res.status(403).json({ message: '当前暂未开放会员注册，请联系管理员。' })
    return
  }

  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '').trim()
  const partnerName = String(req.body?.partnerName || '').trim()

  if (!email) {
    res.status(400).json({ message: '请先填写邮箱。' })
    return
  }

  if (!password) {
    res.status(400).json({ message: '请先填写密码。' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ message: '密码至少需要 6 位。' })
    return
  }

  if (!partnerName) {
    res.status(400).json({ message: '注册时请填写伴侣姓名。' })
    return
  }

  const existing = findMemberByEmail(email)
  if (existing?.disabled) {
    res.status(403).json({ message: '该会员账号已被禁用，请联系管理员。' })
    return
  }

  if (existing?.passwordHash) {
    res.status(409).json({ message: '该邮箱已注册，请直接登录。' })
    return
  }

  const timestamp = nowIso()
  const nextMember = {
    ...existing,
    email,
    partnerName,
    passwordHash: createPasswordHash(password),
    heartBeansBalance: normalizePositiveNumber(existing?.heartBeansBalance, 0),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    lastAuthAt: timestamp,
    disabled: false,
  }

  upsertMember(nextMember)
  res.status(existing ? 200 : 201).json(createMemberSession(nextMember))
})

app.post('/api/member/login', (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '').trim()

  if (!email) {
    res.status(400).json({ message: '请先填写邮箱。' })
    return
  }

  if (!password) {
    res.status(400).json({ message: '请先填写密码。' })
    return
  }

  const member = findMemberByEmail(email)
  if (!member || !String(member.passwordHash || '').trim()) {
    res.status(401).json({ message: '该邮箱尚未注册，请先创建会员账户。' })
    return
  }

  if (member.disabled) {
    res.status(403).json({ message: '该会员账号已被禁用，请联系管理员。' })
    return
  }

  if (!verifyPassword(password, member.passwordHash)) {
    res.status(401).json({ message: '邮箱或密码错误。' })
    return
  }

  const nextMember = {
    ...member,
    lastAuthAt: nowIso(),
    updatedAt: nowIso(),
  }

  upsertMember(nextMember)
  res.json(createMemberSession(nextMember))
})

app.get('/api/member/session', requireMemberAuth, (req, res) => {
  res.json({
    email: normalizeEmail(req.member.email),
    partnerName: String(req.member.partnerName || '').trim(),
    plan: String(req.member.plan || '').trim(),
    heartBeansBalance: normalizePositiveNumber(req.member.heartBeansBalance, 0),
    lastAuthAt: req.member.lastAuthAt || '',
    avatarUrl: String(req.member.avatarUrl || '').trim(),
  })
})

app.post('/api/member/logout', requireMemberAuth, (req, res) => {
  memberSessions.delete(readMemberToken(req))
  res.json({ ok: true })
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
  const nextStatus = String(patch.status || current.status || '').trim()
  const currentStatus = String(current.status || '').trim()
  const nextEmail = normalizeEmail(patch.email || current.email)
  const nextPlan = String(patch.plan || current.plan || '').trim()
  const nextHeartBeans = normalizePositiveNumber(patch.heartBeans, normalizePositiveNumber(current.heartBeans, getDefaultHeartBeansForPlan({ name: nextPlan })))
  const next = {
    ...current,
    ...patch,
    id: current.id,
    email: nextEmail,
    plan: nextPlan,
    heartBeans: nextHeartBeans,
  }
  const hasGrantedBefore = Boolean(String(current.heartBeansGrantedAt || '').trim())

  if (currentStatus !== 'paid' && nextStatus === 'paid' && !hasGrantedBefore) {
    if (!nextEmail) {
      res.status(400).json({ message: '订单缺少会员邮箱，无法发放订阅服务额度。' })
      return
    }

    awardHeartBeansToMember(nextEmail, nextHeartBeans, nextPlan)
    next.heartBeansGrantedAt = nowIso()
  }

  if (currentStatus === 'paid' && (nextStatus === 'cancelled' || nextStatus === 'refunded')) {
    if (!hasGrantedBefore) {
      res.status(400).json({ message: '当前订单尚未发放订阅服务额度，无需回收。' })
      return
    }

    const member = findMemberByEmail(nextEmail)
    if (!member) {
      res.status(400).json({ message: '会员不存在，无法回收已发放的订阅服务额度。' })
      return
    }

    const currentBalance = normalizePositiveNumber(member.heartBeansBalance, 0)
    if (currentBalance < nextHeartBeans) {
      res.status(400).json({ message: `会员当前仅剩 ${currentBalance} 点服务额度，无法回收该订单的 ${nextHeartBeans} 点服务额度。` })
      return
    }

    consumeHeartBeansFromMember(member, nextHeartBeans)
    next.heartBeansGrantedAt = ''
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
  const patch = req.body && typeof req.body === 'object' ? req.body : {}
  adminData = {
    ...adminData,
    config: {
      ...adminData.config,
      ...patch,
      heartBeansPerGeneration: normalizePositiveNumber(patch.heartBeansPerGeneration, adminData.config.heartBeansPerGeneration),
    },
  }
  saveAdminData()
  res.json(adminData.config)
})

app.get('/api/plans', (_req, res) => {
  res.json({ items: adminData.plans })
})

app.get('/api/showcase/tracks', (_req, res) => {
  const items = adminData.showcaseTracks.length ? adminData.showcaseTracks : productShowcaseTracks
  res.json({ items })
})

app.get('/api/payment/methods', (_req, res) => {
  const items = adminData.paymentMethods
    .filter((method) => Boolean(method?.enabled))
    .map((method) => ({
      id: String(method.id || ''),
      name: String(method.name || ''),
      description: String(method.description || ''),
    }))
  res.json({ items })
})

app.post('/api/orders/lookup', (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const orderId = String(req.body?.orderId || '').trim()
  const memberToken = readMemberToken(req)
  const session = memberToken ? memberSessions.get(memberToken) : null
  const member = session ? findMemberByEmail(session.email) : null
  const authenticatedEmail = member && !member.disabled ? normalizeEmail(member.email) : ''

  if (!email) {
    res.status(400).json({ message: '请输入下单邮箱。' })
    return
  }

  if (authenticatedEmail !== email && !orderId) {
    res.status(400).json({ message: '未登录查询时，请同时填写订单号。' })
    return
  }

  const items = adminData.orders
    .filter((order) => {
      const orderEmail = normalizeEmail(order.email)
      if (orderEmail !== email) {
        return false
      }

      if (authenticatedEmail === email) {
        return true
      }

      return String(order.id || '').trim() === orderId
    })
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .map((order) => {
      const method = adminData.paymentMethods.find((item) => String(item.id || '').trim() === String(order.paymentMethod || '').trim())
      return {
        id: String(order.id || '').trim(),
        plan: String(order.plan || '').trim(),
        amount: normalizePositiveNumber(order.amount, 0),
        status: String(order.status || '').trim(),
        createdAt: String(order.createdAt || '').trim(),
        paymentMethod: String(method?.name || order.paymentMethod || '').trim(),
        note: String(order.note || '').trim(),
      }
    })

  if (!items.length) {
    res.status(404).json({ message: '没有找到匹配的订单记录，请确认邮箱和订单号是否正确。' })
    return
  }

  res.json({
    items,
    authenticated: authenticatedEmail === email,
  })
})

app.post('/api/payment/create-order', (req, res) => {
  const planId = String(req.body?.planId || '').trim()
  const methodId = String(req.body?.methodId || '').trim()
  const memberToken = readMemberToken(req)
  const { session: memberSession, error, status } = getValidMemberFromToken(memberToken)

  if (!memberSession) {
    res.status(status).json({ message: error })
    return
  }

  const email = normalizeEmail(memberSession.email)
  const plan = adminData.plans.find((item) => String(item.id) === planId) || null
  if (!plan) {
    res.status(400).json({ message: '套餐不存在。' })
    return
  }

  const method = adminData.paymentMethods.find((item) => String(item.id) === methodId && Boolean(item.enabled)) || null
  if (!method) {
    res.status(400).json({ message: '支付方式不可用。' })
    return
  }

  const checkoutUrl = getPaymentCheckoutUrl(method)
  if (!checkoutUrl) {
    res.status(400).json({ message: '该支付方式未配置收款链接。' })
    return
  }

  const orderId = `ord-${crypto.randomUUID()}`
  const nextOrder = {
    id: orderId,
    couple: '',
    plan: plan.name,
    amount: plan.price,
    heartBeans: normalizePositiveNumber(plan.heartBeans, getDefaultHeartBeansForPlan(plan)),
    status: 'pending',
    email,
    note: `${method.name} checkout`,
    paymentMethod: method.id,
    createdAt: nowIso(),
  }
  adminData = {
    ...adminData,
    orders: [nextOrder, ...adminData.orders].slice(0, 5000),
  }
  saveAdminData()
  res.json({ orderId, checkoutUrl })
})

app.get('/api/admin/payment-methods', requireAdminAuth, (_req, res) => {
  res.json({ items: adminData.paymentMethods })
})

app.put('/api/admin/payment-methods', requireAdminAuth, (req, res) => {
  const items = req.body && typeof req.body === 'object' ? req.body.items : null
  if (!Array.isArray(items)) {
    res.status(400).json({ message: 'paymentMethods.items 格式不正确。' })
    return
  }

  adminData = {
    ...adminData,
    paymentMethods: items,
  }
  saveAdminData()
  res.json({ items: adminData.paymentMethods })
})

app.get('/api/admin/members', requireAdminAuth, (_req, res) => {
  const lookup = new Map()

  adminData.songs.forEach((song) => {
    const email = String(song.email || '').trim().toLowerCase()
    if (!email) {
      return
    }

    const existing = lookup.get(email) || { email, plan: '', songs: 0, lastSeenAt: '' }
    const nextLast = song.updatedAt || song.createdAt || ''
    const nextLastSeenAt = !existing.lastSeenAt || new Date(nextLast).getTime() > new Date(existing.lastSeenAt).getTime()
      ? nextLast
      : existing.lastSeenAt

    lookup.set(email, {
      ...existing,
      songs: Number(existing.songs || 0) + 1,
      lastSeenAt: nextLastSeenAt,
    })
  })

  adminData.orders.forEach((order) => {
    const email = String(order.email || '').trim().toLowerCase()
    if (!email) {
      return
    }

    const existing = lookup.get(email) || { email, plan: '', songs: 0, lastSeenAt: '' }
    const createdAt = order.createdAt || ''
    const nextLastSeenAt = !existing.lastSeenAt || (createdAt && new Date(createdAt).getTime() > new Date(existing.lastSeenAt).getTime())
      ? createdAt
      : existing.lastSeenAt

    lookup.set(email, {
      ...existing,
      plan: order.status === 'paid' ? order.plan || existing.plan || '' : existing.plan || '',
      lastSeenAt: nextLastSeenAt,
    })
  })

  adminData.members.forEach((member) => {
    const email = String(member.email || '').trim().toLowerCase()
    if (!email) {
      return
    }

    const existing = lookup.get(email) || { email, plan: '', songs: 0, lastSeenAt: '' }
    lookup.set(email, {
      ...existing,
      ...member,
      email,
      plan: member.plan || existing.plan || '',
      lastSeenAt: member.lastAuthAt || existing.lastSeenAt || '',
    })
  })

  const items = Array.from(lookup.values())
    .sort((left, right) => new Date(right.lastSeenAt || 0).getTime() - new Date(left.lastSeenAt || 0).getTime())

  res.json({ items })
})

app.patch('/api/admin/members/:email', requireAdminAuth, (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase()
  if (!email) {
    res.status(400).json({ message: '缺少会员邮箱。' })
    return
  }

  const patch = req.body && typeof req.body === 'object' ? req.body : {}
  const current = adminData.members.find((item) => String(item.email || '').trim().toLowerCase() === email) || { email }
  const next = {
    ...current,
    ...patch,
    email,
  }

  adminData = {
    ...adminData,
    members: [next, ...adminData.members.filter((item) => String(item.email || '').trim().toLowerCase() !== email)].slice(0, 5000),
  }
  saveAdminData()
  res.json(next)
})

app.get('/api/admin/plans', requireAdminAuth, (_req, res) => {
  res.json({ items: adminData.plans })
})

app.put('/api/admin/plans', requireAdminAuth, (req, res) => {
  const items = req.body && typeof req.body === 'object' ? req.body.items : null
  if (!Array.isArray(items)) {
    res.status(400).json({ message: 'plans.items 格式不正确。' })
    return
  }

  adminData = {
    ...adminData,
    plans: items,
  }
  saveAdminData()
  res.json({ items: adminData.plans })
})

app.get('/api/admin/showcase-tracks', requireAdminAuth, (_req, res) => {
  res.json({ items: adminData.showcaseTracks })
})

app.put('/api/admin/showcase-tracks', requireAdminAuth, (req, res) => {
  const items = req.body && typeof req.body === 'object' ? req.body.items : null
  if (!Array.isArray(items)) {
    res.status(400).json({ message: 'showcaseTracks.items 格式不正确。' })
    return
  }

  adminData = {
    ...adminData,
    showcaseTracks: items,
  }
  saveAdminData()
  res.json({ items: adminData.showcaseTracks })
})

app.patch('/api/admin/songs/:songId', requireAdminAuth, (req, res) => {
  const songIndex = adminData.songs.findIndex((item) => item.id === req.params.songId)
  if (songIndex === -1) {
    res.status(404).json({ message: '歌曲记录不存在。' })
    return
  }

  const current = adminData.songs[songIndex]
  const patch = req.body && typeof req.body === 'object' ? req.body : {}
  const next = {
    ...current,
    ...patch,
    id: current.id,
  }

  adminData = {
    ...adminData,
    songs: adminData.songs.map((item, index) => (index === songIndex ? next : item)),
  }
  saveAdminData()
  res.json(next)
})

app.delete('/api/admin/songs/:songId', requireAdminAuth, (req, res) => {
  const songId = String(req.params.songId || '').trim()
  const exists = adminData.songs.some((item) => item.id === songId)
  if (!exists) {
    res.status(404).json({ message: '歌曲记录不存在。' })
    return
  }

  adminData = {
    ...adminData,
    songs: adminData.songs.filter((item) => item.id !== songId),
  }
  saveAdminData()
  res.json({ ok: true })
})

app.post('/api/paypal/create-order', (req, res) => {
  const planId = String(req.body?.planId || '').trim()
  const memberToken = readMemberToken(req)
  const { session: memberSession, error, status } = getValidMemberFromToken(memberToken)

  if (!memberSession) {
    res.status(status).json({ message: error })
    return
  }

  const email = normalizeEmail(memberSession.email)
  const plan = adminData.plans.find((item) => String(item.id) === planId) || null
  if (!plan) {
    res.status(400).json({ message: '套餐不存在。' })
    return
  }

  const method = adminData.paymentMethods.find((item) => String(item.id) === 'paypal') || {
    id: 'paypal',
    name: 'PayPal',
    enabled: true,
    envKey: 'PAYPAL_CHECKOUT_URL',
    description: 'PayPal Checkout',
  }
  const checkoutUrl = getPaymentCheckoutUrl(method)
  if (!checkoutUrl) {
    res.status(400).json({ message: '未配置 PayPal 收费链接。' })
    return
  }

  const orderId = `ord-${crypto.randomUUID()}`
  const nextOrder = {
    id: orderId,
    couple: '',
    plan: plan.name,
    amount: plan.price,
    heartBeans: normalizePositiveNumber(plan.heartBeans, getDefaultHeartBeansForPlan(plan)),
    status: 'pending',
    email,
    note: 'PayPal checkout',
    paymentMethod: 'paypal',
    createdAt: nowIso(),
  }
  adminData = {
    ...adminData,
    orders: [nextOrder, ...adminData.orders].slice(0, 5000),
  }
  saveAdminData()
  res.json({ orderId, checkoutUrl })
})

app.post('/api/generate-song', async (req, res) => {
  const memberToken = readMemberToken(req)
  const { session: memberSession, member, error, status } = getValidMemberFromToken(memberToken)

  if (!memberSession) {
    res.status(status).json({ message: error })
    return
  }

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
    input = validateGenerateInput({
      ...req.body,
      userEmail: memberSession.email,
    })
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : '请求参数错误。' })
    return
  }

  const heartBeansPerGeneration = normalizePositiveNumber(adminData.config.heartBeansPerGeneration, 1)
  let debitedMember = null

  try {
    debitedMember = consumeHeartBeansFromMember(member, heartBeansPerGeneration)
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : '订阅服务额度不足。' })
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
    if (debitedMember) {
      refundHeartBeansToMember(debitedMember, heartBeansPerGeneration)
    }

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

app.get('/api/member/songs', requireMemberAuth, (req, res) => {
  const email = normalizeEmail(req.member.email)

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

  res.setHeader('Cache-Control', 'no-store')
  res.redirect(302, sourceUrl)
})

app.get('/api/suno/callback', handleSunoCallback)
app.post('/api/suno/callback', handleSunoCallback)

app.listen(PORT, () => {
  console.log(`MelodyVow API server listening on http://127.0.0.1:${PORT}`)
})
