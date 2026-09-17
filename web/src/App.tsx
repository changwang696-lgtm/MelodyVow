import { Fragment, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, PointerEvent as ReactPointerEvent, ReactNode, SetStateAction } from 'react'
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import confetti from 'canvas-confetti'
import './App.css'
import coupleImage from '../images/01.png'
import recordImage from '../images/02.png'
import pinkHeartImage from '../images/03.png'
import blueHeartImage from '../images/04.png'
import purpleRibbonImage from '../images/05.png'
import pinkRibbonImage from '../images/06.png'
import tealRibbonImage from '../images/07.png'
import goldRibbonImage from '../images/08.png'
import noteImage from '../images/09.png'
import sparkImage from '../images/10.png'
import heroTitleImage from '../images/11.png'
import phoneDiscImage from '../images/12.png'
import { songLanguages } from './data/songLanguages'
import { styleCollectionOptions, styleCollectionsByStyleId, vocalOptions, weddingStyleOptions } from './data/weddingMusicOptions'
import type { StyleCollectionId, WeddingStyleOption } from './data/weddingMusicOptions'
import { readJsonSafe } from './readJsonSafe'

type Locale = 'zh' | 'en'
type Occasion = 'wedding' | 'proposal'

type SongDraft = {
  groom: string
  bride: string
  occasion: Occasion
  languageCode: string
  languageLabel: string
  style: string
  vocal: string
  vocalLabel: string
  loveStory: string
  meetingStory: string
  vowKeywords: string
}

type GenerationStatus =
  | 'queued'
  | 'generating_lyrics'
  | 'lyrics_ready'
  | 'generating_song'
  | 'ready'
  | 'error'

type SongTrack = {
  id: string
  title: string
  duration: number
  audioUrl: string
  downloadUrl: string
  imageUrl: string
  tags: string
  prompt: string
  modelName: string
}

type SongJob = {
  id: string
  status: GenerationStatus
  createdAt: string
  updatedAt: string
  error: string | null
  input: {
    groom: string
    bride: string
    userEmail?: string
    occasion?: Occasion
    style: string
    languageCode: string
    languageLabel: string
    vocal: string
    vocalLabel: string
    loveStory?: string
    meetingStory?: string
    vowKeywords?: string
  }
  title: string | null
  lyrics: string | null
  stylePrompt: string | null
  sunoTaskId: string | null
  callbackEnabled: boolean
  tracks: SongTrack[]
}

type Copy = {
  zh: string
  en: string
}

type BackgroundThemeId =
  | 'vivid_rainbow'
  | 'elegant_dark'
  | 'auto_beijing'

type ResolvedBackgroundThemeId =
  | 'vivid_rainbow'
  | 'elegant_dark'

type HistoryItem = {
  id: string
  title: string
  subtitle: string
  status: string
  rawStatus?: string
  action: string
  jobId?: string
  trackCount?: number
  trackIndex?: number
  variantLabel?: string
  audioUrl?: string
  downloadUrl?: string
  sourceAudioUrl?: string
  sourceDownloadUrl?: string
  createdAt?: string
  languageLabel?: string
  styleLabel?: string
  vocalLabel?: string
  lyricSnippet?: string
  lyrics?: string
}

type AuthSession = {
  authToken: string
  email: string
  partnerName: string
  plan: string
  heartBeansBalance?: number
  topupHeartBeansBalance?: number
  subscriptionHeartBeansBalance?: number
  subscriptionStatus?: string
  subscriptionPlanId?: string
  subscriptionCurrentPeriodEnd?: string
  stripeCustomerId?: string
  paypalSubscriptionId?: string
  subscriptionProvider?: 'stripe' | 'paypal' | ''
  mode: 'login' | 'signup'
  welcomeMessage: string
  lastAuthAt: string
  avatarUrl?: string
}

type MemberProfile = {
  email: string
  partnerName: string
  plan: string
  heartBeansBalance?: number
  topupHeartBeansBalance?: number
  subscriptionHeartBeansBalance?: number
  subscriptionStatus?: string
  subscriptionPlanId?: string
  subscriptionCurrentPeriodEnd?: string
  stripeCustomerId?: string
  paypalSubscriptionId?: string
  subscriptionProvider?: 'stripe' | 'paypal' | ''
  lastAuthAt: string
  avatarUrl?: string
}

type MemberAuthResponse = {
  token: string
  profile: MemberProfile
}

type AdminSession = {
  token: string
  profile: {
    username: string
    role: string
  }
}

type AdminSong = {
  id: string
  jobId?: string
  trackId?: string
  trackIndex?: number
  trackCount?: number
  variantLabel?: string
  title: string
  couple: string
  email?: string
  languageLabel: string
  styleLabel: string
  vocalLabel: string
  status: string
  createdAt: string
  updatedAt: string
  audioUrl?: string
  downloadUrl?: string
  sourceAudioUrl?: string
  sourceDownloadUrl?: string
  lyricSnippet?: string
  lyrics?: string
  error?: string
  story?: {
    loveStory?: string
    meetingStory?: string
    vowKeywords?: string
  }
}

type AdminOrder = {
  id: string
  couple: string
  planId?: string
  plan: string
  planType?: 'subscription' | 'credit_pack'
  amount: number
  heartBeans?: number
  creditsBalanceType?: 'subscription' | 'topup'
  heartBeansGrantedAt?: string
  status: string
  createdAt: string
  email?: string
  paymentMethod?: string
  source?: string
  mode?: string
  stripeCheckoutSessionId?: string
  stripeCustomerId?: string
  stripePaymentIntentId?: string
  stripeInvoiceId?: string
  stripeSubscriptionId?: string
  paypalOrderId?: string
  paypalCaptureId?: string
  paypalSubscriptionId?: string
  subscriptionCurrentPeriodEnd?: string
  note?: string
}

type AdminConfig = {
  deepseekProvider: string
  sunoProvider: string
  publicBaseUrl: string
  allowSignup: boolean
  enableChineseSite: boolean
  backgroundTheme: BackgroundThemeId
  heartBeansPerGeneration: number
  paypalCheckoutUrl?: string
  notes: string
}

type PublicSiteConfig = {
  enableChineseSite: boolean
  backgroundTheme: BackgroundThemeId
}

type MemberInboxMessage = {
  id: string
  message: string
  adminReply: string
  status: string
  createdAt: string
  updatedAt: string
  repliedAt?: string
}

type MemberRechargeCodeResponse = {
  message: string
  creditsAdded: number
  profile: MemberProfile
  code: {
    id: string
    batchId: string
    maskedCode: string
    codeLast4: string
    heartBeans: number
    createdAt: string
    updatedAt: string
    createdBy: string
    status: string
    redeemedAt?: string
    redeemedByEmail?: string
  }
}

type AdminContactMessage = {
  id: string
  name: string
  email: string
  message: string
  status: string
  adminReply?: string
  adminReplyBy?: string
  publicVisible?: boolean
  createdAt: string
  updatedAt: string
  repliedAt?: string
}

type PlanItem = {
  id: string
  name: string
  type?: 'subscription' | 'credit_pack'
  billingInterval?: 'month' | 'year' | ''
  stripePriceId?: string
  paypalPlanId?: string
  price: number
  heartBeans?: number
  currency?: string
  badge?: string
  features?: string[]
  canUseVipModels?: boolean
}

type PaymentMethod = {
  id: string
  name: string
  description?: string
  provider?: 'stripe_checkout' | 'paypal' | 'alipay'
  supportedPlanTypes?: Array<'subscription' | 'credit_pack'>
}

type ShowcaseSessionTrack = {
  id: string
  title: string
  meta: string
  blurb: string
  audioUrl: string
  downloadUrl?: string
}

type ShowcaseSessionContext = {
  mode: 'job' | 'history'
  jobId?: string
  title?: string
  subtitle?: string
  lyrics?: string
  statusText?: string
  generationProgress?: number
  isGenerating?: boolean
  tracks?: ShowcaseSessionTrack[]
  activeTrackId?: string
}

type PaymentMethodAdmin = {
  id: string
  name: string
  enabled: boolean
  provider?: 'stripe_checkout' | 'paypal' | 'alipay'
  envKey: string
  supportedPlanTypes?: Array<'subscription' | 'credit_pack'>
  description?: string
}

type AdminMember = {
  email: string
  plan?: string
  heartBeansBalance?: number
  topupHeartBeansBalance?: number
  subscriptionHeartBeansBalance?: number
  subscriptionStatus?: string
  subscriptionPlanId?: string
  subscriptionCurrentPeriodEnd?: string
  disabled?: boolean
  lastAuthAt?: string
  songs?: number
  lastSeenAt?: string
  lastManualAdjustmentAmount?: number
  lastManualAdjustmentNote?: string
  lastManualAdjustmentAt?: string
  lastManualAdjustmentBy?: string
}

type AdminRechargeCode = {
  id: string
  batchId: string
  maskedCode: string
  codeLast4: string
  heartBeans: number
  createdAt: string
  updatedAt: string
  createdBy: string
  status: string
  redeemedAt?: string
  redeemedByEmail?: string
}

type GeneratedRechargeBatch = {
  batchId: string
  generatedAt: string
  count: number
  csvFilename: string
  csvContent: string
  items: Array<{
    code: string
    heartBeans: number
    batchId: string
    createdAt: string
  }>
}

type LayoutProps = {
  locale: Locale
  title: string
  subtitle: string
  eyebrow: string
  active: string
  onOpenModal: (message: string) => void
  onLogout?: () => void
  authSession?: AuthSession | null
  homePanel?: ReactNode
  hideHero?: boolean
  plainPage?: boolean
  children: ReactNode
}

type HomePageProps = {
  locale: Locale
  draft: SongDraft
  setDraft: Dispatch<SetStateAction<SongDraft>>
  onOpenModal: (message: string) => void
  onUpsertFloatingPlayer: (payload: FloatingPhonePlayerPayload) => void
  onLogout: () => void
  authSession: AuthSession | null
  onAddPendingMemberSongs: (items: HistoryItem[]) => void
}

type StylesPageProps = {
  locale: Locale
  draft: SongDraft
  setDraft: Dispatch<SetStateAction<SongDraft>>
  authSession: AuthSession | null
  onLogout: () => void
}

type PreviewPageProps = {
  locale: Locale
  draft: SongDraft
  authSession: AuthSession | null
  onLogout: () => void
  onUpsertFloatingPlayer: (payload: FloatingPhonePlayerPayload) => void
}

type PricingPageProps = {
  locale: Locale
  selectedPlan: string
  setSelectedPlan: Dispatch<SetStateAction<string>>
  authSession: AuthSession | null
  onLogout: () => void
}

type CheckoutPageProps = {
  locale: Locale
  selectedPlan: string
  setSelectedPlan: Dispatch<SetStateAction<string>>
  authSession: AuthSession | null
  onLogout: () => void
}

type AuthPageProps = {
  locale: Locale
  draft: SongDraft
  selectedPlan: string
  onOpenModal: (message: string) => void
  onAuthSuccess: (session: AuthSession) => void
  onLogout: () => void
  authSession: AuthSession | null
}

type AccountPageProps = {
  locale: Locale
  selectedPlan: string
  onOpenModal: (message: string) => void
  history: HistoryItem[]
  onLogout: () => void
  authSession: AuthSession | null
  onUpsertFloatingPlayer: (payload: FloatingPhonePlayerPayload) => void
  onAuthSessionUpdate: (profile: MemberProfile) => void
}

type CompletePageProps = {
  locale: Locale
  draft: SongDraft
  onOpenModal: (message: string) => void
  authSession: AuthSession | null
  onLogout: () => void
}

type ShowcasePageProps = {
  locale: Locale
  authSession: AuthSession | null
  onLogout: () => void
  onUpsertFloatingPlayer: (payload: FloatingPhonePlayerPayload) => void
}

type LegalPageKey =
  | 'legal'
  | 'delivery'
  | 'privacy'
  | 'terms'
  | 'refund'
  | 'cancellation'
  | 'find-order'

type LegalPageProps = {
  locale: Locale
  policy: LegalPageKey
  authSession: AuthSession | null
  onLogout: () => void
}

type PublicOrderLookupItem = {
  id: string
  plan: string
  amount: number
  status: string
  createdAt: string
  paymentMethod: string
  note?: string
}

type ShowcaseTrack = {
  id: string
  title: Copy
  meta: Copy
  blurb: Copy
  audioUrl: string
}

type FloatingPhoneTrack = {
  id: string
  title: string
  audioUrl: string
  downloadUrl?: string
  duration?: number
  subtitle?: string
}

type FloatingPhonePlayerState = {
  key: string
  locale: Locale
  title: string
  subtitle: string
  eyebrow: string
  tracks: FloatingPhoneTrack[]
  activeTrackIndex?: number
  canClose: boolean
  isGenerating: boolean
  generationProgress: number
  generationLabel: string
  statusText?: string
  lyrics?: string
  error?: string
  autoPlay?: boolean
}

type FloatingPhonePlayerPayload = Partial<FloatingPhonePlayerState> & {
  key: string
}

const SONG_HISTORY_KEY = 'melodyvow-song-history'
const SONG_DRAFT_SESSION_KEY = 'melodyvow-song-draft'
const SIGNUP_POLICY_VERSION = '2026-09-15'
const SHOWCASE_SESSION_KEY = 'melodyvow-showcase-context'
const SHOWCASE_GENERATING_SESSION_KEY = 'melodyvow-showcase-generating-context'
const AUTH_SESSION_KEY = 'melodyvow-auth-session'
const ADMIN_SESSION_KEY = 'melodyvow-admin-session'
const PUBLIC_SITE_CONFIG_KEY = 'melodyvow-public-site-config'
const DEFAULT_BACKGROUND_THEME: BackgroundThemeId = 'vivid_rainbow'
const backgroundThemeOptions: Array<{
  id: BackgroundThemeId
  label: string
  description: string
}> = [
  {
    id: 'vivid_rainbow',
    label: '绚彩渐变',
    description: '首页同款的高亮绚彩渐变，保存后全站页面都会切换到这套背景。',
  },
  {
    id: 'elegant_dark',
    label: '欧美黑金',
    description: '延续绚彩渐变的流动感，但改为深酒红与黑金调，更适合欧美高定婚礼气质。',
  },
  {
    id: 'auto_beijing',
    label: '自动时区（北京时间）',
    description: '按北京时间自动切换：白天使用绚彩渐变，晚上切换为欧美黑金。',
  },
]

function normalizeBackgroundTheme(value: unknown): BackgroundThemeId {
  const normalized = String(value || '').trim() as BackgroundThemeId
  return backgroundThemeOptions.some((item) => item.id === normalized) ? normalized : DEFAULT_BACKGROUND_THEME
}

function getBeijingHour(date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      hour12: false,
    })
    return Number(formatter.format(date))
  } catch {
    return (date.getUTCHours() + 8 + 24) % 24
  }
}

function resolveBackgroundTheme(theme: BackgroundThemeId, date = new Date()): ResolvedBackgroundThemeId {
  if (theme !== 'auto_beijing') {
    return theme
  }

  const beijingHour = getBeijingHour(date)
  return beijingHour >= 6 && beijingHour < 18 ? 'vivid_rainbow' : 'elegant_dark'
}

function getBackgroundThemeOption(theme: BackgroundThemeId | ResolvedBackgroundThemeId) {
  return backgroundThemeOptions.find((item) => item.id === theme) ?? null
}

const defaultPublicSiteConfig: PublicSiteConfig = {
  enableChineseSite: false,
  backgroundTheme: DEFAULT_BACKGROUND_THEME,
}
const SiteConfigContext = createContext<PublicSiteConfig>(defaultPublicSiteConfig)
const HOME_FIREWORK_GOLD_COLORS = ['#fffbf0', '#fff1c2', '#ffe08a', '#f4c45d', '#d89b2f', '#9d6915']
const HOME_FIREWORK_GLOW_COLORS = ['#ffffff', '#fff8e7', '#ffeec4', '#f6d98b']
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event'
const DEBUG_SESSION_ID = 'audio-stops-early'

const EMPTY_SONG_DRAFT: SongDraft = {
  groom: '',
  bride: '',
  occasion: 'wedding',
  languageCode: '',
  languageLabel: '',
  style: '',
  vocal: '',
  vocalLabel: '',
  loveStory: '',
  meetingStory: '',
  vowKeywords: '',
}

function apiUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
}

function getMemberAuthHeaders(session: AuthSession | null | undefined) {
  const token = session?.authToken?.trim()
  const headers: Record<string, string> = {}

  if (token) {
    headers['x-member-token'] = token
  }

  return headers
}

function reportDebugEvent(event: Record<string, unknown>) {
  void fetch(DEBUG_SERVER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: DEBUG_SESSION_ID,
      runId: 'pre-fix',
      ts: Date.now(),
      ...event,
    }),
  }).catch(() => {})
}

function isExpiredSunoStreamUrl(value: string | undefined) {
  return /^https?:\/\/audiopipe\.suno\.ai/i.test(String(value || '').trim())
}

function pickPreferredPlayableUrl(...values: Array<string | undefined>) {
  const candidates = values
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return candidates.find((value) => !isExpiredSunoStreamUrl(value)) || ''
}

function getSongDownloadUrl(songId: string) {
  return apiUrl(`/api/songs/${encodeURIComponent(songId)}/download`)
}

function getSongStreamUrl(songId: string) {
  return apiUrl(`/api/songs/${encodeURIComponent(songId)}/stream`)
}

function buildTrackHistoryId(jobId: string, index: number) {
  return `${jobId}__track_${index + 1}`
}

function buildPendingHistoryItems(params: {
  jobId: string
  title: string
  subtitle: string
  languageLabel?: string
  styleLabel?: string
  vocalLabel?: string
  lyricSnippet?: string
  lyrics?: string
}) {
  return Array.from({ length: 2 }, (_, index) => ({
    id: buildTrackHistoryId(params.jobId, index),
    jobId: params.jobId,
    trackCount: 2,
    trackIndex: index,
    title: params.title,
    subtitle: params.subtitle,
    status: 'generating_song',
    rawStatus: 'generating_song',
    action: '下载音频',
    variantLabel: `Version ${index + 1}`,
    audioUrl: '',
    downloadUrl: '',
    sourceAudioUrl: '',
    sourceDownloadUrl: '',
    createdAt: new Date().toISOString(),
    languageLabel: params.languageLabel || '',
    styleLabel: params.styleLabel || '',
    vocalLabel: params.vocalLabel || '',
    lyricSnippet: params.lyricSnippet || '',
    lyrics: params.lyrics || params.lyricSnippet || '',
  }))
}

function sanitizeHistoryItem(item: HistoryItem) {
  const playbackUrl = pickPreferredPlayableUrl(item.audioUrl, item.downloadUrl)

  return {
    ...item,
    rawStatus: item.rawStatus || item.status,
    audioUrl: playbackUrl,
    downloadUrl: item.downloadUrl || playbackUrl,
    sourceAudioUrl: item.sourceAudioUrl || item.audioUrl || '',
    sourceDownloadUrl: item.sourceDownloadUrl || item.downloadUrl || '',
    lyrics: item.lyrics || item.lyricSnippet || '',
  }
}

function isReadyHistoryItem(item: HistoryItem) {
  return String(item.rawStatus || item.status || '').trim().toLowerCase() === 'ready'
}

function isPendingHistoryItem(item: HistoryItem) {
  return Boolean(item.jobId) && !isReadyHistoryItem(item) && !pickPreferredPlayableUrl(item.audioUrl, item.downloadUrl)
}

function getHistoryItemTimestamp(item: HistoryItem) {
  const timestamp = item.createdAt ? new Date(item.createdAt).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

function sortHistoryItemsByNewest(items: HistoryItem[]) {
  return [...items].sort((left, right) => getHistoryItemTimestamp(right) - getHistoryItemTimestamp(left))
}

function sortHistoryItemsByTrack(items: HistoryItem[]) {
  return [...items].sort((left, right) => {
    const leftTrackIndex = typeof left.trackIndex === 'number' ? left.trackIndex : Number.MAX_SAFE_INTEGER
    const rightTrackIndex = typeof right.trackIndex === 'number' ? right.trackIndex : Number.MAX_SAFE_INTEGER
    if (leftTrackIndex !== rightTrackIndex) {
      return leftTrackIndex - rightTrackIndex
    }

    return getHistoryItemTimestamp(right) - getHistoryItemTimestamp(left)
  })
}

function buildPendingHistoryItemsFromSeed(item: HistoryItem) {
  const jobId = String(item.jobId || item.id || '').trim()
  if (!jobId) {
    return [] as HistoryItem[]
  }

  return buildPendingHistoryItems({
    jobId,
    title: item.title,
    subtitle: item.subtitle,
    languageLabel: item.languageLabel,
    styleLabel: item.styleLabel,
    vocalLabel: item.vocalLabel,
    lyricSnippet: item.lyricSnippet,
    lyrics: item.lyrics,
  }).map((entry) => ({
    ...entry,
    createdAt: item.createdAt || entry.createdAt,
  }))
}

function mergeMemberHistoryItems(currentItems: HistoryItem[], fetchedItems: HistoryItem[]) {
  const sanitizedCurrent = currentItems.map(sanitizeHistoryItem)
  const sanitizedFetched = fetchedItems.map(sanitizeHistoryItem)
  const allPendingItems = sortHistoryItemsByNewest([
    ...sanitizedCurrent.filter(isPendingHistoryItem),
    ...sanitizedFetched.filter(isPendingHistoryItem),
  ])
  const activePendingSeed = allPendingItems[0]
  const activePendingJobId = String(activePendingSeed?.jobId || '').trim()
  const readyItems = sortHistoryItemsByNewest(sanitizedFetched.filter(isReadyHistoryItem))

  if (!activePendingJobId) {
    return readyItems
  }

  const readyItemsForActiveJob = readyItems.filter((item) => (item.jobId || item.id) === activePendingJobId)
  const pendingSlots = sortHistoryItemsByNewest(
    sanitizedCurrent.filter((item) => item.jobId === activePendingJobId && isPendingHistoryItem(item)),
  )
  const fallbackPendingSlots = pendingSlots.length ? pendingSlots : buildPendingHistoryItemsFromSeed(activePendingSeed)
  const readyIdsForActiveJob = new Set(readyItemsForActiveJob.map((item) => item.id))
  const activeJobItems = sortHistoryItemsByTrack([
    ...readyItemsForActiveJob,
    ...fallbackPendingSlots.filter((item) => !readyIdsForActiveJob.has(item.id)),
  ]).slice(0, 2)
  const otherReadyItems = readyItems.filter((item) => (item.jobId || item.id) !== activePendingJobId)

  return [...activeJobItems, ...otherReadyItems]
}

function buildFloatingTrackFromHistory(item: HistoryItem): FloatingPhoneTrack {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.variantLabel || item.subtitle,
    audioUrl: getSongStreamUrl(item.id),
    downloadUrl: getSongDownloadUrl(item.id),
  }
}

function buildFloatingTracksFromJob(job: SongJob, locale: Locale): FloatingPhoneTrack[] {
  return (job.tracks ?? []).map((track, index) => ({
    id: buildTrackHistoryId(job.id, index),
    title: track.title || job.title || copy(locale, {
      zh: `歌曲 ${index + 1}`,
      en: `Track ${index + 1}`,
    }),
    subtitle: copy(locale, {
      zh: `生成版本 ${index + 1}`,
      en: `Generated version ${index + 1}`,
    }),
    audioUrl: getSongStreamUrl(buildTrackHistoryId(job.id, index)),
    downloadUrl: getSongDownloadUrl(buildTrackHistoryId(job.id, index)),
    duration: track.duration,
  }))
}

function isGeneratingShowcaseSession(session: ShowcaseSessionContext | null) {
  if (!session || session.mode !== 'job' || !session.jobId) {
    return false
  }

  if (typeof session.isGenerating === 'boolean') {
    return session.isGenerating
  }

  if ((session.generationProgress ?? 0) < 100) {
    return true
  }

  return !(session.tracks && session.tracks.some((track) => track.audioUrl))
}

function normalizeShowcaseSession(context: ShowcaseSessionContext) {
  if (context.mode !== 'job' || !context.jobId) {
    return {
      ...context,
      isGenerating: context.isGenerating ?? false,
    }
  }

  return {
    ...context,
    isGenerating: typeof context.isGenerating === 'boolean' ? context.isGenerating : isGeneratingShowcaseSession(context),
  }
}

function getShowcaseEntryPath(locale: Locale) {
  const currentSession = loadGeneratingShowcaseSession()
  if (currentSession?.mode === 'job' && currentSession.jobId && isGeneratingShowcaseSession(currentSession)) {
    return withLocale(locale, `/how-it-works?mode=job&job=${encodeURIComponent(currentSession.jobId)}`)
  }

  return withLocale(locale, '/how-it-works')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function launchHomepageFireworks() {
  if (typeof window === 'undefined') {
    return () => {}
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return () => {}
  }

  const duration = 2600
  const end = Date.now() + duration
  const timeouts: number[] = []
  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min
  const randomFrom = (values: string[]) => values[Math.floor(Math.random() * values.length)] || values[0]

  const fire = (particleRatio: number, options: Record<string, unknown>, colors = HOME_FIREWORK_GOLD_COLORS) => {
    confetti({
      particleCount: Math.max(10, Math.floor(150 * particleRatio)),
      colors,
      disableForReducedMotion: true,
      spread: 92,
      startVelocity: 46,
      ticks: 240,
      gravity: 0.86,
      scalar: 1.1,
      drift: randomInRange(-0.12, 0.12),
      zIndex: 25,
      ...options,
    })
  }

  const sparkle = (particleRatio: number, options: Record<string, unknown>) => {
    fire(
      particleRatio,
      {
        spread: 360,
        startVelocity: 26,
        ticks: 170,
        gravity: 0.7,
        scalar: randomInRange(0.72, 0.92),
        decay: 0.95,
        drift: randomInRange(-0.08, 0.08),
        shapes: ['circle'],
        ...options,
      },
      HOME_FIREWORK_GLOW_COLORS,
    )
  }

  fire(0.28, {
    angle: 60,
    spread: 68,
    startVelocity: 62,
    scalar: 1.14,
    origin: { x: 0.02, y: 0.72 },
  })
  fire(0.28, {
    angle: 120,
    spread: 68,
    startVelocity: 62,
    scalar: 1.14,
    origin: { x: 0.98, y: 0.72 },
  })
  fire(0.3, {
    spread: 98,
    startVelocity: 56,
    scalar: 1.16,
    origin: { x: 0.5, y: 0.24 },
  })
  sparkle(0.14, {
    origin: { x: 0.5, y: 0.24 },
  })

  timeouts.push(
    window.setTimeout(() => {
      fire(0.22, {
        spread: 120,
        startVelocity: 50,
        origin: { x: 0.22, y: 0.18 },
      })
      fire(0.22, {
        spread: 120,
        startVelocity: 50,
        origin: { x: 0.78, y: 0.18 },
      })
      sparkle(0.12, {
        origin: { x: 0.22, y: 0.18 },
      })
      sparkle(0.12, {
        origin: { x: 0.78, y: 0.18 },
      })
    }, 280),
  )

  const intervalId = window.setInterval(() => {
    const timeLeft = end - Date.now()

    if (timeLeft <= 0) {
      window.clearInterval(intervalId)
      return
    }

    const intensity = timeLeft / duration

    fire(0.12 * intensity, {
      spread: 360,
      startVelocity: 28,
      decay: 0.95,
      scalar: 0.88,
      ticks: 165,
      origin: {
        x: randomInRange(0.14, 0.34),
        y: randomInRange(0.02, 0.24),
      },
    })

    fire(0.12 * intensity, {
      spread: 360,
      startVelocity: 28,
      decay: 0.95,
      scalar: 0.88,
      ticks: 165,
      origin: {
        x: randomInRange(0.66, 0.86),
        y: randomInRange(0.02, 0.24),
      },
    })

    sparkle(0.1 * intensity, {
      particleCount: Math.max(8, Math.floor(52 * intensity)),
      colors: [randomFrom(HOME_FIREWORK_GLOW_COLORS), '#ffffff'],
      origin: {
        x: randomInRange(0.18, 0.82),
        y: randomInRange(0.08, 0.22),
      },
    })

    fire(0.14 * intensity, {
      angle: 60,
      spread: 56,
      startVelocity: 58,
      scalar: 1.12,
      origin: { x: 0.08, y: 0.62 },
    })

    fire(0.14 * intensity, {
      angle: 120,
      spread: 56,
      startVelocity: 58,
      scalar: 1.12,
      origin: { x: 0.92, y: 0.62 },
    })
  }, 260)

  return () => {
    window.clearInterval(intervalId)
    timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
  }
}

const productShowcaseTracks: ShowcaseTrack[] = [
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

function copy(locale: Locale, content: Copy) {
  return content[locale]
}

function getLegalLinks(locale: Locale) {
  return {
    primary: [
      {
        key: 'legal',
        label: copy(locale, { zh: 'Policies & Support', en: 'Policies & Support' }),
        to: withLocale(locale, '/legal'),
      },
    ],
    order: {
      key: 'find-order',
      label: copy(locale, { zh: 'Find My Order', en: 'Find My Order' }),
      to: withLocale(locale, '/find-my-order'),
    },
  }
}

function getPublicOrderStatusLabel(locale: Locale, status: string) {
  switch (status) {
    case 'pending':
      return copy(locale, { zh: '待确认付款', en: 'Pending Payment Confirmation' })
    case 'processing':
      return copy(locale, { zh: '处理中', en: 'Processing' })
    case 'paid':
      return copy(locale, { zh: '订阅已生效', en: 'Subscription Active' })
    case 'cancelled':
      return copy(locale, { zh: '已取消', en: 'Cancelled' })
    case 'refunded':
      return copy(locale, { zh: '已退款', en: 'Refunded' })
    default:
      return status || copy(locale, { zh: '未知状态', en: 'Unknown Status' })
  }
}

function getStyleLabel(locale: Locale, id: string) {
  const style = weddingStyleOptions.find((item) => item.id === id)
  if (!style) {
    return id
  }

  return locale === 'zh' ? style.zhLabel : style.enLabel
}

function getStyleOption(id: string) {
  return weddingStyleOptions.find((item) => item.id === id) ?? null
}

function getStyleCollectionIds(styleId: string) {
  return styleCollectionsByStyleId[styleId] || ['wedding']
}

function getStyleCollectionLabel(locale: Locale, collectionId: StyleCollectionId) {
  const collection = styleCollectionOptions.find((item) => item.id === collectionId)
  if (!collection) {
    return collectionId
  }

  return locale === 'zh' ? collection.zhLabel : collection.enLabel
}

type StyleMetaField =
  | 'area'
  | 'community'
  | 'region'
  | 'weddingMusicType'
  | 'proposalMusicType'
  | 'coreFeature'
  | 'signatureForm'

const STYLE_META_EN_OVERRIDES: Record<string, string> = {
  '—': '-',
  '中东': 'Middle East',
  '东亚': 'East Asia',
  '东南亚': 'Southeast Asia',
  '南亚': 'South Asia',
  '欧洲': 'Europe',
  '北美洲': 'North America',
  '非洲': 'Africa',
  '大洋洲': 'Oceania',
  '跨区域': 'Cross-region',
  '沙特阿拉伯': 'Saudi Arabia',
  '巴勒斯坦 / 黎凡特': 'Palestine / Levant',
  '伊拉克 / 叙利亚（犹太-阿拉伯社群）': 'Iraq / Syria (Jewish-Arabic communities)',
  '海湾国家（科威特 / 巴林 / 卡塔尔）': 'Gulf States (Kuwait / Bahrain / Qatar)',
  '中东·库尔德': 'Middle East · Kurdish',
  '库尔德地区（伊拉克 / 土耳其 / 叙利亚 / 伊朗）': 'Kurdish regions (Iraq / Turkey / Syria / Iran)',
  '库尔德社群': 'Kurdish community',
  '爱情诗吟唱': 'Love-poetry chant',
  '传统爱情诗': 'Traditional love poetry',
  '阿拉伯语情歌': 'Arabic love song',
  '海湾婚礼歌、女性鼓乐队': 'Gulf wedding songs, women’s drum ensemble',
  '女性鼓乐 band 演奏 Hadar 和 Khammāri 曲目': 'Women’s drum ensemble performing Hadar and Khammari repertoire',
  '犹太-阿拉伯婚礼歌': 'Jewish-Arabic wedding song',
  'Govend / Halparke 线舞、zurna + davul 婚礼乐': 'Govend / Halparke line-dance wedding music with zurna and davul',
  '库尔德情歌': 'Kurdish love song',
  '亲友连手排成长队起舞，zurna 高亢旋律与 davul 大鼓强节奏推进，带有高原史诗感': 'Guests join hands in long dance lines as zurna leads over driving davul drums with a highland-epic feel',
  '适合婚礼进场、长队圆舞、集体庆典与高能婚礼现场': 'Great for entrances, line dances, communal celebrations, and high-energy wedding moments',
}

function getLocalizedStyleMetaValue(locale: Locale, value?: string) {
  const text = value?.replace(/\s+/g, ' ').trim() || ''
  if (!text || locale === 'zh') {
    return text
  }

  const override = STYLE_META_EN_OVERRIDES[text]
  if (override) {
    return override
  }

  if (/\p{Script=Han}/u.test(text)) {
    return ''
  }

  return text
}

function getStyleMetaLabel(locale: Locale, field: StyleMetaField, compact = false) {
  const labels = {
    area: compact
      ? copy(locale, { zh: '区域', en: 'Area' })
      : copy(locale, { zh: '区域', en: 'Area' }),
    community: compact
      ? copy(locale, { zh: '社群', en: 'Community' })
      : copy(locale, { zh: '部落 / 社群', en: 'Tribe / Community' }),
    region: compact
      ? copy(locale, { zh: '地区', en: 'Region' })
      : copy(locale, { zh: '国家 / 地区', en: 'Country / Region' }),
    weddingMusicType: compact
      ? copy(locale, { zh: '婚礼类型', en: 'Wedding Type' })
      : copy(locale, { zh: '婚礼音乐类型', en: 'Wedding Music Type' }),
    proposalMusicType: compact
      ? copy(locale, { zh: '求婚类型', en: 'Proposal Type' })
      : copy(locale, { zh: '求婚歌曲类型', en: 'Proposal Song Type' }),
    coreFeature: compact
      ? copy(locale, { zh: '特征', en: 'Feature' })
      : copy(locale, { zh: '核心特征', en: 'Core Feature' }),
    signatureForm: compact
      ? copy(locale, { zh: '曲式', en: 'Forms' })
      : copy(locale, { zh: '代表性曲目 / 形式', en: 'Signature Form' }),
  } satisfies Record<StyleMetaField, string>

  return labels[field]
}

function getStyleMetaPreview(value: string, locale: Locale, field: StyleMetaField) {
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) {
    return ''
  }

  const limit = locale === 'zh'
    ? (field === 'signatureForm' ? 22 : 18)
    : (field === 'signatureForm' ? 34 : 28)

  if (text.length <= limit) {
    return text
  }

  const parts = text.split(/\s*[，,；;。]\s*/).filter(Boolean)
  if (parts.length > 1) {
    const summary = parts.slice(0, 2).join(' / ')
    if (summary.length <= limit + 8) {
      return `${summary}...`
    }
  }

  return `${text.slice(0, limit).trim()}...`
}

function buildStyleGenerationRequest(style: WeddingStyleOption | null, occasion: Occasion) {
  if (!style?.area && !style?.continent && !style?.region && !style?.community && !style?.weddingMusicType && !style?.proposalMusicType && !style?.coreFeature && !style?.signatureForm) {
    return ''
  }

  const coreType = occasion === 'proposal'
    ? style?.proposalMusicType || style?.weddingMusicType || ''
    : style?.weddingMusicType || style?.proposalMusicType || ''
  const sceneLabel = occasion === 'proposal' ? '求婚歌曲' : '婚礼歌曲'

  return [
    `请以 ${style?.area || style?.continent || '对应文化地区'} 的 ${style?.region || '对应国家 / 地区'} 文化语境来制作这首 ${sceneLabel}。`,
    style?.community ? `重点参考的部落 / 社群是：${style.community}。` : '',
    coreType ? `主导音乐类型要明确落在：${coreType}。` : '',
    style?.coreFeature ? `核心特征必须体现：${style.coreFeature}。` : '',
    style?.signatureForm ? `编曲和旋律请参考这些代表性曲目 / 形式：${style.signatureForm}。` : '',
    '输出结果不要只是泛泛的 world music，要让听感、节奏、器乐与旋律语言都能听出清晰文化来源。',
  ].filter(Boolean).join(' ')
}

function buildStyleLyricsRequest(style: WeddingStyleOption | null, occasion: Occasion) {
  if (!style?.area && !style?.continent && !style?.region && !style?.community && !style?.weddingMusicType && !style?.proposalMusicType && !style?.coreFeature && !style?.signatureForm) {
    return ''
  }

  const themeType = occasion === 'proposal'
    ? style?.proposalMusicType || style?.weddingMusicType || ''
    : style?.weddingMusicType || style?.proposalMusicType || ''
  const sceneLabel = occasion === 'proposal' ? '求婚' : '婚礼'

  return [
    `歌词要贴合 ${style?.region || '对应地区'} 的 ${sceneLabel}表达方式。`,
    style?.community ? `要体现 ${style.community} 的部落 / 社群婚俗语境。` : '',
    themeType ? `情绪表达请向“${themeType}”靠拢。` : '',
    style?.coreFeature ? `歌词里可融入这些核心特征：${style.coreFeature}。` : '',
    style?.signatureForm ? `可以借鉴这些代表性形式中的意象、节奏或仪式动作：${style.signatureForm}。` : '',
    '避免写成空泛的通用情歌，要有地域文化、仪式动作、亲友互动或传统意象。',
  ].filter(Boolean).join(' ')
}

function getVocalLabel(locale: Locale, code: string) {
  const vocal = vocalOptions.find((item) => item.code === code)
  if (!vocal) {
    return code
  }

  return locale === 'zh' ? vocal.zhLabel : vocal.enLabel
}

function getHomeVoiceChipLabel(code: string) {
  if (code === 'female') {
    return 'Female'
  }

  if (code === 'duet') {
    return 'Male & Female'
  }

  if (code === 'male') {
    return 'Male'
  }

  return 'Child'
}

function getOccasionLabel(locale: Locale, occasion: Occasion) {
  return copy(locale, {
    zh: occasion === 'proposal' ? '求婚' : '婚礼',
    en: occasion === 'proposal' ? 'Proposal' : 'Wedding',
  })
}

function loadSongHistory() {
  if (typeof window === 'undefined') {
    return [] as HistoryItem[]
  }

  try {
    const raw = window.localStorage.getItem(SONG_HISTORY_KEY)
    if (!raw) {
      return [] as HistoryItem[]
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as HistoryItem[]).map(sanitizeHistoryItem) : []
  } catch {
    return [] as HistoryItem[]
  }
}

function normalizeSongDraft(value: unknown): SongDraft {
  if (!value || typeof value !== 'object') {
    return { ...EMPTY_SONG_DRAFT }
  }

  const raw = value as Partial<SongDraft>

  return {
    groom: typeof raw.groom === 'string' ? raw.groom : '',
    bride: typeof raw.bride === 'string' ? raw.bride : '',
    occasion: raw.occasion === 'proposal' ? 'proposal' : 'wedding',
    languageCode: typeof raw.languageCode === 'string' ? raw.languageCode : '',
    languageLabel: typeof raw.languageLabel === 'string' ? raw.languageLabel : '',
    style: typeof raw.style === 'string' ? raw.style : '',
    vocal: typeof raw.vocal === 'string' ? raw.vocal : '',
    vocalLabel: typeof raw.vocalLabel === 'string' ? raw.vocalLabel : '',
    loveStory: typeof raw.loveStory === 'string' ? raw.loveStory : '',
    meetingStory: typeof raw.meetingStory === 'string' ? raw.meetingStory : '',
    vowKeywords: typeof raw.vowKeywords === 'string' ? raw.vowKeywords : '',
  }
}

function areSongDraftsEqual(left: SongDraft, right: SongDraft) {
  return left.groom === right.groom
    && left.bride === right.bride
    && left.occasion === right.occasion
    && left.languageCode === right.languageCode
    && left.languageLabel === right.languageLabel
    && left.style === right.style
    && left.vocal === right.vocal
    && left.vocalLabel === right.vocalLabel
    && left.loveStory === right.loveStory
    && left.meetingStory === right.meetingStory
    && left.vowKeywords === right.vowKeywords
}

function loadSongDraft() {
  if (typeof window === 'undefined') {
    return { ...EMPTY_SONG_DRAFT }
  }

  try {
    const raw = window.sessionStorage.getItem(SONG_DRAFT_SESSION_KEY)
    if (!raw) {
      return { ...EMPTY_SONG_DRAFT }
    }

    return normalizeSongDraft(JSON.parse(raw))
  } catch {
    return { ...EMPTY_SONG_DRAFT }
  }
}

function loadAuthSession() {
  if (typeof window === 'undefined') {
    return null as AuthSession | null
  }

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) {
      return null as AuthSession | null
    }

    return JSON.parse(raw) as AuthSession
  } catch {
    return null as AuthSession | null
  }
}

