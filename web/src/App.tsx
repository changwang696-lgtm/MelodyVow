import { Fragment, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
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
import { vocalOptions, weddingStyleOptions } from './data/weddingMusicOptions'
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
  | 'soft_pink_gold'
  | 'ocean_dream'

type HistoryItem = {
  id: string
  title: string
  subtitle: string
  status: string
  action: string
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
}

type AuthSession = {
  authToken: string
  email: string
  partnerName: string
  plan: string
  heartBeansBalance?: number
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
  plan: string
  amount: number
  heartBeans?: number
  heartBeansGrantedAt?: string
  status: string
  createdAt: string
  email?: string
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

type PlanItem = {
  id: string
  name: string
  price: number
  heartBeans?: number
  currency?: string
  badge?: string
  features?: string[]
}

type PaymentMethod = {
  id: string
  name: string
  description?: string
}

type PaymentMethodAdmin = {
  id: string
  name: string
  enabled: boolean
  envKey: string
  description?: string
}

type AdminMember = {
  email: string
  plan?: string
  heartBeansBalance?: number
  disabled?: boolean
  lastAuthAt?: string
  songs?: number
  lastSeenAt?: string
  lastManualAdjustmentAmount?: number
  lastManualAdjustmentNote?: string
  lastManualAdjustmentAt?: string
  lastManualAdjustmentBy?: string
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
  onSaveHistory: (item: HistoryItem) => void
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
    description: '当前默认方案，适合婚礼、求婚和年轻化视觉。',
  },
  {
    id: 'elegant_dark',
    label: '欧美黑金',
    description: '偏欧美用户喜好的黑色系渐变，整体更高级、更克制。',
  },
  {
    id: 'soft_pink_gold',
    label: '柔和粉紫金',
    description: '柔和浪漫，适合婚礼、纪念日和女性向审美。',
  },
  {
    id: 'ocean_dream',
    label: '海盐蓝雾',
    description: '更清爽、轻奢，适合英文站和国际化展示。',
  },
]

function normalizeBackgroundTheme(value: unknown): BackgroundThemeId {
  const normalized = String(value || '').trim() as BackgroundThemeId
  return backgroundThemeOptions.some((item) => item.id === normalized) ? normalized : DEFAULT_BACKGROUND_THEME
}

const defaultPublicSiteConfig: PublicSiteConfig = {
  enableChineseSite: false,
  backgroundTheme: DEFAULT_BACKGROUND_THEME,
}
const SiteConfigContext = createContext<PublicSiteConfig>(defaultPublicSiteConfig)
const HOME_FIREWORK_COLORS = ['#ff4e88', '#ffb657', '#fff07c', '#73f2ff', '#9c7bff', '#ffffff']
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const DEBUG_SERVER_URL = 'http://127.0.0.1:7777/event'
const DEBUG_SESSION_ID = 'suno-expired-url'

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

function sanitizeHistoryItem(item: HistoryItem) {
  const playbackUrl = pickPreferredPlayableUrl(item.audioUrl, item.downloadUrl)

  return {
    ...item,
    audioUrl: playbackUrl,
    downloadUrl: item.downloadUrl || playbackUrl,
    sourceAudioUrl: item.sourceAudioUrl || item.audioUrl || '',
    sourceDownloadUrl: item.sourceDownloadUrl || item.downloadUrl || '',
  }
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

  const fire = (particleRatio: number, options: Record<string, unknown>) => {
    confetti({
      particleCount: Math.max(18, Math.floor(160 * particleRatio)),
      colors: HOME_FIREWORK_COLORS,
      disableForReducedMotion: true,
      spread: 90,
      startVelocity: 42,
      ticks: 220,
      gravity: 0.88,
      scalar: 1.12,
      drift: randomInRange(-0.16, 0.16),
      zIndex: 25,
      ...options,
    })
  }

  fire(0.28, {
    angle: 60,
    spread: 72,
    startVelocity: 60,
    origin: { x: 0.02, y: 0.72 },
  })
  fire(0.28, {
    angle: 120,
    spread: 72,
    startVelocity: 60,
    origin: { x: 0.98, y: 0.72 },
  })
  fire(0.34, {
    spread: 110,
    startVelocity: 52,
    origin: { x: 0.5, y: 0.26 },
  })

  timeouts.push(
    window.setTimeout(() => {
      fire(0.24, {
        spread: 120,
        startVelocity: 48,
        origin: { x: 0.22, y: 0.18 },
      })
      fire(0.24, {
        spread: 120,
        startVelocity: 48,
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

    fire(0.18 * intensity, {
      spread: 360,
      startVelocity: 32,
      decay: 0.94,
      scalar: 0.96,
      ticks: 180,
      origin: {
        x: randomInRange(0.14, 0.34),
        y: randomInRange(0.02, 0.24),
      },
    })

    fire(0.18 * intensity, {
      spread: 360,
      startVelocity: 32,
      decay: 0.94,
      scalar: 0.96,
      ticks: 180,
      origin: {
        x: randomInRange(0.66, 0.86),
        y: randomInRange(0.02, 0.24),
      },
    })

    fire(0.12 * intensity, {
      angle: 60,
      spread: 62,
      startVelocity: 54,
      scalar: 1.06,
      origin: { x: 0.08, y: 0.62 },
    })

    fire(0.12 * intensity, {
      angle: 120,
      spread: 62,
      startVelocity: 54,
      scalar: 1.06,
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
  return [
    {
      key: 'delivery',
      label: copy(locale, { zh: '交付与履约', en: 'Delivery & Fulfillment' }),
      to: withLocale(locale, '/delivery-fulfillment'),
    },
    {
      key: 'privacy',
      label: copy(locale, { zh: '隐私政策', en: 'Privacy Policy' }),
      to: withLocale(locale, '/privacy-policy'),
    },
    {
      key: 'terms',
      label: copy(locale, { zh: '服务条款', en: 'Terms of Service' }),
      to: withLocale(locale, '/terms-of-service'),
    },
    {
      key: 'refund',
      label: copy(locale, { zh: '退款政策', en: 'Refund Policy' }),
      to: withLocale(locale, '/refund-policy'),
    },
    {
      key: 'cancellation',
      label: copy(locale, { zh: '取消政策', en: 'Cancellation Policy' }),
      to: withLocale(locale, '/cancellation-policy'),
    },
    {
      key: 'find-order',
      label: copy(locale, { zh: '查找订单', en: 'Find My Order' }),
      to: withLocale(locale, '/find-my-order'),
    },
  ]
}

function getServiceHubItems(locale: Locale) {
  const links = getLegalLinks(locale)
  const descriptions: Record<LegalPageKey, Copy> = {
    delivery: {
      zh: '了解订阅服务如何交付、生效和记录。',
      en: 'See how the subscription service is fulfilled and activated.',
    },
    privacy: {
      zh: '查看账户、订单与生成记录如何被保护。',
      en: 'Learn how account, order, and generation data are protected.',
    },
    terms: {
      zh: '查看使用网站、付款与生成服务的规则。',
      en: 'Review the rules for using the site, payments, and song generation.',
    },
    refund: {
      zh: '明确退款范围、失败补偿与服务回退规则。',
      en: 'Review refunds, failure compensation, and entitlement reversals.',
    },
    cancellation: {
      zh: '查看取消、退款及订阅服务状态变更处理方式。',
      en: 'See how cancellations, refunds, and service status changes are handled.',
    },
    'find-order': {
      zh: '通过邮箱与订单号快速查询你的订阅订单。',
      en: 'Look up your subscription order with email and order ID.',
    },
  }

  return links.map((item) => ({
    ...item,
    description: copy(locale, descriptions[item.key as LegalPageKey]),
  }))
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

function getVocalLabel(locale: Locale, code: string) {
  const vocal = vocalOptions.find((item) => item.code === code)
  if (!vocal) {
    return code
  }

  return locale === 'zh' ? vocal.zhLabel : vocal.enLabel
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

function ScrollManager() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  return null
}

function App() {
  const location = useLocation()
  const [draft, setDraft] = useState<SongDraft>({
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
  })
  const [selectedPlan, setSelectedPlan] = useState('Pro')
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
          setSongHistory(nextItems)
        }
      } catch (error) {
        if (!disposed) {
          console.error(error)
        }
      }
    }

    void loadMemberSongs()

    return () => {
      disposed = true
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

    return () => {
      disposed = true
    }
  }, [activeMemberToken])

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

  function saveHistory(item: HistoryItem) {
    setSongHistory((current) => {
      const next = [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 12)
      return next
    })
  }

  function handleAuthSuccess(session: AuthSession) {
    setSongHistory([])
    setAuthSession(session)
  }

  function handleLogout() {
    const currentSession = authSession
    if (currentSession?.authToken) {
      void fetch(apiUrl('/api/member/logout'), {
        method: 'POST',
        headers: getMemberAuthHeaders(currentSession),
      }).catch(() => {})
    }

    setAuthSession(null)
    setSongHistory([])
  }

  function handleAdminLogin(session: AdminSession) {
    setAdminSession(session)
  }

  function handleAdminLogout() {
    setAdminSession(null)
  }

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
          element={renderChineseRoute('/en/preview', <PreviewPage locale="zh" draft={draft} onSaveHistory={saveHistory} authSession={authSession} onLogout={handleLogout} onUpsertFloatingPlayer={upsertFloatingPlayer} />)}
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
        <Route path="/zh/delivery-fulfillment" element={renderChineseRoute('/en/delivery-fulfillment', <LegalPage locale="zh" policy="delivery" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/privacy-policy" element={renderChineseRoute('/en/privacy-policy', <LegalPage locale="zh" policy="privacy" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/terms-of-service" element={renderChineseRoute('/en/terms-of-service', <LegalPage locale="zh" policy="terms" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/refund-policy" element={renderChineseRoute('/en/refund-policy', <LegalPage locale="zh" policy="refund" authSession={authSession} onLogout={handleLogout} />)} />
        <Route path="/zh/cancellation-policy" element={renderChineseRoute('/en/cancellation-policy', <LegalPage locale="zh" policy="cancellation" authSession={authSession} onLogout={handleLogout} />)} />
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
          element={<PreviewPage locale="en" draft={draft} onSaveHistory={saveHistory} authSession={authSession} onLogout={handleLogout} onUpsertFloatingPlayer={upsertFloatingPlayer} />}
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
        <Route path="/en/delivery-fulfillment" element={<LegalPage locale="en" policy="delivery" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/privacy-policy" element={<LegalPage locale="en" policy="privacy" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/terms-of-service" element={<LegalPage locale="en" policy="terms" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/refund-policy" element={<LegalPage locale="en" policy="refund" authSession={authSession} onLogout={handleLogout} />} />
        <Route path="/en/cancellation-policy" element={<LegalPage locale="en" policy="cancellation" authSession={authSession} onLogout={handleLogout} />} />
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

      {floatingPlayer ? (
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
  const [activeTrackIndex, setActiveTrackIndex] = useState(player.activeTrackIndex ?? 0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [autoplayNotice, setAutoplayNotice] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
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
    setCurrentTime(0)
    setDuration(0)
    setPlaying(false)
    setAutoplayNotice('')
    setIsCollapsed(false)
  }, [player.key, player.activeTrackIndex])

  const tracks = player.tracks ?? []
  const safeActiveTrackIndex = tracks.length ? Math.min(activeTrackIndex, tracks.length - 1) : 0
  const activeTrack = tracks[safeActiveTrackIndex] ?? null
  const activeTrackUrl = activeTrack?.audioUrl || activeTrack?.downloadUrl || ''

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || activeTrack?.duration || 0)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
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

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [activeTrack?.duration])

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
        setAutoplayNotice(copy(player.locale, {
          zh: '歌曲已准备完成，已在浮动播放器中开始播放。',
          en: 'The song is ready and is now playing in the floating player.',
        }))
      } catch {
        setAutoplayNotice(copy(player.locale, {
          zh: '歌曲已准备完成，请点击播放器中央按钮开始播放。',
          en: 'The song is ready. Please press the center button to play.',
        }))
      }
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

  function updateProgress(nextProgress: number) {
    const audio = audioRef.current
    setProgress(nextProgress)
    if (!audio || !audio.duration) {
      return
    }

    audio.currentTime = (nextProgress / 100) * audio.duration
  }

  function seekBy(deltaSeconds: number) {
    const audio = audioRef.current
    if (!audio || !audio.duration) {
      return
    }

    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + deltaSeconds))
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    const target = event.target
    if (target instanceof HTMLElement && target.closest('button, input, a, textarea, select, label')) {
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

    const nextX = dragState.originX + (event.clientX - dragState.startX)
    const nextY = dragState.originY + (event.clientY - dragState.startY)
    setDragOffset({ x: nextX, y: nextY })
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const compactStatus = player.isGenerating
    ? copy(player.locale, { zh: `${Math.round(player.generationProgress)}%`, en: `${Math.round(player.generationProgress)}%` })
    : copy(player.locale, { zh: '播放中', en: 'Playing' })

  return (
    <div className="floating-phone-backdrop" role="presentation">
      <div
        className="floating-phone-dialog"
        role="dialog"
        aria-modal="false"
        aria-label="Floating song player"
        style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
      >
        <div className={`home-phone-shell floating-phone-shell ${player.isGenerating ? 'is-generating' : ''} ${isCollapsed ? 'is-collapsed' : ''}`}>
          <div
            className="floating-phone-drag-area"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div className="phone-status-row">
              <span>{player.eyebrow || 'MelodyVow'}</span>
              <span>{player.isGenerating ? copy(player.locale, { zh: '生成中', en: 'Creating' }) : copy(player.locale, { zh: '正在播放', en: 'Now Playing' })}</span>
            </div>
            <div className="phone-notch-row">
              <div className="phone-pill">{copy(player.locale, { zh: '悬浮播放器', en: 'Floating Player' })}</div>
              <div className="floating-phone-actions">
                <button type="button" className="floating-phone-toggle" onClick={() => setIsCollapsed((current) => !current)}>
                  {isCollapsed
                    ? copy(player.locale, { zh: '展开', en: 'Expand' })
                    : copy(player.locale, { zh: '折叠', en: 'Collapse' })}
                </button>
                {player.canClose ? (
                  <button type="button" className="floating-phone-close" onClick={onClose}>
                    {copy(player.locale, { zh: '关闭', en: 'Close' })}
                  </button>
                ) : (
                  <div className="phone-dots">{copy(player.locale, { zh: '处理中', en: 'Busy' })}</div>
                )}
              </div>
            </div>
          </div>

          <audio ref={audioRef} preload="metadata" />

          {isCollapsed ? (
            <div
              className="floating-phone-compact"
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <div className={`floating-phone-compact-disc ${playing || player.isGenerating ? 'is-spinning' : ''}`}>
                <img className="floating-phone-disc-image" src={phoneDiscImage} alt="" />
              </div>
              <div className="floating-phone-compact-copy">
                <strong>{activeTrack?.title || player.title}</strong>
                <span>{player.isGenerating ? player.generationLabel || compactStatus : activeTrack?.subtitle || compactStatus}</span>
              </div>
              <div className="floating-phone-compact-actions">
                {!player.isGenerating ? (
                  <button type="button" className="floating-phone-mini-button" onClick={togglePlayback} disabled={!activeTrackUrl}>
                    {playing ? '❚❚' : '▶'}
                  </button>
                ) : null}
                <button type="button" className="floating-phone-mini-button" onClick={() => setIsCollapsed(false)}>
                  {copy(player.locale, { zh: '展开', en: 'Open' })}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="phone-brand-block floating-phone-brand">
                <h2>{player.title || 'MelodyVow'}</h2>
                <p>{player.subtitle}</p>
              </div>

              <div className="phone-record-visual floating-phone-visual">
                <div className={`floating-phone-disc-shell ${playing || player.isGenerating ? 'is-spinning' : ''}`}>
                  <img className="floating-phone-disc-image" src={phoneDiscImage} alt="" />
                </div>
                <img className="phone-record-couple" src={coupleImage} alt="" />
                <img className="phone-record-heart" src={pinkHeartImage} alt="" />
              </div>

              {player.statusText ? (
                <div className={`status-banner ${player.isGenerating ? 'is-generating_song' : 'is-ready'}`}>
                  {player.statusText}
                </div>
              ) : null}

              {player.isGenerating ? (
                <div className="generation-progress-card floating-generation-card" aria-live="polite">
                  <p className="generation-progress-copy">{player.generationLabel}</p>
                  <div className="generation-progress-track" aria-hidden="true">
                    <div className="generation-progress-dots">
                      {Array.from({ length: 12 }, (_, index) => (
                        <span
                          key={index}
                          className={`generation-progress-dot ${index / 11 <= player.generationProgress / 100 ? 'active' : ''}`}
                        />
                      ))}
                    </div>
                    <img
                      className="generation-progress-heart"
                      src={pinkHeartImage}
                      alt=""
                      style={{ left: `calc(${player.generationProgress}% - 12px)` }}
                    />
                  </div>
                  <div className="generation-progress-meta">
                    <span>{copy(player.locale, { zh: '歌曲生成中', en: 'Song in progress' })}</span>
                    <span>{`${Math.round(player.generationProgress)}%`}</span>
                  </div>
                </div>
              ) : null}

              {tracks.length > 1 ? (
                <div className="floating-phone-track-tabs">
                  {tracks.map((track, index) => (
                    <button
                      key={track.id || `${player.key}-${index}`}
                      type="button"
                      className={`ghost-button compact ${index === safeActiveTrackIndex ? 'active' : ''}`}
                      onClick={() => setActiveTrackIndex(index)}
                    >
                      {track.title || copy(player.locale, { zh: `歌曲 ${index + 1}`, en: `Track ${index + 1}` })}
                    </button>
                  ))}
                </div>
              ) : null}

              {!player.isGenerating ? (
                <>
                  <div className="player-now-playing floating-player-meta">
                    <div>
                      <p className="mini-eyebrow">{copy(player.locale, { zh: '正在播放', en: 'Now Playing' })}</p>
                      <h3>{activeTrack?.title || player.title}</h3>
                      <p>{activeTrack?.subtitle || player.subtitle}</p>
                    </div>
                    <div className={`equalizer ${playing ? 'is-active' : ''}`} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>

                  <div className="player-progress">
                    <span>{formatDuration(currentTime)}</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={progress}
                      onChange={(event) => updateProgress(Number(event.target.value))}
                      disabled={!activeTrackUrl}
                    />
                    <span>{formatDuration(duration)}</span>
                  </div>

                  <div className="player-controls floating-player-controls">
                    <button type="button" className="icon-button" onClick={() => updateProgress(0)} disabled={!activeTrackUrl}>
                      ↺
                    </button>
                    <button type="button" className="icon-button" onClick={() => seekBy(-10)} disabled={!activeTrackUrl}>
                      ⏮
                    </button>
                    <button type="button" className="play-button" onClick={togglePlayback} disabled={!activeTrackUrl}>
                      {playing ? '❚❚' : '▶'}
                    </button>
                    <button type="button" className="icon-button" onClick={() => seekBy(10)} disabled={!activeTrackUrl}>
                      ⏭
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => window.open(activeTrack?.downloadUrl || activeTrackUrl, '_blank', 'noopener,noreferrer')}
                      disabled={!activeTrackUrl}
                    >
                      ↓
                    </button>
                  </div>
                </>
              ) : null}

              {autoplayNotice ? <p className="autoplay-notice">{autoplayNotice}</p> : null}
              {player.error ? <p className="form-error">{player.error}</p> : null}
              {player.lyrics ? (
                <div className="lyrics-box floating-player-lyrics">
                  <h3>{copy(player.locale, { zh: '歌词预览', en: 'Lyrics Preview' })}</h3>
                  <p>{player.lyrics}</p>
                </div>
              ) : null}
            </>
          )}
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [memberMenuOpen, setMemberMenuOpen] = useState(false)
  const memberMenuRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const currentAuthSession = authSession ?? loadAuthSession()
  const accountPath = currentAuthSession?.email ? withLocale(locale, '/account') : withLocale(locale, '/auth')
  const memberInitial = (currentAuthSession?.email?.trim()?.[0] ?? 'M').toUpperCase()
  const memberAvatarUrl = currentAuthSession?.avatarUrl?.trim()

  useEffect(() => {
    setMemberMenuOpen(false)
  }, [active])

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
      to: withLocale(locale, '/how-it-works'),
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
    <div className="site-shell" data-locale={locale} data-background-theme={siteConfig.backgroundTheme}>
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

      <header className="site-header">
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

        <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`}>
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

        <div className="header-actions">
          {siteConfig.enableChineseSite ? (
            <button
              type="button"
              className="ghost-button locale-switch"
              onClick={() =>
                navigate(
                  locale === 'zh'
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
                className="member-avatar-button"
                onClick={() => setMemberMenuOpen((value) => !value)}
                aria-label={copy(locale, { zh: '打开会员菜单', en: 'Open member menu' })}
                aria-haspopup="menu"
                aria-expanded={memberMenuOpen}
              >
                {memberAvatarUrl ? (
                  <img className="member-avatar-image" src={memberAvatarUrl} alt="" />
                ) : (
                  <span className="member-avatar-initial">{memberInitial}</span>
                )}
              </button>
              {memberMenuOpen ? (
                <div className="member-menu-popover" role="menu">
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
              <p className="eyebrow">{eyebrow}</p>
              <div className="headline-stack">
                <p className="brand-cn">{copy(locale, { zh: '旋律誓言', en: 'Turn love into melody' })}</p>
                <h1 className="visually-hidden">{title}</h1>
                <img className="hero-title-art" src={heroTitleImage} alt="" />
              </div>
              <div className="home-subtitle-wrap">
                <p className="hero-subtitle">{subtitle}</p>
                <button
                  type="button"
                  className="home-showcase-float-button"
                  onClick={() => navigate(withLocale(locale, '/how-it-works'))}
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
        ) : !hideHero ? (
          <section className="hero-banner">
            <p className="eyebrow">{eyebrow}</p>
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

function ServiceHubSection({ locale, title, subtitle }: { locale: Locale, title: string, subtitle: string }) {
  const items = getServiceHubItems(locale)

  return (
    <section className="service-hub-section">
      <div className="glass-card service-hub-ribbon">
        <div className="service-hub-ribbon-copy">
          <span className="service-hub-kicker">{copy(locale, { zh: '服务支持', en: 'Service Info' })}</span>
          <span className="service-hub-title">{title}</span>
          <span className="service-hub-subtitle">{subtitle}</span>
        </div>
        <nav className="service-hub-inline-links" aria-label={copy(locale, { zh: '订阅服务支持链接', en: 'Subscription support links' })}>
          {items.map((item, index) => (
            <Fragment key={item.key}>
              {index > 0 ? <span className="service-hub-divider" aria-hidden="true">/</span> : null}
              <NavLink to={item.to} className="service-hub-inline-link">
                {item.label}
              </NavLink>
            </Fragment>
          ))}
        </nav>
      </div>
    </section>
  )
}

function HomePage({ locale, draft, setDraft, onOpenModal, onUpsertFloatingPlayer, onLogout, authSession }: HomePageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const memberEmail = authSession?.email?.trim() || ''
  const memberToken = authSession?.authToken?.trim() || ''
  const missingFields = [
    !draft.groom.trim() ? copy(locale, { zh: '新郎姓名', en: 'groom name' }) : '',
    !draft.bride.trim() ? copy(locale, { zh: '新娘姓名', en: 'bride name' }) : '',
    !draft.loveStory.trim() ? copy(locale, { zh: '爱情故事', en: 'love story' }) : '',
    !draft.languageCode.trim() ? copy(locale, { zh: '歌曲语言', en: 'song language' }) : '',
    !draft.style.trim() ? copy(locale, { zh: '曲风偏好', en: 'music style' }) : '',
    !draft.vocal.trim() ? copy(locale, { zh: '歌唱声音', en: 'singing voice' }) : '',
  ].filter(Boolean)
  const isHomeFormValid = missingFields.length === 0

  useEffect(() => launchHomepageFireworks(), [])

  async function handleGenerateSong() {
    if (!isHomeFormValid) {
      const message = copy(locale, {
        zh: `请先完整填写并选择：${missingFields.join('、')}。`,
        en: `Please complete these fields first: ${missingFields.join(', ')}.`,
      })
      setSubmitError(message)
      return
    }

    if (!memberEmail || !memberToken) {
      const message = copy(locale, {
        zh: '请先登录会员后再生成歌曲，这样新生成的歌曲才能自动绑定到你的会员中心。',
        en: 'Please log in before generating a song so it can be saved to your account automatically.',
      })
      setSubmitError(message)
      onOpenModal(message)
      navigate(withLocale(locale, '/auth'))
      return
    }

    setSubmitError('')
    setIsSubmitting(true)

    const pendingPlayerKey = `pending-generate-${locale}`
    onUpsertFloatingPlayer({
      key: pendingPlayerKey,
      locale,
      title: `${draft.groom} & ${draft.bride}`,
      subtitle: `${draft.languageLabel} · ${getStyleLabel(locale, draft.style)} · ${getVocalLabel(locale, draft.vocal)}`,
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
      lyrics: draft.loveStory || draft.meetingStory || draft.vowKeywords,
      error: '',
      autoPlay: false,
    })

    try {
      const response = await fetch(apiUrl('/api/generate-song'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getMemberAuthHeaders(authSession),
        },
        body: JSON.stringify({
          groom: draft.groom,
          bride: draft.bride,
          userEmail: memberEmail,
          occasion: draft.occasion,
          style: draft.style,
          styleLabel: getStyleLabel(locale, draft.style),
          languageCode: draft.languageCode,
          languageLabel: draft.languageLabel,
          vocal: draft.vocal,
          vocalLabel: draft.vocalLabel,
          loveStory: draft.loveStory,
          meetingStory: draft.meetingStory,
          vowKeywords: draft.vowKeywords,
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

      onUpsertFloatingPlayer({
        key: result.jobId,
        locale,
        title: `${draft.groom} & ${draft.bride}`,
        subtitle: `${draft.languageLabel} · ${getStyleLabel(locale, draft.style)} · ${getVocalLabel(locale, draft.vocal)}`,
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
        lyrics: draft.loveStory || draft.meetingStory || draft.vowKeywords,
        error: '',
        autoPlay: false,
      })
      navigate(`${withLocale(locale, '/preview')}?job=${result.jobId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成请求失败，请稍后再试。'
      setSubmitError(message)
      onUpsertFloatingPlayer({
        key: pendingPlayerKey,
        locale,
        title: `${draft.groom} & ${draft.bride}`,
        subtitle: `${draft.languageLabel} · ${getStyleLabel(locale, draft.style)} · ${getVocalLabel(locale, draft.vocal)}`,
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
        lyrics: draft.loveStory || draft.meetingStory || draft.vowKeywords,
        error: message,
        autoPlay: false,
      })
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
        en: 'Turn your names into a wedding song made for your story.',
      })}
      eyebrow="MelodyVow"
      active="home"
      onOpenModal={onOpenModal}
      onLogout={onLogout}
      authSession={authSession}
      homePanel={(
        <section className="home-phone-shell">
          <div className="phone-brand-block">
            <h2>MelodyVow</h2>
            <p>{copy(locale, { zh: '把名字写进婚礼情歌', en: 'Turn names into wedding songs' })}</p>
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
              <select
                value={draft.style}
                onChange={(event) => setDraft((current) => ({ ...current, style: event.target.value }))}
              >
                <option value="">
                  {copy(locale, { zh: '请选择曲风偏好', en: 'Please select a style' })}
                </option>
                {weddingStyleOptions.map((style) => (
                  <option key={style.id} value={style.id}>
                    {locale === 'zh' ? style.zhLabel : style.enLabel}
                  </option>
                ))}
              </select>
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
            onClick={() => void handleGenerateSong()}
            disabled={isSubmitting || !isHomeFormValid}
          >
            {isSubmitting
              ? copy(locale, { zh: '正在生成歌词与歌曲...', en: 'Generating lyrics and song...' })
              : copy(locale, { zh: '开始生成婚礼歌', en: 'Create My Song' })}
          </button>

          {!isHomeFormValid ? (
            <p className="form-hint">
              {copy(locale, {
                zh: `请先完成这 6 项：${missingFields.join('、')}。`,
                en: `Please complete all 6 required fields: ${missingFields.join(', ')}.`,
              })}
            </p>
          ) : null}
          {submitError ? <p className="form-error">{submitError}</p> : null}
        </section>
      )}
    >
      <ServiceHubSection
        locale={locale}
        title={copy(locale, {
          zh: '付款前可查看服务政策与订单支持',
          en: 'Review policies and order support before checkout',
        })}
        subtitle={copy(locale, {
          zh: '交付、退款、取消与订单查询',
          en: 'Fulfillment, refunds, cancellations, and order lookup',
        })}
      />
    </SiteLayout>
  )
}

function formatDuration(seconds: number) {
  if (!seconds || Number.isNaN(seconds)) {
    return '00:00'
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
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

function ShowcasePage({ locale, authSession, onLogout, onUpsertFloatingPlayer }: ShowcasePageProps) {
  const navigate = useNavigate()
  const [tracks, setTracks] = useState<ShowcaseTrack[]>(productShowcaseTracks)
  const [activeTrackId, setActiveTrackId] = useState(productShowcaseTracks[0]?.id ?? '')
  const [error, setError] = useState('')
  const activeTrack = tracks.find((track) => track.id === activeTrackId) ?? tracks[0]

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

  function handleSelectTrack(trackId: string) {
    const trackIndex = tracks.findIndex((track) => track.id === trackId)
    const nextTrack = tracks[trackIndex] ?? tracks[0]
    setActiveTrackId(trackId)
    setError('')
    onUpsertFloatingPlayer({
      key: `showcase-${trackId}`,
      locale,
      title: copy(locale, nextTrack?.title ?? { zh: 'MelodyVow 展示', en: 'MelodyVow Showcase' }),
      subtitle: copy(locale, nextTrack?.meta ?? { zh: '婚礼样片', en: 'Wedding sample' }),
      eyebrow: copy(locale, { zh: '样片播放器', en: 'Showcase Player' }),
      tracks: tracks.map((track) => ({
        id: track.id,
        title: copy(locale, track.title),
        subtitle: copy(locale, track.meta),
        audioUrl: track.audioUrl,
        downloadUrl: track.audioUrl,
      })),
      activeTrackIndex: Math.max(trackIndex, 0),
      canClose: true,
      isGenerating: false,
      generationProgress: 100,
      generationLabel: '',
      statusText: copy(locale, {
        zh: '所有样片播放都会统一进入浮动手机播放器。',
        en: 'All sample playback now opens in the floating phone player.',
      }),
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
        <article className="glass-panel floating-player-teaser">
          <div className="phone-brand-block">
            <h2>{copy(locale, { zh: '悬浮手机播放器', en: 'Floating Phone Player' })}</h2>
            <p>{copy(locale, { zh: '所有样片和生成歌曲都会从这里统一播放。', en: 'All sample and generated songs now open here.' })}</p>
          </div>
          <div className="phone-record-visual floating-phone-visual" aria-hidden="true">
            <div className="floating-phone-disc-shell is-spinning">
              <img className="floating-phone-disc-image" src={phoneDiscImage} alt="" />
            </div>
            <img className="phone-record-couple" src={coupleImage} alt="" />
            <img className="phone-record-heart" src={pinkHeartImage} alt="" />
          </div>
          <div className="status-banner is-ready">
            {copy(locale, {
              zh: '点击右侧任意样片，都会打开右下角悬浮播放器，不再使用旧播放器。',
              en: 'Tap any sample on the right to open the docked floating player.',
            })}
          </div>
          {activeTrack ? (
            <div className="player-now-playing floating-player-meta">
              <div>
                <p className="mini-eyebrow">{copy(locale, { zh: '当前主推样片', en: 'Featured Sample' })}</p>
                <h3>{copy(locale, activeTrack.title)}</h3>
                <p>{copy(locale, activeTrack.meta)}</p>
              </div>
            </div>
          ) : null}
          {error ? <p className="form-error">{error}</p> : null}
        </article>

        <aside className="showcase-sidebar">
          <article className="glass-card showcase-intro">
            <p className="mini-eyebrow">{copy(locale, { zh: '全球', en: 'Global' })}</p>
            <h3>{copy(locale, { zh: '曾经求婚成功的浪漫歌曲', en: 'Romantic Songs from Successful Proposals' })}</h3>
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
            {tracks.map((track, index) => {
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
                    <strong>{copy(locale, track.title)}</strong>
                    <span>{copy(locale, track.meta)}</span>
                  </div>
                  <div className={`showcase-track-icon ${isActive ? 'is-playing' : ''}`}>
                    ▶
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
      <section className="styles-grid styles-page-grid">
        {weddingStyleOptions.map((card, index) => (
          <article
            key={card.id}
            className={`glass-card style-card ${draft.style === card.id ? 'selected' : ''}`}
          >
            <div className="step-badge">{index + 1}</div>
            <h3>{locale === 'zh' ? card.zhLabel : card.enLabel}</h3>
            <p>{locale === 'zh' ? card.zhDescription : card.enDescription}</p>
            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                setDraft((current) => ({ ...current, style: card.id }))
                navigate(withLocale(locale))
              }}
            >
              {copy(locale, { zh: '选择曲风', en: 'Select Style' })}
            </button>
          </article>
        ))}
      </section>
    </SiteLayout>
  )
}

function PreviewPage({ locale, draft, onSaveHistory, authSession, onLogout, onUpsertFloatingPlayer }: PreviewPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [job, setJob] = useState<SongJob | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [generationHeartbeat, setGenerationHeartbeat] = useState(() => Date.now())
  const params = new URLSearchParams(location.search)
  const jobId = params.get('job')
  const activeJob = jobId ? job : null
  const availableTracks = activeJob?.tracks ?? []
  const hasReadyTracks = availableTracks.length > 0
  const duration = availableTracks[0]?.duration ?? 0
  const generationDurationMs = 120000
  const displayedTitle = activeJob?.title || `${draft.groom} & ${draft.bride}` || 'MelodyVow'
  const displayedLyrics = activeJob?.lyrics
    ?? (locale === 'zh'
      ? 'DeepSeek 生成的歌词会显示在这里。\nSuno 回调完成后，歌曲会自动尝试播放。'
      : 'Lyrics from DeepSeek will appear here.\nOnce Suno finishes the callback, the song will try to autoplay.')
  const isGenerating = Boolean(activeJob && activeJob.status !== 'ready' && activeJob.status !== 'error')
  const generationDots = Array.from({ length: 12 }, (_, index) => index)
  const generationStartedAt = new Date(activeJob?.createdAt || activeJob?.updatedAt || generationHeartbeat).getTime()
  const safeGenerationStartedAt = Number.isNaN(generationStartedAt) ? generationHeartbeat : generationStartedAt
  const generationProgress = !activeJob
    ? 0
    : activeJob.status === 'ready'
      ? 100
      : activeJob.status === 'error'
        ? 0
        : Math.min(96, (Math.max(0, generationHeartbeat - safeGenerationStartedAt) / generationDurationMs) * 100)

  useEffect(() => {
    const tracks = activeJob?.tracks ?? []
    if (!activeJob || activeJob.status !== 'ready' || !tracks.length) {
      return
    }

    tracks.forEach((track, index) => {
      const variantLabel = copy(locale, {
        zh: `歌曲 ${index + 1}`,
        en: `Version ${index + 1}`,
      })
      onSaveHistory({
        id: buildTrackHistoryId(activeJob.id, index),
        title: track.title || activeJob.title || displayedTitle,
        subtitle: `${summarizeStoryText(
          draft.loveStory || draft.meetingStory,
          copy(locale, {
            zh: `${draft.groom} & ${draft.bride} 的婚礼歌`,
            en: `${draft.groom} & ${draft.bride}'s wedding song`,
          }),
        )} · ${variantLabel}`,
        status: copy(locale, { zh: '已生成', en: 'Ready' }),
        action: copy(locale, { zh: '播放', en: 'Play' }),
        variantLabel,
        audioUrl: track.audioUrl || track.downloadUrl || '',
        downloadUrl: track.downloadUrl || track.audioUrl || '',
        createdAt: activeJob.updatedAt,
        languageLabel: draft.languageLabel,
        styleLabel: getStyleLabel(locale, draft.style),
        vocalLabel: getVocalLabel(locale, draft.vocal),
        lyricSnippet: summarizeStoryText(activeJob.lyrics ?? '', ''),
      })
    })
  }, [activeJob, displayedTitle, draft, locale, onSaveHistory])

  async function loadJob(currentJobId: string) {
    const response = await fetch(apiUrl(`/api/jobs/${currentJobId}`))
    const data = (await response.json()) as SongJob | { message?: string }

    if (!response.ok) {
      throw new Error('message' in data && data.message ? data.message : '任务查询失败。')
    }

    // #region debug-point C:frontend-job-response
    reportDebugEvent({
      hypothesisId: 'C',
      location: 'web/src/App.tsx:loadJob',
      msg: '[DEBUG] Frontend loaded job payload',
      data: {
        jobId: currentJobId,
        status: 'status' in data ? data.status : '',
        trackCount: 'tracks' in data && Array.isArray(data.tracks) ? data.tracks.length : 0,
        firstTrackAudioUrl: 'tracks' in data && Array.isArray(data.tracks) ? data.tracks[0]?.audioUrl || '' : '',
        firstTrackDownloadUrl: 'tracks' in data && Array.isArray(data.tracks) ? data.tracks[0]?.downloadUrl || '' : '',
      },
    })
    // #endregion

    setJob(data as SongJob)
    return data as SongJob
  }

  useEffect(() => {
    if (!jobId) {
      return
    }

    let disposed = false

    const startLoading = async () => {
      setIsLoading(true)
      setError('')

      try {
        await loadJob(jobId)
      } catch (loadError) {
        if (!disposed) {
          setError(loadError instanceof Error ? loadError.message : '任务查询失败。')
        }
      } finally {
        if (!disposed) {
          setIsLoading(false)
        }
      }
    }

    void startLoading()

    return () => {
      disposed = true
    }
  }, [jobId])

  useEffect(() => {
    if (!jobId || !activeJob || activeJob.status === 'ready' || activeJob.status === 'error') {
      return
    }

    const timer = window.setInterval(() => {
      void loadJob(jobId).catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : '任务查询失败。')
      })
    }, 5000)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeJob, jobId])

  useEffect(() => {
    if (!isGenerating) {
      return
    }

    const timer = window.setInterval(() => {
      setGenerationHeartbeat(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [isGenerating])

  function openPreviewFloatingPlayer(autoPlay: boolean) {
    if (!activeJob) {
      return
    }

    onUpsertFloatingPlayer({
      key: activeJob.id,
      locale,
      title: activeJob.title || `${draft.groom} & ${draft.bride}` || 'MelodyVow',
      subtitle: copy(locale, {
        zh: `${draft.groom} & ${draft.bride} · ${getStyleLabel(locale, draft.style)} · ${getVocalLabel(locale, draft.vocal)}`,
        en: `${draft.groom} & ${draft.bride} · ${getStyleLabel(locale, draft.style)} · ${getVocalLabel(locale, draft.vocal)}`,
      }),
      eyebrow: copy(locale, { zh: '婚礼歌播放器', en: 'Wedding Song Player' }),
      tracks: activeJob.status === 'ready' ? buildFloatingTracksFromJob(activeJob, locale) : [],
      activeTrackIndex: 0,
      canClose: !isGenerating,
      isGenerating,
      generationProgress,
      generationLabel: copy(locale, {
        zh: '幸福正在慢慢向着您靠近！',
        en: 'Happiness is slowly making its way to you!',
      }),
      statusText: activeJob.error
        || getJobStatusLabel(locale, activeJob.status, activeJob.callbackEnabled),
      lyrics: activeJob.lyrics || '',
      error: error || activeJob.error || '',
      autoPlay,
    })
  }

  useEffect(() => {
    if (!activeJob) {
      return
    }

    openPreviewFloatingPlayer(activeJob.status === 'ready' && availableTracks.length > 0)
  }, [
    activeJob,
    availableTracks.length,
    error,
    generationProgress,
    isGenerating,
    locale,
  ])

  return (
    <SiteLayout
      locale={locale}
      title={copy(locale, { zh: '你的婚礼歌已生成', en: 'Your Wedding Song Preview Is Ready' })}
      subtitle={copy(locale, {
        zh: '先试听只属于你们名字的纪念歌曲',
        en: 'Listen to the preview made from your names and wedding story.',
      })}
      eyebrow="MelodyVow"
      active="styles"
      onOpenModal={() => undefined}
      onLogout={onLogout}
      authSession={authSession}
    >
      <section className="preview-layout">
        <article className="glass-panel floating-player-teaser preview-shell-card">
          <div className="phone-brand-block">
            <h2>{copy(locale, { zh: '悬浮 iPhone 播放器', en: 'Floating iPhone Player' })}</h2>
            <p>{copy(locale, {
              zh: '生成进度、两首歌曲和后续播放入口都已经统一进这个右下角悬浮播放器。',
              en: 'Progress, both generated tracks, and all playback now live inside this docked floating player.',
            })}</p>
          </div>

          <div className="phone-record-visual floating-phone-visual" aria-hidden="true">
            <div className={`floating-phone-disc-shell ${isGenerating || availableTracks.length ? 'is-spinning' : ''}`}>
              <img className="floating-phone-disc-image" src={phoneDiscImage} alt="" />
            </div>
            <img className="phone-record-couple" src={coupleImage} alt="" />
            <img className="phone-record-heart" src={pinkHeartImage} alt="" />
          </div>

          {activeJob ? (
            <div className={`status-banner is-${activeJob.status}`}>
              {getJobStatusLabel(locale, activeJob.status, activeJob.callbackEnabled)}
            </div>
          ) : null}

          {activeJob && isGenerating ? (
            <div className="generation-progress-card floating-generation-card" aria-live="polite">
              <p className="generation-progress-copy">
                {copy(locale, {
                  zh: '幸福正在慢慢向着您靠近！',
                  en: 'Happiness is slowly making its way to you!',
                })}
              </p>
              <div className="generation-progress-track" aria-hidden="true">
                <div className="generation-progress-dots">
                  {generationDots.map((dot) => (
                    <span
                      key={dot}
                      className={`generation-progress-dot ${dot / (generationDots.length - 1) <= generationProgress / 100 ? 'active' : ''}`}
                    />
                  ))}
                </div>
                <img
                  className="generation-progress-heart"
                  src={pinkHeartImage}
                  alt=""
                  style={{ left: `calc(${generationProgress}% - 12px)` }}
                />
              </div>
              <div className="generation-progress-meta">
                <span>{copy(locale, { zh: '歌曲生成中', en: 'Generating song' })}</span>
                <span>{`${Math.round(generationProgress)}%`}</span>
              </div>
            </div>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}
          {!jobId ? (
            <p className="empty-state">
              {copy(locale, {
                zh: '请先回到首页填写名字、语言、曲风和声音，再开始真实生成。',
                en: 'Go back to the homepage, fill in the names, language, style and voice, then start a real generation.',
              })}
            </p>
          ) : null}

          <div className="player-now-playing floating-player-meta">
            <div>
              <p className="mini-eyebrow">{copy(locale, { zh: '悬浮状态', en: 'Player Status' })}</p>
              <h3>{displayedTitle}</h3>
              <p>
                {copy(locale, {
                  zh: `${draft.groom} & ${draft.bride} · ${getStyleLabel(locale, draft.style)} · ${getVocalLabel(locale, draft.vocal)}`,
                  en: `${draft.groom} & ${draft.bride} · ${getStyleLabel(locale, draft.style)} · ${getVocalLabel(locale, draft.vocal)}`,
                })}
              </p>
            </div>
            <div className={`equalizer ${isGenerating || availableTracks.length ? 'is-active' : ''}`} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="preview-shell-actions">
            <button
              type="button"
              className="primary-button wide"
              onClick={() => openPreviewFloatingPlayer(activeJob?.status === 'ready')}
              disabled={!activeJob}
            >
              {copy(locale, {
                zh: isGenerating ? '查看悬浮播放器进度' : '打开悬浮播放器试听',
                en: isGenerating ? 'Open Floating Player Progress' : 'Open Floating Player',
              })}
            </button>
            <p className="hint-text">
              {copy(locale, {
                zh: availableTracks.length
                  ? `已生成 ${availableTracks.length} 首歌曲，点击上方按钮即可在悬浮播放器中切换播放。`
                  : '生成期间悬浮播放器会一直保持存在，完成后会自动切换为可播放状态。',
                en: availableTracks.length
                  ? `${availableTracks.length} tracks are ready. Open the floating player to switch between them.`
                  : 'The floating player stays visible during generation and switches to playback when ready.',
              })}
            </p>
          </div>

          <div className="lyrics-box">
            <h3>{copy(locale, { zh: '歌词预览', en: 'Lyrics Preview' })}</h3>
            <p>{displayedLyrics}</p>
          </div>

          <div className="story-summary-card">
            <h3>{copy(locale, { zh: '创作描述', en: 'Creative Brief' })}</h3>
            <p>{summarizeStoryText(draft.loveStory, copy(locale, { zh: '暂未填写爱情故事。', en: 'No love story provided yet.' }))}</p>
            <p>{summarizeStoryText(draft.meetingStory, copy(locale, { zh: '暂未填写相识经历。', en: 'No meeting story provided yet.' }))}</p>
            <p>{summarizeStoryText(draft.vowKeywords, copy(locale, { zh: '暂未填写誓言关键词。', en: 'No vow keywords provided yet.' }))}</p>
          </div>
        </article>

        <aside className="glass-card song-meta">
          <div className="step-badge">1</div>
          <ul>
            <li>{copy(locale, { zh: `新郎：${draft.groom}`, en: `Groom: ${draft.groom}` })}</li>
            <li>{copy(locale, { zh: `新娘：${draft.bride}`, en: `Bride: ${draft.bride}` })}</li>
            <li>{copy(locale, { zh: `语言：${draft.languageLabel}`, en: `Language: ${draft.languageLabel}` })}</li>
            <li>{copy(locale, { zh: `曲风：${getStyleLabel(locale, draft.style)}`, en: `Style: ${getStyleLabel(locale, draft.style)}` })}</li>
            <li>{copy(locale, { zh: `声音：${getVocalLabel(locale, draft.vocal)}`, en: `Voice: ${getVocalLabel(locale, draft.vocal)}` })}</li>
            {availableTracks.length ? (
              <li>{copy(locale, { zh: `已生成歌曲：${availableTracks.length} 首`, en: `Tracks ready: ${availableTracks.length}` })}</li>
            ) : null}
            <li>
              {activeJob
                ? copy(locale, { zh: `状态：${getJobStatusLabel(locale, activeJob.status, activeJob.callbackEnabled)}`, en: `Status: ${getJobStatusLabel(locale, activeJob.status, activeJob.callbackEnabled)}` })
                : copy(locale, { zh: '状态：等待生成', en: 'Status: Waiting to generate' })}
            </li>
            <li>{copy(locale, { zh: `时长：${formatDuration(duration)}`, en: `Duration: ${formatDuration(duration)}` })}</li>
          </ul>
          <button
            type="button"
            className="primary-button wide"
            onClick={() => navigate(hasReadyTracks ? withLocale(locale, '/complete') : withLocale(locale))}
          >
            {hasReadyTracks
              ? copy(locale, { zh: '查看下载页', en: 'Open Download Page' })
              : copy(locale, { zh: '返回继续填写', en: 'Back to Homepage' })}
          </button>
          <p className="hint-text">
            {isLoading
              ? copy(locale, {
                  zh: '正在载入最新任务状态...',
                  en: 'Loading the latest job status...',
                })
              : copy(locale, {
                  zh: '如果配置了公网回调地址，Suno 完成后会直接回调到本系统；本地开发会自动轮询结果。',
                  en: 'If a public callback URL is configured, Suno will push the result back here; local development falls back to polling.',
                })}
          </p>
        </aside>
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
          { id: 'starter', name: 'Starter', price: 89, heartBeans: 5, currency: 'CNY', badge: '', features: ['5 点订阅服务额度', 'AI 歌词生成', '名字入歌', 'MP3 下载'] },
          { id: 'pro', name: 'Pro', price: 199, heartBeans: 15, currency: 'CNY', badge: '推荐', features: ['15 点订阅服务额度', '完整歌词', '婚礼版本', '高清音频'] },
          { id: 'premium', name: 'Premium', price: 499, heartBeans: 40, currency: 'CNY', badge: '', features: ['40 点订阅服务额度', '真人演唱', '高级编曲', '双版本混音'] },
        ]
      : [
          { id: 'starter', name: 'Starter', price: 89, heartBeans: 5, currency: 'CNY', badge: '', features: ['5 service credits', 'AI lyrics', 'Names in song', 'MP3 download'] },
          { id: 'pro', name: 'Pro', price: 199, heartBeans: 15, currency: 'CNY', badge: 'Recommended', features: ['15 service credits', 'Full lyrics', 'Wedding version', 'HD audio'] },
          { id: 'premium', name: 'Premium', price: 499, heartBeans: 40, currency: 'CNY', badge: '', features: ['40 service credits', 'Real singer', 'Custom arrangement', 'Dual mix'] },
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
          setPlans(items.length ? items : fallbackPlans)
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
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`glass-card pricing-card ${selectedPlan === plan.name ? 'selected' : ''}`}
          >
            {plan.badge ? <span className="corner-badge">{plan.badge}</span> : null}
            <div className="step-badge">{plan.name.slice(0, 1)}</div>
            <h3>{plan.name}</h3>
            <div className="price-tag">{plan.currency === 'CNY' || !plan.currency ? `¥${plan.price}` : `${plan.price}`}</div>
            <p>{copy(locale, { zh: `包含 ${plan.heartBeans || 0} 点订阅服务额度`, en: `${plan.heartBeans || 0} service credits included` })}</p>
            <ul>
              {(plan.features || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                setSelectedPlan(plan.name)
                navigate(withLocale(locale, `/checkout?planId=${encodeURIComponent(plan.id)}`))
              }}
            >
              {copy(locale, { zh: '选择此套餐', en: 'Choose This Plan' })}
            </button>
          </article>
        ))}
      </section>
      <ServiceHubSection
        locale={locale}
        title={copy(locale, {
          zh: '订阅购买前请先阅读服务政策',
          en: 'Review service policies before purchase',
        })}
        subtitle={copy(locale, {
          zh: '交付、退款、取消与订单查询',
          en: 'Fulfillment, refunds, cancellations, and order lookup',
        })}
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

    const fallbackPlans: PlanItem[] = [
      { id: 'starter', name: 'Starter', price: 89, heartBeans: 5, currency: 'CNY', badge: '', features: [] },
      { id: 'pro', name: 'Pro', price: 199, heartBeans: 15, currency: 'CNY', badge: '', features: [] },
      { id: 'premium', name: 'Premium', price: 499, heartBeans: 40, currency: 'CNY', badge: '', features: [] },
    ]

    async function loadCheckoutData() {
      setLoading(true)
      setError('')
      try {
        const [plansRes, methodsRes] = await Promise.all([
          fetch(apiUrl('/api/plans')),
          fetch(apiUrl('/api/payment/methods')),
        ])
        const [plansData, methodsData] = await Promise.all([plansRes.json(), methodsRes.json()])
        const nextPlans = Array.isArray(plansData.items) ? (plansData.items as PlanItem[]) : fallbackPlans
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
        }),
      })
      const result = (await response.json()) as { checkoutUrl?: string; message?: string }
      if (!response.ok) {
        throw new Error(result.message || '创建订单失败。')
      }
      if (!result.checkoutUrl) {
        throw new Error('收款链接为空。')
      }

      window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer')
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
              <div className="price-tag">{activePlan.currency === 'CNY' || !activePlan.currency ? `¥${activePlan.price}` : `${activePlan.price}`}</div>
              <p>{copy(locale, { zh: `开通 ${activePlan.heartBeans || 0} 点订阅服务额度`, en: `${activePlan.heartBeans || 0} service credits will be activated` })}</p>
              <button type="button" className="ghost-button compact" onClick={() => navigate(withLocale(locale, '/pricing'))}>
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
          {!loading && !methods.length ? (
            <p className="empty-state">{copy(locale, { zh: '暂无可用支付方式，请联系管理员在后台启用。', en: 'No payment methods available. Please contact the admin to enable one.' })}</p>
          ) : null}
          <div className="admin-detail-stack">
            {methods.map((method) => (
              <button
                key={method.id}
                type="button"
                className="primary-button"
                disabled={submitting || loading}
                onClick={() => void handleStartPayment(method)}
              >
                {method.name}
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
  const [isSubmitting, setIsSubmitting] = useState(false)

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
          </div>

          {authError ? <p className="form-error">{authError}</p> : null}

          <button
            type="button"
            className="primary-button wide"
            disabled={isSubmitting}
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

function AccountPage({ locale, selectedPlan, onOpenModal, history, onLogout, authSession, onUpsertFloatingPlayer }: AccountPageProps) {
  const displayName = authSession?.partnerName
    ? `${authSession.partnerName} & MelodyVow`
    : locale === 'zh'
      ? 'Hao & Xin'
      : 'Hao & Xin'
  const memberLabel = authSession?.email ?? copy(locale, { zh: '未登录访客', en: 'Guest User' })
  const currentPlanLabel = authSession?.plan?.trim() || selectedPlan
  const heartBeansBalance = Number(authSession?.heartBeansBalance || 0)
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

  async function handleTogglePlay(item: HistoryItem) {
    try {
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
          zh: '会员中心的歌曲会统一在这个悬浮播放器中播放。',
          en: 'Songs from your member center now play in this floating player.',
        }),
        lyrics: item.lyricSnippet || '',
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
            <h3>{displayName}</h3>
            <p className="account-member-email">{memberLabel}</p>
            <div className="tag-row">
              <span className="soft-pill accent">{currentPlanLabel} Member</span>
              <span className="soft-pill">{copy(locale, { zh: `${heartBeansBalance} 点服务额度`, en: `${heartBeansBalance} service credits` })}</span>
              {authTime ? (
                <span className="soft-pill">{copy(locale, { zh: `最近验证 ${authTime}`, en: `Verified ${authTime}` })}</span>
              ) : null}
            </div>
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
            </div>
          </section>
        </aside>

        <section className="account-song-list">
          {history.map((item) => (
            <article key={item.id} className="glass-card account-song-row">
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
                  {copy(locale, { zh: '浮动播放器', en: 'Open Player' })}
                </button>
                <button
                  type="button"
                  className="ghost-button compact"
                  onClick={() => void handleShareSong(item)}
                >
                  {copy(locale, { zh: '分享链接', en: 'Share Link' })}
                </button>
                <button
                  type="button"
                  className="primary-button compact"
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
  const [tab, setTab] = useState<'overview' | 'members' | 'songs' | 'showcase' | 'plans' | 'payments' | 'orders' | 'config'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metrics, setMetrics] = useState({
    totalSongs: 0,
    readySongs: 0,
    totalOrders: 0,
    paidOrders: 0,
    totalRevenue: 0,
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

        const [overviewRes, membersRes, songsRes, showcaseRes, plansRes, paymentsRes, ordersRes, configRes] = await Promise.all([
          fetch(apiUrl('/api/admin/overview'), { headers }),
          fetch(apiUrl('/api/admin/members'), { headers }),
          fetch(apiUrl('/api/admin/songs'), { headers }),
          fetch(apiUrl('/api/admin/showcase-tracks'), { headers }),
          fetch(apiUrl('/api/admin/plans'), { headers }),
          fetch(apiUrl('/api/admin/payment-methods'), { headers }),
          fetch(apiUrl('/api/admin/orders'), { headers }),
          fetch(apiUrl('/api/admin/config'), { headers }),
        ])

        const [overviewData, membersData, songsData, showcaseData, plansData, paymentsData, ordersData, configData] = await Promise.all([
          readJsonSafe(overviewRes),
          readJsonSafe(membersRes),
          readJsonSafe(songsRes),
          readJsonSafe(showcaseRes),
          readJsonSafe(plansRes),
          readJsonSafe(paymentsRes),
          readJsonSafe(ordersRes),
          readJsonSafe(configRes),
        ])

        if ([overviewRes, membersRes, songsRes, showcaseRes, plansRes, paymentsRes, ordersRes, configRes].some((item) => !item.ok)) {
          const message = overviewData.message
            || membersData.message
            || songsData.message
            || showcaseData.message
            || plansData.message
            || paymentsData.message
            || ordersData.message
            || configData.message
            || '后台数据加载失败。'
          throw new Error(message)
        }

        if (!disposed) {
          setMetrics(overviewData.metrics)
          const nextMembers = Array.isArray(membersData.items) ? membersData.items : []
          const nextSongs = Array.isArray(songsData.items) ? songsData.items : []
          const nextShowcase = Array.isArray(showcaseData.items) ? showcaseData.items : []
          const nextPlans = Array.isArray(plansData.items) ? plansData.items : []
          const nextPayments = Array.isArray(paymentsData.items) ? paymentsData.items : []
          const nextOrders = Array.isArray(ordersData.items) ? ordersData.items : []
          setMembers(nextMembers)
          setSongs(nextSongs)
          setShowcaseTracks(nextShowcase)
          setPlans(nextPlans)
          setPaymentMethods(nextPayments)
          setOrders(nextOrders)
          setSelectedMember(nextMembers[0] ?? null)
          setSelectedSong(nextSongs[0] ?? null)
          setSelectedOrder(nextOrders[0] ?? null)
          setConfig(configData as AdminConfig)
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
    const currentBalance = Number(selectedMember.heartBeansBalance ?? 0)
    const manualNote = manualTopupNote.trim()
    const nextMemberPayload: AdminMember = {
      ...selectedMember,
      heartBeansBalance: currentBalance + topupAmount,
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
      setPlans(Array.isArray(result.items) ? result.items : plans)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '套餐保存失败。')
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
                        setSelectedMember(item)
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
                        <span>服务额度余额</span>
                        <strong>{selectedMember.heartBeansBalance ?? 0}</strong>
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
                          onChange={(event) => setSelectedMember((current) => current ? { ...current, plan: event.target.value } : current)}
                        >
                          <option value="">未设置</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.name}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>服务额度余额</span>
                        <input
                          type="number"
                          value={selectedMember.heartBeansBalance ?? 0}
                          onChange={(event) => setSelectedMember((current) => current ? { ...current, heartBeansBalance: Number(event.target.value) } : current)}
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

                    <button type="button" className="primary-button" onClick={() => void handleSaveMember()}>
                      保存会员修改
                    </button>
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
                <strong>订阅套餐</strong>
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
                        <span>订阅服务额度</span>
                        <input
                          type="number"
                          value={plan.heartBeans ?? 0}
                          onChange={(event) =>
                            setPlans((current) => current.map((item, i) => (i === index ? { ...item, heartBeans: Number(event.target.value) } : item)))
                          }
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
                      price: 0,
                      heartBeans: 0,
                      currency: 'CNY',
                      badge: '',
                      features: [],
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
                      envKey: '',
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
                  <h3>{backgroundThemeOptions.find((item) => item.id === config.backgroundTheme)?.label || '网站背景方案'}</h3>
                  <p>{backgroundThemeOptions.find((item) => item.id === config.backgroundTheme)?.description || '保存后前台会立即使用这套底图配色。'}</p>
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

  const policyContent: Record<LegalPageKey, { active: string, title: Copy, subtitle: Copy, sections: Array<{ heading: Copy, paragraphs: Copy[] }> }> = {
    delivery: {
      active: 'legal_delivery',
      title: { zh: '交付与履约', en: 'Delivery & Fulfillment' },
      subtitle: {
        zh: '说明 MelodyVow 如何交付订阅服务、何时生效以及会员如何使用服务额度。',
        en: 'This page explains how MelodyVow fulfills subscription services, when access becomes active, and how members use their service quota.',
      },
      sections: [
        {
          heading: { zh: '数字服务交付方式', en: 'Digital Delivery Method' },
          paragraphs: [
            {
              zh: 'MelodyVow 销售的是订阅式数字婚礼歌曲服务，不涉及实体商品发货。用户完成付款后，订单会在网站内记录，管理员确认付款成功后，对应订阅套餐会把服务额度开通到会员账户。',
              en: 'MelodyVow sells a subscription-based digital wedding song service and does not ship physical goods. After payment, the order is recorded on-site, and once payment is confirmed, the selected plan activates service credits in the member account.',
            },
            {
              zh: '会员在首页点击“开始生成婚礼歌”时，会按当前服务配置扣除相应数量的服务额度，并在会员中心查看歌曲记录、订单状态与可下载内容。',
              en: 'When a member clicks "Create My Song" on the homepage, the configured amount of service quota is consumed and the generated song, order status, and downloadable files become available in the member account.',
            },
          ],
        },
        {
          heading: { zh: '履约时间', en: 'Fulfillment Timing' },
          paragraphs: [
            {
              zh: '会员权益通常在付款确认后生效。若使用第三方支付链接，实际到账时间以支付平台记录和网站后台确认时间为准。',
              en: 'Member entitlements generally become active after payment confirmation. For third-party payment links, the effective time depends on the payment record and website order confirmation.',
            },
            {
              zh: '歌曲生成属于数字内容服务，完成时间取决于外部 AI 服务、网络状况和排队负载。若生成失败，本次扣除的服务额度会自动退回。',
              en: 'Song generation is a digital content service, and completion time depends on external AI services, network conditions, and queue load. If generation fails, the consumed service quota is automatically returned.',
            },
          ],
        },
      ],
    },
    privacy: {
      active: 'legal_privacy',
      title: { zh: '隐私政策', en: 'Privacy Policy' },
      subtitle: {
        zh: '说明网站收集哪些信息、如何使用以及如何保护会员数据。',
        en: 'This page explains what information the website collects, how it is used, and how member data is protected.',
      },
      sections: [
        {
          heading: { zh: '我们收集的信息', en: 'Information We Collect' },
          paragraphs: [
            {
              zh: '当你注册会员、购买订阅套餐或生成歌曲时，我们可能会收集邮箱、伴侣姓名、订单信息、生成参数、歌曲记录和账户状态等与服务交付直接相关的数据。',
              en: 'When you register, purchase a subscription plan, or generate a song, we may collect information directly related to service delivery, including email address, partner name, order data, generation inputs, song records, and account status.',
            },
            {
              zh: '我们不会在 MelodyVow 网站内存储支付密码、银行卡密码或 PayPal 账户密码。支付环节由第三方支付平台处理。',
              en: 'We do not store payment passwords, card passwords, or PayPal account passwords inside MelodyVow. Payment steps are handled by third-party payment platforms.',
            },
          ],
        },
        {
          heading: { zh: '信息使用与保护', en: 'How Information Is Used and Protected' },
          paragraphs: [
            {
              zh: '这些信息仅用于会员认证、订单处理、订阅服务开通、歌曲生成、记录展示和必要的客服支持。管理员凭据、API 密钥及其他敏感配置必须通过服务器环境变量管理，不会在前端公开。',
              en: 'This information is used only for member authentication, order handling, subscription activation, song generation, record display, and necessary customer support. Admin credentials, API keys, and other sensitive settings must be managed through server environment variables and are not exposed on the frontend.',
            },
            {
              zh: '如后续接入正式数据库与备份系统，我们会继续按最小权限原则保护会员和订单数据。',
              en: 'As the site moves to a production database and backup system, member and order data will continue to be handled under a least-privilege approach.',
            },
          ],
        },
      ],
    },
    terms: {
      active: 'legal_terms',
      title: { zh: '服务条款', en: 'Terms of Service' },
      subtitle: {
        zh: '说明会员使用网站、购买套餐和生成歌曲时需遵守的规则。',
        en: 'This page explains the rules that apply when members use the site, purchase plans, and generate songs.',
      },
      sections: [
        {
          heading: { zh: '服务范围', en: 'Scope of Service' },
          paragraphs: [
            {
              zh: 'MelodyVow 提供订阅式婚礼歌曲生成与会员账户服务，包括注册登录、套餐购买、服务额度开通、生成记录查看和后台订单管理。',
              en: 'MelodyVow provides subscription-based wedding song generation and member account services, including registration, login, plan purchases, service-credit activation, song history, and order administration.',
            },
            {
              zh: '所有生成结果都依赖第三方 AI 服务和网络环境，因此实际生成时间、音频风格和交付速度可能存在差异。',
              en: 'All generated results depend on third-party AI services and network conditions, so actual completion time, audio style, and fulfillment speed may vary.',
            },
          ],
        },
        {
          heading: { zh: '用户责任', en: 'User Responsibilities' },
          paragraphs: [
            {
              zh: '会员应确保提交的信息真实、合法，并妥善保管自己的登录邮箱与密码。不得使用本服务从事违法、侵权、欺诈或滥用支付流程的行为。',
              en: 'Members must provide lawful information and keep their login email and password secure. The service may not be used for illegal, infringing, fraudulent, or abusive payment-related activity.',
            },
            {
              zh: '如果网站发现账户被滥用、支付存在异常或订单存在高风险，管理员有权暂时冻结相关权益并进行人工复核。',
              en: 'If the site detects account abuse, suspicious payment behavior, or high-risk orders, the administrator may temporarily hold related entitlements for manual review.',
            },
          ],
        },
      ],
    },
    refund: {
      active: 'legal_refund',
      title: { zh: '退款政策', en: 'Refund Policy' },
      subtitle: {
        zh: '说明订阅服务、服务额度与歌曲生成相关的退款处理原则。',
        en: 'This page explains the refund rules for subscription services, service credits, and song generation requests.',
      },
      sections: [
        {
          heading: { zh: '可退款场景', en: 'Refund Scenarios' },
          paragraphs: [
            {
              zh: '若用户已付款但网站未按订单向会员账户开通对应订阅服务额度，或支付记录存在重复扣款、明显异常，经核实后可由管理员处理退款或服务补发。',
              en: 'If payment is completed but the purchased subscription service credits are not activated correctly, or if duplicate or clearly abnormal charges are verified, the administrator may issue a refund or restore the missing service entitlement.',
            },
            {
              zh: '若歌曲生成流程在系统侧失败，本次扣除的服务额度会自动退回会员账户，这属于站内服务回退，不需要用户重复申请。',
              en: 'If song generation fails on the system side, the consumed service credits are automatically returned to the member account. This is handled as an on-site service reversal and does not require a separate request.',
            },
          ],
        },
        {
          heading: { zh: '不适用场景', en: 'Non-Refundable Cases' },
          paragraphs: [
            {
              zh: '对于已经成功交付并可正常使用的订阅服务、已成功生成并可访问的歌曲内容，原则上不支持因个人主观偏好发起退款。',
              en: 'For subscription services that have already been delivered and used normally, or songs that have been successfully generated and accessed, refunds are generally not available based on personal preference alone.',
            },
            {
              zh: '如订单已经触发退款或取消流程，网站会同步回收该订单已开通的服务额度；若账户余额不足以回收，订单可能被暂时锁定，等待人工处理。',
              en: 'If an order enters a refund or cancellation flow, the service credits activated by that order will be reclaimed. If the current balance is insufficient for reclamation, the order may be temporarily held for manual handling.',
            },
          ],
        },
      ],
    },
    cancellation: {
      active: 'legal_cancellation',
      title: { zh: '取消政策', en: 'Cancellation Policy' },
      subtitle: {
        zh: '说明下单后取消、支付未完成以及会员权益回收的处理方式。',
        en: 'This page explains how cancellations, unpaid orders, and entitlement reversals are handled.',
      },
      sections: [
        {
          heading: { zh: '订单取消', en: 'Order Cancellation' },
          paragraphs: [
            {
              zh: '如果订单尚未完成付款确认，管理员可将订单维持为 pending、processing 或直接标记为 cancelled，未生效订单不会为会员开通服务额度。',
              en: 'If payment has not been confirmed, an order may remain pending, stay in processing, or be marked cancelled. Orders that never become effective do not activate service credits.',
            },
            {
              zh: '如果订单已经被确认为 paid，但后续发生取消或退款，网站会按订单记录回收此前开通的服务额度，以保持会员权益与订单状态一致。',
              en: 'If an order was already marked paid and is later cancelled or refunded, the site reclaims the service credits granted by that order to keep account entitlements aligned with order status.',
            },
          ],
        },
        {
          heading: { zh: '会员取消与后续购买', en: 'Account Cancellation and Future Purchases' },
          paragraphs: [
            {
              zh: '当前网站的会员模式以订阅套餐和站内服务额度消耗为主，不属于钱包储值。若后续增加自动续费功能，取消方式会在订阅页和本页同步更新。',
              en: 'The current membership model focuses on subscription plans and on-site service-credit usage rather than a stored-value wallet. If auto-renewing plans are added later, the cancellation steps will be updated on both the pricing page and this page.',
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

  const current = policyContent[policy]
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
    case 'legal_delivery':
      return '/delivery-fulfillment'
    case 'legal_privacy':
      return '/privacy-policy'
    case 'legal_terms':
      return '/terms-of-service'
    case 'legal_refund':
      return '/refund-policy'
    case 'legal_cancellation':
      return '/cancellation-policy'
    case 'legal_find_order':
      return '/find-my-order'
    default:
      return ''
  }
}

export default App