function loadAdminSession() {
  if (typeof window === 'undefined') {
    return null as AdminSession | null
  }

  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY)
    if (!raw) {
      return null as AdminSession | null
    }

    return JSON.parse(raw) as AdminSession
  } catch {
    return null as AdminSession | null
  }
}

function loadPublicSiteConfig() {
  if (typeof window === 'undefined') {
    return defaultPublicSiteConfig
  }

  try {
    const raw = window.localStorage.getItem(PUBLIC_SITE_CONFIG_KEY)
    if (!raw) {
      return defaultPublicSiteConfig
    }

    const parsed = JSON.parse(raw)
    return {
      enableChineseSite: Boolean(parsed?.enableChineseSite),
      backgroundTheme: normalizeBackgroundTheme(parsed?.backgroundTheme),
    }
  } catch {
    return defaultPublicSiteConfig
  }
}

function useSiteConfig() {
  return useContext(SiteConfigContext)
}

function createCaptchaChallenge() {
  const left = Math.floor(Math.random() * 8) + 1
  const right = Math.floor(Math.random() * 8) + 1

  return {
    prompt: `${left} + ${right} = ?`,
    answer: String(left + right),
  }
}

function summarizeStoryText(value: string, fallback: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return fallback
  }

  return trimmed.length > 58 ? `${trimmed.slice(0, 58)}...` : trimmed
}

function withLocale(locale: Locale, path = '') {
  if (locale === 'en') {
    return path ? `/en${path}` : '/en'
  }

  return path ? `/zh${path}` : '/zh'
}

function useIsMobileViewport(query = '(max-width: 720px), ((pointer: coarse) and (hover: none) and (max-height: 560px))') {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(query)
    const syncViewport = () => setMatches(mediaQuery.matches)
    syncViewport()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport)
      return () => mediaQuery.removeEventListener('change', syncViewport)
    }

    mediaQuery.addListener(syncViewport)
    return () => mediaQuery.removeListener(syncViewport)
  }, [query])

  return matches
}

function saveShowcaseSession(context: ShowcaseSessionContext) {
  if (typeof window === 'undefined') {
    return
  }

  const normalized = normalizeShowcaseSession(context)
  window.sessionStorage.setItem(SHOWCASE_SESSION_KEY, JSON.stringify(normalized))

  if (normalized.mode === 'job' && normalized.jobId) {
    window.sessionStorage.setItem(SHOWCASE_GENERATING_SESSION_KEY, JSON.stringify(normalized))
  }
}

function loadShowcaseSession() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(SHOWCASE_SESSION_KEY)
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as ShowcaseSessionContext
  } catch {
    return null
  }
}

function saveGeneratingShowcaseSession(context: ShowcaseSessionContext) {
  if (typeof window === 'undefined') {
    return
  }

  const normalized = normalizeShowcaseSession(context)
  if (normalized.mode !== 'job' || !normalized.jobId) {
    return
  }

  window.sessionStorage.setItem(SHOWCASE_GENERATING_SESSION_KEY, JSON.stringify(normalized))
}

function loadGeneratingShowcaseSession() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.sessionStorage.getItem(SHOWCASE_GENERATING_SESSION_KEY)
    if (raw) {
      return JSON.parse(raw) as ShowcaseSessionContext
    }

    const fallback = loadShowcaseSession()
    return fallback?.mode === 'job' && fallback.jobId ? fallback : null
  } catch {
    return null
  }
}

function normalizePricingPlan(plan: PlanItem): PlanItem {
  const identityKey = `${String(plan.id || '').trim()} ${String(plan.name || '').trim()}`.toLowerCase()
  const looksLikeLegacySubscriptionPlan = identityKey.includes('starter') || identityKey.includes('pro') || identityKey.includes('premium')
  const looksLikeLegacyPremiumPlan = identityKey.includes('premium')
  return {
    ...plan,
    type: plan.type
      ? (plan.type === 'credit_pack' ? 'credit_pack' : 'subscription')
      : looksLikeLegacySubscriptionPlan
        ? 'subscription'
        : 'credit_pack',
    billingInterval: plan.billingInterval === 'year'
      ? 'year'
      : plan.billingInterval === 'month'
        ? 'month'
        : looksLikeLegacySubscriptionPlan
          ? 'month'
          : '',
    stripePriceId: String(plan.stripePriceId || '').trim(),
    paypalPlanId: String(plan.paypalPlanId || '').trim(),
    currency: 'USD',
    canUseVipModels: typeof plan.canUseVipModels === 'boolean' ? plan.canUseVipModels : looksLikeLegacyPremiumPlan,
  }
}

const PREMIUM_VIP_PLAN_ID_PREFIX = 'premium'
const VIP_CHINESE_FEATURED_STYLE_IDS: string[] = [
  'chinese_royal_dragon_phoenix',
  'forbidden_city_bride_entrance',
  'chinese_hundred_birds_festive',
  'chinese_vow_gratitude_ballad',
  'chinese_desert_film_epic',
]
const VIP_CHINESE_FEATURED_STYLE_PRIORITY = new Map<string, number>(VIP_CHINESE_FEATURED_STYLE_IDS.map((id, index) => [id, index]))

function getDefaultPlanAccessFallback(): PlanItem[] {
  return [
    { id: 'starter-monthly', name: 'Starter Monthly', type: 'subscription', billingInterval: 'month', price: 89, heartBeans: 5, currency: 'USD', badge: '', features: [], canUseVipModels: false },
    { id: 'pro-monthly', name: 'Pro Monthly', type: 'subscription', billingInterval: 'month', price: 199, heartBeans: 15, currency: 'USD', badge: '', features: [], canUseVipModels: false },
    { id: 'premium-monthly', name: 'Premium Monthly', type: 'subscription', billingInterval: 'month', price: 499, heartBeans: 40, currency: 'USD', badge: '', features: [], canUseVipModels: true },
    { id: 'boost-5', name: 'Boost 5', type: 'credit_pack', billingInterval: '', price: 69, heartBeans: 5, currency: 'USD', badge: '', features: [], canUseVipModels: false },
    { id: 'signature-15', name: 'Signature 15', type: 'credit_pack', billingInterval: '', price: 169, heartBeans: 15, currency: 'USD', badge: '', features: [], canUseVipModels: false },
    { id: 'celebration-40', name: 'Celebration 40', type: 'credit_pack', billingInterval: '', price: 429, heartBeans: 40, currency: 'USD', badge: '', features: [], canUseVipModels: false },
  ]
}

function planSupportsVipModels(plan: Pick<PlanItem, 'id' | 'type' | 'canUseVipModels'> | null | undefined) {
  const normalizedPlanId = String(plan?.id || '').trim().toLowerCase()
  return Boolean(plan?.canUseVipModels)
    && (plan?.type || 'subscription') === 'subscription'
    && normalizedPlanId.startsWith(PREMIUM_VIP_PLAN_ID_PREFIX)
}

function authSessionLooksPremium(authSession: AuthSession | null | undefined) {
  const planName = String(authSession?.plan || '').trim().toLowerCase()
  const planId = String(authSession?.subscriptionPlanId || '').trim().toLowerCase()
  return planName.includes(PREMIUM_VIP_PLAN_ID_PREFIX) || planId.startsWith(PREMIUM_VIP_PLAN_ID_PREFIX)
}

function isVipStyle(styleId: string) {
  return getStyleCollectionIds(styleId).includes('vip')
}

function resolveMemberVipPlan(authSession: AuthSession | null | undefined, plans: PlanItem[]) {
  const subscriptionPlanId = String(authSession?.subscriptionPlanId || '').trim()
  const currentPlanName = String(authSession?.plan || '').trim()
  const matchedPlanByName = currentPlanName
    ? plans.find((item) => String(item.name || '').trim() === currentPlanName) || null
    : null
  if (matchedPlanByName && planSupportsVipModels(matchedPlanByName)) {
    return matchedPlanByName
  }

  if (subscriptionPlanId) {
    return plans.find((item) => item.id === subscriptionPlanId) || null
  }

  if (!currentPlanName) {
    return null
  }

  return matchedPlanByName
}

function memberHasVipModelAccess(authSession: AuthSession | null | undefined, plans: PlanItem[]) {
  if (authSessionLooksPremium(authSession)) {
    return true
  }
  const matchedPlan = resolveMemberVipPlan(authSession, plans)
  return planSupportsVipModels(matchedPlan)
}

function syncAdminMemberPlanFields(
  member: AdminMember,
  planName: string,
  plans: PlanItem[],
  options?: { preserveExistingSubscriptionStatus?: boolean },
) {
  const normalizedPlanName = String(planName || '').trim()
  const matchedPlan = plans.find((item) => String(item.name || '').trim() === normalizedPlanName) || null
  if (!matchedPlan) {
    return {
      ...member,
      plan: normalizedPlanName,
    }
  }

  if (matchedPlan.type === 'subscription') {
    const nextSubscriptionStatus = options?.preserveExistingSubscriptionStatus
      ? String(member.subscriptionStatus || '').trim()
      : 'active'
    return {
      ...member,
      plan: matchedPlan.name,
      subscriptionPlanId: matchedPlan.id,
      subscriptionStatus: nextSubscriptionStatus,
    }
  }

  return {
    ...member,
    plan: matchedPlan.name,
    subscriptionPlanId: '',
    subscriptionStatus: '',
  }
}

function formatPlanPrice(plan: Pick<PlanItem, 'price'>) {
  return `$${plan.price}`
}

function getPlanActionLabel(locale: Locale, planType: PlanItem['type']) {
  return planType === 'credit_pack'
    ? copy(locale, { zh: '立即充值', en: 'Top Up Now' })
    : copy(locale, { zh: '立即订阅', en: 'Subscribe Now' })
}

function getPlanTypeLabel(locale: Locale, planType: PlanItem['type']) {
  return planType === 'credit_pack'
    ? copy(locale, { zh: '充值包', en: 'Top Up Pack' })
    : copy(locale, { zh: '月订阅', en: 'Monthly Subscription' })
}

function formatPlanCreditsText(locale: Locale, plan: PlanItem) {
  if ((plan.type || 'subscription') === 'credit_pack') {
    return copy(locale, {
      zh: `立即到账 ${plan.heartBeans || 0} 点充值额度`,
      en: `${plan.heartBeans || 0} top-up credits delivered instantly`,
    })
  }

  return copy(locale, {
    zh: `每月发放 ${plan.heartBeans || 0} 点订阅额度`,
    en: `${plan.heartBeans || 0} subscription credits every month`,
  })
}

function getPlanFeatureItems(locale: Locale, plan: PlanItem) {
  const items = [...(plan.features || [])]
  const vipAccessLabel = copy(locale, {
    zh: '可使用 VIP模型',
    en: 'VIP Models access',
  })

  if (planSupportsVipModels(plan) && !items.some((item) => String(item || '').toLowerCase().includes('vip'))) {
    items.push(vipAccessLabel)
  }

  return items
}

function ScrollManager() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  return null
}

function App() {
  const location = useLocation()
  const isMobileViewport = useIsMobileViewport()
  const [draft, setDraft] = useState<SongDraft>(() => loadSongDraft())
  const [selectedPlan, setSelectedPlan] = useState('Pro Monthly')
  const [modalMessage, setModalMessage] = useState('')
  const [songHistory, setSongHistory] = useState<HistoryItem[]>(() => loadSongHistory())
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => loadAuthSession())
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => loadAdminSession())
  const [siteConfig, setSiteConfig] = useState<PublicSiteConfig>(() => loadPublicSiteConfig())
  const [siteConfigReady, setSiteConfigReady] = useState(false)
  const [floatingPlayer, setFloatingPlayer] = useState<FloatingPhonePlayerState | null>(null)
  const modalLocale: Locale = location.pathname.startsWith('/en') ? 'en' : 'zh'
  const activeMemberToken = authSession?.authToken?.trim() || ''
  const activeMemberEmail = authSession?.email?.trim() || ''
  const shouldHideFloatingPlayer = isMobileViewport && /\/how-it-works$/.test(location.pathname)

  useEffect(() => {
    let disposed = false

    const loadSiteConfig = async () => {
      try {
        const response = await fetch(apiUrl('/api/site-config'))
        const result = (await readJsonSafe(response)) as PublicSiteConfig | { message?: string }
        if (!response.ok) {
          throw new Error('message' in result && result.message ? result.message : '站点配置加载失败。')
        }

        if (!disposed) {
          const nextConfig = {
            enableChineseSite: Boolean((result as PublicSiteConfig).enableChineseSite),
            backgroundTheme: normalizeBackgroundTheme((result as PublicSiteConfig).backgroundTheme),
          }
          setSiteConfig(nextConfig)
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(PUBLIC_SITE_CONFIG_KEY, JSON.stringify(nextConfig))
          }
        }
      } catch {
        // Keep the last cached public config when the request fails.
      } finally {
        if (!disposed) {
          setSiteConfigReady(true)
        }
      }
    }

    void loadSiteConfig()

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = modalLocale === 'en' ? 'en' : 'zh-CN'
  }, [modalLocale])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(SONG_HISTORY_KEY, JSON.stringify(songHistory))
  }, [songHistory])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.sessionStorage.setItem(SONG_DRAFT_SESSION_KEY, JSON.stringify(normalizeSongDraft(draft)))
  }, [draft])

  useEffect(() => {
    if (!activeMemberToken || !activeMemberEmail) {
      return
    }

    let disposed = false

    const loadMemberSongs = async () => {
      try {
        const response = await fetch(apiUrl('/api/member/songs'), {
          headers: {
            'x-member-token': activeMemberToken,
          },
        })
        const data = (await readJsonSafe(response)) as { items?: HistoryItem[]; message?: string }

        if (!response.ok) {
          if (!disposed && (response.status === 401 || response.status === 403)) {
            setAuthSession(null)
            setSongHistory([])
          }
          throw new Error(data.message || '会员歌单加载失败。')
        }

        if (!disposed && Array.isArray(data.items)) {
          const nextItems = data.items.map(sanitizeHistoryItem)
          // #region debug-point E:frontend-member-history
          reportDebugEvent({
            hypothesisId: 'E',
            location: 'web/src/App.tsx:loadMemberSongs',
            msg: '[DEBUG] Frontend loaded member song history',
            data: {
              email: activeMemberEmail,
              itemCount: nextItems.length,
              firstItemId: nextItems[0]?.id || '',
              firstItemAudioUrl: nextItems[0]?.audioUrl || '',
              firstItemDownloadUrl: nextItems[0]?.downloadUrl || '',
            },
          })
          // #endregion
          setSongHistory((current) => mergeMemberHistoryItems(current, nextItems))
        }
      } catch (error) {
        if (!disposed) {
          console.error(error)
        }
      }
    }

    void loadMemberSongs()

    const handleRefresh = () => {
      if (document.visibilityState === 'hidden') {
        return
      }

      void loadMemberSongs()
    }

    const timer = window.setInterval(() => {
      void loadMemberSongs()
    }, 5000)
    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleRefresh)

    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleRefresh)
    }
  }, [activeMemberEmail, activeMemberToken])

  useEffect(() => {
    if (!activeMemberToken) {
      return
    }

    let disposed = false

    const syncMemberSession = async () => {
      try {
        const response = await fetch(apiUrl('/api/member/session'), {
          headers: {
            'x-member-token': activeMemberToken,
          },
        })
        const data = (await readJsonSafe(response)) as Partial<MemberProfile> & { message?: string }

        if (!response.ok) {
          if (!disposed && (response.status === 401 || response.status === 403)) {
            setAuthSession(null)
            setSongHistory([])
          }
          return
        }

        if (!disposed && data.email) {
          setAuthSession((current) => {
            if (!current || current.authToken !== activeMemberToken) {
              return current
            }

            return {
              ...current,
              email: data.email || current.email,
              partnerName: data.partnerName || current.partnerName,
              plan: data.plan || current.plan,
              heartBeansBalance: typeof data.heartBeansBalance === 'number' ? data.heartBeansBalance : current.heartBeansBalance,
              topupHeartBeansBalance: typeof data.topupHeartBeansBalance === 'number' ? data.topupHeartBeansBalance : current.topupHeartBeansBalance,
              subscriptionHeartBeansBalance: typeof data.subscriptionHeartBeansBalance === 'number' ? data.subscriptionHeartBeansBalance : current.subscriptionHeartBeansBalance,
              subscriptionStatus: data.subscriptionStatus || current.subscriptionStatus,
              subscriptionPlanId: data.subscriptionPlanId || current.subscriptionPlanId,
              subscriptionCurrentPeriodEnd: data.subscriptionCurrentPeriodEnd || current.subscriptionCurrentPeriodEnd,
              stripeCustomerId: data.stripeCustomerId || current.stripeCustomerId,
              paypalSubscriptionId: data.paypalSubscriptionId || current.paypalSubscriptionId,
              subscriptionProvider: data.subscriptionProvider || current.subscriptionProvider,
              lastAuthAt: data.lastAuthAt || current.lastAuthAt,
              avatarUrl: data.avatarUrl || current.avatarUrl,
            }
          })
        }
      } catch (error) {
        if (!disposed) {
          console.error(error)
        }
      }
    }

    void syncMemberSession()

    const handleRefresh = () => {
      if (document.visibilityState === 'hidden') {
        return
      }

      void syncMemberSession()
    }

    const timer = window.setInterval(() => {
      void syncMemberSession()
    }, 5000)
    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleRefresh)

    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleRefresh)
    }
  }, [activeMemberToken])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let disposed = false

    const syncActiveShowcaseSession = async () => {
      const currentSession = loadGeneratingShowcaseSession()
      if (!isGeneratingShowcaseSession(currentSession) || !currentSession?.jobId) {
        return
      }

      try {
        const response = await fetch(apiUrl(`/api/jobs/${currentSession.jobId}`))
        const result = (await readJsonSafe(response)) as SongJob | { message?: string }
        if (!response.ok) {
          return
        }

        if (disposed) {
          return
        }

        const nextSession = buildShowcaseSessionFromJob(result as SongJob, modalLocale, currentSession)
        saveGeneratingShowcaseSession(nextSession)

        const currentPlaybackSession = loadShowcaseSession()
        if (currentPlaybackSession?.mode === 'job' && currentPlaybackSession.jobId === nextSession.jobId) {
          saveShowcaseSession(nextSession)
        }
      } catch {
        // Keep the last known Showcase session until the next successful sync.
      }
    }

    void syncActiveShowcaseSession()

    const handleRefresh = () => {
      if (document.visibilityState === 'hidden') {
        return
      }

      void syncActiveShowcaseSession()
    }

    const timer = window.setInterval(() => {
      void syncActiveShowcaseSession()
    }, 5000)
    window.addEventListener('focus', handleRefresh)
    document.addEventListener('visibilitychange', handleRefresh)

    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener('focus', handleRefresh)
      document.removeEventListener('visibilitychange', handleRefresh)
    }
  }, [modalLocale])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!authSession) {
      window.localStorage.removeItem(AUTH_SESSION_KEY)
      return
    }

    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authSession))
  }, [authSession])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!adminSession) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY)
      return
    }

    window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminSession))
  }, [adminSession])

  const saveHistory = useCallback((item: HistoryItem) => {
    setSongHistory((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== item.id)]
      return next
    })
  }, [])

  const addPendingMemberSongs = useCallback((items: HistoryItem[]) => {
    if (!items.length) {
      return
    }

    setSongHistory((current) => {
      const existingIds = new Set(items.map((item) => item.id))
      const readyEntries = current.filter((entry) => !isPendingHistoryItem(entry))
      return [...items, ...readyEntries.filter((entry) => !existingIds.has(entry.id))]
    })
  }, [])

  const handleAuthSuccess = useCallback((session: AuthSession) => {
    setSongHistory([])
    setAuthSession(session)
  }, [])

  const handleAuthProfileUpdate = useCallback((profile: MemberProfile) => {
    setAuthSession((current) => {
      if (!current || current.authToken.trim() === '' || current.email !== profile.email) {
        return current
      }

      return {
        ...current,
        email: profile.email || current.email,
        partnerName: profile.partnerName || current.partnerName,
        plan: profile.plan || current.plan,
        heartBeansBalance: typeof profile.heartBeansBalance === 'number' ? profile.heartBeansBalance : current.heartBeansBalance,
        topupHeartBeansBalance: typeof profile.topupHeartBeansBalance === 'number' ? profile.topupHeartBeansBalance : current.topupHeartBeansBalance,
        subscriptionHeartBeansBalance: typeof profile.subscriptionHeartBeansBalance === 'number' ? profile.subscriptionHeartBeansBalance : current.subscriptionHeartBeansBalance,
        subscriptionStatus: profile.subscriptionStatus || current.subscriptionStatus,
        subscriptionPlanId: profile.subscriptionPlanId || current.subscriptionPlanId,
        subscriptionCurrentPeriodEnd: profile.subscriptionCurrentPeriodEnd || current.subscriptionCurrentPeriodEnd,
        stripeCustomerId: profile.stripeCustomerId || current.stripeCustomerId,
        paypalSubscriptionId: profile.paypalSubscriptionId || current.paypalSubscriptionId,
        subscriptionProvider: profile.subscriptionProvider || current.subscriptionProvider,
        lastAuthAt: profile.lastAuthAt || current.lastAuthAt,
        avatarUrl: profile.avatarUrl || current.avatarUrl,
      }
    })
  }, [])

  const handleLogout = useCallback(() => {
    const currentSession = authSession
    if (currentSession?.authToken) {
      void fetch(apiUrl('/api/member/logout'), {
        method: 'POST',
        headers: getMemberAuthHeaders(currentSession),
      }).catch(() => {})
    }

    setAuthSession(null)
    setSongHistory([])
  }, [authSession])

  const handleAdminLogin = useCallback((session: AdminSession) => {
    setAdminSession(session)
  }, [])

  const handleAdminLogout = useCallback(() => {
    setAdminSession(null)
  }, [])

  const upsertFloatingPlayer = useCallback((payload: FloatingPhonePlayerPayload) => {
    setFloatingPlayer((current) => ({
      key: payload.key,
      locale: payload.locale ?? current?.locale ?? 'en',
      title: payload.title ?? current?.title ?? 'MelodyVow',
      subtitle: payload.subtitle ?? current?.subtitle ?? '',
      eyebrow: payload.eyebrow ?? current?.eyebrow ?? 'MelodyVow',
      tracks: payload.tracks ?? current?.tracks ?? [],
      activeTrackIndex: payload.activeTrackIndex ?? current?.activeTrackIndex ?? 0,
      canClose: payload.canClose ?? current?.canClose ?? true,
      isGenerating: payload.isGenerating ?? current?.isGenerating ?? false,
      generationProgress: payload.generationProgress ?? current?.generationProgress ?? 0,
      generationLabel: payload.generationLabel ?? current?.generationLabel ?? '',
      statusText: payload.statusText ?? current?.statusText ?? '',
      lyrics: payload.lyrics ?? current?.lyrics ?? '',
      error: payload.error ?? current?.error ?? '',
      autoPlay: payload.autoPlay ?? current?.autoPlay ?? false,
    }))
  }, [])

  const closeFloatingPlayer = useCallback(() => {
    setFloatingPlayer((current) => {
      if (!current || !current.canClose) {
        return current
      }

      return null
    })
  }, [])

  useEffect(() => {
    if (!floatingPlayer?.isGenerating || !floatingPlayer.key || floatingPlayer.key.startsWith('pending-generate-')) {
      return
    }

    let disposed = false

    const syncFloatingJob = async (allowAutoplay = false) => {
      try {
        const response = await fetch(apiUrl(`/api/jobs/${floatingPlayer.key}`))
        const result = (await readJsonSafe(response)) as SongJob | { message?: string }

        if (!response.ok) {
          throw new Error('message' in result && result.message ? result.message : '任务查询失败。')
        }

        const job = result as SongJob
        if (disposed) {
          return
        }

        if (job.status === 'ready') {
          job.tracks?.forEach((track, index) => {
            const variantLabel = copy(floatingPlayer.locale, {
              zh: `歌曲 ${index + 1}`,
              en: `Version ${index + 1}`,
            })
            saveHistory({
              id: buildTrackHistoryId(job.id, index),
              title: track.title || job.title || floatingPlayer.title || 'MelodyVow',
              subtitle: `${summarizeStoryText(
                draft.loveStory || draft.meetingStory,
                copy(floatingPlayer.locale, {
                  zh: `${draft.groom} & ${draft.bride} 的婚礼歌`,
                  en: `${draft.groom} & ${draft.bride}'s wedding song`,
                }),
              )} · ${variantLabel}`,
              status: copy(floatingPlayer.locale, { zh: '已生成', en: 'Ready' }),
              action: copy(floatingPlayer.locale, { zh: '播放', en: 'Play' }),
              variantLabel,
              audioUrl: track.audioUrl || track.downloadUrl || '',
              downloadUrl: track.downloadUrl || track.audioUrl || '',
              createdAt: job.updatedAt,
              languageLabel: draft.languageLabel,
              styleLabel: draft.style ? getStyleLabel(floatingPlayer.locale, draft.style) : '',
              vocalLabel: draft.vocal ? getVocalLabel(floatingPlayer.locale, draft.vocal) : '',
              lyricSnippet: summarizeStoryText(job.lyrics ?? '', ''),
            })
          })
        }

        upsertFloatingPlayer(buildFloatingPlayerPayloadFromJob(job, floatingPlayer.locale, draft, '', allowAutoplay && job.status === 'ready'))
      } catch (error) {
        if (!disposed) {
          upsertFloatingPlayer({
            key: floatingPlayer.key,
            locale: floatingPlayer.locale,
            canClose: true,
            isGenerating: false,
            generationProgress: 0,
            error: error instanceof Error ? error.message : '任务查询失败。',
            statusText: error instanceof Error ? error.message : '任务查询失败。',
          })
        }
      }
    }

    void syncFloatingJob(true)
    const timer = window.setInterval(() => {
      void syncFloatingJob()
    }, 5000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [draft, floatingPlayer, saveHistory, upsertFloatingPlayer])

  function renderChineseRoute(fallbackPath: string, element: ReactNode) {
    return siteConfig.enableChineseSite ? element : <Navigate to={fallbackPath} replace />
  }

  if (!siteConfigReady) {
    return <div className="app-loading-shell">Loading MelodyVow...</div>
  }

  return (
    <SiteConfigContext.Provider value={siteConfig}>
      <ScrollManager />

      <Routes>
        <Route path="/" element={<Navigate to="/en" replace />} />
        <Route
          path="/zh"
          element={renderChineseRoute('/en', (
            <HomePage
              locale="zh"
              draft={draft}
              setDraft={setDraft}
              onOpenModal={setModalMessage}
              onUpsertFloatingPlayer={upsertFloatingPlayer}
              onLogout={handleLogout}
              authSession={authSession}
              onAddPendingMemberSongs={addPendingMemberSongs}
            />
          ))}
        />
        <Route
          path="/zh/how-it-works"
          element={renderChineseRoute('/en/how-it-works', <ShowcasePage locale="zh" authSession={authSession} onLogout={handleLogout} onUpsertFloatingPlayer={upsertFloatingPlayer} />)}
        />
        <Route
          path="/zh/styles"
          element={renderChineseRoute('/en/styles', (
            <StylesPage locale="zh" draft={draft} setDraft={setDraft} authSession={authSession} onLogout={handleLogout} />
          ))}
        />
        <Route
          path="/zh/preview"
          element={renderChineseRoute('/en/preview', <PreviewPage locale="zh" draft={draft} authSession={authSession} onLogout={handleLogout} onUpsertFloatingPlayer={upsertFloatingPlayer} />)}
        />
        <Route
          path="/zh/pricing"
          element={renderChineseRoute('/en/pricing', (
            <PricingPage
              locale="zh"
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              authSession={authSession}
              onLogout={handleLogout}
            />
          ))}
        />
        <Route path="/zh/legal" element={renderChineseRoute('/en/legal', <LegalPage locale="zh" policy="legal" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/delivery-fulfillment" element={renderChineseRoute('/en/delivery-fulfillment', <LegalPage locale="zh" policy="legal" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/privacy-policy" element={renderChineseRoute('/en/privacy-policy', <LegalPage locale="zh" policy="legal" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/terms-of-service" element={renderChineseRoute('/en/terms-of-service', <LegalPage locale="zh" policy="legal" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/refund-policy" element={renderChineseRoute('/en/refund-policy', <LegalPage locale="zh" policy="legal" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/cancellation-policy" element={renderChineseRoute('/en/cancellation-policy', <LegalPage locale="zh" policy="legal" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/find-my-order" element={renderChineseRoute('/en/find-my-order', <LegalPage locale="zh" policy="find-order" authSession={authSession} onLogout={handleLogout} />)} />
        <Route
          path="/zh/checkout"
          element={renderChineseRoute('/en/checkout', (
            <CheckoutPage
              locale="zh"
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              authSession={authSession}
              onLogout={handleLogout}
            />
          ))}
        />
        <Route
          path="/zh/auth"
          element={renderChineseRoute('/en/auth', (
            <AuthPage
              locale="zh"
              draft={draft}
              selectedPlan={selectedPlan}
              onOpenModal={setModalMessage}
              onAuthSuccess={handleAuthSuccess}
              onLogout={handleLogout}
              authSession={authSession}
            />
          ))}
        />
        <Route
          path="/zh/account"
          element={renderChineseRoute('/en/account', (
            <AccountPage
              locale="zh"
              selectedPlan={selectedPlan}
              onOpenModal={setModalMessage}
              history={songHistory}
              onLogout={handleLogout}
              authSession={authSession}
              onUpsertFloatingPlayer={upsertFloatingPlayer}
              onAuthSessionUpdate={handleAuthProfileUpdate}
            />
          ))}
        />
        <Route
          path="/zh/complete"
          element={renderChineseRoute('/en/complete', (
            <CompletePage
              locale="zh"
              draft={draft}
              onOpenModal={setModalMessage}
              authSession={authSession}
              onLogout={handleLogout}
            />
          ))}
        />
        <Route
          path="/admin/login"
          element={<AdminLoginPage session={adminSession} onLogin={handleAdminLogin} />}
        />
        <Route
          path="/admin"
          element={<AdminDashboardPage session={adminSession} onLogout={handleAdminLogout} />}
        />

        <Route
          path="/en"
          element={
            <HomePage
              locale="en"
              draft={draft}
              setDraft={setDraft}
              onOpenModal={setModalMessage}
              onUpsertFloatingPlayer={upsertFloatingPlayer}
              onLogout={handleLogout}
              authSession={authSession}
              onAddPendingMemberSongs={addPendingMemberSongs}
            />
          }
        />
        <Route
          path="/en/how-it-works"
          element={<ShowcasePage locale="en" authSession={authSession} onLogout={handleLogout} onUpsertFloatingPlayer={upsertFloatingPlayer} />}
        />
        <Route
          path="/en/styles"
          element={
            <StylesPage locale="en" draft={draft} setDraft={setDraft} authSession={authSession} onLogout={handleLogout} />
          }
        />
        <Route
          path="/en/preview"
          element={<PreviewPage locale="en" draft={draft} authSession={authSession} onLogout={handleLogout} onUpsertFloatingPlayer={upsertFloatingPlayer} />}
        />
        <Route
          path="/en/pricing"
          element={
            <PricingPage
              locale="en"
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              authSession={authSession}
              onLogout={handleLogout}
            />
          }
        />
        <Route path="/en/legal" element={<LegalPage locale="en" policy="legal" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/delivery-fulfillment" element={<LegalPage locale="en" policy="legal" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/privacy-policy" element={<LegalPage locale="en" policy="legal" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/terms-of-service" element={<LegalPage locale="en" policy="legal" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/refund-policy" element={<LegalPage locale="en" policy="legal" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/cancellation-policy" element={<LegalPage locale="en" policy="legal" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/find-my-order" element={<LegalPage locale="en" policy="find-order" authSession={authSession} onLogout={handleLogout} />} />
        <Route
          path="/en/checkout"
          element={
            <CheckoutPage
              locale="en"
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              authSession={authSession}
              onLogout={handleLogout}
            />
          }
        />
        <Route
          path="/en/auth"
          element={
            <AuthPage
              locale="en"
              draft={draft}
              selectedPlan={selectedPlan}
              onOpenModal={setModalMessage}
              onAuthSuccess={handleAuthSuccess}
              onLogout={handleLogout}
              authSession={authSession}
            />
          }
        />
        <Route
          path="/en/account"
          element={
            <AccountPage
              locale="en"
              selectedPlan={selectedPlan}
              onOpenModal={setModalMessage}
              history={songHistory}
              onLogout={handleLogout}
              authSession={authSession}
              onUpsertFloatingPlayer={upsertFloatingPlayer}
              onAuthSessionUpdate={handleAuthProfileUpdate}
            />
          }
        />
        <Route
          path="/en/complete"
          element={
            <CompletePage
              locale="en"
              draft={draft}
              onOpenModal={setModalMessage}
              authSession={authSession}
              onLogout={handleLogout}
            />
          }
        />

        <Route path="*" element={<Navigate to="/en" replace />} />
      </Routes>

      {modalMessage ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalMessage('')}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-badge">MelodyVow</div>
            <h2 id="modal-title">{modalMessage}</h2>
            <p>
              {copy(modalLocale, {
                zh: '这是一个可演示前端原型，当前操作已完成视觉和交互模拟，后续可继续接入登录、支付、音频生成与下载接口。',
                en: 'This is a polished frontend prototype. The current flow already demonstrates the UX and is ready for auth, payment, song generation and file delivery APIs.',
              })}
            </p>
            <button type="button" className="primary-button" onClick={() => setModalMessage('')}>
              {copy(modalLocale, { zh: '我知道了', en: 'Got it' })}
            </button>
          </div>
        </div>
      ) : null}

      {floatingPlayer && !shouldHideFloatingPlayer ? (
        <FloatingPhonePlayer
          player={floatingPlayer}
          onClose={closeFloatingPlayer}
        />
      ) : null}
    </SiteConfigContext.Provider>
  )
}

function FloatingPhonePlayer({
  player,
  onClose,
}: {
  player: FloatingPhonePlayerState
  onClose: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [activeTrackIndex, setActiveTrackIndex] = useState(player.activeTrackIndex ?? 0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)

  useEffect(() => {
    setActiveTrackIndex(player.activeTrackIndex ?? 0)
    setProgress(0)
    setPlaying(false)
  }, [player.key, player.activeTrackIndex])

  useEffect(() => {
    dragOffsetRef.current = dragOffset
  }, [dragOffset])

  const tracks = player.tracks ?? []

  const clampDragOffset = useCallback((nextOffset: { x: number, y: number }) => {
    if (typeof window === 'undefined') {
      return nextOffset
    }

    const dialog = dialogRef.current
    if (!dialog) {
      return nextOffset
    }

    const rect = dialog.getBoundingClientRect()
    const safeMargin = window.innerWidth <= 768 ? 12 : 18
    const minVisibleWidth = Math.min(Math.max(rect.width * 0.42, 112), rect.width - safeMargin)
    const minVisibleHeight = Math.min(Math.max(rect.height * 0.36, 92), rect.height - safeMargin)
    const minX = -(rect.left + rect.width - minVisibleWidth)
    const maxX = window.innerWidth - rect.left - minVisibleWidth
    const minY = -(rect.top + rect.height - minVisibleHeight)
    const maxY = window.innerHeight - rect.top - minVisibleHeight

    return {
      x: clamp(nextOffset.x, minX, maxX),
      y: clamp(nextOffset.y, minY, maxY),
    }
  }, [])

  useLayoutEffect(() => {
    setDragOffset((current) => clampDragOffset(current))
  }, [clampDragOffset, player.isGenerating, player.key, tracks.length])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleViewportChange = () => {
      setDragOffset((current) => clampDragOffset(current))
    }

    window.addEventListener('resize', handleViewportChange)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
    }
  }, [clampDragOffset])

  const safeActiveTrackIndex = tracks.length ? Math.min(activeTrackIndex, tracks.length - 1) : 0
  const activeTrack = tracks[safeActiveTrackIndex] ?? null
  const activeTrackUrl = activeTrack?.audioUrl || activeTrack?.downloadUrl || ''

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    }

    const handlePlay = () => {
      setPlaying(true)
    }

    const handlePause = () => {
      setPlaying(false)
    }

    const handleEnded = () => {
      setPlaying(false)
      setProgress(100)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (!activeTrackUrl) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      return
    }

    audio.src = activeTrackUrl
    audio.load()

    if (!player.autoPlay) {
      return
    }

    const tryAutoplay = async () => {
      try {
        await audio.play()
      } catch {}
    }

    void tryAutoplay()
  }, [activeTrackUrl, player.autoPlay, player.key, player.locale])

  function togglePlayback() {
    const audio = audioRef.current
    if (!audio || !activeTrackUrl) {
      return
    }

    if (audio.paused) {
      void audio.play()
      return
    }

    audio.pause()
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    const target = event.target
    if (target instanceof HTMLElement && target.closest('button, input, a, textarea, select, label, [data-no-drag]')) {
      return
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: dragOffset.x,
      originY: dragOffset.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    const nextOffset = clampDragOffset({
      x: dragState.originX + (event.clientX - dragState.startX),
      y: dragState.originY + (event.clientY - dragState.startY),
    })
    setDragOffset(nextOffset)
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const miniStatus = player.isGenerating
    ? copy(player.locale, {
        zh: `生成中 ${Math.round(player.generationProgress)}%`,
        en: `Generating ${Math.round(player.generationProgress)}%`,
      })
    : activeTrack?.subtitle || player.subtitle || copy(player.locale, { zh: '正在播放', en: 'Now Playing' })
  const miniProgress = player.isGenerating ? player.generationProgress : progress
  const lyricsPreview = (player.error || '').trim() || (player.lyrics || '').trim() || player.statusText || player.generationLabel || copy(player.locale, {
    zh: '歌词会在这里显示，播放时也能继续保留可见。',
    en: 'Lyrics will appear here and stay visible while you listen.',
  })

  return (
    <div className="floating-phone-backdrop" role="presentation">
      <div
        className="floating-phone-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-label="Floating song player"
        style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
      >
        <div
          className={`home-phone-shell floating-phone-shell floating-phone-shell-mini ${player.isGenerating ? 'is-generating' : ''}`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <audio ref={audioRef} preload="metadata" />
          <div className="floating-phone-compact">
            <div className="floating-phone-drag-area floating-phone-mini-main">
              <div className="floating-phone-compact-copy">
                <span className="floating-phone-mini-eyebrow">{player.eyebrow || 'MelodyVow'}</span>
                <strong>{activeTrack?.title || player.title}</strong>
                <span>{miniStatus}</span>
              </div>
              <div className="floating-phone-compact-actions">
                <button type="button" className="floating-phone-mini-button" onClick={togglePlayback} disabled={!activeTrackUrl}>
                  {playing ? '❚❚' : '▶'}
                </button>
                {player.canClose ? (
                  <button type="button" className="floating-phone-mini-button is-close" onClick={onClose}>
                    {copy(player.locale, { zh: '关', en: 'X' })}
                  </button>
                ) : (
                  <div className="phone-dots">{copy(player.locale, { zh: '处理中', en: 'Busy' })}</div>
                )}
              </div>
            </div>
            <div className="floating-phone-mini-progress" aria-hidden="true">
              <span className="floating-phone-mini-progress-bar" style={{ width: `${Math.max(0, Math.min(100, miniProgress))}%` }} />
            </div>
            <div className="floating-phone-mini-meta">
              <span className={`floating-phone-mini-badge ${player.error ? 'is-error' : player.isGenerating ? 'is-generating' : 'is-ready'}`}>
                {player.error
                  ? player.error
                  : player.isGenerating
                  ? player.generationLabel || copy(player.locale, { zh: '歌词与旋律生成中', en: 'Generating lyrics and melody' })
                  : player.statusText || copy(player.locale, { zh: '悬浮播放器已准备好播放。', en: 'The floating player is ready to play.' })}
              </span>
              {tracks.length > 1 ? (
                <div className="floating-phone-mini-track-tabs" role="tablist" aria-label={copy(player.locale, { zh: '版本切换', en: 'Track versions' })}>
                  {tracks.map((track, index) => (
                    <button
                      key={track.id}
                      type="button"
                      className={`floating-phone-mini-track-tab ${safeActiveTrackIndex === index ? 'is-active' : ''}`}
                      onClick={() => setActiveTrackIndex(index)}
                    >
                      {track.subtitle || copy(player.locale, { zh: `版本 ${index + 1}`, en: `Version ${index + 1}` })}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <section className="floating-phone-mini-lyrics" aria-label={copy(player.locale, { zh: '歌词小窗口', en: 'Mini lyrics panel' })}>
              <div className="floating-phone-mini-lyrics-head">
                <strong>{copy(player.locale, { zh: 'Lyrics', en: 'Lyrics' })}</strong>
              </div>
              <div className="floating-phone-mini-lyrics-body" data-no-drag="true">
                <p>{lyricsPreview}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function SiteLayout({
  locale,
  title,
  subtitle,
  eyebrow,
  active,
  onOpenModal: _onOpenModal,
  onLogout,
  authSession,
  homePanel,
  hideHero = false,
  plainPage = false,
  children,
}: LayoutProps) {
  const siteConfig = useSiteConfig()
  const isMobileViewport = useIsMobileViewport()
  const [menuOpen, setMenuOpen] = useState(false)
  const [memberMenuOpen, setMemberMenuOpen] = useState(false)
  const [memberInboxPanelOpen, setMemberInboxPanelOpen] = useState(false)
  const [memberInboxLoading, setMemberInboxLoading] = useState(false)
  const [memberInbox, setMemberInbox] = useState<MemberInboxMessage[]>([])
  const [resolvedBackgroundTheme, setResolvedBackgroundTheme] = useState<ResolvedBackgroundThemeId>(() => resolveBackgroundTheme(siteConfig.backgroundTheme))
  const memberMenuRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const useHomeMobileChrome = ['home', 'how', 'styles', 'pricing', 'account'].includes(active)
  const currentAuthSession = authSession ?? loadAuthSession()
  const currentMemberEmail = currentAuthSession?.email?.trim() || ''
  const currentMemberToken = currentAuthSession?.authToken?.trim() || ''
  const accountPath = currentAuthSession?.email ? withLocale(locale, '/account') : withLocale(locale, '/auth')
  const memberInitial = (currentAuthSession?.email?.trim()?.[0] ?? 'M').toUpperCase()
  const memberAvatarUrl = currentAuthSession?.avatarUrl?.trim()
  const memberReplyCount = memberInbox.length
  const showHeroEyebrow = Boolean(eyebrow) && !(active !== 'home' && eyebrow === 'MelodyVow')

  const loadMemberInbox = useCallback(async () => {
    if (!currentMemberEmail || !currentMemberToken) {
      setMemberInbox([])
      return
    }

    setMemberInboxLoading(true)

    try {
      const response = await fetch(apiUrl('/api/member/messages'), {
        headers: currentMemberToken ? { 'x-member-token': currentMemberToken } : {},
      })
      const result = await readJsonSafe(response) as { items?: MemberInboxMessage[] }
      setMemberInbox(Array.isArray(result.items) ? result.items : [])
    } catch {
      setMemberInbox([])
    } finally {
      setMemberInboxLoading(false)
    }
  }, [currentMemberEmail, currentMemberToken])

  useEffect(() => {
    setMemberMenuOpen(false)
    setMemberInboxPanelOpen(false)
  }, [active])

  useEffect(() => {
    void loadMemberInbox()
  }, [loadMemberInbox])

  useEffect(() => {
    const syncResolvedTheme = () => {
      setResolvedBackgroundTheme(resolveBackgroundTheme(siteConfig.backgroundTheme))
    }

    syncResolvedTheme()

    if (siteConfig.backgroundTheme !== 'auto_beijing' || typeof window === 'undefined') {
      return
    }

    const timer = window.setInterval(syncResolvedTheme, 60 * 1000)
    return () => window.clearInterval(timer)
  }, [siteConfig.backgroundTheme])

  useEffect(() => {
    if (!memberMenuOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!target || !(target instanceof Node)) {
        return
      }

      if (memberMenuRef.current && !memberMenuRef.current.contains(target)) {
        setMemberMenuOpen(false)
        setMemberInboxPanelOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [memberMenuOpen])

  const navItems = [
    { key: 'home', label: copy(locale, { zh: '首页', en: 'Home' }), to: withLocale(locale) },
    {
      key: 'how',
      label: copy(locale, { zh: '产品展示', en: 'Showcase' }),
      to: getShowcaseEntryPath(locale),
    },
    {
      key: 'styles',
      label: copy(locale, { zh: '曲风展示', en: 'Music Styles' }),
      to: withLocale(locale, '/styles'),
    },
    {
      key: 'pricing',
      label: copy(locale, { zh: '订阅套餐', en: 'Pricing' }),
      to: withLocale(locale, '/pricing'),
    },
    {
      key: 'account',
      label: copy(locale, {
        zh: currentAuthSession?.email ? '会员中心' : '登录会员',
        en: currentAuthSession?.email ? 'Account' : 'Login',
      }),
      to: accountPath,
    },
  ]

  return (
    <div
      className={`site-shell ${active === 'home' ? 'site-shell-home' : ''} ${active === 'how' ? 'site-shell-showcase' : ''} ${active === 'styles' ? 'site-shell-styles' : ''} ${active === 'pricing' ? 'site-shell-pricing' : ''} ${active === 'account' ? 'site-shell-account' : ''}`.trim()}
      data-locale={locale}
      data-background-theme={resolvedBackgroundTheme}
      data-background-theme-mode={siteConfig.backgroundTheme}
    >
      <div className="site-gradient" />
      <div className="site-noise" />
      {!plainPage ? (
        <>
          <img className="float image-float float-note left-top" src={noteImage} alt="" />
          <img className="float image-float float-ribbon right-top" src={pinkRibbonImage} alt="" />
          <img className="float image-float float-heart right-mid" src={pinkHeartImage} alt="" />
          <img className="float image-float float-ribbon left-mid pink" src={tealRibbonImage} alt="" />
        </>
      ) : null}

      <header className={`site-header ${useHomeMobileChrome ? 'site-header-home' : ''}`.trim()}>
        <button
          type="button"
          className="brand-mark brand-button"
          onClick={() => navigate(withLocale(locale))}
        >
          MelodyVow
        </button>

        <button
          type="button"
          className="nav-toggle"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-label={copy(locale, { zh: '切换导航菜单', en: 'Toggle navigation menu' })}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`site-nav ${active === 'home' ? 'site-nav-home' : ''} ${menuOpen ? 'is-open' : ''}`.trim()}>
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              className={`nav-link ${active === item.key ? 'active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={`header-actions ${currentAuthSession?.email ? 'has-member-menu' : ''}`.trim()}>
          {siteConfig.enableChineseSite ? (
            <button
              type="button"
              className="ghost-button locale-switch"
              onClick={() =>
                navigate(
                  active === 'how'
                    ? getShowcaseEntryPath(locale === 'zh' ? 'en' : 'zh')
                    : locale === 'zh'
                    ? withLocale('en', active === 'home' ? '' : activeToPath(active))
                    : withLocale('zh', active === 'home' ? '' : activeToPath(active)),
                )
              }
            >
              {locale === 'zh' ? 'EN' : '中文'}
            </button>
          ) : null}
          {currentAuthSession?.email ? (
            <div className="member-menu" ref={memberMenuRef}>
              <button
                type="button"
                className={`member-avatar-button ${memberReplyCount ? 'has-alert' : ''}`.trim()}
                onClick={() => {
                  setMemberMenuOpen((value) => {
                    const next = !value
                    if (next) {
                      void loadMemberInbox()
                    }
                    if (!next) {
                      setMemberInboxPanelOpen(false)
                    }
                    return next
                  })
                }}
                aria-label={copy(locale, { zh: '打开会员菜单', en: 'Open member menu' })}
                aria-haspopup="menu"
                aria-expanded={memberMenuOpen}
              >
                {memberAvatarUrl ? (
                  <img className="member-avatar-image" src={memberAvatarUrl} alt="" />
                ) : (
                  <span className="member-avatar-initial">{memberInitial}</span>
                )}
                {memberReplyCount ? (
                  <span className="member-avatar-badge">{memberReplyCount > 9 ? '9+' : memberReplyCount}</span>
                ) : null}
              </button>
              {memberMenuOpen ? (
                <div className="member-menu-popover" role="menu">
                  <button
                    type="button"
                    className={`member-menu-item member-menu-item-inbox ${memberReplyCount ? 'is-highlighted' : ''} ${memberInboxPanelOpen ? 'is-open' : ''}`.trim()}
                    role="menuitem"
                    aria-expanded={memberInboxPanelOpen}
                    onClick={() => {
                      void loadMemberInbox()
                      setMemberInboxPanelOpen((value) => !value)
                    }}
                  >
                    <span className="member-menu-item-copy">
                      <span>{copy(locale, { zh: '留言回复', en: 'Replies' })}</span>
                      <span className="member-menu-item-subtle">
                        {memberReplyCount
                          ? copy(locale, {
                              zh: `${memberReplyCount} 条新回复`,
                              en: `${memberReplyCount} new replies`,
                            })
                          : copy(locale, {
                              zh: '查看后台私密回复',
                              en: 'Private admin replies',
                            })}
                      </span>
                    </span>
                    <span className="member-menu-item-meta">
                      {memberReplyCount ? <span className="member-menu-item-dot" aria-hidden="true" /> : null}
                      <span className="member-menu-item-count">{memberReplyCount > 9 ? '9+' : memberReplyCount || ''}</span>
                    </span>
                  </button>
                  {memberInboxPanelOpen ? (
                    <section className="member-inbox-panel" aria-label={copy(locale, { zh: '留言回复面板', en: 'Reply panel' })}>
                      <div className="member-inbox-panel-head">
                        <strong>{copy(locale, { zh: '后台回复', en: 'Admin Replies' })}</strong>
                        <span>
                          {memberInboxLoading
                            ? copy(locale, {
                                zh: '同步中...',
                                en: 'Refreshing...',
                              })
                            : memberReplyCount
                            ? copy(locale, {
                                zh: `共 ${memberReplyCount} 条`,
                                en: `${memberReplyCount} total`,
                              })
                            : copy(locale, {
                                zh: '暂无回复',
                                en: 'No replies yet',
                              })}
                        </span>
                      </div>
                      {memberInboxLoading ? (
                        <div className="member-inbox-empty">
                          <strong>{copy(locale, { zh: '正在同步回复', en: 'Refreshing replies' })}</strong>
                          <p>
                            {copy(locale, {
                              zh: '我们正在重新获取后台最新回复。',
                              en: 'We are fetching the latest replies from the admin desk.',
                            })}
                          </p>
                        </div>
                      ) : memberInbox.length ? memberInbox.slice(0, 3).map((item) => {
                        const repliedTime = item.repliedAt
                          ? new Date(item.repliedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')
                          : '-'

                        return (
                          <article key={item.id} className="member-inbox-card">
                            <p className="member-inbox-label">{copy(locale, { zh: '你的留言', en: 'Your message' })}</p>
                            <p className="member-inbox-question">{item.message}</p>
                            <p className="member-inbox-label">{copy(locale, { zh: '后台回复', en: 'Admin reply' })}</p>
                            <p className="member-inbox-answer">{item.adminReply}</p>
                            <p className="member-inbox-time">{repliedTime}</p>
                          </article>
                        )
                      }) : (
                        <div className="member-inbox-empty">
                          <strong>{copy(locale, { zh: '还没有新回复', en: 'No replies yet' })}</strong>
                          <p>
                            {copy(locale, {
                              zh: '你在首页提交留言后，后台回复会出现在这里。',
                              en: 'Replies from the admin team will appear here after you send a message from the homepage.',
                            })}
                          </p>
                        </div>
                      )}
                    </section>
                  ) : null}
                  <button
                    type="button"
                    className="member-menu-item"
                    role="menuitem"
                    onClick={() => {
                      setMemberMenuOpen(false)
                      navigate(withLocale(locale, '/account'))
                    }}
                  >
                    {copy(locale, { zh: '会员中心', en: 'Account' })}
                  </button>
                  <button
                    type="button"
                    className="member-menu-item danger"
                    role="menuitem"
                    onClick={() => {
                      setMemberMenuOpen(false)
                      onLogout?.()
                      navigate(withLocale(locale, '/auth'))
                    }}
                  >
                    {copy(locale, { zh: '退出登录', en: 'Log out' })}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <main className={`page-container ${!hideHero && active === 'home' && homePanel ? 'page-container-home' : ''}`.trim()}>
        {!hideHero && active === 'home' && homePanel ? (
          <section className="home-hero-layout">
            <section className="hero-banner hero-banner-home">
              {showHeroEyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
              <div className="home-subtitle-wrap">
                <div className="headline-stack">
                  <h1 className="visually-hidden">{title}</h1>
                  <img className="hero-title-art" src={heroTitleImage} alt="" />
                </div>
                <button
                  type="button"
                  className="home-showcase-float-button"
                  onClick={() => navigate(getShowcaseEntryPath(locale))}
                >
                  <span className="home-showcase-float-button-text">
                    {copy(locale, { zh: '去看求婚成功的歌曲', en: 'See Successful Proposal Songs' })}
                  </span>
                  <span className="home-showcase-float-button-arrow-cluster" aria-hidden="true">
                    <span className="home-showcase-float-button-arrow home-showcase-float-button-arrow-primary">→</span>
                    <span className="home-showcase-float-button-arrow home-showcase-float-button-arrow-secondary">→</span>
                  </span>
                  <span className="home-showcase-float-button-particles" aria-hidden="true">
                    <span className="home-showcase-float-particle particle-1" />
                    <span className="home-showcase-float-particle particle-2" />
                    <span className="home-showcase-float-particle particle-3" />
                  </span>
                </button>
              </div>
              {isMobileViewport ? <p className="hero-subtitle home-hero-subtitle-detached">{subtitle}</p> : null}
              <div className="hero-illustration" aria-hidden="true">
                <img className="hero-ribbon hero-ribbon-right" src={purpleRibbonImage} alt="" />
                <img className="hero-ribbon hero-ribbon-bottom" src={goldRibbonImage} alt="" />
                <img className="hero-spark hero-spark-top" src={sparkImage} alt="" />
                <img className="hero-spark hero-spark-right" src={sparkImage} alt="" />
                <img className="hero-couple" src={coupleImage} alt="" />
                <img className="hero-record hero-record-main" src={recordImage} alt="" />
                <img className="hero-heart hero-heart-pink" src={pinkHeartImage} alt="" />
                <img className="hero-heart hero-heart-blue" src={blueHeartImage} alt="" />
              </div>
            </section>

            <aside className="home-phone-column">
              {homePanel}
            </aside>
          </section>
        ) : useHomeMobileChrome && ['how', 'styles', 'pricing', 'account'].includes(active) ? (
          <section className="hero-banner hero-banner-home mobile-shared-hero">
            {showHeroEyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <div className="home-subtitle-wrap">
              {isMobileViewport ? <p className="hero-subtitle">Turn Your Names Into a Wedding Song</p> : null}
            </div>
          </section>
        ) : !hideHero ? (
          <section className="hero-banner">
            {showHeroEyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <div className="headline-stack">
              <p className="brand-cn">{copy(locale, { zh: '旋律誓言', en: 'Turn love into melody' })}</p>
              {active === 'home' ? (
                <>
                  <h1 className="visually-hidden">{title}</h1>
                  <img className="hero-title-art" src={heroTitleImage} alt="" />
                </>
              ) : (
                <h1>{title}</h1>
              )}
            </div>
            <p className="hero-subtitle">{subtitle}</p>
            <div className="hero-illustration" aria-hidden="true">
              <img className="hero-ribbon hero-ribbon-left" src={tealRibbonImage} alt="" />
              <img className="hero-ribbon hero-ribbon-right" src={purpleRibbonImage} alt="" />
              <img className="hero-ribbon hero-ribbon-bottom" src={goldRibbonImage} alt="" />
              <img className="hero-note" src={noteImage} alt="" />
              <img className="hero-spark hero-spark-top" src={sparkImage} alt="" />
              <img className="hero-spark hero-spark-right" src={sparkImage} alt="" />
              <img className="hero-couple" src={coupleImage} alt="" />
              <img className="hero-record hero-record-main" src={recordImage} alt="" />
              <img className="hero-heart hero-heart-pink" src={pinkHeartImage} alt="" />
              <img className="hero-heart hero-heart-blue" src={blueHeartImage} alt="" />
            </div>
          </section>
        ) : null}

        {children}
      </main>
    </div>
  )
}

function ServiceHubSection({ locale, title, className = '' }: { locale: Locale, title: string, className?: string }) {
  const { primary, order } = getLegalLinks(locale)

  return (
    <section className={`service-hub-section ${className}`.trim()}>
      <div className="service-hub-ribbon">
        <p className="service-hub-kicker">{title}</p>
        <nav className="service-hub-inline-links" aria-label={copy(locale, { zh: '订阅服务支持链接', en: 'Subscription support links' })}>
          {primary.map((item, index) => (
            <Fragment key={item.key}>
              {index > 0 ? <span className="service-hub-divider" aria-hidden="true">/</span> : null}
              <NavLink to={item.to} className="service-hub-inline-link">
                {item.label}
              </NavLink>
            </Fragment>
          ))}
        </nav>
        <nav className="service-hub-inline-links service-hub-inline-links-order" aria-label={copy(locale, { zh: '订单查询链接', en: 'Order lookup link' })}>
          <NavLink to={order.to} className="service-hub-inline-link">
            {order.label}
          </NavLink>
        </nav>
      </div>
    </section>
  )
}

function HomeSocialLinksSection({ locale }: { locale: Locale }) {
  const items = [
    { key: 'tiktok', label: 'TikTok', icon: 'T', href: 'https://www.tiktok.com/' },
    { key: 'facebook', label: 'Facebook', icon: 'f', href: 'https://www.facebook.com/' },
    { key: 'instagram', label: 'Instagram', icon: 'IG', href: 'https://www.instagram.com/' },
    { key: 'youtube', label: 'YouTube', icon: 'YT', href: 'https://www.youtube.com/' },
  ]

  return (
    <section className="home-social-section" aria-label={copy(locale, { zh: '社交媒体链接', en: 'Social media links' })}>
      <div className="glass-card home-social-card">
        <p className="home-social-title">{copy(locale, { zh: '关注我们', en: 'Follow Us' })}</p>
        <div className="home-social-links">
          {items.map((item) => (
            <a
              key={item.key}
              className="home-social-link"
              href={item.href}
              target="_blank"
              rel="noreferrer"
            >
              <span className="home-social-link-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function HomeMessageBoardSection({
  locale,
  name,
  email,
  message,
  submitting,
  onNameChange,
  onEmailChange,
  onMessageChange,
  onSubmit,
}: {
  locale: Locale
  name: string
  email: string
  message: string
  submitting: boolean
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onMessageChange: (value: string) => void
  onSubmit: () => void
}) {
  return (
    <section className="home-trust-section" aria-label={copy(locale, { zh: '留言与支持', en: 'Messages and support' })}>
      <div className="glass-card home-message-board">
        <div className="home-trust-head">
          <p className="mini-eyebrow">{copy(locale, { zh: 'SUPPORT', en: 'SUPPORT' })}</p>
          <h3>{copy(locale, { zh: '留言板', en: 'Message Board' })}</h3>
          <p>
            {copy(locale, {
              zh: '如需人工协助、订单核对或合作沟通，可以在这里留言。后台会看到并回复。',
              en: 'Leave a note here for manual support, order checks, or partnership inquiries. Your message appears in the admin desk for reply.',
            })}
          </p>
        </div>

        <div className="home-message-form">
          <label className="field">
            <span>{copy(locale, { zh: '称呼', en: 'Name' })}</span>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={copy(locale, { zh: '可选，例如：Luna', en: 'Optional, for example: Luna' })}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="hello@melodyvow.com"
            />
          </label>
          <label className="field form-span-2">
            <span>{copy(locale, { zh: '留言内容', en: 'Your Message' })}</span>
            <textarea
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              rows={3}
              placeholder={copy(locale, {
                zh: '例如：我已付款但想确认订单、想咨询婚礼歌曲交付时间、或想合作。',
                en: 'For example: I paid and want to confirm the order, ask about delivery timing, or discuss collaboration.',
              })}
            />
          </label>
          <button type="button" className="primary-button compact home-message-submit" disabled={submitting} onClick={onSubmit}>
            {submitting
              ? copy(locale, { zh: '提交中...', en: 'Sending...' })
              : copy(locale, { zh: '提交留言', en: 'Send Message' })}
          </button>
        </div>
        <p className="form-hint">
          {copy(locale, {
            zh: '出于隐私保护，后台回复不会在首页公开展示。登录会员后，可在右上角头像菜单中的“留言回复”查看。',
            en: 'For privacy, admin replies are not shown publicly on the homepage. After logging in, you can view them from the top-right avatar menu.',
          })}
        </p>
      </div>
    </section>
  )
}

function HomeTrustFooterSection({
  locale,
  health,
}: {
  locale: Locale
  health: null | {
    ok?: boolean
    databaseEnabled?: boolean
    callbackEnabled?: boolean
    stripeConfigured?: boolean
  }
}) {
  const releaseLabel = 'Release 2026.09'
  const serviceState = health?.ok
    ? copy(locale, { zh: '站点在线', en: 'Site Online' })
    : copy(locale, { zh: '持续监控中', en: 'Under Monitoring' })
  const deliveryState = health?.callbackEnabled
    ? copy(locale, { zh: '自动回调交付', en: 'Auto Callback Delivery' })
    : copy(locale, { zh: '人工复核兜底', en: 'Manual Review Backup' })
  const persistenceState = health?.databaseEnabled
    ? copy(locale, { zh: '订单与留言持久化', en: 'Persistent Orders & Messages' })
    : copy(locale, { zh: '本地持久化模式', en: 'Local Persistence Mode' })
  const paymentState = health?.stripeConfigured
    ? copy(locale, { zh: '在线支付可用', en: 'Online Payments Ready' })
    : copy(locale, { zh: '支付通道已接入', en: 'Payment Channels Connected' })

  return (
    <section className="home-trust-section" aria-label={copy(locale, { zh: '站点可信信息', en: 'Site trust information' })}>
      <div className="glass-card home-trust-card">
        <div className="home-trust-head">
          <p className="mini-eyebrow">{copy(locale, { zh: 'TRUST', en: 'TRUST' })}</p>
          <h3>{copy(locale, { zh: '正规站点信息', en: 'Trust Signals' })}</h3>
          <p>
            {copy(locale, {
              zh: '我们提供数字化婚礼歌曲服务、政策页面、订单查询、会员中心与后台工单处理，让交易与交付路径更清晰。',
              en: 'MelodyVow includes policy pages, order lookup, member records, and admin follow-up so the purchase and delivery flow feels clear and dependable.',
            })}
          </p>
        </div>

        <div className="home-trust-metrics">
          {[serviceState, deliveryState, persistenceState, paymentState].map((item) => (
            <span key={item} className="soft-pill home-trust-pill">{item}</span>
          ))}
        </div>

        <div className="home-trust-legal">
          <NavLink to={withLocale(locale, '/legal')} className="home-trust-link">Policies</NavLink>
          <NavLink to={withLocale(locale, '/find-my-order')} className="home-trust-link">
            {copy(locale, { zh: '订单查询', en: 'Order Lookup' })}
          </NavLink>
          <NavLink to={withLocale(locale, '/auth')} className="home-trust-link">
            {copy(locale, { zh: '会员中心', en: 'Member Access' })}
          </NavLink>
        </div>

        <div className="home-trust-version">
          <span>MelodyVow</span>
          <span>{releaseLabel}</span>
          <span>{copy(locale, { zh: 'Digital Delivery Only', en: 'Digital Delivery Only' })}</span>
        </div>
      </div>
    </section>
  )
}

function HomePage({ locale, draft, setDraft, onOpenModal, onUpsertFloatingPlayer, onLogout, authSession, onAddPendingMemberSongs }: HomePageProps) {
  const navigate = useNavigate()
  const isMobileViewport = useIsMobileViewport()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMobileStoryPrompt, setShowMobileStoryPrompt] = useState(false)
  const [boardName, setBoardName] = useState('')
  const [boardEmail, setBoardEmail] = useState('')
  const [boardMessage, setBoardMessage] = useState('')
  const [boardSubmitting, setBoardSubmitting] = useState(false)
  const [siteHealth, setSiteHealth] = useState<null | {
    ok?: boolean
    databaseEnabled?: boolean
    callbackEnabled?: boolean
    stripeConfigured?: boolean
  }>(null)
  const memberEmail = authSession?.email?.trim() || ''
  const memberToken = authSession?.authToken?.trim() || ''
  const fallbackLanguageCode = locale === 'zh' ? 'zh' : 'en'
  const fallbackLanguage = songLanguages.find((item) => item.code === fallbackLanguageCode) ?? songLanguages[0]
  const fallbackStyle = weddingStyleOptions[0]
  const fallbackVocal = vocalOptions.find((item) => item.code === 'female') ?? vocalOptions[0]

  useEffect(() => launchHomepageFireworks(), [])

  useEffect(() => {
    let disposed = false

    async function loadBoardData() {
      try {
        const healthResponse = await fetch(apiUrl('/api/health'))
        const healthResult = await readJsonSafe(healthResponse) as {
          ok?: boolean
          databaseEnabled?: boolean
          callbackEnabled?: boolean
          stripeConfigured?: boolean
        }

        if (disposed) {
          return
        }

        setSiteHealth(healthResult || null)
      } catch {
        if (!disposed) {
          setSiteHealth(null)
        }
      }
    }

    void loadBoardData()

    return () => {
      disposed = true
    }
  }, [])

  const collectVisibleDraftValues = useCallback(() => {
    if (typeof document === 'undefined') {
      return {} as Partial<SongDraft>
    }

    const readFieldValue = (field: string) => {
      const elements = Array.from(
        document.querySelectorAll(`[data-home-draft-field="${field}"]`),
      ) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>

      const firstNonEmpty = elements
        .map((element) => String(element.value || ''))
        .find((value) => value.trim())

      if (firstNonEmpty) {
        return firstNonEmpty
      }

      return elements.length ? String(elements[0].value || '') : ''
    }

    const languageCode = readFieldValue('languageCode').trim()
    const languageLabel = languageCode
      ? songLanguages.find((item) => item.code === languageCode)?.label ?? ''
      : ''

    return {
      groom: readFieldValue('groom'),
      bride: readFieldValue('bride'),
      loveStory: readFieldValue('loveStory'),
      languageCode,
      languageLabel,
    } as Partial<SongDraft>
  }, [])

  const buildEffectiveDraft = useCallback(() => {
    const visibleValues = collectVisibleDraftValues()
    const mergedDraft = normalizeSongDraft({
      ...draft,
      ...Object.fromEntries(
        Object.entries(visibleValues).filter(([, value]) => typeof value !== 'string' || value !== ''),
      ),
    })

    if (mergedDraft.languageCode && !mergedDraft.languageLabel) {
      mergedDraft.languageLabel = songLanguages.find((item) => item.code === mergedDraft.languageCode)?.label ?? ''
    }

    if (mergedDraft.vocal && !mergedDraft.vocalLabel) {
      mergedDraft.vocalLabel = getVocalLabel(locale, mergedDraft.vocal)
    }

    return mergedDraft
  }, [collectVisibleDraftValues, draft, locale])

  const syncVisibleDraftIntoState = useCallback(() => {
    const nextDraft = buildEffectiveDraft()
    if (!areSongDraftsEqual(nextDraft, draft)) {
      setDraft(nextDraft)
    }
    return nextDraft
  }, [buildEffectiveDraft, draft, setDraft])

  useEffect(() => {
    const syncFromVisibleInputs = () => {
      syncVisibleDraftIntoState()
    }

    syncFromVisibleInputs()

    if (typeof window === 'undefined') {
      return
    }

    window.addEventListener('pageshow', syncFromVisibleInputs)
    window.addEventListener('focus', syncFromVisibleInputs)
    return () => {
      window.removeEventListener('pageshow', syncFromVisibleInputs)
      window.removeEventListener('focus', syncFromVisibleInputs)
    }
  }, [syncVisibleDraftIntoState])

  function handleCreateSongEntry() {
    syncVisibleDraftIntoState()
    setShowMobileStoryPrompt(true)
  }

  async function handleSubmitBoardMessage() {
    const nextEmail = boardEmail.trim()
    const nextMessage = boardMessage.trim()

    if (!nextEmail) {
      onOpenModal(copy(locale, {
        zh: '请先填写一个可联系的邮箱，这样我们才能在后台定位并回复你的留言。',
        en: 'Please provide a contact email so the admin team can identify and reply to your note.',
      }))
      return
    }

    if (!nextMessage) {
      onOpenModal(copy(locale, {
        zh: '请先写下你的留言内容。',
        en: 'Please enter your message first.',
      }))
      return
    }

    setBoardSubmitting(true)
    try {
      const response = await fetch(apiUrl('/api/messages'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: boardName.trim(),
          email: nextEmail,
          message: nextMessage,
        }),
      })

      const result = await readJsonSafe(response) as { message?: string }

      if (!response.ok) {
        throw new Error(result.message || copy(locale, { zh: '留言提交失败。', en: 'Failed to send your message.' }))
      }

      setBoardName('')
      setBoardEmail('')
      setBoardMessage('')
      onOpenModal(copy(locale, {
        zh: '留言已提交。后台现在可以看到这条信息，并在处理后给出回复。',
        en: 'Your message has been submitted. The admin team can now review it and reply from the dashboard.',
      }))
    } catch (error) {
      onOpenModal(error instanceof Error ? error.message : copy(locale, { zh: '留言提交失败。', en: 'Failed to send your message.' }))
    } finally {
      setBoardSubmitting(false)
    }
  }

  async function handleGenerateSong() {
    const effectiveDraft = syncVisibleDraftIntoState()

    if (!memberEmail || !memberToken) {
      const message = copy(locale, {
        zh: '请先登录会员后再生成歌曲，这样新生成的歌曲才能自动绑定到你的会员中心。',
        en: 'Please log in before generating a song so it can be saved to your account automatically.',
      })
      onOpenModal(message)
      setShowMobileStoryPrompt(false)
      navigate(withLocale(locale, '/auth'))
      return
    }

    setIsSubmitting(true)
    const groomName = effectiveDraft.groom.trim() || copy(locale, { zh: '新郎', en: 'Groom' })
    const brideName = effectiveDraft.bride.trim() || copy(locale, { zh: '新娘', en: 'Bride' })
    const languageCode = effectiveDraft.languageCode.trim() || fallbackLanguage.code
    const languageLabel = effectiveDraft.languageLabel.trim() || fallbackLanguage.label
    const style = effectiveDraft.style.trim() || fallbackStyle.id
    const selectedStyle = getStyleOption(style) ?? fallbackStyle
    const styleLabel = effectiveDraft.style.trim() ? getStyleLabel(locale, effectiveDraft.style) : (locale === 'zh' ? fallbackStyle.zhLabel : fallbackStyle.enLabel)
    const styleGenerationRequest = buildStyleGenerationRequest(selectedStyle, effectiveDraft.occasion)
    const styleLyricsRequest = buildStyleLyricsRequest(selectedStyle, effectiveDraft.occasion)
    const vocal = effectiveDraft.vocal.trim() || fallbackVocal.code
    const vocalLabel = effectiveDraft.vocal.trim() ? getVocalLabel(locale, effectiveDraft.vocal) : (locale === 'zh' ? fallbackVocal.zhLabel : fallbackVocal.enLabel)
    const initialLyrics = [effectiveDraft.loveStory, effectiveDraft.meetingStory, effectiveDraft.vowKeywords].filter(Boolean).join('\n\n').trim()

    const pendingPlayerKey = `pending-generate-${locale}`
    if (!isMobileViewport) {
      onUpsertFloatingPlayer({
        key: pendingPlayerKey,
        locale,
        title: `${groomName} & ${brideName}`,
        subtitle: `${languageLabel} · ${styleLabel} · ${vocalLabel}`,
        eyebrow: copy(locale, { zh: '婚礼歌生成器', en: 'Wedding Song Generator' }),
        tracks: [],
        canClose: false,
        isGenerating: true,
        generationProgress: 6,
        generationLabel: copy(locale, {
          zh: '正在提交婚礼歌曲生成请求，请稍候...',
          en: 'Submitting your wedding song request...',
        }),
        statusText: copy(locale, {
          zh: '悬浮播放器已经打开，后续生成进度会持续显示在这里。',
          en: 'The floating player is open and will keep showing progress here.',
        }),
        lyrics: effectiveDraft.loveStory || effectiveDraft.meetingStory || effectiveDraft.vowKeywords,
        error: '',
        autoPlay: false,
      })
    }

    try {
      const response = await fetch(apiUrl('/api/generate-song'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getMemberAuthHeaders(authSession),
        },
        body: JSON.stringify({
          groom: groomName,
          bride: brideName,
          userEmail: memberEmail,
          occasion: effectiveDraft.occasion,
          style,
          styleLabel,
          styleContinent: selectedStyle.continent || '',
          styleRegion: selectedStyle.region || '',
          styleWeddingMusicType: selectedStyle.weddingMusicType || '',
          styleProposalMusicType: selectedStyle.proposalMusicType || '',
          styleSignatureForm: selectedStyle.signatureForm || '',
          styleGenerationRequest,
          styleLyricsRequest,
          languageCode,
          languageLabel,
          vocal,
          vocalLabel,
          loveStory: effectiveDraft.loveStory,
          meetingStory: effectiveDraft.meetingStory,
          vowKeywords: effectiveDraft.vowKeywords,
        }),
      })

      const result = (await readJsonSafe(response)) as { jobId?: string; message?: string }

      if (!response.ok || !result.jobId) {
        if (response.status === 401 || response.status === 403) {
          onLogout()
          navigate(withLocale(locale, '/auth'))
        }
        throw new Error(result.message ?? '生成请求失败，请稍后再试。')
      }

      if (isMobileViewport) {
        onAddPendingMemberSongs(buildPendingHistoryItems({
          jobId: result.jobId,
          title: `${groomName} & ${brideName}`,
          subtitle: `${languageLabel} · ${styleLabel} · ${vocalLabel}`,
          languageLabel,
          styleLabel,
          vocalLabel,
          lyricSnippet: initialLyrics,
          lyrics: initialLyrics,
        }))
        saveShowcaseSession({
          mode: 'job',
          jobId: result.jobId,
          title: `${groomName} & ${brideName}`,
          subtitle: `${languageLabel} · ${styleLabel} · ${vocalLabel}`,
          lyrics: initialLyrics,
          statusText: copy(locale, {
            zh: '歌词已提交到生成流程，Showcase 会在这里持续显示歌词与生成进度。',
            en: 'Lyrics have entered the generation flow. Showcase will keep showing the lyrics and progress here.',
          }),
          generationProgress: 12,
          isGenerating: true,
          tracks: [],
        })
        setShowMobileStoryPrompt(false)
        navigate(withLocale(locale, `/how-it-works?mode=job&job=${encodeURIComponent(result.jobId)}`))
      } else {
        onAddPendingMemberSongs(buildPendingHistoryItems({
          jobId: result.jobId,
          title: `${groomName} & ${brideName}`,
          subtitle: `${languageLabel} · ${styleLabel} · ${vocalLabel}`,
          languageLabel,
          styleLabel,
          vocalLabel,
          lyricSnippet: initialLyrics,
          lyrics: initialLyrics,
        }))
        onUpsertFloatingPlayer({
          key: result.jobId,
          locale,
          title: `${groomName} & ${brideName}`,
          subtitle: `${languageLabel} · ${styleLabel} · ${vocalLabel}`,
          eyebrow: copy(locale, { zh: '婚礼歌生成器', en: 'Wedding Song Generator' }),
          tracks: [],
          canClose: false,
          isGenerating: true,
          generationProgress: 12,
          generationLabel: copy(locale, {
            zh: '歌词与旋律已经进入生成队列，请保持弹窗开启。',
            en: 'Lyrics and melody are now in the queue. Please keep the player open.',
          }),
          statusText: copy(locale, {
            zh: '歌曲生成中，完成后两首版本会直接出现在这个悬浮播放器里。',
            en: 'Your song is generating. Both versions will appear in this floating player.',
          }),
          lyrics: effectiveDraft.loveStory || effectiveDraft.meetingStory || effectiveDraft.vowKeywords,
          error: '',
          autoPlay: false,
        })
      }
      setShowMobileStoryPrompt(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成请求失败，请稍后再试。'
      if (!isMobileViewport) {
        onUpsertFloatingPlayer({
          key: pendingPlayerKey,
          locale,
          title: `${groomName} & ${brideName}`,
          subtitle: `${languageLabel} · ${styleLabel} · ${vocalLabel}`,
          eyebrow: copy(locale, { zh: '婚礼歌生成器', en: 'Wedding Song Generator' }),
          tracks: [],
          canClose: true,
          isGenerating: false,
          generationProgress: 0,
          generationLabel: '',
          statusText: copy(locale, {
            zh: '请求没有成功发送，请检查提示信息后再试一次。',
            en: 'The request could not be sent. Please review the message and try again.',
          }),
          lyrics: effectiveDraft.loveStory || effectiveDraft.meetingStory || effectiveDraft.vowKeywords,
          error: message,
          autoPlay: false,
        })
      }
      onOpenModal(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SiteLayout
      locale={locale}
      title={copy(locale, {
        zh: '把你们的名字写进婚礼情歌',
        en: 'Your Love Deserves Its Own Song',
      })}
      subtitle={copy(locale, {
        zh: '输入新郎新娘名字，生成一首专属婚礼纪念歌曲',
        en: 'Turn Your Names Into a Wedding Song',
      })}
      eyebrow="MelodyVow"
      active="home"
      onOpenModal={onOpenModal}
      onLogout={onLogout}
      authSession={authSession}
      homePanel={(
        <>
          <section className="home-phone-shell">
            <div className="home-app-mobile">
              <div className="home-app-card-head">
                <span className="home-app-card-spacer" aria-hidden="true" />
                <p className="home-app-card-title">Successful Proposal Cases</p>
                <button
                  type="button"
                  className="home-app-card-arrow"
                  onClick={() => navigate(getShowcaseEntryPath(locale))}
                  aria-label={copy(locale, { zh: '查看样片', en: 'View showcase' })}
                >
                  ›
                </button>
              </div>

              <div className="home-app-form">
                <label className="home-app-field">
                  <input
                    data-home-draft-field="groom"
                    value={draft.groom}
                    onChange={(event) => setDraft((current) => ({ ...current, groom: event.target.value }))}
                    placeholder="Groom Name"
                  />
                </label>
                <label className="home-app-field">
                  <input
                    data-home-draft-field="bride"
                    value={draft.bride}
                    onChange={(event) => setDraft((current) => ({ ...current, bride: event.target.value }))}
                    placeholder="Bride Name"
                  />
                </label>
                <label className="home-app-field home-app-field-select">
                  <select
                    data-home-draft-field="languageCode"
                    value={draft.languageCode}
                    onChange={(event) =>
                      setDraft((current) => {
                        const selected = songLanguages.find((item) => item.code === event.target.value)
                        return {
                          ...current,
                          languageCode: event.target.value,
                          languageLabel: selected?.label ?? '',
                        }
                      })
                    }
                  >
                    <option value="">Song Language</option>
                    {songLanguages.map((language) => (
                      <option key={language.code} value={language.code}>
                        {`${language.label} / ${language.nativeLabel}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="home-app-field home-app-field-select">
                  <button
                    type="button"
                    className={`home-app-field-trigger ${draft.style ? '' : 'is-placeholder'}`.trim()}
                    onClick={() => navigate(withLocale(locale, '/styles'))}
                    aria-label={copy(locale, { zh: '选择曲风偏好', en: 'Choose music style' })}
                  >
                    {draft.style ? getStyleLabel(locale, draft.style) : 'Music Style'}
                  </button>
                </label>
              </div>

              <button
                type="button"
                className="home-app-submit"
                onClick={handleCreateSongEntry}
                disabled={isSubmitting}
              >
                Create My Song
              </button>

              <div className="home-app-voice-row" role="group" aria-label={copy(locale, { zh: '歌唱声音', en: 'Singing voice' })}>
                {vocalOptions.map((vocal) => {
                  const label = getHomeVoiceChipLabel(vocal.code)
                  const active = draft.vocal === vocal.code
                  return (
                    <button
                      key={vocal.code}
                      type="button"
                      className={`home-app-voice-chip ${active ? 'is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => setDraft((current) => ({ ...current, vocal: vocal.code, vocalLabel: getVocalLabel(locale, vocal.code) }))}
                    >
                      <span className="home-app-voice-chip-label">{label}</span>
                      <span className="home-app-voice-chip-check" aria-hidden="true">{active ? '✓' : ''}</span>
                    </button>
                  )
                })}
              </div>

            </div>

            <div className="home-phone-legacy">
              <div className="phone-brand-block">
                <h2>MelodyVow</h2>
              </div>

              <div className="phone-record-visual" aria-hidden="true">
                <img className="phone-record-disc" src={phoneDiscImage} alt="" />
                <img className="phone-record-couple" src={coupleImage} alt="" />
                <img className="phone-record-heart" src={pinkHeartImage} alt="" />
              </div>

              <div className="phone-form-grid">
                <label className="field form-span-2">
                  <span>{copy(locale, { zh: '使用场景', en: 'Occasion' })}</span>
                  <div className="occasion-switch" role="tablist" aria-label={copy(locale, { zh: '选择使用场景', en: 'Select occasion' })}>
                    {(['wedding', 'proposal'] as Occasion[]).map((occasion) => {
                      const active = draft.occasion === occasion

                      return (
                        <button
                          key={occasion}
                          type="button"
                          className={`occasion-chip ${active ? 'active' : ''}`}
                          onClick={() => setDraft((current) => ({ ...current, occasion }))}
                        >
                          {getOccasionLabel(locale, occasion)}
                        </button>
                      )
                    })}
                  </div>
                </label>

                <label className="field">
                  <span>{copy(locale, { zh: '新郎姓名', en: 'Groom Name' })}</span>
                  <input
                    data-home-draft-field="groom"
                    value={draft.groom}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, groom: event.target.value }))
                    }
                    placeholder={copy(locale, { zh: '请输入新郎姓名', en: 'Enter groom name' })}
                  />
                </label>

                <label className="field">
                  <span>{copy(locale, { zh: '新娘姓名', en: 'Bride Name' })}</span>
                  <input
                    data-home-draft-field="bride"
                    value={draft.bride}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, bride: event.target.value }))
                    }
                    placeholder={copy(locale, { zh: '请输入新娘姓名', en: 'Enter bride name' })}
                  />
                </label>

                <label className="field form-span-2">
                  <span>{copy(locale, { zh: '爱情故事', en: 'Love Story' })}</span>
                  <textarea
                    data-home-draft-field="loveStory"
                    value={draft.loveStory}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, loveStory: event.target.value }))
                    }
                    placeholder={copy(locale, {
                      zh: '简短写一点故事，让歌词更像你们。',
                      en: 'Add a short story to make the lyrics feel personal.',
                    })}
                    rows={3}
                  />
                </label>

                <label className="field">
                  <span>{copy(locale, { zh: '歌曲语言', en: 'Song Language' })}</span>
                  <select
                    data-home-draft-field="languageCode"
                    value={draft.languageCode}
                    onChange={(event) =>
                      setDraft((current) => {
                        const selected = songLanguages.find((item) => item.code === event.target.value)

                        return {
                          ...current,
                          languageCode: event.target.value,
                          languageLabel: selected?.label ?? '',
                        }
                      })
                    }
                  >
                    <option value="">
                      {copy(locale, { zh: '请选择歌曲语言', en: 'Please select a language' })}
                    </option>
                    {songLanguages.map((language) => (
                      <option key={language.code} value={language.code}>
                        {`${language.label} / ${language.nativeLabel}`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>{copy(locale, { zh: '曲风偏好', en: 'Music Style' })}</span>
                  <button
                    type="button"
                    className={`home-app-field-trigger ${draft.style ? '' : 'is-placeholder'}`.trim()}
                    onClick={() => navigate(withLocale(locale, '/styles'))}
                    aria-label={copy(locale, { zh: '选择曲风偏好', en: 'Choose music style' })}
                  >
                    {draft.style
                      ? getStyleLabel(locale, draft.style)
                      : copy(locale, { zh: '请选择曲风偏好', en: 'Please select a style' })}
                  </button>
                </label>

                <label className="field form-span-2">
                  <span>{copy(locale, { zh: '歌唱声音', en: 'Singing Voice' })}</span>
                  <select
                    value={draft.vocal}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        vocal: event.target.value,
                        vocalLabel: event.target.value ? getVocalLabel(locale, event.target.value) : '',
                      }))
                    }
                  >
                    <option value="">
                      {copy(locale, { zh: '请选择歌唱声音', en: 'Please select a voice' })}
                    </option>
                    {vocalOptions.map((vocal) => (
                      <option key={vocal.code} value={vocal.code}>
                        {locale === 'zh' ? vocal.zhLabel : vocal.enLabel}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                className="primary-button wide home-phone-submit"
                onClick={handleCreateSongEntry}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? copy(locale, { zh: '正在生成歌词与歌曲...', en: 'Generating lyrics and song...' })
                  : copy(locale, { zh: '开始生成婚礼歌', en: 'Create My Song' })}
              </button>
            </div>
          </section>

          <section className="home-app-shortcuts" aria-label={copy(locale, { zh: '快捷入口', en: 'Quick actions' })}>
            {[
              { key: 'signup', badge: 1, title: 'Sign up', to: withLocale(locale, '/auth') },
              { key: 'pricing', badge: 2, title: 'Pricing', to: withLocale(locale, '/pricing') },
              { key: 'styles', badge: 3, title: 'Music Styles', to: withLocale(locale, '/styles') },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className="home-app-shortcut-card"
                onClick={() => navigate(item.to)}
              >
                <span className="home-app-shortcut-badge">{item.badge}</span>
                <span className="home-app-shortcut-title">{item.title}</span>
                <span className="home-app-shortcut-cta">GO</span>
              </button>
            ))}
          </section>

          {showMobileStoryPrompt ? (
            <div className="home-story-prompt-backdrop" role="presentation" onClick={() => setShowMobileStoryPrompt(false)}>
              <div
                className={`home-story-prompt-shell ${isMobileViewport ? '' : 'is-desktop'}`.trim()}
                role="dialog"
                aria-modal="true"
                aria-label={copy(locale, { zh: '歌曲生成信息', en: 'Song creation details' })}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="home-story-prompt-card">
                  <div className="home-story-prompt-head">
                    <p>MelodyVow</p>
                    <button
                      type="button"
                      className="home-story-prompt-close"
                      onClick={() => setShowMobileStoryPrompt(false)}
                      aria-label={copy(locale, { zh: '关闭', en: 'Close' })}
                    >
                      ×
                    </button>
                  </div>

                  <div className="home-story-prompt-section">
                    <span className="home-story-prompt-label">Occasion</span>
                    <div className="home-story-prompt-switch" role="tablist" aria-label={copy(locale, { zh: '选择使用场景', en: 'Select occasion' })}>
                      {(['wedding', 'proposal'] as Occasion[]).map((occasion) => {
                        const active = draft.occasion === occasion
                        return (
                          <button
                            key={occasion}
                            type="button"
                            className={`home-story-prompt-chip ${active ? 'is-active' : ''}`}
                            onClick={() => setDraft((current) => ({ ...current, occasion }))}
                          >
                            {getOccasionLabel(locale, occasion)}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <label className="home-story-prompt-field">
                    <span>Love Story</span>
                    <textarea
                      data-home-draft-field="loveStory"
                      value={draft.loveStory}
                      onChange={(event) => setDraft((current) => ({ ...current, loveStory: event.target.value }))}
                      placeholder="Add a short story to make the lyrics feel personal"
                      rows={4}
                    />
                  </label>

                  <button
                    type="button"
                    className="home-story-prompt-submit"
                    onClick={() => void handleGenerateSong()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? copy(locale, { zh: '提交中...', en: 'Submitting...' }) : 'Create My Song'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

        </>
      )}
    >
      <ServiceHubSection
        locale={locale}
        title={copy(locale, {
          zh: '服务与订单',
          en: 'Support & Orders',
        })}
      />
      <HomeMessageBoardSection
        locale={locale}
        name={boardName}
        email={boardEmail}
        message={boardMessage}
        submitting={boardSubmitting}
        onNameChange={setBoardName}
        onEmailChange={setBoardEmail}
        onMessageChange={setBoardMessage}
        onSubmit={() => void handleSubmitBoardMessage()}
      />
      <HomeTrustFooterSection locale={locale} health={siteHealth} />
      <HomeSocialLinksSection locale={locale} />
    </SiteLayout>
  )
}

function getJobStatusLabel(locale: Locale, status: GenerationStatus, callbackEnabled: boolean) {
  switch (status) {
    case 'queued':
      return copy(locale, { zh: '任务已创建，准备开始。', en: 'Job created and queued.' })
    case 'generating_lyrics':
      return copy(locale, { zh: 'DeepSeek 正在生成歌词...', en: 'DeepSeek is writing the lyrics...' })
    case 'lyrics_ready':
      return copy(locale, { zh: '歌词已完成，正在提交 Suno。', en: 'Lyrics are ready. Submitting to Suno.' })
    case 'generating_song':
      return copy(locale, {
        zh: callbackEnabled ? 'Suno 已接收任务，等待回调返回音频。' : 'Suno 正在生成歌曲，系统正在轮询结果。',
        en: callbackEnabled ? 'Suno accepted the task and is waiting to call back with audio.' : 'Suno is generating the song and the app is polling for results.',
      })
    case 'ready':
      return copy(locale, { zh: '歌曲已生成，正在准备自动播放。', en: 'The song is ready and preparing autoplay.' })
    case 'error':
      return copy(locale, { zh: '生成失败，请检查配置或稍后重试。', en: 'Generation failed. Check the configuration and try again.' })
    default:
      return ''
  }
}

function computeGenerationProgress(job: SongJob | null, now = Date.now()) {
  if (!job) {
    return 0
  }

  if (job.status === 'ready') {
    return 100
  }

  if (job.status === 'error') {
    return 0
  }

  const generationStartedAt = new Date(job.createdAt || job.updatedAt || now).getTime()
  const safeStartedAt = Number.isNaN(generationStartedAt) ? now : generationStartedAt
  return Math.min(96, (Math.max(0, now - safeStartedAt) / 120000) * 100)
}

function buildShowcaseSessionFromJob(job: SongJob, locale: Locale, currentSession: ShowcaseSessionContext | null) {
  const nextLyrics = job.lyrics || currentSession?.lyrics || ''
  const nextStatusText = job.error || getJobStatusLabel(locale, job.status, job.callbackEnabled)
  const nextTracks: ShowcaseSessionTrack[] = job.status === 'ready'
    ? (job.tracks ?? []).map((track, index) => ({
        id: buildTrackHistoryId(job.id, index),
        title: track.title || job.title || copy(locale, { zh: `歌曲 ${index + 1}`, en: `Track ${index + 1}` }),
        meta: copy(locale, { zh: `生成版本 ${index + 1}`, en: `Generated version ${index + 1}` }),
        blurb: summarizeStoryText(nextLyrics, copy(locale, {
          zh: '歌曲已完成，点击即可播放。',
          en: 'The song is ready. Tap to play.',
        })),
        audioUrl: getSongStreamUrl(buildTrackHistoryId(job.id, index)),
        downloadUrl: getSongDownloadUrl(buildTrackHistoryId(job.id, index)),
      }))
    : [
        {
          id: job.id,
          title: job.title || currentSession?.title || 'MelodyVow',
          meta: currentSession?.subtitle || copy(locale, { zh: '婚礼歌曲生成中', en: 'Wedding song generating' }),
          blurb: nextStatusText,
          audioUrl: '',
          downloadUrl: '',
        },
      ]

  return {
    mode: 'job' as const,
    jobId: job.id,
    title: job.title || currentSession?.title || 'MelodyVow',
    subtitle: currentSession?.subtitle || '',
    lyrics: nextLyrics,
    statusText: nextStatusText,
    generationProgress: computeGenerationProgress(job),
    isGenerating: job.status !== 'ready' && job.status !== 'error',
    tracks: nextTracks,
    activeTrackId: nextTracks[0]?.id || '',
  }
}

function buildFloatingPlayerPayloadFromJob(job: SongJob, locale: Locale, draft: SongDraft, error = '', autoPlay = false): FloatingPhonePlayerPayload {
  const isGenerating = job.status !== 'ready' && job.status !== 'error'
  const subtitleParts = [
    draft.groom.trim() && draft.bride.trim() ? `${draft.groom.trim()} & ${draft.bride.trim()}` : '',
    draft.style ? getStyleLabel(locale, draft.style) : '',
    draft.vocal ? getVocalLabel(locale, draft.vocal) : '',
  ].filter(Boolean)

  return {
    key: job.id,
    locale,
    title: job.title || subtitleParts[0] || 'MelodyVow',
    subtitle: subtitleParts.join(' · '),
    eyebrow: copy(locale, { zh: '婚礼歌播放器', en: 'Wedding Song Player' }),
    tracks: job.status === 'ready' ? buildFloatingTracksFromJob(job, locale) : [],
    activeTrackIndex: 0,
    canClose: !isGenerating,
    isGenerating,
    generationProgress: computeGenerationProgress(job),
    generationLabel: copy(locale, {
      zh: '幸福正在慢慢向着您靠近！',
      en: 'Happiness is slowly making its way to you!',
    }),
    statusText: error || job.error || getJobStatusLabel(locale, job.status, job.callbackEnabled),
    lyrics: job.lyrics || '',
    error: error || job.error || '',
    autoPlay,
  }
}

function ShowcasePage({ locale, authSession, onLogout, onUpsertFloatingPlayer }: ShowcasePageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isShowcaseMobile = useIsMobileViewport()
  const [tracks, setTracks] = useState<ShowcaseTrack[]>(productShowcaseTracks)
  const [displayMode, setDisplayMode] = useState<'demo' | 'job' | 'history'>('demo')
  const [displayTracks, setDisplayTracks] = useState<ShowcaseSessionTrack[]>(() =>
    productShowcaseTracks.map((track) => ({
      id: track.id,
      title: copy(locale, track.title),
      meta: copy(locale, track.meta),
      blurb: copy(locale, track.blurb),
      audioUrl: track.audioUrl,
      downloadUrl: track.audioUrl,
    })),
  )
  const [activeTrackId, setActiveTrackId] = useState(productShowcaseTracks[0]?.id ?? '')
  const [error, setError] = useState('')
  const [showcasePlaying, setShowcasePlaying] = useState(false)
  const [showcaseProgress, setShowcaseProgress] = useState(0)
  const [showcaseGenerationProgress, setShowcaseGenerationProgress] = useState(100)
  const [showcaseIsGenerating, setShowcaseIsGenerating] = useState(false)
  const [showcaseStatusText, setShowcaseStatusText] = useState(copy(locale, {
    zh: '点击下方歌单，直接在这里试听 MelodyVow 的样片。',
    en: 'Tap the list below to preview MelodyVow samples here.',
  }))
  const [pendingReadyNotice, setPendingReadyNotice] = useState('')
  const [showcaseLyrics, setShowcaseLyrics] = useState('')
  const showcaseAudioRef = useRef<HTMLAudioElement | null>(null)
  const showcaseShouldAutoplayRef = useRef(false)
  const showcaseLastJobStatusRef = useRef('')
  const queuedReadyJobSessionRef = useRef<ShowcaseSessionContext | null>(null)
  const activeTrack = displayTracks.find((track) => track.id === activeTrackId) ?? displayTracks[0] ?? null

  function buildDemoTracks(items: ShowcaseTrack[]) {
    return items.map((track) => ({
      id: track.id,
      title: copy(locale, track.title),
      meta: copy(locale, track.meta),
      blurb: copy(locale, track.blurb),
      audioUrl: track.audioUrl,
      downloadUrl: track.audioUrl,
    }))
  }

  function applyShowcaseSession(session: ShowcaseSessionContext) {
    // #region debug-point A:apply-showcase-session
    reportDebugEvent({
      hypothesisId: 'A',
      location: 'web/src/App.tsx:ShowcasePage.applyShowcaseSession',
      msg: '[DEBUG] Applying Showcase session into player state',
      data: {
        mode: session.mode,
        jobId: session.jobId || '',
        activeTrackId: session.activeTrackId || '',
        trackCount: session.tracks?.length || 0,
        firstTrackId: session.tracks?.[0]?.id || '',
        firstTrackAudioUrl: session.tracks?.[0]?.audioUrl || '',
        isGenerating: session.isGenerating ?? null,
        generationProgress: session.generationProgress ?? null,
      },
    })
    // #endregion
    if (session.mode === 'history' && session.tracks?.length) {
      setDisplayMode('history')
      setDisplayTracks(session.tracks)
      setActiveTrackId(session.activeTrackId || session.tracks[0]?.id || '')
      setShowcaseLyrics(session.lyrics || '')
      setShowcaseStatusText(session.statusText || copy(locale, {
        zh: '会员中心歌曲会统一在这里播放，并同时显示歌词。',
        en: 'Member songs now play here with lyrics kept visible.',
      }))
      setShowcaseGenerationProgress(100)
      setShowcaseIsGenerating(false)
      return
    }

    const nextTracks = session.tracks?.length
      ? session.tracks
      : [
          {
            id: session.jobId || 'pending-job',
            title: session.title || 'MelodyVow',
            meta: session.subtitle || copy(locale, { zh: '婚礼歌曲生成中', en: 'Wedding song generating' }),
            blurb: session.statusText || copy(locale, {
              zh: '歌词与旋律已经进入生成流程，请稍候。',
              en: 'Lyrics and melody are in the generation flow. Please wait.',
            }),
            audioUrl: '',
            downloadUrl: '',
          },
        ]

    setDisplayMode('job')
    setDisplayTracks(nextTracks)
    setActiveTrackId(session.activeTrackId || nextTracks[0]?.id || '')
    setShowcaseLyrics(session.lyrics || '')
    setShowcaseStatusText(session.statusText || copy(locale, {
      zh: 'Showcase 正在承接歌词与生成进度。',
      en: 'Showcase is now carrying the lyrics and generation progress.',
    }))
    setShowcaseGenerationProgress(session.generationProgress ?? 12)
    setShowcaseIsGenerating(session.isGenerating ?? true)
  }

  useEffect(() => {
    let disposed = false

    async function loadTracks() {
      try {
        const response = await fetch(apiUrl('/api/showcase/tracks'))
        const data = (await response.json()) as { items?: ShowcaseTrack[]; message?: string }
        if (!response.ok) {
          throw new Error(data.message || '加载样片失败。')
        }
        const items = Array.isArray(data.items) ? data.items : []
        if (!disposed && items.length) {
          setTracks(items)
          setActiveTrackId((current) => (items.some((track) => track.id === current) ? current : items[0].id))
        }
      } catch (loadError) {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : '加载样片失败。')
        }
      }
    }

    void loadTracks()

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (displayMode !== 'demo') {
      return
    }

    const nextTracks = buildDemoTracks(tracks)
    setDisplayTracks(nextTracks)
    setActiveTrackId((current) => (nextTracks.some((track) => track.id === current) ? current : nextTracks[0]?.id ?? ''))
    setShowcaseLyrics('')
    setShowcaseStatusText(copy(locale, {
      zh: '点击下方歌单，直接在这里试听 MelodyVow 的样片。',
      en: 'Tap the list below to preview MelodyVow samples here.',
    }))
    setShowcaseGenerationProgress(100)
    setShowcaseIsGenerating(false)
  }, [displayMode, locale, tracks])

  useEffect(() => {
    const mode = searchParams.get('mode')
    const showcaseSession = loadShowcaseSession()
    const generatingSession = loadGeneratingShowcaseSession()
    const shouldResumeGeneratingJob = !mode && isShowcaseMobile && isGeneratingShowcaseSession(generatingSession)

    if (!isShowcaseMobile) {
      setDisplayMode('demo')
      return
    }

    if (mode === 'job' || shouldResumeGeneratingJob) {
      const nextSession = generatingSession || {
        mode: 'job' as const,
        jobId: searchParams.get('job') || showcaseSession?.jobId || '',
        title: showcaseSession?.title || 'MelodyVow',
        subtitle: showcaseSession?.subtitle || '',
        lyrics: showcaseSession?.lyrics || '',
        statusText: showcaseSession?.statusText || '',
        generationProgress: showcaseSession?.generationProgress ?? 12,
        isGenerating: showcaseSession?.isGenerating ?? true,
        tracks: showcaseSession?.tracks || [],
        activeTrackId: showcaseSession?.activeTrackId || '',
      }
      applyShowcaseSession(nextSession)
      saveShowcaseSession(nextSession)
      return
    }

    if (mode === 'history' && showcaseSession?.mode === 'history' && showcaseSession.tracks?.length) {
      applyShowcaseSession(showcaseSession)
      return
    }

    setDisplayMode('demo')
  }, [isShowcaseMobile, locale, searchParams])

  useEffect(() => {
    if (!isShowcaseMobile || displayMode !== 'job') {
      return
    }

    const jobId = searchParams.get('job') || loadGeneratingShowcaseSession()?.jobId || ''
    if (!jobId) {
      return
    }

    let disposed = false

    const syncShowcaseJob = async (allowAutoplay = false) => {
      try {
        const response = await fetch(apiUrl(`/api/jobs/${jobId}`))
        const result = (await readJsonSafe(response)) as SongJob | { message?: string }
        if (!response.ok) {
          throw new Error('message' in result && result.message ? result.message : '任务查询失败。')
        }

        const job = result as SongJob
        if (disposed) {
          return
        }

        const currentSession = loadGeneratingShowcaseSession()
        const nextSession = buildShowcaseSessionFromJob(job, locale, currentSession)
        const nextTracks = nextSession.tracks || []
        const audio = showcaseAudioRef.current
        const currentPlaybackSession = loadShowcaseSession()
        const isViewingSameJob = displayMode === 'job' && (currentPlaybackSession?.jobId === jobId || searchParams.get('job') === jobId)
        const canTakeOverVisiblePlayer = displayMode === 'job' && (isViewingSameJob || searchParams.get('mode') === 'job')
        const isPlayingAnotherTrack = Boolean(audio && !audio.paused && displayMode !== 'job')

        // #region debug-point D:job-sync-branch
        reportDebugEvent({
          hypothesisId: 'D',
          location: 'web/src/App.tsx:ShowcasePage.syncShowcaseJob:branch',
          msg: '[DEBUG] Evaluated Showcase job sync branch',
          data: {
            jobId,
            jobStatus: job.status,
            displayMode,
            currentPlaybackMode: currentPlaybackSession?.mode || '',
            currentPlaybackJobId: currentPlaybackSession?.jobId || '',
            isViewingSameJob,
            canTakeOverVisiblePlayer,
            isPlayingAnotherTrack,
            audioPaused: audio ? audio.paused : null,
            audioCurrentTime: audio ? Number(audio.currentTime || 0) : null,
            audioSrc: audio?.currentSrc || audio?.src || '',
          },
        })
        // #endregion

        if (job.status === 'ready' && (allowAutoplay || showcaseLastJobStatusRef.current !== 'ready')) {
          if (canTakeOverVisiblePlayer && (!isPlayingAnotherTrack || isViewingSameJob)) {
            showcaseShouldAutoplayRef.current = true
            queuedReadyJobSessionRef.current = null
            setPendingReadyNotice('')
            applyShowcaseSession(nextSession)
            saveShowcaseSession(nextSession)
          } else if (isPlayingAnotherTrack) {
            queuedReadyJobSessionRef.current = nextSession
            setPendingReadyNotice(copy(locale, {
              zh: '新生成的歌曲已完成，当前歌曲播放结束后会自动切换播放。',
              en: 'Your generated song is ready and will start after the current track finishes.',
            }))
          }
        } else if (canTakeOverVisiblePlayer) {
          applyShowcaseSession(nextSession)
          saveShowcaseSession(nextSession)
        }

        // #region debug-point B:showcase-job-sync
        reportDebugEvent({
          hypothesisId: 'B',
          location: 'web/src/App.tsx:ShowcasePage.syncShowcaseJob',
          msg: '[DEBUG] Showcase synced job payload into mobile player state',
          data: {
            jobId,
            jobStatus: job.status,
            allowAutoplay,
            willAutoplay: showcaseShouldAutoplayRef.current,
            nextTrackCount: nextTracks.length,
            nextFirstTrackId: nextTracks[0]?.id || '',
            nextFirstTrackAudioUrl: nextTracks[0]?.audioUrl || '',
            nextFirstTrackDownloadUrl: nextTracks[0]?.downloadUrl || '',
            nextActiveTrackId: nextTracks[0]?.id || '',
          },
        })
        // #endregion

        setError(job.status === 'error' ? (job.error || copy(locale, { zh: '生成失败，请稍后重试。', en: 'Generation failed. Please try again later.' })) : '')
        saveGeneratingShowcaseSession(nextSession)
        showcaseLastJobStatusRef.current = job.status
      } catch (loadError) {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : '任务查询失败。')
        }
      }
    }

    void syncShowcaseJob(true)
    const timer = window.setInterval(() => {
      void syncShowcaseJob()
    }, 5000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [displayMode, isShowcaseMobile, locale, searchParams])

  useEffect(() => {
    const audio = showcaseAudioRef.current
    if (!audio) {
      return
    }

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setShowcaseProgress((audio.currentTime / audio.duration) * 100)
      } else {
        setShowcaseProgress(0)
      }
    }

    const handlePlay = () => {
      // #region debug-point B:audio-play
      reportDebugEvent({
        hypothesisId: 'B',
        location: 'web/src/App.tsx:ShowcasePage.audioEvents:play',
        msg: '[DEBUG] Showcase audio play event fired',
        data: {
          activeTrackId,
          currentTime: Number(audio.currentTime || 0),
          duration: Number(audio.duration || 0),
          readyState: audio.readyState,
          networkState: audio.networkState,
          src: audio.currentSrc || audio.src || '',
        },
      })
      // #endregion
      setShowcasePlaying(true)
    }

    const handlePause = () => {
      // #region debug-point B:audio-pause
      reportDebugEvent({
        hypothesisId: 'B',
        location: 'web/src/App.tsx:ShowcasePage.audioEvents:pause',
        msg: '[DEBUG] Showcase audio pause event fired',
        data: {
          activeTrackId,
          currentTime: Number(audio.currentTime || 0),
          duration: Number(audio.duration || 0),
          ended: audio.ended,
          readyState: audio.readyState,
          networkState: audio.networkState,
          src: audio.currentSrc || audio.src || '',
        },
      })
      // #endregion
      setShowcasePlaying(false)
    }

    const handleEnded = () => {
      // #region debug-point C:audio-ended
      reportDebugEvent({
        hypothesisId: 'C',
        location: 'web/src/App.tsx:ShowcasePage.audioEvents:ended',
        msg: '[DEBUG] Showcase audio ended event fired',
        data: {
          activeTrackId,
          currentTime: Number(audio.currentTime || 0),
          duration: Number(audio.duration || 0),
          hasQueuedReadySession: Boolean(queuedReadyJobSessionRef.current?.jobId),
          queuedReadyJobId: queuedReadyJobSessionRef.current?.jobId || '',
        },
      })
      // #endregion
      setShowcasePlaying(false)
      setShowcaseProgress(100)

      const queuedSession = queuedReadyJobSessionRef.current
      if (queuedSession?.mode === 'job' && queuedSession.tracks?.some((track) => track.audioUrl)) {
        queuedReadyJobSessionRef.current = null
        setPendingReadyNotice('')
        showcaseShouldAutoplayRef.current = true
        applyShowcaseSession(queuedSession)
        saveShowcaseSession(queuedSession)
      }
    }

    const handleAudioError = () => {
      // #region debug-point B:audio-error
      reportDebugEvent({
        hypothesisId: 'B',
        location: 'web/src/App.tsx:ShowcasePage.audioEvents:error',
        msg: '[DEBUG] Showcase audio error event fired',
        data: {
          activeTrackId,
          currentTime: Number(audio.currentTime || 0),
          duration: Number(audio.duration || 0),
          readyState: audio.readyState,
          networkState: audio.networkState,
          errorCode: audio.error?.code || null,
          errorMessage: audio.error?.message || '',
          src: audio.currentSrc || audio.src || '',
        },
      })
      // #endregion
    }

    const handleAudioNetworkEvent = (eventName: string) => {
      // #region debug-point B:audio-network
      reportDebugEvent({
        hypothesisId: 'B',
        location: `web/src/App.tsx:ShowcasePage.audioEvents:${eventName}`,
        msg: `[DEBUG] Showcase audio ${eventName} event fired`,
        data: {
          activeTrackId,
          currentTime: Number(audio.currentTime || 0),
          duration: Number(audio.duration || 0),
          readyState: audio.readyState,
          networkState: audio.networkState,
          paused: audio.paused,
          ended: audio.ended,
          src: audio.currentSrc || audio.src || '',
        },
      })
      // #endregion
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleAudioError)
    audio.addEventListener('stalled', () => handleAudioNetworkEvent('stalled'))
    audio.addEventListener('abort', () => handleAudioNetworkEvent('abort'))
    audio.addEventListener('suspend', () => handleAudioNetworkEvent('suspend'))
    audio.addEventListener('waiting', () => handleAudioNetworkEvent('waiting'))
    audio.addEventListener('canplay', () => handleAudioNetworkEvent('canplay'))

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleAudioError)
    }
  }, [activeTrackId])

  useEffect(() => {
    const audio = showcaseAudioRef.current
    if (!audio || !activeTrack?.audioUrl) {
      // #region debug-point B:showcase-audio-missing
      reportDebugEvent({
        hypothesisId: 'B',
        location: 'web/src/App.tsx:ShowcasePage.audioEffect',
        msg: '[DEBUG] Showcase audio effect missing playable track',
        data: {
          activeTrackId: activeTrack?.id || '',
          activeTrackAudioUrl: activeTrack?.audioUrl || '',
          activeTrackDownloadUrl: activeTrack?.downloadUrl || '',
          hasAudioElement: Boolean(audio),
        },
      })
      // #endregion
      setShowcasePlaying(false)
      setShowcaseProgress(0)
      return
    }

    audio.src = activeTrack.audioUrl
    audio.load()
    setShowcaseProgress(0)
    setShowcasePlaying(false)

    if (!showcaseShouldAutoplayRef.current) {
      return
    }

    const tryPlay = async () => {
      try {
        await audio.play()
        // #region debug-point B:showcase-autoplay-success
        reportDebugEvent({
          hypothesisId: 'B',
          location: 'web/src/App.tsx:ShowcasePage.audioEffect',
          msg: '[DEBUG] Showcase autoplay succeeded',
          data: {
            activeTrackId: activeTrack.id,
            activeTrackAudioUrl: activeTrack.audioUrl,
            activeTrackDownloadUrl: activeTrack.downloadUrl || '',
          },
        })
        // #endregion
      } catch {
        // #region debug-point B:showcase-autoplay-failed
        reportDebugEvent({
          hypothesisId: 'B',
          location: 'web/src/App.tsx:ShowcasePage.audioEffect',
          msg: '[DEBUG] Showcase autoplay failed',
          data: {
            activeTrackId: activeTrack.id,
            activeTrackAudioUrl: activeTrack.audioUrl,
            activeTrackDownloadUrl: activeTrack.downloadUrl || '',
          },
        })
        // #endregion
        setError(copy(locale, {
          zh: '当前样片暂时无法播放，请稍后再试。',
          en: 'This sample cannot be played right now. Please try again later.',
        }))
      } finally {
        showcaseShouldAutoplayRef.current = false
      }
    }

    void tryPlay()
  }, [activeTrack?.id, activeTrack?.audioUrl, locale])

  useEffect(() => {
    const audio = showcaseAudioRef.current
    if (!audio || isShowcaseMobile) {
      return
    }

    audio.pause()
    setShowcasePlaying(false)
  }, [isShowcaseMobile])

  useEffect(() => () => {
    const audio = showcaseAudioRef.current
    if (audio) {
      audio.pause()
    }
  }, [])

  async function handleMobileShowcasePlayback() {
    const audio = showcaseAudioRef.current
    if (!audio || !activeTrack?.audioUrl) {
      return
    }

    // #region debug-point B:manual-play-click
    reportDebugEvent({
      hypothesisId: 'B',
      location: 'web/src/App.tsx:ShowcasePage.handleMobileShowcasePlayback',
      msg: '[DEBUG] User triggered Showcase mobile playback toggle',
      data: {
        activeTrackId: activeTrack.id,
        activeTrackAudioUrl: activeTrack.audioUrl,
        activeTrackDownloadUrl: activeTrack.downloadUrl || '',
        paused: audio.paused,
        currentTime: Number(audio.currentTime || 0),
        duration: Number(audio.duration || 0),
        readyState: audio.readyState,
        networkState: audio.networkState,
        src: audio.currentSrc || audio.src || '',
      },
    })
    // #endregion
    setError('')

    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setError(copy(locale, {
          zh: '当前样片暂时无法播放，请稍后再试。',
          en: 'This sample cannot be played right now. Please try again later.',
        }))
      }
      return
    }

    audio.pause()
  }

  function handleSelectTrack(trackId: string) {
    const trackIndex = displayTracks.findIndex((track) => track.id === trackId)
    const nextTrack = displayTracks[trackIndex] ?? displayTracks[0]
    // #region debug-point A:select-track
    reportDebugEvent({
      hypothesisId: 'A',
      location: 'web/src/App.tsx:ShowcasePage.handleSelectTrack',
      msg: '[DEBUG] User selected Showcase track',
      data: {
        requestedTrackId: trackId,
        nextTrackId: nextTrack?.id || '',
        nextTrackAudioUrl: nextTrack?.audioUrl || '',
        displayMode,
        displayTrackCount: displayTracks.length,
        showcaseIsGenerating,
      },
    })
    // #endregion
    setActiveTrackId(trackId)
    setError('')

    if (isShowcaseMobile) {
      showcaseShouldAutoplayRef.current = true
      return
    }

    onUpsertFloatingPlayer({
      key: `showcase-${trackId}`,
      locale,
      title: nextTrack?.title || copy(locale, { zh: 'MelodyVow 展示', en: 'MelodyVow Showcase' }),
      subtitle: nextTrack?.meta || copy(locale, { zh: '婚礼样片', en: 'Wedding sample' }),
      eyebrow: copy(locale, { zh: '样片播放器', en: 'Showcase Player' }),
      tracks: displayTracks.map((track) => ({
        id: track.id,
        title: track.title,
        subtitle: track.meta,
        audioUrl: track.audioUrl,
        downloadUrl: track.downloadUrl || track.audioUrl,
      })),
      activeTrackIndex: Math.max(trackIndex, 0),
      canClose: true,
      isGenerating: showcaseIsGenerating,
      generationProgress: showcaseIsGenerating ? showcaseGenerationProgress : 100,
      generationLabel: '',
      statusText: showcaseStatusText,
      lyrics: showcaseLyrics,
      autoPlay: true,
    })
  }

  return (
    <SiteLayout
      locale={locale}
      title={copy(locale, { zh: '产品展示', en: 'Product Showcase' })}
      subtitle={copy(locale, {
        zh: '点击样片即可直接播放，查看 MelodyVow 的成品听感。',
        en: 'Tap any demo track to hear the MelodyVow experience.',
      })}
      eyebrow="MelodyVow"
      active="how"
      onOpenModal={() => undefined}
      onLogout={onLogout}
      authSession={authSession}
      hideHero
    >
      <section className="showcase-layout">
        <article className="glass-card showcase-mobile-player">
          <audio ref={showcaseAudioRef} preload="metadata" />
          <div className="showcase-mobile-player-shell">
            <div className="showcase-mobile-player-card">
              <div className="showcase-mobile-player-head">
                <p className="showcase-mobile-player-eyebrow">{copy(locale, { zh: '唯一播放器', en: 'Only Player' })}</p>
                <span className="showcase-mobile-player-count">
                  {copy(locale, {
                    zh: `${displayTracks.length} 首歌曲`,
                    en: `${displayTracks.length} tracks`,
                  })}
                </span>
              </div>

              <div className="showcase-mobile-player-main">
                <button
                  type="button"
                  className={`showcase-mobile-play-button ${showcasePlaying ? 'is-playing' : ''}`}
                  onClick={() => void handleMobileShowcasePlayback()}
                  disabled={!activeTrack?.audioUrl}
                  aria-label={copy(locale, { zh: '播放或暂停样片', en: 'Play or pause sample' })}
                >
                  {showcasePlaying ? '❚❚' : '▶'}
                </button>

                <div className="showcase-mobile-player-copy">
                  <strong>{activeTrack?.title || copy(locale, { zh: 'MelodyVow 展示', en: 'MelodyVow Showcase' })}</strong>
                  <span>{activeTrack?.meta || copy(locale, { zh: '婚礼样片', en: 'Wedding sample' })}</span>
                  <p>{showcaseStatusText || activeTrack?.blurb || copy(locale, { zh: '点击下方歌单，直接在这里试听。', en: 'Tap a song below to preview it here.' })}</p>
                </div>
              </div>

              <div className="showcase-mobile-player-progress-copy">
                <span>
                  {showcaseIsGenerating
                    ? copy(locale, { zh: '歌曲生成进度', en: 'Generation Progress' })
                    : showcasePlaying
                    ? copy(locale, { zh: '歌曲播放中', en: 'Now Playing' })
                    : copy(locale, { zh: '歌曲播放进度', en: 'Song Progress' })}
                </span>
                <span>{`${Math.round(showcaseIsGenerating ? showcaseGenerationProgress : showcaseProgress)}%`}</span>
              </div>
              <div className="showcase-mobile-player-progress" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, showcaseIsGenerating ? showcaseGenerationProgress : showcaseProgress))}%` }} />
              </div>
            </div>
          </div>
          {pendingReadyNotice ? <p className="showcase-mobile-ready-notice">{pendingReadyNotice}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          <article className="glass-card showcase-mobile-lyrics">
            <div className="showcase-mobile-lyrics-shell">
              <div className="showcase-mobile-lyrics-card">
                <div className="showcase-mobile-lyrics-head">
                  <p>{copy(locale, { zh: '歌词面板', en: 'Lyrics Panel' })}</p>
                  <span>{displayMode === 'job' ? copy(locale, { zh: '生成中可见', en: 'Visible While Generating' }) : copy(locale, { zh: '统一播放页', en: 'Unified Player' })}</span>
                </div>
                <div className="showcase-mobile-lyrics-body">
                  {showcaseLyrics || copy(locale, {
                    zh: '这里会显示当前歌曲的歌词、故事关键词，或者生成中的文案内容。',
                    en: 'The current lyrics, story keywords, or generation copy will appear here.',
                  })}
                </div>
              </div>
            </div>
          </article>
        </article>

        <aside className="showcase-sidebar">
          <article className="glass-card showcase-intro">
            <p className="mini-eyebrow">{copy(locale, { zh: '全球', en: 'Global' })}</p>
            <h3>{copy(locale, { zh: '曾经求婚成功的浪漫歌曲', en: 'Romantic Songs from Successful Proposals' })}</h3>
            <p className="showcase-mobile-intro-copy">
              {displayMode === 'job'
                ? copy(locale, {
                    zh: '生成中的歌曲会先在这里显示歌词和进度，等 Suno 完成后自动播放。',
                    en: 'Generated songs stay here with lyrics and progress, then autoplay once Suno finishes.',
                  })
                : displayMode === 'history'
                ? copy(locale, {
                    zh: '会员中心歌曲已经切到这里播放，你可以一边听一边看歌词。',
                    en: 'Member songs have moved here, so you can listen while keeping the lyrics visible.',
                  })
                : copy(locale, {
                    zh: '下方歌单会统一进入上面的手机播放器，点击即可播放。',
                    en: 'Every sample below plays inside the mobile player above.',
                  })}
            </p>
            <button
              type="button"
              className="showcase-home-link"
              onClick={() => navigate(withLocale(locale))}
            >
              <span>{copy(locale, { zh: '我也去制作', en: 'Make Mine Too' })}</span>
              <span className="showcase-home-link-icon" aria-hidden="true">↗</span>
            </button>
          </article>

          <div className="showcase-track-list">
            {displayTracks.map((track, index) => {
              const isActive = track.id === activeTrackId

              return (
                <button
                  key={track.id}
                  type="button"
                  className={`glass-card showcase-track-card ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleSelectTrack(track.id)}
                >
                  <div className="showcase-track-index">{String(index + 1).padStart(2, '0')}</div>
                  <div className="showcase-track-copy">
                    <strong>{track.title}</strong>
                    <span>{track.meta}</span>
                    <small>{track.blurb}</small>
                  </div>
                  <div className={`showcase-track-icon ${isActive ? 'is-playing' : ''}`}>
                    {isActive && showcasePlaying && isShowcaseMobile ? '❚❚' : '▶'}
                  </div>
                </button>
              )
            })}
          </div>

        </aside>
      </section>
    </SiteLayout>
  )
}

function StylesPage({ locale, draft, setDraft, authSession, onLogout }: StylesPageProps) {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<PlanItem[]>(() => getDefaultPlanAccessFallback().map(normalizePricingPlan))
  const [activeCollection, setActiveCollection] = useState<StyleCollectionId>(() => {
    if (draft.style) {
      const matchedCollections = getStyleCollectionIds(draft.style)
      if (matchedCollections.includes('china')) {
        return 'china'
      }
      return matchedCollections.includes('proposal')
        ? 'proposal'
        : matchedCollections[0]
    }

    return draft.occasion === 'proposal' ? 'proposal' : 'wedding'
  })
  const hasVipModelAccess = useMemo(() => memberHasVipModelAccess(authSession, plans), [authSession, plans])

  useEffect(() => {
    let disposed = false

    async function loadPlans() {
      try {
        const response = await fetch(apiUrl('/api/plans'))
        const data = (await readJsonSafe(response)) as { items?: PlanItem[]; message?: string }
        if (!response.ok) {
          throw new Error(data.message || '套餐加载失败。')
        }

        const items = Array.isArray(data.items) ? data.items.map(normalizePricingPlan) : []
        if (!disposed && items.length) {
          setPlans(items)
        }
      } catch {
        // Fall back to local defaults so VIP visibility still works when plans are temporarily unavailable.
      }
    }

    void loadPlans()

    return () => {
      disposed = true
    }
  }, [])

  useEffect(() => {
    if (!draft.style || hasVipModelAccess || !isVipStyle(draft.style)) {
      return
    }

    setDraft((current) => {
      const currentStyle = String(current.style || '').trim()
      if (!currentStyle || !isVipStyle(currentStyle)) {
        return current
      }

      return { ...current, style: '' }
    })
  }, [draft.style, hasVipModelAccess, setDraft])

  const filteredStyles = useMemo(
    () => {
      const items = weddingStyleOptions.filter((card) => getStyleCollectionIds(card.id).includes(activeCollection))
      if (activeCollection !== 'vip') {
        return items
      }

      return [...items].sort((left, right) => {
        const leftPriority = VIP_CHINESE_FEATURED_STYLE_PRIORITY.get(left.id) ?? Number.MAX_SAFE_INTEGER
        const rightPriority = VIP_CHINESE_FEATURED_STYLE_PRIORITY.get(right.id) ?? Number.MAX_SAFE_INTEGER
        return leftPriority - rightPriority
      })
    },
    [activeCollection],
  )

  return (
    <SiteLayout
      locale={locale}
      title=""
      subtitle=""
      eyebrow="MelodyVow"
      active="styles"
      onOpenModal={() => undefined}
      onLogout={onLogout}
      authSession={authSession}
      hideHero
    >
      <section className={`styles-page-toolbar glass-card ${activeCollection === 'vip' ? 'is-vip-active' : ''}`}>
        <div
          key={`style-switcher-${locale}`}
          className="styles-page-switcher"
          role="tablist"
          aria-label={copy(locale, { zh: '曲风分类切换', en: 'Style category switcher' })}
        >
          {styleCollectionOptions.map((collection) => {
            const count = weddingStyleOptions.filter((card) => getStyleCollectionIds(card.id).includes(collection.id)).length
            const active = activeCollection === collection.id
            const locked = collection.id === 'vip' && !hasVipModelAccess

            return (
              <button
                key={`${locale}-${collection.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                className={`styles-page-switch ${active ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
                title={locked ? copy(locale, {
                  zh: 'VIP模型需开通带有 VIP 权限的订阅套餐后才能选择。',
                  en: 'VIP Models require a subscription plan with VIP access.',
                }) : undefined}
                onClick={() => setActiveCollection(collection.id)}
              >
                <span>{getStyleCollectionLabel(locale, collection.id)}</span>
                <strong>{count}</strong>
              </button>
            )
          })}
        </div>
      </section>

      {activeCollection === 'vip' ? (
        <section className={`glass-card styles-page-vip-note ${hasVipModelAccess ? 'is-unlocked' : 'is-locked'}`}>
          <span className="styles-page-vip-kicker">{copy(locale, { zh: 'Imperial Selection', en: 'Imperial Selection' })}</span>
          <strong>{copy(locale, { zh: 'VIP模型专区', en: 'VIP Models' })}</strong>
          <p>{hasVipModelAccess
            ? copy(locale, {
                zh: '当前账号订阅已开通 VIP模型权限，可直接选择下方高阶模型。',
                en: 'Your current subscription includes VIP Models access, so you can select any premium model below.',
              })
            : copy(locale, {
                zh: authSession?.email
                  ? '当前账号套餐未开通 VIP模型 权限，请升级到后台已开启该权限的订阅套餐后使用。'
                  : '登录并开通带有 VIP模型 权限的 Premium 订阅后，才可选择该分类下的模型。',
                en: authSession?.email
                  ? 'Your current plan does not include VIP Models access. Upgrade to a subscription plan with VIP access enabled.'
                  : 'Sign in and activate a Premium subscription with VIP Models access to use this category.',
              })}</p>
        </section>
      ) : null}

      <section className={`styles-grid styles-page-grid ${activeCollection === 'vip' ? 'is-vip-active' : ''}`}>
        {filteredStyles.map((card, index) => {
          const vipStyle = isVipStyle(card.id)
          const vipFeatured = activeCollection === 'vip' && VIP_CHINESE_FEATURED_STYLE_PRIORITY.has(card.id)
          const canSelectStyle = !vipStyle || hasVipModelAccess
          const baseMetaRows: Array<{ field: StyleMetaField, value?: string }> = [
            { field: 'area', value: card.area || card.continent },
            { field: 'community', value: card.community },
            { field: 'region', value: card.region },
            { field: 'weddingMusicType', value: card.weddingMusicType },
            { field: 'proposalMusicType', value: card.proposalMusicType },
            { field: 'coreFeature', value: card.coreFeature },
            { field: 'signatureForm', value: card.signatureForm },
          ]
          const metaRows = baseMetaRows
            .map((item) => {
              const localizedValue = getLocalizedStyleMetaValue(locale, item.value)
              if (!localizedValue) {
                return null
              }

              return {
                field: item.field,
                value: localizedValue,
                label: getStyleMetaLabel(locale, item.field, true),
                fullLabel: getStyleMetaLabel(locale, item.field),
                previewValue: getStyleMetaPreview(localizedValue, locale, item.field),
              }
            })
            .filter((item): item is {
              field: StyleMetaField
              value: string
              label: string
              fullLabel: string
              previewValue: string
            } => Boolean(item))

          return (
            <article
              key={card.id}
              className={`glass-card style-card ${draft.style === card.id ? 'selected' : ''} ${vipStyle ? 'is-vip' : ''} ${vipFeatured ? 'is-vip-featured' : ''} ${!canSelectStyle ? 'is-locked' : ''}`}
            >
              <div className="step-badge">{index + 1}</div>
              {vipStyle ? <span className="style-card-badge">VIP</span> : null}
              {vipFeatured ? (
                <span className="style-card-featured-badge">{copy(locale, { zh: '中式史诗精选', en: 'Chinese Epic Pick' })}</span>
              ) : null}
              <h3>{locale === 'zh' ? card.zhLabel : card.enLabel}</h3>
              <p>{locale === 'zh' ? card.zhDescription : card.enDescription}</p>
              {metaRows.length ? (
                <div className="styles-page-meta">
                  {metaRows.map((item) => (
                    <div
                      key={`${card.id}-${item.field}`}
                      className="styles-page-meta-row"
                      title={`${item.fullLabel}: ${item.value}`}
                    >
                      <span title={item.fullLabel}>{item.label}</span>
                      <strong>{item.previewValue}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
              {vipStyle && !canSelectStyle ? (
                <p className="style-card-lock-note">{copy(locale, {
                  zh: '需开通带有 VIP模型 权限的 Premium 订阅后才能选择。',
                  en: 'Upgrade to a Premium subscription with VIP Models access to select this style.',
                })}</p>
              ) : null}
              <button
                type="button"
                className="primary-button compact"
                disabled={!canSelectStyle}
                onClick={() => {
                  if (!canSelectStyle) {
                    return
                  }
                  setDraft((current) => ({ ...current, style: card.id }))
                  navigate(withLocale(locale))
                }}
              >
                {canSelectStyle
                  ? copy(locale, { zh: '选择曲风', en: 'Select Style' })
                  : copy(locale, { zh: 'Premium 解锁', en: 'Unlock with Premium' })}
              </button>
            </article>
          )
        })}
        {!filteredStyles.length ? (
          <article className="glass-card styles-page-empty">
            <h3>{copy(locale, { zh: '该分类还没有曲风', en: 'No styles in this category yet' })}</h3>
            <p>{copy(locale, {
              zh: '后续新增模型后，会自动出现在这个切换分类里。',
              en: 'Once new models are added, they will appear in this category automatically.',
            })}</p>
          </article>
        ) : null}
      </section>
    </SiteLayout>
  )
}

function PreviewPage({ locale, draft, authSession, onLogout, onUpsertFloatingPlayer }: PreviewPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const params = new URLSearchParams(location.search)
  const jobId = params.get('job')

  useEffect(() => {
    if (!jobId) {
      navigate(withLocale(locale), { replace: true })
      return
    }

    let disposed = false

    const bootstrapPreviewPlayer = async () => {
      try {
        const response = await fetch(apiUrl(`/api/jobs/${jobId}`))
        const result = (await readJsonSafe(response)) as SongJob | { message?: string }
        if (!response.ok) {
          throw new Error('message' in result && result.message ? result.message : '任务查询失败。')
        }

        if (disposed) {
          return
        }

        onUpsertFloatingPlayer(buildFloatingPlayerPayloadFromJob(result as SongJob, locale, draft, '', true))
        navigate(withLocale(locale), { replace: true })
      } catch (loadError) {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : '任务查询失败。')
        }
      }
    }

    void bootstrapPreviewPlayer()

    return () => {
      disposed = true
    }
  }, [draft, jobId, locale, navigate, onUpsertFloatingPlayer])

  return (
    <SiteLayout
      locale={locale}
      title={copy(locale, { zh: '正在返回首页', en: 'Returning to Home' })}
      subtitle={copy(locale, {
        zh: '旧预览页已移除，歌曲会在迷你播放器里继续同步。',
        en: 'The old preview page has been removed. Your song will continue in the mini player.',
      })}
      eyebrow="MelodyVow"
      active="home"
      onOpenModal={() => undefined}
      onLogout={onLogout}
      authSession={authSession}
    >
      <section className="preview-layout">
        <article className="glass-panel preview-shell-card">
          <h2>{copy(locale, { zh: '正在同步迷你播放器', en: 'Syncing Mini Player' })}</h2>
          <p>
            {copy(locale, {
              zh: '旧的预览播放器页面已经移除，生成进度和播放都会保留在右下角迷你播放器里。',
              en: 'The old preview player page has been removed. Progress and playback now stay in the mini player.',
            })}
          </p>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="button" className="primary-button wide" onClick={() => navigate(withLocale(locale), { replace: true })}>
            {copy(locale, { zh: '返回首页', en: 'Back to Home' })}
          </button>
        </article>
      </section>
    </SiteLayout>
  )
}

function PricingPage({ locale, selectedPlan, setSelectedPlan, authSession, onLogout }: PricingPageProps) {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [, setLoadingPlans] = useState(true)

  useEffect(() => {
    let disposed = false

    const fallbackPlans: PlanItem[] = locale === 'zh'
      ? [
          { id: 'starter-monthly', name: 'Starter Monthly', type: 'subscription', billingInterval: 'month', price: 89, heartBeans: 5, currency: 'USD', badge: '', features: ['每月自动续费', '每月发放 5 点订阅额度', 'AI 歌词生成', 'MP3 下载'], canUseVipModels: false },
          { id: 'pro-monthly', name: 'Pro Monthly', type: 'subscription', billingInterval: 'month', price: 199, heartBeans: 15, currency: 'USD', badge: '推荐', features: ['每月自动续费', '每月发放 15 点订阅额度', '完整歌词', '高清音频'], canUseVipModels: false },
          { id: 'premium-monthly', name: 'Premium Monthly', type: 'subscription', billingInterval: 'month', price: 499, heartBeans: 40, currency: 'USD', badge: '', features: ['每月自动续费', '每月发放 40 点订阅额度', '真人演唱', '双版本混音', '可使用 VIP模型'], canUseVipModels: true },
          { id: 'boost-5', name: 'Boost 5', type: 'credit_pack', billingInterval: '', price: 69, heartBeans: 5, currency: 'USD', badge: '', features: ['一次性购买', '立即到账 5 点充值额度', '适合低频用户'], canUseVipModels: false },
          { id: 'signature-15', name: 'Signature 15', type: 'credit_pack', billingInterval: '', price: 169, heartBeans: 15, currency: 'USD', badge: '热门', features: ['一次性购买', '立即到账 15 点充值额度', '适合婚礼筹备期集中使用'], canUseVipModels: false },
          { id: 'celebration-40', name: 'Celebration 40', type: 'credit_pack', billingInterval: '', price: 429, heartBeans: 40, currency: 'USD', badge: '', features: ['一次性购买', '立即到账 40 点充值额度', '适合高频用户'], canUseVipModels: false },
        ]
      : [
          { id: 'starter-monthly', name: 'Starter Monthly', type: 'subscription', billingInterval: 'month', price: 89, heartBeans: 5, currency: 'USD', badge: '', features: ['Auto-renews monthly', '5 subscription credits every month', 'AI lyrics', 'MP3 download'], canUseVipModels: false },
          { id: 'pro-monthly', name: 'Pro Monthly', type: 'subscription', billingInterval: 'month', price: 199, heartBeans: 15, currency: 'USD', badge: 'Recommended', features: ['Auto-renews monthly', '15 subscription credits every month', 'Full lyrics', 'HD audio'], canUseVipModels: false },
          { id: 'premium-monthly', name: 'Premium Monthly', type: 'subscription', billingInterval: 'month', price: 499, heartBeans: 40, currency: 'USD', badge: '', features: ['Auto-renews monthly', '40 subscription credits every month', 'Real singer', 'Dual mix', 'VIP Models access'], canUseVipModels: true },
          { id: 'boost-5', name: 'Boost 5', type: 'credit_pack', billingInterval: '', price: 69, heartBeans: 5, currency: 'USD', badge: '', features: ['One-time payment', '5 top-up credits instantly', 'Ideal for occasional orders'], canUseVipModels: false },
          { id: 'signature-15', name: 'Signature 15', type: 'credit_pack', billingInterval: '', price: 169, heartBeans: 15, currency: 'USD', badge: 'Popular', features: ['One-time payment', '15 top-up credits instantly', 'Ideal for wedding production bursts'], canUseVipModels: false },
          { id: 'celebration-40', name: 'Celebration 40', type: 'credit_pack', billingInterval: '', price: 429, heartBeans: 40, currency: 'USD', badge: '', features: ['One-time payment', '40 top-up credits instantly', 'Ideal for studios and heavy usage'], canUseVipModels: false },
        ]

    async function loadPlans() {
      setLoadingPlans(true)
      try {
        const response = await fetch(apiUrl('/api/plans'))
        const data = (await response.json()) as { items?: PlanItem[]; message?: string }
        if (!response.ok) {
          throw new Error(data.message || '套餐加载失败。')
        }
        const items = Array.isArray(data.items) ? data.items : []
        if (!disposed) {
          setPlans((items.length ? items : fallbackPlans).map(normalizePricingPlan))
        }
      } catch {
        if (!disposed) {
          setPlans(fallbackPlans)
        }
      } finally {
        if (!disposed) {
          setLoadingPlans(false)
        }
      }
    }

    void loadPlans()

    return () => {
      disposed = true
    }
  }, [locale])

  const subscriptionPlans = plans.filter((plan) => (plan.type || 'subscription') === 'subscription')
  const topupPlans = plans.filter((plan) => (plan.type || 'subscription') === 'credit_pack')

  return (
    <SiteLayout
      locale={locale}
      title=""
      subtitle=""
      eyebrow="MelodyVow"
      active="pricing"
      onOpenModal={() => undefined}
      onLogout={onLogout}
      authSession={authSession}
      hideHero
    >
      <section className="pricing-page-stack">
        {[
          {
            key: 'subscription',
            title: copy(locale, { zh: '月订阅', en: 'Monthly Subscription' }),
            subtitle: copy(locale, {
              zh: '适合持续创作的用户，每月自动扣款并发放订阅额度。',
              en: 'Best for ongoing creation with monthly auto-renewal and recurring credits.',
            }),
            items: subscriptionPlans,
          },
          {
            key: 'topup',
            title: copy(locale, { zh: '充值包', en: 'TOP UP PACKS' }),
            subtitle: copy(locale, {
              zh: '一次性购买，额度立即到账，不自动续费。',
              en: 'One-time purchase with instant credits and no auto-renewal.',
            }),
            items: topupPlans,
          },
        ].map((group) => (
          <section key={group.key} className="pricing-group-section">
            <div className="pricing-group-head">
              <p className="mini-eyebrow">{group.title}</p>
              <h2>{group.subtitle}</h2>
            </div>
            <div className="pricing-grid pricing-page-grid">
              {group.items.map((plan) => (
                <article
                  key={plan.name}
                  className={`glass-card pricing-card ${selectedPlan === plan.name ? 'selected' : ''}`}
                >
                  {plan.badge ? <span className="corner-badge">{plan.badge}</span> : null}
                  <div className="step-badge">{plan.name.slice(0, 1)}</div>
                  <p className="mini-eyebrow">{getPlanTypeLabel(locale, plan.type)}</p>
                  <h3>{plan.name}</h3>
                  <div className="price-tag">{formatPlanPrice(plan)}</div>
                  <p>{formatPlanCreditsText(locale, plan)}</p>
                  <ul>
                    {getPlanFeatureItems(locale, plan).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="primary-button compact pricing-action-button"
                    onClick={() => {
                      setSelectedPlan(plan.name)
                      navigate(withLocale(locale, `/checkout?planId=${encodeURIComponent(plan.id)}`))
                    }}
                  >
                    {getPlanActionLabel(locale, plan.type)}
                  </button>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
      <ServiceHubSection
        locale={locale}
        title={copy(locale, {
          zh: '购买前请先阅读服务政策',
          en: 'Review service policies before purchase',
        })}
        className="pricing-service-hub"
      />
    </SiteLayout>
  )
}

function CheckoutPage({ locale, selectedPlan, setSelectedPlan, authSession, onLogout }: CheckoutPageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedPlanId = String(searchParams.get('planId') || '').trim()
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let disposed = false

    const fallbackPlans: PlanItem[] = getDefaultPlanAccessFallback()

    async function loadCheckoutData() {
      setLoading(true)
      setError('')
      try {
        const [plansRes, methodsRes] = await Promise.all([
          fetch(apiUrl('/api/plans')),
          fetch(apiUrl('/api/payment/methods')),
        ])
        const [plansData, methodsData] = await Promise.all([plansRes.json(), methodsRes.json()])
        const nextPlans = Array.isArray(plansData.items) ? (plansData.items as PlanItem[]).map(normalizePricingPlan) : fallbackPlans
        const nextMethods = Array.isArray(methodsData.items) ? (methodsData.items as PaymentMethod[]) : []

        if (!disposed) {
          setPlans(nextPlans.length ? nextPlans : fallbackPlans)
          setMethods(nextMethods)
        }
      } catch (loadError) {
        if (!disposed) {
          setPlans(fallbackPlans)
          setMethods([])
          setError(loadError instanceof Error ? loadError.message : '支付信息加载失败。')
        }
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    void loadCheckoutData()

    return () => {
      disposed = true
    }
  }, [])

  const selectedById = plans.find((plan) => plan.id === requestedPlanId)
  const selectedByName = plans.find((plan) => plan.name === selectedPlan)
  const activePlan = selectedById || selectedByName || plans[0] || null
  const visibleMethods = methods.filter((method) => !activePlan || (method.supportedPlanTypes || ['credit_pack']).includes((activePlan.type || 'subscription')))
  const actionLabel = getPlanActionLabel(locale, activePlan?.type)

  useEffect(() => {
    if (!activePlan) {
      return
    }

    if (activePlan.name !== selectedPlan) {
      setSelectedPlan(activePlan.name)
    }
  }, [activePlan, selectedPlan, setSelectedPlan])

  async function handleStartPayment(method: PaymentMethod) {
    setError('')

    if (!activePlan) {
      setError(copy(locale, { zh: '套餐信息缺失。', en: 'Missing plan information.' }))
      return
    }

    if (!authSession?.email) {
      navigate(withLocale(locale, '/auth'))
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(apiUrl('/api/payment/create-order'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getMemberAuthHeaders(authSession),
        },
        body: JSON.stringify({
          planId: activePlan.id,
          methodId: method.id,
          locale,
        }),
      })
      const result = (await readJsonSafe(response)) as { checkoutUrl?: string; message?: string }
      if (!response.ok) {
        throw new Error(result.message || '创建订单失败。')
      }
      if (!result.checkoutUrl) {
        throw new Error('收款链接为空。')
      }

      window.location.assign(result.checkoutUrl)
    } catch (payError) {
      setError(payError instanceof Error ? payError.message : '创建订单失败。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SiteLayout
      locale={locale}
      title=""
      subtitle=""
      eyebrow="MelodyVow"
      active="pricing"
      onOpenModal={() => undefined}
      onLogout={onLogout}
      authSession={authSession}
      hideHero
    >
      <section className="pricing-grid pricing-page-grid">
        <article className="glass-card pricing-card selected">
          <div className="admin-table-head">
            <strong>{copy(locale, { zh: '订单确认', en: 'Checkout' })}</strong>
            <span>{activePlan ? activePlan.name : '-'}</span>
          </div>
          {loading ? <p className="empty-state">{copy(locale, { zh: '加载中...', en: 'Loading...' })}</p> : null}
          {!loading && activePlan ? (
            <>
              <p className="mini-eyebrow">{getPlanTypeLabel(locale, activePlan.type)}</p>
              <div className="price-tag">{formatPlanPrice(activePlan)}</div>
              <p>{formatPlanCreditsText(locale, activePlan)}</p>
              <button type="button" className="primary-button compact pricing-action-button" onClick={() => navigate(withLocale(locale, '/pricing'))}>
                {copy(locale, { zh: '返回选择套餐', en: 'Back to Pricing' })}
              </button>
            </>
          ) : null}
        </article>

        <article className="glass-card pricing-card">
          <div className="admin-table-head">
            <strong>{copy(locale, { zh: '选择支付方式', en: 'Payment Methods' })}</strong>
            <span>{methods.length ? `${methods.length}` : '-'}</span>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          {!loading && !visibleMethods.length ? (
            <p className="empty-state">{copy(locale, { zh: '暂无可用支付方式，请联系管理员在后台启用。', en: 'No payment methods available. Please contact the admin to enable one.' })}</p>
          ) : null}
          <div className="admin-detail-stack">
            {visibleMethods.map((method) => (
              <button
                key={method.id}
                type="button"
                className="primary-button pricing-action-button"
                disabled={submitting || loading}
                onClick={() => void handleStartPayment(method)}
              >
                {actionLabel} · {method.name}
              </button>
            ))}
          </div>
        </article>
      </section>
    </SiteLayout>
  )
}

function AuthPage({ locale, draft, selectedPlan, onOpenModal, onAuthSuccess, onLogout, authSession }: AuthPageProps) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [partnerName, setPartnerName] = useState(draft.bride)
  const [authError, setAuthError] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaChallenge, setCaptchaChallenge] = useState(createCaptchaChallenge)
  const [acceptedAccountPolicy, setAcceptedAccountPolicy] = useState(false)
  const [acceptedTransactionPolicy, setAcceptedTransactionPolicy] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const signupPolicyComplete = acceptedAccountPolicy && acceptedTransactionPolicy

  function getPolicyHref(path: string) {
    return `#${withLocale(locale, path)}`
  }

  if (authSession?.email) {
    return <Navigate to={withLocale(locale, '/account')} replace />
  }

  function refreshCaptcha() {
    setCaptchaChallenge(createCaptchaChallenge())
    setCaptchaInput('')
  }

  async function handleAuthSubmit() {
    setAuthError('')

    if (!email.trim()) {
      setAuthError(copy(locale, { zh: '请先填写邮箱。', en: 'Please enter your email.' }))
      return
    }

    if (!password.trim()) {
      setAuthError(copy(locale, { zh: '请先填写密码。', en: 'Please enter your password.' }))
      return
    }

    if (captchaInput.trim() !== captchaChallenge.answer) {
      setAuthError(copy(locale, {
        zh: '验证码结果不正确，请重新计算。',
        en: 'The captcha answer is incorrect. Please try again.',
      }))
      refreshCaptcha()
      return
    }

    if (tab === 'signup') {
      if (!partnerName.trim()) {
        setAuthError(copy(locale, { zh: '注册时请填写伴侣姓名。', en: 'Please enter your partner name for sign up.' }))
        return
      }

      if (!signupPolicyComplete) {
        setAuthError(copy(locale, {
          zh: '请先勾选并同意注册所需的隐私政策、服务条款及相关交易政策。',
          en: 'Please agree to the required privacy, terms, and transaction policies before creating your account.',
        }))
        return
      }

      if (password.length < 6) {
        setAuthError(copy(locale, { zh: '密码至少需要 6 位。', en: 'Password must be at least 6 characters.' }))
        return
      }

      if (password !== confirmPassword) {
        setAuthError(copy(locale, { zh: '两次输入的密码不一致。', en: 'Passwords do not match.' }))
        return
      }
    }

    const normalizedPartnerName = tab === 'signup'
      ? partnerName.trim()
      : draft.bride

    const successMessage = copy(locale, {
      zh: tab === 'login'
        ? `欢迎回来，${email.trim()}。你现在可以继续管理婚礼歌曲、歌单和下载文件。`
        : `注册成功，${email.trim()} 已创建会员账户。现在就可以开始保存歌曲、管理歌单和继续下单。`,
      en: tab === 'login'
        ? `Welcome back, ${email.trim()}. You can now manage your wedding songs, playlists and downloads.`
        : `Registration successful. ${email.trim()} is now ready to save songs, manage playlists and continue checkout.`,
    })

    setIsSubmitting(true)

    try {
      const endpoint = tab === 'login' ? '/api/member/login' : '/api/member/signup'
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          partnerName: normalizedPartnerName,
          acceptedAccountPolicy: tab === 'signup' ? acceptedAccountPolicy : undefined,
          acceptedTransactionPolicy: tab === 'signup' ? acceptedTransactionPolicy : undefined,
          policyConsentVersion: tab === 'signup' ? SIGNUP_POLICY_VERSION : undefined,
        }),
      })

      const result = (await readJsonSafe(response)) as MemberAuthResponse & { message?: string }

      if (!response.ok || !result.token || !result.profile?.email) {
        throw new Error(result.message || copy(locale, {
          zh: tab === 'login' ? '会员登录失败。' : '会员注册失败。',
          en: tab === 'login' ? 'Login failed.' : 'Sign up failed.',
        }))
      }

      onAuthSuccess({
        authToken: result.token,
        email: result.profile.email,
        partnerName: result.profile.partnerName || normalizedPartnerName,
        plan: result.profile.plan || selectedPlan,
        heartBeansBalance: typeof result.profile.heartBeansBalance === 'number' ? result.profile.heartBeansBalance : 0,
        topupHeartBeansBalance: typeof result.profile.topupHeartBeansBalance === 'number' ? result.profile.topupHeartBeansBalance : 0,
        subscriptionHeartBeansBalance: typeof result.profile.subscriptionHeartBeansBalance === 'number' ? result.profile.subscriptionHeartBeansBalance : 0,
        subscriptionStatus: result.profile.subscriptionStatus || '',
        subscriptionPlanId: result.profile.subscriptionPlanId || '',
        subscriptionCurrentPeriodEnd: result.profile.subscriptionCurrentPeriodEnd || '',
        stripeCustomerId: result.profile.stripeCustomerId || '',
        paypalSubscriptionId: result.profile.paypalSubscriptionId || '',
        subscriptionProvider: result.profile.subscriptionProvider || '',
        mode: tab,
        welcomeMessage: successMessage,
        lastAuthAt: result.profile.lastAuthAt || new Date().toISOString(),
        avatarUrl: result.profile.avatarUrl,
      })

      onOpenModal(successMessage)
      refreshCaptcha()
      navigate(withLocale(locale, '/account'))
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : copy(locale, {
        zh: tab === 'login' ? '会员登录失败。' : '会员注册失败。',
        en: tab === 'login' ? 'Login failed.' : 'Sign up failed.',
      }))
      refreshCaptcha()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SiteLayout
      locale={locale}
      title=""
      subtitle=""
      eyebrow="MelodyVow"
      active="account"
      onOpenModal={onOpenModal}
      onLogout={onLogout}
      authSession={authSession}
      hideHero
    >
      <section className="auth-layout">
        <article className="glass-card auth-form-panel auth-form-panel-centered">
          <div className="auth-form-heading">
            <h3>{copy(locale, { zh: '登录 / 注册会员', en: 'Login / Sign Up' })}</h3>
            <p>
              {copy(locale, {
                zh: '登录后即可继续保存歌曲、管理歌单与下载文件。',
                en: 'Log in to save songs, manage playlists and download files.',
              })}
            </p>
          </div>
          <div className="tab-switch">
            <button
              type="button"
              className={tab === 'login' ? 'active' : ''}
              onClick={() => {
                setTab('login')
                setAuthError('')
                refreshCaptcha()
              }}
            >
              {copy(locale, { zh: '登录', en: 'Login' })}
            </button>
            <button
              type="button"
              className={tab === 'signup' ? 'active' : ''}
              onClick={() => {
                setTab('signup')
                setAuthError('')
                refreshCaptcha()
              }}
            >
              {copy(locale, { zh: '注册', en: 'Sign Up' })}
            </button>
          </div>

          <div className="form-grid single">
            <label className="field">
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="hello@melodyvow.com" />
            </label>
            <label className="field">
              <span>{copy(locale, { zh: '密码', en: 'Password' })}</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
            </label>
            {tab === 'signup' ? (
              <>
                <label className="field">
                  <span>{copy(locale, { zh: '伴侣姓名', en: 'Partner Name' })}</span>
                  <input value={partnerName} onChange={(event) => setPartnerName(event.target.value)} placeholder={draft.bride} />
                </label>
                <label className="field">
                  <span>{copy(locale, { zh: '确认密码', en: 'Confirm Password' })}</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                  />
                </label>
              </>
            ) : null}
            <div className="captcha-box">
              <div className="captcha-row">
                <div className="captcha-question">
                  <span>{copy(locale, { zh: '安全验证', en: 'Security Check' })}</span>
                  <strong>{captchaChallenge.prompt}</strong>
                </div>
                <button type="button" className="ghost-button compact captcha-refresh" onClick={refreshCaptcha}>
                  {copy(locale, { zh: '换一题', en: 'Refresh' })}
                </button>
              </div>
              <label className="field">
                <span>{copy(locale, { zh: '验证码答案', en: 'Captcha Answer' })}</span>
                <input
                  value={captchaInput}
                  onChange={(event) => setCaptchaInput(event.target.value)}
                  placeholder={copy(locale, { zh: '请输入结果', en: 'Enter the result' })}
                />
              </label>
            </div>
            {tab === 'signup' ? (
              <div className="policy-consent-box">
                <div className="policy-consent-head">
                  <strong>{copy(locale, { zh: '注册前确认', en: 'Before You Sign Up' })}</strong>
                  <p>
                    {copy(locale, {
                      zh: '为了保持社区与交易流程的正规、透明，创建账户前需完成以下政策确认。',
                      en: 'To keep the community and checkout flow clear and compliant, please confirm the policies below before creating an account.',
                    })}
                  </p>
                </div>
                <label className="policy-consent-item">
                  <input
                    type="checkbox"
                    checked={acceptedAccountPolicy}
                    onChange={(event) => setAcceptedAccountPolicy(event.target.checked)}
                  />
                  <span className="policy-consent-copy">
                    {copy(locale, { zh: '我已阅读并同意', en: 'I have read and agree to the' })}{' '}
                    <a href={getPolicyHref('/terms-of-service')} target="_blank" rel="noreferrer">
                      {copy(locale, { zh: '服务条款', en: 'Terms of Service' })}
                    </a>
                    {' '}&{' '}
                    <a href={getPolicyHref('/privacy-policy')} target="_blank" rel="noreferrer">
                      {copy(locale, { zh: '隐私政策', en: 'Privacy Policy' })}
                    </a>
                    。
                  </span>
                </label>
                <label className="policy-consent-item">
                  <input
                    type="checkbox"
                    checked={acceptedTransactionPolicy}
                    onChange={(event) => setAcceptedTransactionPolicy(event.target.checked)}
                  />
                  <span className="policy-consent-copy">
                    {copy(locale, { zh: '我已知悉并接受', en: 'I understand and accept the' })}{' '}
                    <a href={getPolicyHref('/refund-policy')} target="_blank" rel="noreferrer">
                      {copy(locale, { zh: '退款政策', en: 'Refund Policy' })}
                    </a>
                    {' '}/ {' '}
                    <a href={getPolicyHref('/cancellation-policy')} target="_blank" rel="noreferrer">
                      {copy(locale, { zh: '取消政策', en: 'Cancellation Policy' })}
                    </a>
                    {' '}/ {' '}
                    <a href={getPolicyHref('/delivery-fulfillment')} target="_blank" rel="noreferrer">
                      {copy(locale, { zh: '交付说明', en: 'Delivery & Fulfillment' })}
                    </a>
                    。
                  </span>
                </label>
                <p className="policy-consent-tip">
                  {copy(locale, {
                    zh: '未完成勾选前，注册按钮会保持不可提交状态。',
                    en: 'The sign-up button stays unavailable until both confirmations are checked.',
                  })}
                </p>
              </div>
            ) : null}
          </div>

          {authError ? <p className="form-error">{authError}</p> : null}

          <button
            type="button"
            className="primary-button wide"
            disabled={isSubmitting || (tab === 'signup' && !signupPolicyComplete)}
            onClick={() => void handleAuthSubmit()}
          >
            {isSubmitting
              ? copy(locale, { zh: '提交中...', en: 'Submitting...' })
              : tab === 'login'
              ? copy(locale, { zh: '立即登录', en: 'Log In' })
              : copy(locale, { zh: '创建账户', en: 'Create Account' })}
          </button>

          <div className="social-actions">
            <button type="button" className="ghost-button compact">
              Google
            </button>
          </div>
        </article>
      </section>
    </SiteLayout>
  )
}

function AccountPage({ locale, selectedPlan, onOpenModal, history, onLogout, authSession, onUpsertFloatingPlayer, onAuthSessionUpdate }: AccountPageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isMobileViewport = useIsMobileViewport()
  const [openingPortal, setOpeningPortal] = useState(false)
  const [rechargeCodeInput, setRechargeCodeInput] = useState('')
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [redeemFeedback, setRedeemFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const displayName = authSession?.partnerName
    ? `${authSession.partnerName} & MelodyVow`
    : locale === 'zh'
      ? 'Hao & Xin'
      : 'Hao & Xin'
  const memberLabel = authSession?.email ?? copy(locale, { zh: '未登录访客', en: 'Guest User' })
  const currentPlanLabel = authSession?.plan?.trim() || selectedPlan
  const heartBeansBalance = Number(authSession?.heartBeansBalance || 0)
  const topupHeartBeansBalance = Number(authSession?.topupHeartBeansBalance || 0)
  const subscriptionHeartBeansBalance = Number(authSession?.subscriptionHeartBeansBalance || 0)
  const subscriptionStatus = String(authSession?.subscriptionStatus || '').trim()
  const subscriptionPlanId = String(authSession?.subscriptionPlanId || '').trim()
  const subscriptionCurrentPeriodEnd = String(authSession?.subscriptionCurrentPeriodEnd || '').trim()
  const subscriptionProvider = String(authSession?.subscriptionProvider || '').trim()
  const canManageStripeSubscription = subscriptionProvider === 'stripe' && Boolean(String(authSession?.stripeCustomerId || '').trim())
  const welcomeTitle = copy(locale, {
    zh: authSession?.mode === 'signup' ? '欢迎加入 MelodyVow 会员' : '欢迎回来',
    en: authSession?.mode === 'signup' ? 'Welcome to MelodyVow' : 'Welcome Back',
  })
  const welcomeCopy = authSession?.welcomeMessage ?? copy(locale, {
    zh: '登录后，这里会显示你的会员欢迎信息、歌单进度和订单提醒。',
    en: 'Once you log in, this area will show your welcome message, song progress and order reminders.',
  })
  const authTime = authSession?.lastAuthAt
    ? new Date(authSession.lastAuthAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null
  const nextBillingTime = subscriptionCurrentPeriodEnd
    ? new Date(subscriptionCurrentPeriodEnd).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short',
        day: 'numeric',
      })
    : ''

  useEffect(() => {
    const checkoutState = String(searchParams.get('checkout') || '').trim()
    const portalState = String(searchParams.get('portal') || '').trim()

    if (!checkoutState && !portalState) {
      return
    }

    if (checkoutState === 'success') {
      onOpenModal(copy(locale, {
        zh: '支付已提交成功。我们会在 Stripe 回调确认后自动发放额度并刷新订阅状态。',
        en: 'Payment submitted successfully. Credits and subscription status will refresh automatically after Stripe confirms the checkout.',
      }))
    } else if (checkoutState === 'cancel') {
      onOpenModal(copy(locale, {
        zh: '你已取消本次支付，套餐仍然可以稍后继续购买。',
        en: 'This checkout was cancelled. You can return and purchase the plan later.',
      }))
    } else if (portalState === 'returned') {
      onOpenModal(copy(locale, {
        zh: '已返回订阅管理页，最新订阅状态会自动同步到账户中心。',
        en: 'Returned from the billing portal. Your latest subscription status will sync into the account center automatically.',
      }))
    }

    navigate(withLocale(locale, '/account'), { replace: true })
  }, [locale, navigate, onOpenModal, searchParams])

  function buildSongFileName(item: HistoryItem) {
    const raw = `${item.title}${item.variantLabel ? ` ${item.variantLabel}` : ''}`
      .replace(/[<>:"/\\|?*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return `${raw || 'MelodyVow Song'}.mp3`
  }

  async function handleDownloadSong(item: HistoryItem) {
    if (!item.downloadUrl && !item.audioUrl) {
      onOpenModal(copy(locale, {
        zh: '当前歌曲还没有可下载的音频链接。',
        en: 'This song does not have a downloadable audio link yet.',
      }))
      return
    }

    try {
      const response = await fetch(getSongDownloadUrl(item.id))
      if (!response.ok) {
        const result = (await readJsonSafe(response)) as { message?: string }
        throw new Error(result.message || '下载歌曲失败。')
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = buildSongFileName(item)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      onOpenModal(error instanceof Error ? error.message : copy(locale, {
        zh: '下载歌曲失败，请稍后重试。',
        en: 'Song download failed. Please try again later.',
      }))
    }
  }

  async function handleShareSong(item: HistoryItem) {
    const shareUrl = getSongStreamUrl(item.id)

    try {
      await navigator.clipboard.writeText(shareUrl)
      onOpenModal(copy(locale, {
        zh: '分享链接已复制。',
        en: 'Share link copied.',
      }))
    } catch {
      onOpenModal(`${copy(locale, {
        zh: '分享链接如下：',
        en: 'Share link:',
      })}\n${shareUrl}`)
    }
  }

  async function handleCopyLyrics(item: HistoryItem) {
    const lyricsText = String(item.lyrics || item.lyricSnippet || '').trim()

    if (!lyricsText) {
      onOpenModal(copy(locale, {
        zh: '这首歌暂时还没有可复制的歌词内容。',
        en: 'This song does not have any lyrics available to copy yet.',
      }))
      return
    }

    try {
      await navigator.clipboard.writeText(lyricsText)
      onOpenModal(copy(locale, {
        zh: '歌词已复制。',
        en: 'Lyrics copied.',
      }))
    } catch {
      onOpenModal(`${copy(locale, {
        zh: '歌词如下：',
        en: 'Lyrics:',
      })}\n${lyricsText}`)
    }
  }

  async function handleOpenBillingPortal() {
    setOpeningPortal(true)

    try {
      const response = await fetch(apiUrl('/api/stripe/create-billing-portal'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getMemberAuthHeaders(authSession),
        },
        body: JSON.stringify({ locale }),
      })
      const result = (await readJsonSafe(response)) as { url?: string; message?: string }
      if (!response.ok) {
        throw new Error(result.message || copy(locale, { zh: '创建订阅管理入口失败。', en: 'Failed to open billing portal.' }))
      }

      if (!result.url) {
        throw new Error(copy(locale, { zh: '订阅管理链接为空。', en: 'Billing portal URL is empty.' }))
      }

      window.location.assign(result.url)
    } catch (error) {
      onOpenModal(error instanceof Error ? error.message : copy(locale, {
        zh: '创建订阅管理入口失败。',
        en: 'Failed to open billing portal.',
      }))
    } finally {
      setOpeningPortal(false)
    }
  }

  async function handleRedeemRechargeCode() {
    const normalizedCode = rechargeCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (normalizedCode.length !== 12) {
      setRedeemFeedback({
        type: 'error',
        message: copy(locale, {
          zh: '请输入有效的 12 位 SVIP 卡码。',
          en: 'Please enter a valid 12-character SVIP card code.',
        }),
      })
      return
    }

    setRedeemLoading(true)
    setRedeemFeedback(null)

    try {
      const response = await fetch(apiUrl('/api/member/recharge-codes/redeem'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getMemberAuthHeaders(authSession),
        },
        body: JSON.stringify({ code: normalizedCode }),
      })
      const result = (await readJsonSafe(response)) as MemberRechargeCodeResponse | { message?: string }
      if (!response.ok) {
        throw new Error('message' in result && result.message ? result.message : copy(locale, {
          zh: 'SVIP 卡兑换失败，请稍后重试。',
          en: 'SVIP card redemption failed. Please try again later.',
        }))
      }

      const payload = result as MemberRechargeCodeResponse
      onAuthSessionUpdate(payload.profile)
      setRechargeCodeInput('')
      setRedeemFeedback({
        type: 'success',
        message: payload.message || copy(locale, {
          zh: `兑换成功，已到账 ${payload.creditsAdded} 点服务额度。`,
          en: `${payload.creditsAdded} service credits were added successfully.`,
        }),
      })
    } catch (error) {
      setRedeemFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : copy(locale, {
          zh: 'SVIP 卡兑换失败，请稍后重试。',
          en: 'SVIP card redemption failed. Please try again later.',
        }),
      })
    } finally {
      setRedeemLoading(false)
    }
  }

  async function handleTogglePlay(item: HistoryItem) {
    try {
      const groupJobId = item.jobId || item.id
      const itemLyrics = String(item.lyrics || item.lyricSnippet || '').trim()
      const relatedReadyTracks = history.filter((candidate) => {
        const candidateJobId = candidate.jobId || candidate.id
        return candidateJobId === groupJobId && candidate.rawStatus === 'ready' && Boolean(candidate.audioUrl || candidate.downloadUrl)
      })
      const canPlayCurrentItem = item.rawStatus === 'ready' && Boolean(item.audioUrl || item.downloadUrl)

      if (isMobileViewport) {
        if (!canPlayCurrentItem && groupJobId) {
          saveShowcaseSession({
            mode: 'job',
            jobId: groupJobId,
            title: item.title || 'MelodyVow',
            subtitle: item.subtitle,
            lyrics: itemLyrics,
            statusText: copy(locale, {
              zh: '这首歌还在生成中，Showcase 会继续显示进度，完成后自动播放。',
              en: 'This song is still generating. Showcase will keep showing progress and autoplay once it is ready.',
            }),
            generationProgress: 72,
            isGenerating: true,
            tracks: [],
            activeTrackId: '',
          })
          navigate(withLocale(locale, `/how-it-works?mode=job&job=${encodeURIComponent(groupJobId)}`))
          return
        }

        const mobileTracks = (relatedReadyTracks.length ? relatedReadyTracks : [item]).map((track) => ({
          id: track.id,
          title: track.title || 'MelodyVow',
          meta: track.variantLabel || track.subtitle,
          blurb: summarizeStoryText(
            String(track.lyrics || track.lyricSnippet || '').trim(),
            copy(locale, {
              zh: '点击播放按钮即可直接试听这首歌曲。',
              en: 'Tap play to listen to this song here.',
            }),
          ),
          audioUrl: getSongStreamUrl(track.id),
          downloadUrl: getSongDownloadUrl(track.id),
        }))

        // #region debug-point E:account-history-handoff
        reportDebugEvent({
          hypothesisId: 'E',
          location: 'web/src/App.tsx:AccountPage.handleTogglePlay',
          msg: '[DEBUG] Account handed off song playback to Showcase session',
          data: {
            songId: item.id,
            jobId: groupJobId,
            relatedReadyTrackCount: relatedReadyTracks.length,
            title: item.title || '',
            audioUrl: item.audioUrl || '',
            downloadUrl: item.downloadUrl || '',
            lyricTextLength: itemLyrics.length,
          },
        })
        // #endregion
        saveShowcaseSession({
          mode: 'history',
          title: item.title || 'MelodyVow',
          subtitle: item.subtitle,
          lyrics: itemLyrics,
          statusText: copy(locale, {
            zh: '会员中心歌曲已切换到 Showcase 页面播放，这里可以同时查看歌词。',
            en: 'Member songs now play inside Showcase, where the lyrics can stay visible.',
          }),
          generationProgress: 100,
          isGenerating: false,
          activeTrackId: item.id,
          tracks: mobileTracks,
        })
        navigate(withLocale(locale, `/how-it-works?mode=history&track=${encodeURIComponent(item.id)}`))
        return
      }

      if (!canPlayCurrentItem) {
        onOpenModal(copy(locale, {
          zh: '这首歌还在生成中，桌面端暂时不能播放，请稍后刷新会员中心。',
          en: 'This song is still generating. Desktop playback is not ready yet. Please refresh your member center shortly.',
        }))
        return
      }

      onUpsertFloatingPlayer({
        key: `account-${item.id}`,
        locale,
        title: item.title || 'MelodyVow',
        subtitle: item.subtitle,
        eyebrow: copy(locale, { zh: '会员中心播放器', en: 'Member Player' }),
        tracks: [buildFloatingTrackFromHistory(item)],
        activeTrackIndex: 0,
        canClose: true,
        isGenerating: false,
        generationProgress: 100,
        generationLabel: '',
        statusText: copy(locale, {
          zh: '会员中心的歌曲会统一在这个悬浮播放器中播放，下方会保留歌词小窗口。',
          en: 'Songs from your member center now play in this floating player with lyrics kept below.',
        }),
        lyrics: itemLyrics,
        error: '',
        autoPlay: true,
      })
    } catch {
      onOpenModal(copy(locale, {
        zh: '当前歌曲暂时无法播放，请稍后再试。',
        en: 'This song cannot be played right now. Please try again later.',
      }))
    }
  }

  if (!authSession?.email) {
    return <Navigate to={withLocale(locale, '/auth')} replace />
  }

  return (
    <SiteLayout
      locale={locale}
      title=""
      subtitle=""
      eyebrow=""
      active="account"
      onOpenModal={onOpenModal}
      onLogout={onLogout}
      authSession={authSession}
      hideHero
    >
      <section className="account-layout">
        <aside className="account-sidebar">
          <section className="glass-card account-member-card">
            <div className="account-member-card-head">
              <h3>{displayName}</h3>
              <button
                type="button"
                className="account-mini-logout-button"
                onClick={onLogout}
              >
                {copy(locale, { zh: '退出登录', en: 'Log out' })}
              </button>
            </div>
            <p className="account-member-email">{memberLabel}</p>
            <div className="tag-row">
              <span className="soft-pill accent">{currentPlanLabel}</span>
              <span className="soft-pill">{copy(locale, { zh: `${heartBeansBalance} 点服务额度`, en: `${heartBeansBalance} service credits` })}</span>
              <span className="soft-pill">{copy(locale, { zh: `订阅额度 ${subscriptionHeartBeansBalance}`, en: `Subscription ${subscriptionHeartBeansBalance}` })}</span>
              <span className="soft-pill">{copy(locale, { zh: `充值额度 ${topupHeartBeansBalance}`, en: `Top-up ${topupHeartBeansBalance}` })}</span>
              {subscriptionStatus ? (
                <span className="soft-pill">{copy(locale, { zh: `订阅状态 ${subscriptionStatus}`, en: `Subscription ${subscriptionStatus}` })}</span>
              ) : null}
              {authTime ? (
                <span className="soft-pill">{copy(locale, { zh: `最近验证 ${authTime}`, en: `Verified ${authTime}` })}</span>
              ) : null}
            </div>
            {canManageStripeSubscription ? (
              <button
                type="button"
                className="ghost-button compact"
                disabled={openingPortal}
                onClick={() => void handleOpenBillingPortal()}
              >
                {openingPortal
                  ? copy(locale, { zh: '打开中...', en: 'Opening...' })
                  : copy(locale, { zh: '管理订阅', en: 'Manage Subscription' })}
              </button>
            ) : null}
          </section>

          <section className="glass-card account-recharge-card">
            <p className="mini-eyebrow">{copy(locale, { zh: 'SVIP 卡', en: 'SVIP Card' })}</p>
            <h3>{copy(locale, { zh: '输入 12 位 SVIP 卡码，立即到账服务点数', en: 'Enter your 12-character SVIP card code and add credits instantly' })}</h3>
            <p>
              {copy(locale, {
                zh: 'SVIP 卡仅限已登录会员兑换，点数会直接进入你的充值额度余额。',
                en: 'Redeem your SVIP card while logged in and the credits will land directly in your top-up balance.',
              })}
            </p>
            <div className="account-recharge-form">
              <label className="field">
                <span>{copy(locale, { zh: '12 位 SVIP 卡码', en: '12-character SVIP card code' })}</span>
                <input
                  value={rechargeCodeInput}
                  maxLength={12}
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder={copy(locale, { zh: '例如 AB12CD34EF56', en: 'Example: AB12CD34EF56' })}
                  onChange={(event) => {
                    setRechargeCodeInput(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12))
                    if (redeemFeedback) {
                      setRedeemFeedback(null)
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="primary-button"
                disabled={redeemLoading || rechargeCodeInput.trim().length !== 12}
                onClick={() => void handleRedeemRechargeCode()}
              >
                {redeemLoading
                  ? copy(locale, { zh: '兑换中...', en: 'Redeeming...' })
                  : copy(locale, { zh: '立即兑换', en: 'Redeem Now' })}
              </button>
            </div>
            <div className="account-recharge-meta">
              <span className="soft-pill">{copy(locale, { zh: `当前充值额度 ${topupHeartBeansBalance}`, en: `Top-up balance ${topupHeartBeansBalance}` })}</span>
              <span className="soft-pill">{copy(locale, { zh: 'SVIP 卡已写入数据库并防重复兑换', en: 'SVIP cards are stored securely and cannot be redeemed twice' })}</span>
            </div>
            {redeemFeedback ? (
              <p className={`account-recharge-feedback ${redeemFeedback.type === 'success' ? 'is-success' : 'is-error'}`}>
                {redeemFeedback.message}
              </p>
            ) : null}
          </section>

          <section className="glass-card account-welcome-card">
            <p className="mini-eyebrow">{welcomeTitle}</p>
            <h3>{copy(locale, { zh: '会员中心已为你准备好', en: 'Your Member Dashboard Is Ready' })}</h3>
            <p>{welcomeCopy}</p>
            <div className="account-metrics">
              <div className="account-metric">
                <strong>{history.length}</strong>
                <span>{copy(locale, { zh: '首生成品', en: 'Songs Saved' })}</span>
              </div>
              <div className="account-metric">
                <strong>{currentPlanLabel}</strong>
                <span>{copy(locale, { zh: '当前套餐', en: 'Current Plan' })}</span>
              </div>
              <div className="account-metric">
                <strong>{heartBeansBalance}</strong>
                <span>{copy(locale, { zh: '剩余服务额度', en: 'Service Credits' })}</span>
              </div>
              <div className="account-metric">
                <strong>{subscriptionHeartBeansBalance}</strong>
                <span>{copy(locale, { zh: '订阅额度', en: 'Subscription Credits' })}</span>
              </div>
              <div className="account-metric">
                <strong>{topupHeartBeansBalance}</strong>
                <span>{copy(locale, { zh: '充值额度', en: 'Top-up Credits' })}</span>
              </div>
            </div>
            {subscriptionPlanId ? (
              <p className="account-subscription-note">
                {copy(locale, {
                  zh: `当前订阅：${subscriptionPlanId}${nextBillingTime ? `，下次账期至 ${nextBillingTime}` : ''}${subscriptionProvider ? `，通道 ${subscriptionProvider}` : ''}`,
                  en: `Subscription: ${subscriptionPlanId}${nextBillingTime ? `, current period through ${nextBillingTime}` : ''}${subscriptionProvider ? `, via ${subscriptionProvider}` : ''}`,
                })}
              </p>
            ) : (
              <p className="account-subscription-note">
                {copy(locale, {
                  zh: '你当前没有激活中的月订阅，可以在套餐页直接立即订阅。',
                  en: 'No active monthly subscription yet. You can subscribe directly from the pricing page.',
                })}
              </p>
            )}
          </section>
        </aside>

        <section className="account-song-list">
          {history.map((item) => (
            <article key={item.id} className={`glass-card account-song-row ${item.rawStatus === 'ready' ? '' : 'is-pending'}`}>
              <div className="account-song-main">
                <h3 className="account-song-title">{item.title}</h3>
                <p className="account-song-subtitle">{item.subtitle}</p>
                <div className="account-song-meta">
                  <span>{item.status}</span>
                  {item.variantLabel ? <span>{item.variantLabel}</span> : null}
                  {item.languageLabel ? <span>{item.languageLabel}</span> : null}
                  {item.styleLabel ? <span>{item.styleLabel}</span> : null}
                </div>
              </div>
              <div className="account-song-actions">
                <button
                  type="button"
                  className="ghost-button compact"
                  onClick={() => void handleTogglePlay(item)}
                >
                  {item.rawStatus === 'ready'
                    ? copy(locale, { zh: '浮动播放器', en: 'Open Player' })
                    : copy(locale, { zh: '查看进度', en: 'View Progress' })}
                </button>
                <button
                  type="button"
                  className="ghost-button compact"
                  onClick={() => void handleShareSong(item)}
                  disabled={!item.downloadUrl && !item.audioUrl}
                >
                  {copy(locale, { zh: '分享链接', en: 'Share Link' })}
                </button>
                <button
                  type="button"
                  className="ghost-button compact"
                  onClick={() => void handleCopyLyrics(item)}
                  disabled={!String(item.lyrics || item.lyricSnippet || '').trim()}
                >
                  {copy(locale, { zh: '复制歌词', en: 'Copy Lyrics' })}
                </button>
                <button
                  type="button"
                  className="primary-button compact"
                  disabled={!item.downloadUrl && !item.audioUrl}
                  onClick={() => {
                    reportDebugEvent({
                      hypothesisId: 'C',
                      location: 'web/src/App.tsx:accountDownloadClick',
                      msg: '[DEBUG] User clicked account history download button',
                      data: {
                        itemId: item.id,
                        chosenUrl: getSongDownloadUrl(item.id),
                        audioUrl: item.audioUrl || '',
                        downloadUrl: item.downloadUrl || '',
                      },
                    })
                    void handleDownloadSong(item)
                  }}
                >
                  {copy(locale, { zh: '下载歌曲', en: 'Download Song' })}
                </button>
              </div>
            </article>
          ))}
        </section>
      </section>
    </SiteLayout>
  )
}

function AdminLoginPage({
  session,
  onLogin,
}: {
  session: AdminSession | null
  onLogin: (session: AdminSession) => void
}) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (session) {
      navigate('/admin', { replace: true })
    }
  }, [navigate, session])

  async function handleSubmit() {
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      })

      const result = (await readJsonSafe(response)) as AdminSession | { message?: string }

      if (!response.ok || !('token' in result)) {
        throw new Error('message' in result && result.message ? result.message : '后台登录失败。')
      }

      onLogin(result)
      navigate('/admin', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '后台登录失败。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-shell">
      <div className="admin-login-card glass-card">
        <p className="mini-eyebrow">MelodyVow Admin</p>
        <h1>后台管理登录</h1>
        <p className="admin-subtitle">请输入部署环境中配置的后台账号与密码。</p>
        <div className="form-grid single">
          <label className="field">
            <span>后台账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入后台账号" />
          </label>
          <label className="field">
            <span>后台密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入后台密码"
            />
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="button" className="primary-button wide" onClick={() => void handleSubmit()} disabled={isSubmitting}>
          {isSubmitting ? '登录中...' : '进入后台'}
        </button>
        <p className="admin-tip">生产环境请务必使用 Render 环境变量中的后台账号，不要在页面中暴露默认凭据。</p>
      </div>
    </div>
  )
}

function AdminDashboardPage({
  session,
  onLogout,
}: {
  session: AdminSession | null
  onLogout: () => void
}) {
  const navigate = useNavigate()
  const activeSession = session
  const [tab, setTab] = useState<'overview' | 'members' | 'songs' | 'showcase' | 'plans' | 'payments' | 'orders' | 'messages' | 'codes' | 'config'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState({
    totalSongs: 0,
    readySongs: 0,
    totalOrders: 0,
    paidOrders: 0,
    totalRevenue: 0,
    totalMessages: 0,
    pendingMessages: 0,
    totalRechargeCodes: 0,
    activeRechargeCodes: 0,
    redeemedRechargeCodes: 0,
  })
  const [songs, setSongs] = useState<AdminSong[]>([])
  const [members, setMembers] = useState<AdminMember[]>([])
  const [selectedMember, setSelectedMember] = useState<AdminMember | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [manualTopupAmount, setManualTopupAmount] = useState('0')
  const [manualTopupNote, setManualTopupNote] = useState('')
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selectedSong, setSelectedSong] = useState<AdminSong | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [plans, setPlans] = useState<PlanItem[]>([])
  const [showcaseTracks, setShowcaseTracks] = useState<ShowcaseTrack[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodAdmin[]>([])
  const [messages, setMessages] = useState<AdminContactMessage[]>([])
  const [selectedMessage, setSelectedMessage] = useState<AdminContactMessage | null>(null)
  const [rechargeCodes, setRechargeCodes] = useState<AdminRechargeCode[]>([])
  const [selectedRechargeCode, setSelectedRechargeCode] = useState<AdminRechargeCode | null>(null)
  const [rechargeCodeHeartBeans, setRechargeCodeHeartBeans] = useState('15')
  const [rechargeCodeQuantity, setRechargeCodeQuantity] = useState('20')
  const [generatingRechargeCodes, setGeneratingRechargeCodes] = useState(false)
  const [latestRechargeBatch, setLatestRechargeBatch] = useState<GeneratedRechargeBatch | null>(null)
  const [config, setConfig] = useState<AdminConfig>({
    deepseekProvider: '',
    sunoProvider: '',
    publicBaseUrl: '',
    allowSignup: true,
    enableChineseSite: false,
    backgroundTheme: DEFAULT_BACKGROUND_THEME,
    heartBeansPerGeneration: 1,
    paypalCheckoutUrl: '',
    notes: '',
  })
  const [savingConfig, setSavingConfig] = useState(false)
  const selectedBackgroundTheme = getBackgroundThemeOption(config.backgroundTheme)
  const effectiveBackgroundThemeOption = getBackgroundThemeOption(resolveBackgroundTheme(config.backgroundTheme))

  useEffect(() => {
    if (!activeSession) {
      navigate('/admin/login', { replace: true })
      return
    }

    let disposed = false

    async function loadAdminData() {
      setLoading(true)
      setError('')

      try {
        const headers = {
          'x-admin-token': activeSession!.token,
        }

        const adminRequests = [
          { key: 'overview', path: '/api/admin/overview', label: '总览' },
          { key: 'members', path: '/api/admin/members', label: '会员' },
          { key: 'songs', path: '/api/admin/songs', label: '歌曲' },
          { key: 'showcase', path: '/api/admin/showcase-tracks', label: '样片' },
          { key: 'plans', path: '/api/admin/plans', label: '套餐' },
          { key: 'payments', path: '/api/admin/payment-methods', label: '支付方式' },
          { key: 'orders', path: '/api/admin/orders', label: '订单' },
          { key: 'messages', path: '/api/admin/messages', label: '留言' },
          { key: 'codes', path: '/api/admin/recharge-codes', label: 'SVIP 卡' },
          { key: 'config', path: '/api/admin/config', label: '配置' },
        ] as const

        const settled = await Promise.allSettled(
          adminRequests.map(async (request) => {
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)

            try {
              const response = await fetch(apiUrl(request.path), {
                headers,
                signal: controller.signal,
              })
              const data = await readJsonSafe(response)
              return {
                ...request,
                response,
                data,
              }
            } finally {
              clearTimeout(timeoutId)
            }
          }),
        )

        if (disposed) {
          return
        }

        const failureMessages: string[] = []
        let authExpired = false
        let nextMembers: AdminMember[] | null = null
        let nextSongs: AdminSong[] | null = null
        let nextShowcase: ShowcaseTrack[] | null = null
        let nextPlans: PlanItem[] | null = null
        let nextPayments: PaymentMethodAdmin[] | null = null
        let nextOrders: AdminOrder[] | null = null
        let nextMessages: AdminContactMessage[] | null = null
        let nextRechargeCodes: AdminRechargeCode[] | null = null
        let nextConfig: AdminConfig | null = null

        settled.forEach((result) => {
          if (result.status === 'rejected') {
            failureMessages.push('部分后台数据请求超时，请刷新重试。')
            return
          }

          const { key, label, response, data } = result.value

          if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
              authExpired = true
            }
            failureMessages.push(data?.message || `${label}数据加载失败。`)
            return
          }

          switch (key) {
            case 'overview':
              if (data?.metrics) {
                setMetrics(data.metrics)
              }
              break
            case 'members':
              nextMembers = Array.isArray(data?.items) ? data.items : []
              break
            case 'songs':
              nextSongs = Array.isArray(data?.items) ? data.items : []
              break
            case 'showcase':
              nextShowcase = Array.isArray(data?.items) ? data.items : []
              break
            case 'plans':
              nextPlans = Array.isArray(data?.items) ? data.items : []
              break
            case 'payments':
              nextPayments = Array.isArray(data?.items) ? data.items : []
              break
            case 'orders':
              nextOrders = Array.isArray(data?.items) ? data.items : []
              break
            case 'messages':
              nextMessages = Array.isArray(data?.items) ? data.items : []
              break
            case 'codes':
              nextRechargeCodes = Array.isArray(data?.items) ? data.items : []
              break
            case 'config':
              nextConfig = data as AdminConfig
              break
          }
        })

        if (authExpired) {
          onLogout()
          navigate('/admin/login', { replace: true })
          return
        }

        if (nextMembers) {
          const membersData: AdminMember[] = nextMembers
          setMembers(membersData)
          setSelectedMember((current) => {
            if (current) {
              const matchedMember = membersData.find((item) => item.email === current.email) ?? membersData[0] ?? null
              return matchedMember
                ? syncAdminMemberPlanFields(matchedMember, matchedMember.plan || '', plans, { preserveExistingSubscriptionStatus: true })
                : null
            }
            return membersData[0]
              ? syncAdminMemberPlanFields(membersData[0], membersData[0].plan || '', plans, { preserveExistingSubscriptionStatus: true })
              : null
          })
        }

        if (nextSongs) {
          const songsData: AdminSong[] = nextSongs
          setSongs(songsData)
          setSelectedSong((current) => {
            if (current) {
              return songsData.find((item) => item.id === current.id) ?? songsData[0] ?? null
            }
            return songsData[0] ?? null
          })
        }

        if (nextShowcase) {
          setShowcaseTracks(nextShowcase)
        }

        if (nextPlans) {
          setPlans(nextPlans)
        }

        if (nextPayments) {
          setPaymentMethods(nextPayments)
        }

        if (nextOrders) {
          const ordersData: AdminOrder[] = nextOrders
          setOrders(ordersData)
          setSelectedOrder((current) => {
            if (current) {
              return ordersData.find((item) => item.id === current.id) ?? ordersData[0] ?? null
            }
            return ordersData[0] ?? null
          })
        }

        if (nextMessages) {
          const messageData: AdminContactMessage[] = nextMessages
          setMessages(messageData)
          setSelectedMessage((current) => {
            if (current) {
              return messageData.find((item) => item.id === current.id) ?? messageData[0] ?? null
            }
            return messageData[0] ?? null
          })
        }

        if (nextRechargeCodes) {
          const codeData: AdminRechargeCode[] = nextRechargeCodes
          setRechargeCodes(codeData)
          setSelectedRechargeCode((current) => {
            if (current) {
              return codeData.find((item) => item.id === current.id) ?? codeData[0] ?? null
            }
            return codeData[0] ?? null
          })
        }

        if (nextConfig) {
          setConfig(nextConfig)
        }

        if (failureMessages.length) {
          setError(failureMessages[0] || '部分后台数据加载失败。')
        }
      } catch (loadError) {
        if (!disposed) {
          const message = loadError instanceof Error ? loadError.message : '后台数据加载失败。'
          setError(message)
          if (message.includes('登录已失效')) {
            onLogout()
            navigate('/admin/login', { replace: true })
          }
        }
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    void loadAdminData()

    return () => {
      disposed = true
    }
  }, [activeSession, navigate, onLogout])

  if (!activeSession) {
    return <Navigate to="/admin/login" replace />
  }

  async function handleSaveConfig() {
    setSavingConfig(true)
    setError('')

    try {
      const response = await fetch(apiUrl('/api/admin/config'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': activeSession!.token,
        },
        body: JSON.stringify(config),
      })

      const result = (await readJsonSafe(response)) as AdminConfig | { message?: string }
      if (!response.ok) {
        throw new Error('message' in result && result.message ? result.message : '配置保存失败。')
      }

      setConfig(result as AdminConfig)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '配置保存失败。')
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleSelectSong(songId: string) {
    try {
      const response = await fetch(apiUrl(`/api/admin/songs/${songId}`), {
        headers: {
          'x-admin-token': activeSession!.token,
        },
      })
      const result = (await readJsonSafe(response)) as AdminSong | { message?: string }
      if (!response.ok) {
        throw new Error('message' in result && result.message ? result.message : '歌曲详情加载失败。')
      }
      setSelectedSong(result as AdminSong)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '歌曲详情加载失败。')
    }
  }

  async function handleSelectOrder(orderId: string) {
    try {
      const response = await fetch(apiUrl(`/api/admin/orders/${orderId}`), {
        headers: {
          'x-admin-token': activeSession!.token,
        },
      })
      const result = (await readJsonSafe(response)) as AdminOrder | { message?: string }
      if (!response.ok) {
        throw new Error('message' in result && result.message ? result.message : '订单详情加载失败。')
      }
      setSelectedOrder(result as AdminOrder)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '订单详情加载失败。')
    }
  }

  async function handleSaveOrder() {
    if (!selectedOrder) {
      return
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/orders/${selectedOrder.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': activeSession!.token,
        },
        body: JSON.stringify(selectedOrder),
      })
      const result = (await readJsonSafe(response)) as AdminOrder | { message?: string }
      if (!response.ok) {
        throw new Error('message' in result && result.message ? result.message : '订单保存失败。')
      }

      const saved = result as AdminOrder
      setSelectedOrder(saved)
      setOrders((current) => current.map((item) => (item.id === saved.id ? saved : item)))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '订单保存失败。')
    }
  }

  async function handleSaveMember() {
    if (!selectedMember) {
      return
    }

    const topupAmount = Math.max(0, Number(manualTopupAmount || 0))
    const currentTopupBalance = Number(selectedMember.topupHeartBeansBalance ?? selectedMember.heartBeansBalance ?? 0)
    const currentSubscriptionBalance = Number(selectedMember.subscriptionHeartBeansBalance ?? 0)
    const manualNote = manualTopupNote.trim()
    const nextMemberPayload: AdminMember = {
      ...syncAdminMemberPlanFields(selectedMember, selectedMember.plan || '', plans),
      topupHeartBeansBalance: currentTopupBalance + topupAmount,
      subscriptionHeartBeansBalance: currentSubscriptionBalance,
      heartBeansBalance: currentTopupBalance + topupAmount + currentSubscriptionBalance,
    }

    if (topupAmount > 0 || manualNote) {
      nextMemberPayload.lastManualAdjustmentAmount = topupAmount
      nextMemberPayload.lastManualAdjustmentNote = manualNote
      nextMemberPayload.lastManualAdjustmentAt = new Date().toISOString()
      nextMemberPayload.lastManualAdjustmentBy = activeSession?.profile.username || 'admin'
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/members/${encodeURIComponent(selectedMember.email)}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': activeSession!.token,
        },
        body: JSON.stringify(nextMemberPayload),
      })
      const result = (await readJsonSafe(response)) as AdminMember | { message?: string }
      if (!response.ok) {
        throw new Error('message' in result && result.message ? result.message : '会员信息保存失败。')
      }

      const saved = result as AdminMember
      setSelectedMember(saved)
      setMembers((current) => current.map((item) => (item.email === saved.email ? { ...item, ...saved } : item)))
      setManualTopupAmount('0')
      setManualTopupNote('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '会员信息保存失败。')
    }
  }

  async function handleDeleteMember(email: string) {
    if (!window.confirm(`确认删除会员 ${email} 吗？这会同时删除该会员的订单、歌曲、额度流水和登录状态。`)) {
      return
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/members/${encodeURIComponent(email)}`), {
        method: 'DELETE',
        headers: {
          'x-admin-token': activeSession!.token,
        },
      })
      const result = (await readJsonSafe(response)) as { ok?: boolean; message?: string }
      if (!response.ok) {
        throw new Error(result.message || '会员删除失败。')
      }

      setMembers((current) => current.filter((item) => item.email !== email))
      setOrders((current) => current.filter((item) => (item.email || '').toLowerCase() !== email.toLowerCase()))
      setSongs((current) => current.filter((item) => (item.email || '').toLowerCase() !== email.toLowerCase()))
      setSelectedMember((current) => (current?.email === email ? null : current))
      setSelectedOrder((current) => ((current?.email || '').toLowerCase() === email.toLowerCase() ? null : current))
      setSelectedSong((current) => ((current?.email || '').toLowerCase() === email.toLowerCase() ? null : current))
      setManualTopupAmount('0')
      setManualTopupNote('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '会员删除失败。')
    }
  }

  async function handleSavePlans() {
    try {
      const response = await fetch(apiUrl('/api/admin/plans'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': activeSession!.token,
        },
        body: JSON.stringify({ items: plans }),
      })
      const result = (await readJsonSafe(response)) as { items?: PlanItem[]; message?: string }
      if (!response.ok) {
        throw new Error(result.message || '套餐保存失败。')
      }
      setPlans(Array.isArray(result.items) ? result.items.map(normalizePricingPlan) : plans)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '套餐保存失败。')
    }
  }

  async function handleDeletePlan(planId: string) {
    if (!window.confirm(`确认删除套餐 ${planId} 吗？删除后前台将不再展示该套餐。`)) {
      return
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/plans/${encodeURIComponent(planId)}`), {
        method: 'DELETE',
        headers: {
          'x-admin-token': activeSession!.token,
        },
      })
      const result = (await readJsonSafe(response)) as { ok?: boolean; message?: string }
      if (!response.ok) {
        throw new Error(result.message || '套餐删除失败。')
      }

      setPlans((current) => current.filter((item) => item.id !== planId))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '套餐删除失败。')
    }
  }

  async function handleSaveShowcaseTracks() {
    try {
      const response = await fetch(apiUrl('/api/admin/showcase-tracks'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': activeSession!.token,
        },
        body: JSON.stringify({ items: showcaseTracks }),
      })
      const result = (await readJsonSafe(response)) as { items?: ShowcaseTrack[]; message?: string }
      if (!response.ok) {
        throw new Error(result.message || '样片保存失败。')
      }
      setShowcaseTracks(Array.isArray(result.items) ? result.items : showcaseTracks)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '样片保存失败。')
    }
  }

  async function handleDeleteShowcaseTrack(trackId: string) {
    if (!window.confirm(`确认删除样片 ${trackId} 吗？`)) {
      return
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/showcase-tracks/${encodeURIComponent(trackId)}`), {
        method: 'DELETE',
        headers: {
          'x-admin-token': activeSession!.token,
        },
      })
      const result = (await readJsonSafe(response)) as { ok?: boolean; message?: string }
      if (!response.ok) {
        throw new Error(result.message || '样片删除失败。')
      }

      setShowcaseTracks((current) => current.filter((item) => item.id !== trackId))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '样片删除失败。')
    }
  }

  async function handleSavePaymentMethods() {
    try {
      const response = await fetch(apiUrl('/api/admin/payment-methods'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': activeSession!.token,
        },
        body: JSON.stringify({ items: paymentMethods }),
      })
      const result = (await readJsonSafe(response)) as { items?: PaymentMethodAdmin[]; message?: string }
      if (!response.ok) {
        throw new Error(result.message || '支付方式保存失败。')
      }
      setPaymentMethods(Array.isArray(result.items) ? result.items : paymentMethods)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '支付方式保存失败。')
    }
  }

  async function handleSaveMessage() {
    if (!selectedMessage) {
      return
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/messages/${selectedMessage.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': activeSession!.token,
        },
        body: JSON.stringify(selectedMessage),
      })
      const result = (await readJsonSafe(response)) as AdminContactMessage | { message?: string }
      if (!response.ok) {
        throw new Error('message' in result && result.message ? result.message : '留言保存失败。')
      }
      const saved = result as AdminContactMessage
      setSelectedMessage(saved)
      setMessages((current) => current.map((item) => (item.id === saved.id ? saved : item)))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '留言保存失败。')
    }
  }

  function downloadRechargeBatchCsv(batch: GeneratedRechargeBatch) {
    const blob = new Blob([batch.csvContent], { type: 'text/csv;charset=utf-8' })
    const blobUrl = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = batch.csvFilename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(blobUrl)
  }

  async function handleGenerateRechargeCodes() {
    const heartBeans = Math.max(1, Number(rechargeCodeHeartBeans || 0))
    const quantity = Math.max(1, Math.min(500, Number(rechargeCodeQuantity || 0)))

    if (!Number.isFinite(heartBeans) || heartBeans <= 0) {
      setError('请输入有效的服务点数。')
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('请输入有效的 SVIP 卡数量。')
      return
    }

    setGeneratingRechargeCodes(true)
    setError('')

    try {
      const response = await fetch(apiUrl('/api/admin/recharge-codes/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': activeSession!.token,
        },
        body: JSON.stringify({ heartBeans, quantity }),
      })
      const result = (await readJsonSafe(response)) as GeneratedRechargeBatch | { message?: string }
      if (!response.ok) {
        throw new Error('message' in result && result.message ? result.message : 'SVIP 卡生成失败。')
      }

      const batch = result as GeneratedRechargeBatch
      setLatestRechargeBatch(batch)
      downloadRechargeBatchCsv(batch)

      const reloadResponse = await fetch(apiUrl('/api/admin/recharge-codes'), {
        headers: {
          'x-admin-token': activeSession!.token,
        },
      })
      const reloadData = (await readJsonSafe(reloadResponse)) as { items?: AdminRechargeCode[]; message?: string }
      if (!reloadResponse.ok) {
        throw new Error(reloadData.message || 'SVIP 卡列表刷新失败。')
      }

      const nextItems = Array.isArray(reloadData.items) ? reloadData.items : []
      setRechargeCodes(nextItems)
      setSelectedRechargeCode(nextItems[0] ?? null)
      setMetrics((current) => ({
        ...current,
        totalRechargeCodes: nextItems.length,
        activeRechargeCodes: nextItems.filter((item) => item.status !== 'redeemed').length,
        redeemedRechargeCodes: nextItems.filter((item) => item.status === 'redeemed').length,
      }))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'SVIP 卡生成失败。')
    } finally {
      setGeneratingRechargeCodes(false)
    }
  }

  async function handleSaveSong() {
    if (!selectedSong) {
      return
    }

    try {
      const response = await fetch(apiUrl(`/api/admin/songs/${selectedSong.id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': activeSession!.token,
        },
        body: JSON.stringify(selectedSong),
      })
      const result = (await readJsonSafe(response)) as AdminSong | { message?: string }
      if (!response.ok) {
        throw new Error('message' in result && result.message ? result.message : '歌曲更新失败。')
      }
      const saved = result as AdminSong
      setSelectedSong(saved)
      setSongs((current) => current.map((item) => (item.id === saved.id ? saved : item)))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '歌曲更新失败。')
    }
  }

  async function handleDeleteSong(songId: string) {
    try {
      const response = await fetch(apiUrl(`/api/admin/songs/${songId}`), {
        method: 'DELETE',
        headers: {
          'x-admin-token': activeSession!.token,
        },
      })
      const result = (await readJsonSafe(response)) as { ok?: boolean; message?: string }
      if (!response.ok) {
        throw new Error(result.message || '歌曲删除失败。')
      }

      setSongs((current) => current.filter((item) => item.id !== songId))
      setSelectedSong((current) => (current?.id === songId ? null : current))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '歌曲删除失败。')
    }
  }

  const tabs = [
    { key: 'overview', label: '总览' },
    { key: 'members', label: '会员管理' },
    { key: 'songs', label: '歌曲记录' },
    { key: 'showcase', label: '样片管理' },
    { key: 'plans', label: '套餐管理' },
    { key: 'payments', label: '支付方式' },
    { key: 'orders', label: '订单' },
    { key: 'messages', label: '留言管理' },
    { key: 'codes', label: 'SVIP 卡' },
    { key: 'config', label: '配置' },
  ] as const

  const filteredMembers = members.filter((item) => {
    const keyword = memberSearch.trim().toLowerCase()
    if (!keyword) {
      return true
    }

    return [item.email, item.plan, item.disabled ? 'disabled' : 'active']
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  })

  const selectedMemberOrders = selectedMember
    ? orders
        .filter((item) => String(item.email || '').trim().toLowerCase() === selectedMember.email.toLowerCase())
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    : []
  const selectedMemberPaidOrders = selectedMemberOrders.filter((item) => item.status === 'paid')
  const selectedMemberSongs = selectedMember
    ? songs
        .filter((item) => String(item.email || '').trim().toLowerCase() === selectedMember.email.toLowerCase())
        .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime())
    : []
  const successfulSongCount = selectedMemberSongs.filter((item) => item.status === 'ready').length
  const failedSongCount = selectedMemberSongs.filter((item) => item.status === 'error').length
  const selectedSongStreamUrl = selectedSong ? getSongStreamUrl(selectedSong.id) : ''
  const selectedSongDownloadUrl = selectedSong ? getSongDownloadUrl(selectedSong.id) : ''
  const activeRechargeCodeCount = rechargeCodes.filter((item) => item.status !== 'redeemed').length
  const redeemedRechargeCodeCount = rechargeCodes.filter((item) => item.status === 'redeemed').length

  return (
    <div className="admin-shell">
      <header className="admin-header glass-card">
        <div>
          <p className="mini-eyebrow">MelodyVow Admin</p>
          <h1>后台管理中心</h1>
          <p className="admin-subtitle">当前登录：{activeSession.profile.username}，用于查看歌曲任务、订单和基础配置。</p>
        </div>
        <div className="admin-header-actions">
          <button type="button" className="ghost-button compact" onClick={() => navigate('/')}>
            返回前台
          </button>
          <button type="button" className="primary-button compact" onClick={onLogout}>
            退出登录
          </button>
        </div>
      </header>

      <section className="admin-layout">
        <aside className="admin-sidebar glass-card">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`ghost-button menu-item ${tab === item.key ? 'admin-tab-active' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <main className="admin-main">
          {error ? <p className="form-error">{error}</p> : null}
          {loading ? <p className="empty-state">后台数据加载中...</p> : null}

          {!loading && tab === 'overview' ? (
            <section className="admin-grid">
              <article className="glass-card admin-metric-card">
                <strong>{metrics.totalSongs}</strong>
                <span>总歌曲任务</span>
              </article>
              <article className="glass-card admin-metric-card">
                <strong>{metrics.readySongs}</strong>
                <span>已生成完成</span>
              </article>
              <article className="glass-card admin-metric-card">
                <strong>{metrics.totalOrders}</strong>
                <span>订单数量</span>
              </article>
              <article className="glass-card admin-metric-card">
                <strong>¥{metrics.totalRevenue}</strong>
                <span>已支付金额</span>
              </article>
              <article className="glass-card admin-metric-card">
                <strong>{metrics.totalMessages}</strong>
                <span>留言总数</span>
              </article>
              <article className="glass-card admin-metric-card">
                <strong>{metrics.pendingMessages}</strong>
                <span>待回复留言</span>
              </article>
              <article className="glass-card admin-metric-card">
                <strong>{metrics.totalRechargeCodes}</strong>
                <span>SVIP 卡总数</span>
              </article>
              <article className="glass-card admin-metric-card">
                <strong>{metrics.activeRechargeCodes}</strong>
                <span>可兑换 SVIP 卡</span>
              </article>
              <article className="glass-card admin-metric-card">
                <strong>{metrics.redeemedRechargeCodes}</strong>
                <span>已兑换 SVIP 卡</span>
              </article>
            </section>
          ) : null}

          {!loading && tab === 'members' ? (
            <section className="admin-detail-layout">
              <section className="admin-table glass-card admin-members-table">
                <div className="admin-table-head">
                  <strong>会员管理</strong>
                  <span>{filteredMembers.length} / {members.length} 条</span>
                </div>
                <label className="field admin-member-search">
                  <span>搜索会员</span>
                  <input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="按邮箱、套餐或状态筛选"
                  />
                </label>
                <div className="admin-table-list">
                  {filteredMembers.map((item) => (
                    <button
                      key={item.email}
                      type="button"
                      className={`admin-table-row admin-select-row admin-member-row ${selectedMember?.email === item.email ? 'is-active' : ''}`}
                      onClick={() => {
                        setSelectedMember(syncAdminMemberPlanFields(item, item.plan || '', plans, { preserveExistingSubscriptionStatus: true }))
                        setManualTopupAmount('0')
                        setManualTopupNote('')
                      }}
                    >
                      <div className="admin-member-row-main">
                        <h3>{item.email}</h3>
                        <p>{item.plan || '未设置套餐'}</p>
                      </div>
                      <div className="admin-member-row-meta">
                        <span className="soft-pill">{item.heartBeansBalance ?? 0} 点</span>
                        <span className="soft-pill">{`订阅 ${item.subscriptionHeartBeansBalance ?? 0} / 充值 ${item.topupHeartBeansBalance ?? 0}`}</span>
                        <span className="soft-pill">{typeof item.songs === 'number' ? `${item.songs} 首` : '0 首'}</span>
                        <span className={`soft-pill ${item.disabled ? '' : 'accent'}`}>{item.disabled ? '禁用' : '正常'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="glass-card admin-detail-card">
                <div className="admin-table-head">
                  <strong>会员详情</strong>
                  <span>{selectedMember?.email ?? '未选择'}</span>
                </div>
                {selectedMember ? (
                  <div className="admin-detail-stack">
                    <section className="admin-member-summary-grid">
                      <article className="admin-mini-card">
                        <span>当前套餐</span>
                        <strong>{selectedMember.plan || '未设置'}</strong>
                      </article>
                      <article className="admin-mini-card">
                        <span>总服务额度</span>
                        <strong>{selectedMember.heartBeansBalance ?? 0}</strong>
                      </article>
                      <article className="admin-mini-card">
                        <span>订阅额度</span>
                        <strong>{selectedMember.subscriptionHeartBeansBalance ?? 0}</strong>
                      </article>
                      <article className="admin-mini-card">
                        <span>充值额度</span>
                        <strong>{selectedMember.topupHeartBeansBalance ?? 0}</strong>
                      </article>
                      <article className="admin-mini-card">
                        <span>生成成功</span>
                        <strong>{successfulSongCount}</strong>
                      </article>
                      <article className="admin-mini-card">
                        <span>生成失败</span>
                        <strong>{failedSongCount}</strong>
                      </article>
                    </section>

                    <section className="admin-member-edit-grid">
                      <label className="field">
                        <span>Email</span>
                        <input value={selectedMember.email} readOnly />
                      </label>
                      <label className="field">
                        <span>套餐</span>
                        <select
                          value={selectedMember.plan || ''}
                          onChange={(event) => setSelectedMember((current) => current ? syncAdminMemberPlanFields(current, event.target.value, plans) : current)}
                        >
                          <option value="">未设置</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.name}>
                              {plan.name}{plan.id === 'premium-monthly' ? ' · 可用VIP模型' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>充值额度余额</span>
                        <input
                          type="number"
                          value={selectedMember.topupHeartBeansBalance ?? selectedMember.heartBeansBalance ?? 0}
                          onChange={(event) => setSelectedMember((current) => current
                            ? {
                                ...current,
                                topupHeartBeansBalance: Number(event.target.value),
                                heartBeansBalance: Number(event.target.value) + Number(current.subscriptionHeartBeansBalance ?? 0),
                              }
                            : current)}
                        />
                      </label>
                      <label className="field">
                        <span>订阅额度余额</span>
                        <input
                          type="number"
                          value={selectedMember.subscriptionHeartBeansBalance ?? 0}
                          onChange={(event) => setSelectedMember((current) => current
                            ? {
                                ...current,
                                subscriptionHeartBeansBalance: Number(event.target.value),
                                heartBeansBalance: Number(event.target.value) + Number(current.topupHeartBeansBalance ?? current.heartBeansBalance ?? 0),
                              }
                            : current)}
                        />
                      </label>
                      <label className="field">
                        <span>手动补服务额度</span>
                        <input
                          type="number"
                          min="0"
                          value={manualTopupAmount}
                          onChange={(event) => setManualTopupAmount(event.target.value)}
                        />
                      </label>
                      <label className="field form-span-2">
                        <span>补额度备注</span>
                        <textarea
                          value={manualTopupNote}
                          onChange={(event) => setManualTopupNote(event.target.value)}
                          rows={3}
                          placeholder="例如：售后补发、人工赠送、测试补偿"
                        />
                      </label>
                      <label className="field">
                        <span>订阅状态</span>
                        <input
                          value={selectedMember.subscriptionStatus || ''}
                          onChange={(event) => setSelectedMember((current) => current ? { ...current, subscriptionStatus: event.target.value } : current)}
                          placeholder="active / past_due / cancelled"
                        />
                      </label>
                      <label className="field">
                        <span>订阅计划 ID</span>
                        <input
                          value={selectedMember.subscriptionPlanId || ''}
                          readOnly
                          placeholder="跟随套餐自动同步"
                        />
                      </label>
                    </section>

                    <label className="admin-switch">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedMember.disabled)}
                        onChange={(event) => setSelectedMember((current) => current ? { ...current, disabled: event.target.checked } : current)}
                      />
                      <span>禁用会员</span>
                    </label>

                    <section className="admin-member-insight-grid">
                      <article className="glass-card admin-inline-card">
                        <div className="admin-inline-head">
                          <strong>购买套餐信息</strong>
                          <span>{selectedMemberPaidOrders.length} 笔</span>
                        </div>
                        <div className="admin-inline-list">
                          {selectedMemberOrders.length ? selectedMemberOrders.slice(0, 4).map((item) => (
                            <div key={item.id} className="admin-inline-row">
                              <div>
                                <strong>{item.plan || '未命名套餐'}</strong>
                                <p>{item.id} · ¥{item.amount}</p>
                              </div>
                              <div className="admin-inline-meta">
                                <span className={`soft-pill ${item.status === 'paid' ? 'accent' : ''}`}>{item.status}</span>
                                <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '-'}</span>
                              </div>
                            </div>
                          )) : <p className="empty-state compact">还没有订单记录。</p>}
                        </div>
                      </article>

                      <article className="glass-card admin-inline-card">
                        <div className="admin-inline-head">
                          <strong>后台手动补额度信息</strong>
                          <span>{selectedMember.lastManualAdjustmentAt ? '最近一次' : '暂无'}</span>
                        </div>
                        <div className="admin-inline-list">
                          {selectedMember.lastManualAdjustmentAt ? (
                            <div className="admin-inline-row">
                              <div>
                                <strong>+{selectedMember.lastManualAdjustmentAmount ?? 0} 点服务额度</strong>
                                <p>{selectedMember.lastManualAdjustmentNote || '未填写备注'}</p>
                              </div>
                              <div className="admin-inline-meta">
                                <span>{selectedMember.lastManualAdjustmentBy || activeSession.profile.username}</span>
                                <span>{new Date(selectedMember.lastManualAdjustmentAt).toLocaleString('zh-CN')}</span>
                              </div>
                            </div>
                          ) : <p className="empty-state compact">还没有手动补额度记录。</p>}
                        </div>
                      </article>

                      <article className="glass-card admin-inline-card">
                        <div className="admin-inline-head">
                          <strong>生成歌曲信息</strong>
                          <span>{selectedMemberSongs.length} 条</span>
                        </div>
                        <div className="admin-inline-list">
                          {selectedMemberSongs.length ? selectedMemberSongs.slice(0, 5).map((item) => (
                            <div key={item.id} className="admin-inline-row">
                              <div>
                                <strong>{item.title || item.couple || '未命名歌曲'}</strong>
                                <p>{item.variantLabel ? `${item.couple || item.email || '-'} · ${item.variantLabel}` : (item.couple || item.email || '-')}</p>
                                <div className="admin-inline-links">
                                  <a href={getSongStreamUrl(item.id)} target="_blank" rel="noreferrer">播放链接</a>
                                  <a href={getSongDownloadUrl(item.id)} target="_blank" rel="noreferrer">MP3 链接</a>
                                </div>
                              </div>
                              <div className="admin-inline-meta">
                                <span className={`soft-pill ${item.status === 'ready' ? 'accent' : ''}`}>{item.status === 'ready' ? '成功' : item.status === 'error' ? '失败' : item.status}</span>
                                <span>{new Date(item.updatedAt || item.createdAt).toLocaleDateString('zh-CN')}</span>
                              </div>
                            </div>
                          )) : <p className="empty-state compact">还没有生成歌曲记录。</p>}
                        </div>
                      </article>
                    </section>

                    <div className="admin-link-actions">
                      <button type="button" className="primary-button" onClick={() => void handleSaveMember()}>
                        保存会员修改
                      </button>
                      <button type="button" className="ghost-button" onClick={() => void handleDeleteMember(selectedMember.email)}>
                        删除会员
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="empty-state">请选择一位会员查看详情。</p>
                )}
              </aside>
            </section>
          ) : null}

          {!loading && tab === 'songs' ? (
            <section className="admin-detail-layout">
              <section className="admin-table glass-card">
                <div className="admin-table-head">
                  <strong>歌曲记录</strong>
                  <span>{songs.length} 条</span>
                </div>
                <div className="admin-table-list">
                  {songs.map((item) => (
                    <button key={item.id} type="button" className="admin-table-row admin-select-row" onClick={() => void handleSelectSong(item.id)}>
                      <div>
                        <h3>{item.title}</h3>
                        <p>{item.variantLabel ? `${item.couple} · ${item.variantLabel}` : item.couple}</p>
                      </div>
                      <div>{item.languageLabel}</div>
                      <div>{item.styleLabel}</div>
                      <div>{item.vocalLabel}</div>
                      <div>{item.status}</div>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="glass-card admin-detail-card">
                <div className="admin-table-head">
                  <strong>歌曲详情</strong>
                  <span>{selectedSong?.status ?? '未选择'}</span>
                </div>
                {selectedSong ? (
                  <div className="admin-detail-stack">
                    <label className="field">
                      <span>标题</span>
                      <input
                        value={selectedSong.title}
                        onChange={(event) => setSelectedSong((current) => current ? { ...current, title: event.target.value } : current)}
                      />
                    </label>
                    <label className="field">
                      <span>归属邮箱</span>
                      <input
                        value={selectedSong.email ?? ''}
                        onChange={(event) => setSelectedSong((current) => current ? { ...current, email: event.target.value } : current)}
                      />
                    </label>
                    <p><strong>新人：</strong>{selectedSong.couple}</p>
                    <p><strong>版本：</strong>{selectedSong.variantLabel || '单首歌曲'}</p>
                    <p><strong>语言：</strong>{selectedSong.languageLabel}</p>
                    <p><strong>曲风：</strong>{selectedSong.styleLabel}</p>
                    <p><strong>声音：</strong>{selectedSong.vocalLabel}</p>
                    <label className="field">
                      <span>状态</span>
                      <select
                        value={selectedSong.status}
                        onChange={(event) => setSelectedSong((current) => current ? { ...current, status: event.target.value } : current)}
                      >
                        <option value="queued">queued</option>
                        <option value="generating_lyrics">generating_lyrics</option>
                        <option value="lyrics_ready">lyrics_ready</option>
                        <option value="generating_song">generating_song</option>
                        <option value="ready">ready</option>
                        <option value="error">error</option>
                      </select>
                    </label>
                    <p><strong>错误信息：</strong>{selectedSong.error || '无'}</p>
                    <p><strong>版本：</strong>{selectedSong.variantLabel || '单首歌曲'}</p>
                    <p><strong>系统播放链接：</strong>{selectedSongStreamUrl || '无'}</p>
                    <p><strong>系统 MP3 链接：</strong>{selectedSongDownloadUrl || '无'}</p>
                    <p><strong>播放链接：</strong>{selectedSong.audioUrl || '无'}</p>
                    <p><strong>下载链接：</strong>{selectedSong.downloadUrl || '无'}</p>
                    <p><strong>原始 audio_url：</strong>{selectedSong.sourceAudioUrl || '无'}</p>
                    <p><strong>原始 download_url：</strong>{selectedSong.sourceDownloadUrl || '无'}</p>
                    <p><strong>爱情故事：</strong>{selectedSong.story?.loveStory || '未填写'}</p>
                    <p><strong>相识经历：</strong>{selectedSong.story?.meetingStory || '未填写'}</p>
                    <p><strong>誓言关键词：</strong>{selectedSong.story?.vowKeywords || '未填写'}</p>
                    <div className="admin-lyrics-box">
                      <strong>歌词</strong>
                      <p>{selectedSong.lyrics || selectedSong.lyricSnippet || '暂无歌词内容。'}</p>
                    </div>
                    <div className="admin-link-actions">
                      <button
                        type="button"
                        className="ghost-button compact"
                        onClick={() => window.open(getSongStreamUrl(selectedSong.id), '_blank', 'noopener,noreferrer')}
                      >
                        打开播放链接
                      </button>
                      <button
                        type="button"
                        className="primary-button compact"
                        onClick={() => window.open(getSongDownloadUrl(selectedSong.id), '_blank', 'noopener,noreferrer')}
                      >
                        打开 MP3 链接
                      </button>
                    </div>
                    <button type="button" className="primary-button" onClick={() => void handleSaveSong()}>
                      保存歌曲修改
                    </button>
                    <button type="button" className="ghost-button" onClick={() => void handleDeleteSong(selectedSong.id)}>
                      删除歌曲记录
                    </button>
                  </div>
                ) : (
                  <p className="empty-state">请选择一条歌曲记录查看详情。</p>
                )}
              </aside>
            </section>
          ) : null}

          {!loading && tab === 'showcase' ? (
            <section className="glass-card admin-config-card">
              <div className="admin-table-head">
                <strong>产品展示样片</strong>
                <span>{showcaseTracks.length} 条</span>
              </div>
              <div className="form-grid">
                {showcaseTracks.map((track, index) => (
                  <article key={track.id} className="glass-card">
                    <div className="form-grid single">
                      <label className="field">
                        <span>样片 ID</span>
                        <input value={track.id} readOnly />
                      </label>
                      <label className="field">
                        <span>标题(中文)</span>
                        <input
                          value={track.title.zh}
                          onChange={(event) =>
                            setShowcaseTracks((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, title: { ...item.title, zh: event.target.value } } : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        <span>标题(英文)</span>
                        <input
                          value={track.title.en}
                          onChange={(event) =>
                            setShowcaseTracks((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, title: { ...item.title, en: event.target.value } } : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        <span>标签(中文)</span>
                        <input
                          value={track.meta.zh}
                          onChange={(event) =>
                            setShowcaseTracks((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, meta: { ...item.meta, zh: event.target.value } } : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        <span>标签(英文)</span>
                        <input
                          value={track.meta.en}
                          onChange={(event) =>
                            setShowcaseTracks((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, meta: { ...item.meta, en: event.target.value } } : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field form-span-2">
                        <span>简介(中文)</span>
                        <textarea
                          value={track.blurb.zh}
                          onChange={(event) =>
                            setShowcaseTracks((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, blurb: { ...item.blurb, zh: event.target.value } } : item,
                              ),
                            )
                          }
                          rows={3}
                        />
                      </label>
                      <label className="field form-span-2">
                        <span>简介(英文)</span>
                        <textarea
                          value={track.blurb.en}
                          onChange={(event) =>
                            setShowcaseTracks((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, blurb: { ...item.blurb, en: event.target.value } } : item,
                              ),
                            )
                          }
                          rows={3}
                        />
                      </label>
                      <label className="field form-span-2">
                        <span>音频地址</span>
                        <input
                          value={track.audioUrl}
                          onChange={(event) =>
                            setShowcaseTracks((current) =>
                              current.map((item, i) => (i === index ? { ...item, audioUrl: event.target.value } : item)),
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="ghost-button compact"
                        onClick={() => void handleDeleteShowcaseTrack(track.id)}
                      >
                        删除样片
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  setShowcaseTracks((current) => [
                    ...current,
                    {
                      id: `showcase-${crypto.randomUUID()}`,
                      title: { zh: '新样片', en: 'New Demo' },
                      meta: { zh: '婚礼样片', en: 'Wedding Demo' },
                      blurb: { zh: '', en: '' },
                      audioUrl: '',
                    },
                  ])
                }
              >
                新增样片
              </button>
              <button type="button" className="primary-button" onClick={() => void handleSaveShowcaseTracks()}>
                保存样片配置
              </button>
            </section>
          ) : null}

          {!loading && tab === 'plans' ? (
            <section className="glass-card admin-config-card">
              <div className="admin-table-head">
                <strong>套餐管理</strong>
                <span>{plans.length} 条</span>
              </div>
              <div className="form-grid">
                {plans.map((plan, index) => (
                  <article key={plan.id} className="glass-card">
                    <div className="form-grid single">
                      <label className="field">
                        <span>套餐 ID</span>
                        <input value={plan.id} readOnly />
                      </label>
                      <label className="field">
                        <span>名称</span>
                        <input
                          value={plan.name}
                          onChange={(event) =>
                            setPlans((current) => current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>价格</span>
                        <input
                          type="number"
                          value={plan.price}
                          onChange={(event) =>
                            setPlans((current) => current.map((item, i) => (i === index ? { ...item, price: Number(event.target.value) } : item)))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>套餐类型</span>
                        <select
                          value={plan.type || 'subscription'}
                          onChange={(event) =>
                            setPlans((current) => current.map((item, i) => (i === index ? { ...item, type: event.target.value as PlanItem['type'] } : item)))
                          }
                        >
                          <option value="subscription">月订阅</option>
                          <option value="credit_pack">充值包</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>账期</span>
                        <select
                          value={plan.billingInterval || ''}
                          onChange={(event) =>
                            setPlans((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, billingInterval: event.target.value as PlanItem['billingInterval'] } : item,
                              ),
                            )
                          }
                        >
                          <option value="">无</option>
                          <option value="month">month</option>
                          <option value="year">year</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>服务额度</span>
                        <input
                          type="number"
                          value={plan.heartBeans ?? 0}
                          onChange={(event) =>
                            setPlans((current) => current.map((item, i) => (i === index ? { ...item, heartBeans: Number(event.target.value) } : item)))
                          }
                        />
                      </label>
                      <label className="field form-span-2">
                        <span>Stripe Price ID</span>
                        <input
                          value={plan.stripePriceId || ''}
                          onChange={(event) =>
                            setPlans((current) => current.map((item, i) => (i === index ? { ...item, stripePriceId: event.target.value } : item)))
                          }
                          placeholder="price_xxx"
                        />
                      </label>
                      <label className="field form-span-2">
                        <span>PayPal Plan ID</span>
                        <input
                          value={plan.paypalPlanId || ''}
                          onChange={(event) =>
                            setPlans((current) => current.map((item, i) => (i === index ? { ...item, paypalPlanId: event.target.value } : item)))
                          }
                          placeholder="P-xxxxxx"
                        />
                      </label>
                      <label className="field">
                        <span>角标</span>
                        <input
                          value={plan.badge || ''}
                          onChange={(event) =>
                            setPlans((current) => current.map((item, i) => (i === index ? { ...item, badge: event.target.value } : item)))
                          }
                        />
                      </label>
                      <label className="admin-switch form-span-2">
                        <input
                          type="checkbox"
                          checked={Boolean(plan.canUseVipModels)}
                          onChange={(event) =>
                            setPlans((current) =>
                              current.map((item, i) => (i === index ? { ...item, canUseVipModels: event.target.checked } : item)),
                            )
                          }
                        />
                        <span>允许该订阅使用 VIP模型</span>
                      </label>
                      <label className="field form-span-2">
                        <span>权益(每行一条)</span>
                        <textarea
                          value={(plan.features || []).join('\n')}
                          onChange={(event) =>
                            setPlans((current) =>
                              current.map((item, i) =>
                                i === index ? { ...item, features: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean) } : item,
                              ),
                            )
                          }
                          rows={4}
                        />
                      </label>
                      <button
                        type="button"
                        className="ghost-button compact"
                        onClick={() => void handleDeletePlan(plan.id)}
                      >
                        删除套餐
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  setPlans((current) => [
                    ...current,
                    {
                      id: `plan-${crypto.randomUUID()}`,
                      name: 'New Plan',
                      type: 'credit_pack',
                      billingInterval: '',
                      stripePriceId: '',
                      paypalPlanId: '',
                      price: 0,
                      heartBeans: 0,
                      currency: 'USD',
                      badge: '',
                      features: [],
                      canUseVipModels: false,
                    },
                  ])
                }
              >
                新增套餐
              </button>
              <button type="button" className="primary-button" onClick={() => void handleSavePlans()}>
                保存套餐配置
              </button>
            </section>
          ) : null}

          {!loading && tab === 'payments' ? (
            <section className="glass-card admin-config-card">
              <div className="admin-table-head">
                <strong>支付方式</strong>
                <span>{paymentMethods.length} 条</span>
              </div>
              <div className="form-grid">
                {paymentMethods.map((method, index) => (
                  <article key={method.id} className="glass-card">
                    <div className="form-grid single">
                      <label className="field">
                        <span>方式 ID</span>
                        <input
                          value={method.id}
                          onChange={(event) =>
                            setPaymentMethods((current) =>
                              current.map((item, i) => (i === index ? { ...item, id: event.target.value } : item)),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        <span>名称</span>
                        <input
                          value={method.name}
                          onChange={(event) =>
                            setPaymentMethods((current) =>
                              current.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Provider</span>
                        <select
                          value={method.provider || 'paypal'}
                          onChange={(event) =>
                            setPaymentMethods((current) =>
                              current.map((item, i) => (i === index ? { ...item, provider: event.target.value as PaymentMethodAdmin['provider'] } : item)),
                            )
                          }
                        >
                          <option value="stripe_checkout">stripe_checkout</option>
                          <option value="paypal">paypal</option>
                          <option value="alipay">alipay</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>环境变量名</span>
                        <input
                          value={method.envKey}
                          onChange={(event) =>
                            setPaymentMethods((current) =>
                              current.map((item, i) => (i === index ? { ...item, envKey: event.target.value } : item)),
                            )
                          }
                          placeholder="PAYPAL_CHECKOUT_URL"
                        />
                      </label>
                      <label className="admin-switch">
                        <input
                          type="checkbox"
                          checked={Boolean(method.enabled)}
                          onChange={(event) =>
                            setPaymentMethods((current) =>
                              current.map((item, i) => (i === index ? { ...item, enabled: event.target.checked } : item)),
                            )
                          }
                        />
                        <span>启用</span>
                      </label>
                      <label className="field form-span-2">
                        <span>支持套餐类型(逗号分隔)</span>
                        <input
                          value={(method.supportedPlanTypes || []).join(', ')}
                          onChange={(event) =>
                            setPaymentMethods((current) =>
                              current.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      supportedPlanTypes: event.target.value
                                        .split(',')
                                        .map((value) => value.trim())
                                        .filter(Boolean) as PaymentMethodAdmin['supportedPlanTypes'],
                                    }
                                  : item,
                              ),
                            )
                          }
                          placeholder="subscription, credit_pack"
                        />
                      </label>
                      <label className="field form-span-2">
                        <span>说明</span>
                        <textarea
                          value={method.description || ''}
                          onChange={(event) =>
                            setPaymentMethods((current) =>
                              current.map((item, i) => (i === index ? { ...item, description: event.target.value } : item)),
                            )
                          }
                          rows={3}
                        />
                      </label>
                      <button
                        type="button"
                        className="ghost-button compact"
                        onClick={() => setPaymentMethods((current) => current.filter((_item, i) => i !== index))}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  setPaymentMethods((current) => [
                    ...current,
                    {
                      id: `method-${crypto.randomUUID()}`,
                      name: 'New Method',
                      enabled: false,
                      provider: 'paypal',
                      envKey: '',
                      supportedPlanTypes: ['credit_pack'],
                      description: '',
                    },
                  ])
                }
              >
                新增支付方式
              </button>
              <button type="button" className="primary-button" onClick={() => void handleSavePaymentMethods()}>
                保存支付方式
              </button>
            </section>
          ) : null}

          {!loading && tab === 'orders' ? (
            <section className="admin-detail-layout">
              <section className="admin-table glass-card">
                <div className="admin-table-head">
                  <strong>订单列表</strong>
                  <span>{orders.length} 条</span>
                </div>
                <div className="admin-table-list">
                  {orders.map((item) => (
                    <button key={item.id} type="button" className="admin-table-row admin-select-row" onClick={() => void handleSelectOrder(item.id)}>
                      <div>
                        <h3>{item.id}</h3>
                        <p>{item.couple} · {item.heartBeans ?? 0} 点服务额度</p>
                      </div>
                      <div>{item.plan}</div>
                      <div>¥{item.amount}</div>
                      <div>{item.status}</div>
                      <div>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</div>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="glass-card admin-detail-card">
                <div className="admin-table-head">
                  <strong>订单详情</strong>
                  <span>{selectedOrder?.id ?? '未选择'}</span>
                </div>
                {selectedOrder ? (
                  <div className="admin-detail-stack">
                    <label className="field">
                      <span>用户邮箱</span>
                      <input
                        value={selectedOrder.email ?? ''}
                        onChange={(event) => setSelectedOrder((current) => current ? { ...current, email: event.target.value } : current)}
                      />
                    </label>
                    <label className="field">
                      <span>套餐</span>
                      <input
                        value={selectedOrder.plan}
                        onChange={(event) => setSelectedOrder((current) => current ? { ...current, plan: event.target.value } : current)}
                      />
                    </label>
                    <label className="field">
                      <span>订单状态</span>
                      <select
                        value={selectedOrder.status}
                        onChange={(event) => setSelectedOrder((current) => current ? { ...current, status: event.target.value } : current)}
                      >
                        <option value="pending">pending</option>
                        <option value="processing">processing</option>
                        <option value="paid">paid</option>
                        <option value="delivered">delivered</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>订单金额</span>
                      <input
                        type="number"
                        value={selectedOrder.amount}
                        onChange={(event) => setSelectedOrder((current) => current ? { ...current, amount: Number(event.target.value) } : current)}
                      />
                    </label>
                    <label className="field">
                      <span>服务额度数量</span>
                      <input
                        type="number"
                        value={selectedOrder.heartBeans ?? 0}
                        onChange={(event) => setSelectedOrder((current) => current ? { ...current, heartBeans: Number(event.target.value) } : current)}
                      />
                    </label>
                    <label className="field form-span-2">
                      <span>备注</span>
                      <textarea
                        value={selectedOrder.note ?? ''}
                        onChange={(event) => setSelectedOrder((current) => current ? { ...current, note: event.target.value } : current)}
                        rows={4}
                      />
                    </label>
                    <button type="button" className="primary-button" onClick={() => void handleSaveOrder()}>
                      保存订单修改
                    </button>
                  </div>
                ) : (
                  <p className="empty-state">请选择一条订单查看详情。</p>
                )}
              </aside>
            </section>
          ) : null}

          {!loading && tab === 'messages' ? (
            <section className="admin-detail-layout">
              <section className="admin-table glass-card">
                <div className="admin-table-head">
                  <strong>留言列表</strong>
                  <span>{messages.length} 条</span>
                </div>
                <div className="admin-table-list">
                  {messages.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`admin-table-row admin-select-row ${selectedMessage?.id === item.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedMessage(item)}
                    >
                      <div>
                        <h3>{item.name || 'Guest'}</h3>
                        <p>{item.email || '-'}</p>
                      </div>
                      <div>{item.status || 'new'}</div>
                      <div>{new Date(item.updatedAt || item.createdAt).toLocaleDateString('zh-CN')}</div>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="glass-card admin-detail-card">
                <div className="admin-table-head">
                  <strong>留言详情</strong>
                  <span>{selectedMessage?.id ?? '未选择'}</span>
                </div>
                {selectedMessage ? (
                  <div className="admin-detail-stack">
                    <label className="field">
                      <span>称呼</span>
                      <input value={selectedMessage.name || ''} readOnly />
                    </label>
                    <label className="field">
                      <span>Email</span>
                      <input value={selectedMessage.email || ''} readOnly />
                    </label>
                    <label className="field">
                      <span>状态</span>
                      <select
                        value={selectedMessage.status || 'new'}
                        onChange={(event) => setSelectedMessage((current) => current ? { ...current, status: event.target.value } : current)}
                      >
                        <option value="new">new</option>
                        <option value="replied">replied</option>
                        <option value="archived">archived</option>
                      </select>
                    </label>
                    <label className="field form-span-2">
                      <span>用户留言</span>
                      <textarea value={selectedMessage.message || ''} rows={4} readOnly />
                    </label>
                    <label className="field form-span-2">
                      <span>后台回复</span>
                      <textarea
                        value={selectedMessage.adminReply || ''}
                        onChange={(event) => setSelectedMessage((current) => current ? { ...current, adminReply: event.target.value } : current)}
                        rows={5}
                        placeholder="在这里写回复。保存后，该回复只会提供给对应会员在头像菜单中查看。"
                      />
                    </label>
                    <p><strong>提交时间：</strong>{selectedMessage.createdAt ? new Date(selectedMessage.createdAt).toLocaleString('zh-CN') : '-'}</p>
                    <p><strong>最后更新：</strong>{selectedMessage.updatedAt ? new Date(selectedMessage.updatedAt).toLocaleString('zh-CN') : '-'}</p>
                    <p><strong>回复人：</strong>{selectedMessage.adminReplyBy || '未回复'}</p>
                    <button type="button" className="primary-button" onClick={() => void handleSaveMessage()}>
                      保存留言回复
                    </button>
                  </div>
                ) : (
                  <p className="empty-state">请选择一条留言查看详情。</p>
                )}
              </aside>
            </section>
          ) : null}

          {!loading && tab === 'codes' ? (
            <section className="admin-detail-layout">
              <section className="admin-table glass-card">
                <div className="admin-table-head">
                  <strong>SVIP 卡列表</strong>
                  <span>{rechargeCodes.length} 条</span>
                </div>
                <div className="admin-table-list">
                  {rechargeCodes.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`admin-table-row admin-select-row admin-code-row ${selectedRechargeCode?.id === item.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedRechargeCode(item)}
                    >
                      <div>
                        <h3>{item.maskedCode}</h3>
                        <p>{item.batchId || '未分批次'} · {item.createdBy || 'admin'}</p>
                      </div>
                      <div>{item.heartBeans} 点</div>
                      <div>{item.status === 'redeemed' ? '已兑换' : '可兑换'}</div>
                      <div>{item.redeemedByEmail || '-'}</div>
                      <div>{new Date(item.updatedAt || item.createdAt).toLocaleDateString('zh-CN')}</div>
                    </button>
                  ))}
                </div>
              </section>

              <aside className="glass-card admin-detail-card">
                <div className="admin-table-head">
                  <strong>SVIP 卡生成器</strong>
                  <span>{selectedRechargeCode?.maskedCode ?? '未选择'}</span>
                </div>
                <div className="admin-detail-stack">
                  <section className="admin-member-summary-grid">
                    <article className="admin-mini-card">
                      <span>SVIP 卡总数</span>
                      <strong>{rechargeCodes.length}</strong>
                    </article>
                    <article className="admin-mini-card">
                      <span>可兑换</span>
                      <strong>{activeRechargeCodeCount}</strong>
                    </article>
                    <article className="admin-mini-card">
                      <span>已兑换</span>
                      <strong>{redeemedRechargeCodeCount}</strong>
                    </article>
                    <article className="admin-mini-card">
                      <span>最近批次</span>
                      <strong>{latestRechargeBatch?.count ?? 0}</strong>
                    </article>
                  </section>

                  <section className="admin-member-edit-grid">
                    <label className="field">
                      <span>每张卡点数</span>
                      <input
                        type="number"
                        min="1"
                        value={rechargeCodeHeartBeans}
                        onChange={(event) => setRechargeCodeHeartBeans(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>批量数量</span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={rechargeCodeQuantity}
                        onChange={(event) => setRechargeCodeQuantity(event.target.value)}
                      />
                    </label>
                  </section>

                  <div className="admin-link-actions">
                    <button type="button" className="primary-button" disabled={generatingRechargeCodes} onClick={() => void handleGenerateRechargeCodes()}>
                      {generatingRechargeCodes ? '生成中...' : '生成 SVIP 卡并下载 CSV'}
                    </button>
                    {latestRechargeBatch ? (
                      <button type="button" className="ghost-button" onClick={() => downloadRechargeBatchCsv(latestRechargeBatch)}>
                        重新下载最近批次
                      </button>
                    ) : null}
                  </div>

                  {latestRechargeBatch ? (
                    <article className="glass-card admin-inline-card">
                      <div className="admin-inline-head">
                        <strong>最近生成批次</strong>
                        <span>{latestRechargeBatch.batchId}</span>
                      </div>
                      <div className="admin-inline-list">
                        {latestRechargeBatch.items.slice(0, 8).map((item) => (
                          <div key={item.code} className="admin-inline-row admin-code-preview-row">
                            <div>
                              <strong>{item.code}</strong>
                              <p>{item.heartBeans} 点服务额度</p>
                            </div>
                            <div className="admin-inline-meta">
                              <span>{item.batchId}</span>
                              <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ) : null}

                  {selectedRechargeCode ? (
                    <article className="glass-card admin-inline-card">
                      <div className="admin-inline-head">
                        <strong>SVIP 卡详情</strong>
                        <span>{selectedRechargeCode.status === 'redeemed' ? '已兑换' : '可兑换'}</span>
                      </div>
                      <div className="admin-inline-list">
                        <div className="admin-inline-row">
                          <div>
                            <strong>{selectedRechargeCode.maskedCode}</strong>
                            <p>{selectedRechargeCode.heartBeans} 点服务额度 · 批次 {selectedRechargeCode.batchId}</p>
                          </div>
                          <div className="admin-inline-meta">
                            <span>{selectedRechargeCode.createdBy || 'admin'}</span>
                            <span>{new Date(selectedRechargeCode.createdAt).toLocaleString('zh-CN')}</span>
                          </div>
                        </div>
                        <div className="admin-inline-row">
                          <div>
                            <strong>兑换状态</strong>
                            <p>{selectedRechargeCode.redeemedByEmail || '尚未兑换'}</p>
                          </div>
                          <div className="admin-inline-meta">
                            <span>{selectedRechargeCode.status === 'redeemed' ? '已到账' : '待兑换'}</span>
                            <span>{selectedRechargeCode.redeemedAt ? new Date(selectedRechargeCode.redeemedAt).toLocaleString('zh-CN') : '-'}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  ) : (
                    <p className="empty-state compact">请选择一张 SVIP 卡查看兑换详情。</p>
                  )}
                </div>
              </aside>
            </section>
          ) : null}

          {!loading && tab === 'config' ? (
            <section className="glass-card admin-config-card">
              <div className="form-grid">
                <label className="field">
                  <span>DeepSeek 提供方</span>
                  <input
                    value={config.deepseekProvider}
                    onChange={(event) => setConfig((current) => ({ ...current, deepseekProvider: event.target.value }))}
                  />
                </label>
                <label className="field">
                  <span>Suno 提供方</span>
                  <input
                    value={config.sunoProvider}
                    onChange={(event) => setConfig((current) => ({ ...current, sunoProvider: event.target.value }))}
                  />
                </label>
                <label className="field form-span-2">
                  <span>公网回调地址</span>
                  <input
                    value={config.publicBaseUrl}
                    onChange={(event) => setConfig((current) => ({ ...current, publicBaseUrl: event.target.value }))}
                    placeholder="https://your-domain.com"
                  />
                </label>
                <label className="field">
                  <span>每次生成扣除服务额度</span>
                  <input
                    type="number"
                    value={config.heartBeansPerGeneration}
                    onChange={(event) => setConfig((current) => ({ ...current, heartBeansPerGeneration: Number(event.target.value) }))}
                  />
                </label>
                <label className="field">
                  <span>网站背景方案</span>
                  <select
                    value={config.backgroundTheme}
                    onChange={(event) => setConfig((current) => ({ ...current, backgroundTheme: normalizeBackgroundTheme(event.target.value) }))}
                  >
                    {backgroundThemeOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field form-span-2">
                  <span>后台备注</span>
                  <textarea
                    value={config.notes}
                    onChange={(event) => setConfig((current) => ({ ...current, notes: event.target.value }))}
                    rows={4}
                  />
                </label>
                <div className="glass-card admin-theme-preview form-span-2">
                  <p className="mini-eyebrow">当前背景方案说明</p>
                  <h3>{selectedBackgroundTheme?.label || '网站背景方案'}</h3>
                  <p>{selectedBackgroundTheme?.description || '保存后前台会立即使用这套底图配色。'}</p>
                  {config.backgroundTheme === 'auto_beijing' && effectiveBackgroundThemeOption ? (
                    <p>{`当前北京时间实际生效：${effectiveBackgroundThemeOption.label}`}</p>
                  ) : null}
                </div>
              </div>
              <label className="admin-switch">
                <input
                  type="checkbox"
                  checked={config.allowSignup}
                  onChange={(event) => setConfig((current) => ({ ...current, allowSignup: event.target.checked }))}
                />
                <span>允许前台用户注册</span>
              </label>
              <label className="admin-switch">
                <input
                  type="checkbox"
                  checked={config.enableChineseSite}
                  onChange={(event) => setConfig((current) => ({ ...current, enableChineseSite: event.target.checked }))}
                />
                <span>开启首页中英文切换</span>
              </label>
              <button type="button" className="primary-button" onClick={() => void handleSaveConfig()} disabled={savingConfig}>
                {savingConfig ? '保存中...' : '保存后台配置'}
              </button>
            </section>
          ) : null}
        </main>
      </section>
    </div>
  )
}

function CompletePage({ locale, draft, onOpenModal, authSession, onLogout }: CompletePageProps) {
  return (
    <SiteLayout
      locale={locale}
      title={copy(locale, { zh: '恭喜，你的婚礼歌曲已完成', en: 'Congratulations, Your Wedding Song Is Ready' })}
      subtitle={copy(locale, {
        zh: '高清音频和完整歌词已准备好，可下载保存',
        en: 'Your full audio and lyric files are ready for download and sharing.',
      })}
      eyebrow="MelodyVow"
      active="pricing"
      onOpenModal={onOpenModal}
      onLogout={onLogout}
      authSession={authSession}
    >
      <section className="complete-layout">
        <article className="glass-panel complete-card">
          <div className="success-mark">✓</div>
          <h3>{locale === 'zh' ? '《Forever Start》' : '"Forever Start"'}</h3>
          <p>{`${draft.groom} & ${draft.bride}`}</p>
          <div className="success-word">{copy(locale, { zh: '成功', en: 'Done' })}</div>
          <p className="date-line">{draft.languageLabel}</p>
          <p className="date-line">{getStyleLabel(locale, draft.style)}</p>
          <p className="date-line">{getVocalLabel(locale, draft.vocal)}</p>

          <button
            type="button"
            className="primary-button wide"
            onClick={() =>
              onOpenModal(
                copy(locale, {
                  zh: '下载链接已预留，可接入对象存储、CDN 和真实订单校验。',
                  en: 'Download links are ready for object storage, CDN delivery and order validation.',
                }),
              )
            }
          >
            {copy(locale, { zh: '下载完整歌单', en: 'Download Full Files' })}
          </button>

          <div className="download-grid">
            <button type="button" className="soft-pill action-pill">
              {copy(locale, { zh: '下载完整歌词', en: 'Lyrics PDF' })}
            </button>
            <button type="button" className="soft-pill action-pill">
              {copy(locale, { zh: '下载高清音频', en: 'HD Audio' })}
            </button>
            <button type="button" className="soft-pill action-pill">
              {copy(locale, { zh: 'LRC 歌词文件', en: 'LRC File' })}
            </button>
          </div>
        </article>

        <article className="speech-card">
          <p>
            {copy(locale, {
              zh: '建议备份到电脑或U盘，婚礼现场播放前请先测试设备。',
              en: 'Back up the files to a laptop or USB drive and test the venue setup in advance.',
            })}
          </p>
        </article>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            onOpenModal(
              copy(locale, {
                zh: '分享链接位已预留，后续可生成专属分享页或新人海报。',
                en: 'The share entry is ready for a custom share page or couple poster.',
              }),
            )
          }
        >
          {copy(locale, { zh: '分享给新人', en: 'Share with the Couple' })}
        </button>
      </section>
    </SiteLayout>
  )
}

function LegalPage({ locale, policy, authSession, onLogout }: LegalPageProps) {
  const [lookupEmail, setLookupEmail] = useState(authSession?.email || '')
  const [lookupOrderId, setLookupOrderId] = useState('')
  const [lookupResults, setLookupResults] = useState<PublicOrderLookupItem[]>([])
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')

  const policyContent: Record<'legal' | 'find-order', { active: string, title: Copy, subtitle: Copy, sections: Array<{ heading: Copy, paragraphs: Copy[] }> }> = {
    legal: {
      active: 'legal',
      title: { zh: '服务说明与政策', en: 'Policies & Support' },
      subtitle: {
        zh: '集中说明 MelodyVow 的交付方式、隐私保护、使用规则、退款范围与取消处理。',
        en: 'A consolidated overview of MelodyVow fulfillment, privacy, usage terms, refund scope, and cancellation handling.',
      },
      sections: [
        {
          heading: { zh: '交付与履约', en: 'Delivery & Fulfillment' },
          paragraphs: [
            {
              zh: 'MelodyVow 提供的是订阅式数字婚礼歌曲服务，不涉及实体商品发货。订单创建并确认付款后，系统会把对应服务额度开通到会员账户，并在会员中心记录歌曲、订单与下载内容。',
              en: 'MelodyVow provides a subscription-based digital wedding song service and does not ship physical goods. Once payment is confirmed, the corresponding service quota is activated in the member account, and the related song, order, and download records appear in the account center.',
            },
            {
              zh: '歌曲生成属于数字内容交付，完成时间取决于外部 AI 服务、网络状况与排队负载。若系统侧生成失败，已扣除的服务额度会自动退回。',
              en: 'Song generation is a digital-content delivery process, and completion time depends on external AI services, network conditions, and queue load. If the generation fails on the system side, the consumed service quota is automatically returned.',
            },
          ],
        },
        {
          heading: { zh: '隐私与数据保护', en: 'Privacy & Data Protection' },
          paragraphs: [
            {
              zh: '当你注册会员、购买套餐或生成歌曲时，网站会收集完成服务所必需的信息，例如邮箱、伴侣姓名、订单信息、生成参数与歌曲记录。这些信息仅用于会员认证、订单处理、服务开通、歌曲生成和必要的客服支持。',
              en: 'When you register, purchase a plan, or generate a song, the site collects only the information required to fulfill the service, such as email, partner name, order data, generation inputs, and song records. This information is used only for authentication, order handling, service activation, song generation, and essential customer support.',
            },
            {
              zh: '网站不会在前端保存支付密码、银行卡密码或第三方支付账户密码。管理员凭据、API 密钥和其他敏感配置必须通过服务器环境变量管理，并按最小权限原则保护。',
              en: 'The site does not store payment passwords, bank-card passwords, or third-party payment account passwords on the frontend. Administrator credentials, API keys, and other sensitive settings must be managed through server environment variables and protected under a least-privilege approach.',
            },
          ],
        },
        {
          heading: { zh: '服务条款与用户责任', en: 'Terms of Service & User Responsibilities' },
          paragraphs: [
            {
              zh: 'MelodyVow 提供婚礼歌曲生成、会员账户、套餐购买、歌曲记录查看和订单管理等数字服务。所有生成结果都依赖第三方 AI 服务与网络环境，因此实际完成时间、音频风格和交付速度可能存在差异。',
              en: 'MelodyVow provides digital services including wedding-song generation, member accounts, plan purchases, song-history review, and order administration. All generated results depend on third-party AI services and network conditions, so actual completion time, audio style, and delivery speed may vary.',
            },
            {
              zh: '会员需确保提交的信息真实、合法，并妥善保管自己的登录邮箱与密码。不得利用本服务从事违法、侵权、欺诈或滥用支付流程的行为。若账户或订单存在异常，网站有权进行人工复核并暂时限制相关权益。',
              en: 'Members must provide lawful information and keep their login email and password secure. The service may not be used for illegal, infringing, fraudulent, or payment-abusive activity. If an account or order appears abnormal, the site may place the related entitlement under manual review and temporary restriction.',
            },
          ],
        },
        {
          heading: { zh: '退款与取消', en: 'Refunds & Cancellations' },
          paragraphs: [
            {
              zh: '若用户已付款但网站未正确开通对应服务，或支付记录存在重复扣款、明显异常，经核实后管理员可处理退款或服务补发。若歌曲生成在系统侧失败，服务额度会自动退回，这属于站内服务回退。',
              en: 'If payment is completed but the purchased service is not activated correctly, or if duplicate or clearly abnormal charges are verified, an administrator may issue a refund or restore the missing service. If song generation fails on the system side, the consumed service quota is automatically returned as an on-site service reversal.',
            },
            {
              zh: '对于已经成功交付并可正常使用的订阅服务或已成功生成并可访问的歌曲内容，原则上不支持基于个人主观偏好的退款。若订单后续被取消或退款，系统会同步回收该订单开通的相关权益，以保持账户状态与订单状态一致。',
              en: 'For subscription services that have already been delivered and used normally, or songs that have been successfully generated and accessed, refunds are generally not available based on personal preference alone. If an order is later cancelled or refunded, the related entitlements granted by that order are reclaimed to keep the account state aligned with the order state.',
            },
          ],
        },
      ],
    },
    'find-order': {
      active: 'legal_find_order',
      title: { zh: '查找订单', en: 'Find My Order' },
      subtitle: {
        zh: '帮助会员确认订阅订单、支付状态和已开通的服务内容。',
        en: 'This page helps members confirm subscription orders, payment status, and activated service records.',
      },
      sections: [
        {
          heading: { zh: '如何查找订单', en: 'How To Find Your Order' },
          paragraphs: [
            {
              zh: '请使用下单时注册或登录的会员邮箱进入 MelodyVow 会员中心。你可以在账户内查看对应的歌曲记录、会员状态和与订单关联的订阅服务记录。',
              en: 'Please log in to MelodyVow using the same member email used at checkout. Inside the member account, you can review related song records, membership status, and subscription service records tied to the order.',
            },
            {
              zh: '如果你已经完成付款，但账户中暂未看到对应服务，请先确认支付平台记录是否成功，再联系网站管理员核对订单邮箱、订单状态和服务额度开通情况。',
              en: 'If you completed payment but do not yet see the related service, first confirm the payment record on the payment platform, then contact the site administrator to verify the order email, order status, and service activation.',
            },
          ],
        },
        {
          heading: { zh: '订单状态说明', en: 'Order Status Meanings' },
          paragraphs: [
            {
              zh: 'pending 表示订单已创建但尚未确认付款；processing 表示订单正在处理；paid 表示订单已生效并已发放对应权益；cancelled 或 refunded 表示订单已取消或退款，相关权益会同步失效或被回收。',
              en: 'Pending means the order was created but payment is not yet confirmed. Processing means the order is under review. Paid means the order is active and the related entitlements were delivered. Cancelled or refunded means the order was cancelled or refunded and the related entitlements are removed or reclaimed.',
            },
          ],
        },
      ],
    },
  }

  const current = policy === 'find-order' ? policyContent['find-order'] : policyContent.legal
  const orderLookupEnabled = policy === 'find-order'

  async function handleLookupOrder() {
    setLookupError('')
    setLookupLoading(true)
    setLookupResults([])

    try {
      const response = await fetch(apiUrl('/api/orders/lookup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getMemberAuthHeaders(authSession),
        },
        body: JSON.stringify({
          email: lookupEmail.trim(),
          orderId: lookupOrderId.trim(),
        }),
      })
      const result = (await readJsonSafe(response)) as { items?: PublicOrderLookupItem[]; message?: string }
      if (!response.ok) {
        throw new Error(result.message || copy(locale, { zh: '订单查询失败。', en: 'Order lookup failed.' }))
      }
      setLookupResults(Array.isArray(result.items) ? result.items : [])
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : copy(locale, { zh: '订单查询失败。', en: 'Order lookup failed.' }))
    } finally {
      setLookupLoading(false)
    }
  }

  return (
    <SiteLayout
      locale={locale}
      title={copy(locale, current.title)}
      subtitle={copy(locale, current.subtitle)}
      eyebrow=""
      active={current.active}
      onOpenModal={() => {}}
      onLogout={onLogout}
      authSession={authSession}
      hideHero
      plainPage
    >
      <section className="legal-page">
        {orderLookupEnabled ? (
          <article className="glass-card legal-card legal-order-card">
            <h3>{copy(locale, { zh: '在线查询订阅订单', en: 'Look Up Your Subscription Order' })}</h3>
            <p>
              {copy(locale, {
                zh: '已登录会员可直接按邮箱查询全部订单；未登录访客请同时填写下单邮箱和订单号，以便系统安全地定位对应订单。',
                en: 'Logged-in members can look up all orders by email. Guests should provide both the checkout email and order ID so the system can locate the correct order safely.',
              })}
            </p>
            <div className="legal-order-form">
              <label className="field">
                <span>{copy(locale, { zh: '下单邮箱', en: 'Order Email' })}</span>
                <input value={lookupEmail} onChange={(event) => setLookupEmail(event.target.value)} placeholder="hello@melodyvow.com" />
              </label>
              <label className="field">
                <span>{copy(locale, { zh: '订单号（未登录时必填）', en: 'Order ID (required for guests)' })}</span>
                <input value={lookupOrderId} onChange={(event) => setLookupOrderId(event.target.value)} placeholder="ord-xxxx" />
              </label>
            </div>
            <button type="button" className="primary-button legal-order-button" onClick={() => void handleLookupOrder()} disabled={lookupLoading}>
              {lookupLoading ? copy(locale, { zh: '查询中...', en: 'Looking up...' }) : copy(locale, { zh: '查询我的订单', en: 'Find My Order' })}
            </button>
            {lookupError ? <p className="form-error">{lookupError}</p> : null}
            {lookupResults.length ? (
              <div className="legal-order-results">
                {lookupResults.map((item) => (
                  <article key={item.id} className="glass-card legal-order-result">
                    <div className="legal-order-topline">
                      <strong>{item.id}</strong>
                      <span className={`soft-pill ${item.status === 'paid' ? 'accent' : ''}`}>{getPublicOrderStatusLabel(locale, item.status)}</span>
                    </div>
                    <div className="legal-order-meta">
                      <p>{copy(locale, { zh: `订阅套餐：${item.plan}`, en: `Plan: ${item.plan}` })}</p>
                      <p>{copy(locale, { zh: `支付金额：¥${item.amount}`, en: `Amount: ¥${item.amount}` })}</p>
                      <p>{copy(locale, { zh: `支付方式：${item.paymentMethod || '-'}`, en: `Payment method: ${item.paymentMethod || '-'}` })}</p>
                      <p>{copy(locale, { zh: `创建时间：${item.createdAt || '-'}`, en: `Created at: ${item.createdAt || '-'}` })}</p>
                      {item.note ? <p>{copy(locale, { zh: `订单备注：${item.note}`, en: `Order note: ${item.note}` })}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </article>
        ) : null}
        {current.sections.map((section) => (
          <article key={copy(locale, section.heading)} className="glass-card legal-card">
            <h3>{copy(locale, section.heading)}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={copy(locale, paragraph)}>{copy(locale, paragraph)}</p>
            ))}
          </article>
        ))}
      </section>
    </SiteLayout>
  )
}

function activeToPath(active: string) {
  switch (active) {
    case 'how':
      return '/how-it-works'
    case 'styles':
      return '/styles'
    case 'pricing':
      return '/pricing'
    case 'account':
      return '/auth'
    case 'legal':
      return '/legal'
    case 'legal_delivery':
      return '/legal'
    case 'legal_privacy':
      return '/legal'
    case 'legal_terms':
      return '/legal'
    case 'legal_refund':
      return '/legal'
    case 'legal_cancellation':
      return '/legal'
    case 'legal_find_order':
      return '/find-my-order'
    default:
      return ''
  }
}

export default App
