import { useEffect, useRef, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
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

type HistoryItem = {
  id: string
  title: string
  subtitle: string
  status: string
  action: string
  audioUrl?: string
  downloadUrl?: string
  createdAt?: string
  languageLabel?: string
  styleLabel?: string
  vocalLabel?: string
  lyricSnippet?: string
}

type AuthSession = {
  email: string
  partnerName: string
  plan: string
  mode: 'login' | 'signup'
  welcomeMessage: string
  lastAuthAt: string
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
  title: string
  couple: string
  languageLabel: string
  styleLabel: string
  vocalLabel: string
  status: string
  createdAt: string
  updatedAt: string
  audioUrl?: string
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
  notes: string
}

type LayoutProps = {
  locale: Locale
  title: string
  subtitle: string
  eyebrow: string
  active: string
  onOpenModal: (message: string) => void
  homePanel?: ReactNode
  hideHero?: boolean
  children: ReactNode
}

type HomePageProps = {
  locale: Locale
  draft: SongDraft
  setDraft: Dispatch<SetStateAction<SongDraft>>
  onOpenModal: (message: string) => void
  authSession: AuthSession | null
}

type StylesPageProps = {
  locale: Locale
  draft: SongDraft
  setDraft: Dispatch<SetStateAction<SongDraft>>
}

type PreviewPageProps = {
  locale: Locale
  draft: SongDraft
  onSaveHistory: (item: HistoryItem) => void
}

type PricingPageProps = {
  locale: Locale
  selectedPlan: string
  setSelectedPlan: Dispatch<SetStateAction<string>>
}

type AuthPageProps = {
  locale: Locale
  draft: SongDraft
  selectedPlan: string
  onOpenModal: (message: string) => void
  onAuthSuccess: (session: AuthSession) => void
}

type AccountPageProps = {
  locale: Locale
  selectedPlan: string
  onOpenModal: (message: string) => void
  history: HistoryItem[]
  authSession: AuthSession | null
}

type CompletePageProps = {
  locale: Locale
  draft: SongDraft
  onOpenModal: (message: string) => void
}

type ShowcasePageProps = {
  locale: Locale
}

type ShowcaseTrack = {
  id: string
  title: Copy
  meta: Copy
  blurb: Copy
  audioUrl: string
}

const SONG_HISTORY_KEY = 'melodyvow-song-history'
const AUTH_SESSION_KEY = 'melodyvow-auth-session'
const ADMIN_SESSION_KEY = 'melodyvow-admin-session'
const HOME_FIREWORK_COLORS = ['#ff4e88', '#ffb657', '#fff07c', '#73f2ff', '#9c7bff', '#ffffff']
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function apiUrl(path: string) {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
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
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : []
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

  return path || '/'
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
    groom: '浩',
    bride: '欣',
    occasion: 'wedding',
    languageCode: 'zh',
    languageLabel: 'Chinese Mandarin',
    style: 'soft_pop',
    vocal: 'female',
    vocalLabel: 'Female Vocal',
    loveStory: '',
    meetingStory: '',
    vowKeywords: '',
  })
  const [selectedPlan, setSelectedPlan] = useState('Pro')
  const [modalMessage, setModalMessage] = useState('')
  const [songHistory, setSongHistory] = useState<HistoryItem[]>(() => loadSongHistory())
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => loadAuthSession())
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => loadAdminSession())
  const modalLocale: Locale = location.pathname.startsWith('/en') ? 'en' : 'zh'

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
    if (!authSession?.email) {
      return
    }

    let disposed = false

    const loadMemberSongs = async () => {
      try {
        const response = await fetch(apiUrl(`/api/member/songs?email=${encodeURIComponent(authSession.email)}`))
        const data = (await response.json()) as { items?: HistoryItem[]; message?: string }

        if (!response.ok) {
          throw new Error(data.message || '会员歌单加载失败。')
        }

        if (!disposed && Array.isArray(data.items)) {
          setSongHistory(data.items)
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
  }, [authSession])

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
    setAuthSession(session)
  }

  function handleAdminLogin(session: AdminSession) {
    setAdminSession(session)
  }

  function handleAdminLogout() {
    setAdminSession(null)
  }

  return (
    <>
      <ScrollManager />

      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              locale="zh"
              draft={draft}
              setDraft={setDraft}
              onOpenModal={setModalMessage}
              authSession={authSession}
            />
          }
        />
        <Route
          path="/how-it-works"
          element={<ShowcasePage locale="zh" />}
        />
        <Route
          path="/styles"
          element={
            <StylesPage locale="zh" draft={draft} setDraft={setDraft} />
          }
        />
        <Route path="/preview" element={<PreviewPage locale="zh" draft={draft} onSaveHistory={saveHistory} />} />
        <Route
          path="/pricing"
          element={
            <PricingPage
              locale="zh"
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
            />
          }
        />
        <Route
          path="/auth"
          element={
            <AuthPage
              locale="zh"
              draft={draft}
              selectedPlan={selectedPlan}
              onOpenModal={setModalMessage}
              onAuthSuccess={handleAuthSuccess}
            />
          }
        />
        <Route
          path="/account"
          element={
            <AccountPage
              locale="zh"
              selectedPlan={selectedPlan}
              onOpenModal={setModalMessage}
              history={songHistory}
              authSession={authSession}
            />
          }
        />
        <Route
          path="/complete"
          element={
            <CompletePage
              locale="zh"
              draft={draft}
              onOpenModal={setModalMessage}
            />
          }
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
              authSession={authSession}
            />
          }
        />
        <Route
          path="/en/how-it-works"
          element={<ShowcasePage locale="en" />}
        />
        <Route
          path="/en/styles"
          element={
            <StylesPage locale="en" draft={draft} setDraft={setDraft} />
          }
        />
        <Route
          path="/en/preview"
          element={<PreviewPage locale="en" draft={draft} onSaveHistory={saveHistory} />}
        />
        <Route
          path="/en/pricing"
          element={
            <PricingPage
              locale="en"
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
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
              authSession={authSession}
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
            />
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
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
    </>
  )
}

function SiteLayout({
  locale,
  title,
  subtitle,
  eyebrow,
  active,
  onOpenModal: _onOpenModal,
  homePanel,
  hideHero = false,
  children,
}: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

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
      label: copy(locale, { zh: '登录会员', en: 'Account' }),
      to: withLocale(locale, '/auth'),
    },
  ]

  return (
    <div className="site-shell" data-locale={locale}>
      <div className="site-gradient" />
      <div className="site-noise" />
      <img className="float image-float float-note left-top" src={noteImage} alt="" />
      <img className="float image-float float-ribbon right-top" src={pinkRibbonImage} alt="" />
      <img className="float image-float float-heart right-mid" src={pinkHeartImage} alt="" />
      <img className="float image-float float-ribbon left-mid pink" src={tealRibbonImage} alt="" />

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
          <button
            type="button"
            className="primary-button header-cta"
            onClick={() => navigate(withLocale(locale, '/pricing'))}
          >
            {copy(locale, { zh: '升级套餐', en: 'Upgrade' })}
          </button>
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

function HomePage({ locale, draft, setDraft, onOpenModal, authSession }: HomePageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => launchHomepageFireworks(), [])

  async function handleGenerateSong() {
    setSubmitError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(apiUrl('/api/generate-song'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groom: draft.groom,
          bride: draft.bride,
          userEmail: authSession?.email || '',
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

      const result = (await response.json()) as { jobId?: string; message?: string }

      if (!response.ok || !result.jobId) {
        throw new Error(result.message ?? '生成请求失败，请稍后再试。')
      }

      navigate(`${withLocale(locale, '/preview')}?job=${result.jobId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成请求失败，请稍后再试。'
      setSubmitError(message)
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
                      languageLabel: selected?.label ?? current.languageLabel,
                    }
                  })
                }
              >
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
                    vocalLabel: getVocalLabel(locale, event.target.value),
                  }))
                }
              >
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
            disabled={isSubmitting}
          >
            {isSubmitting
              ? copy(locale, { zh: '正在生成歌词与歌曲...', en: 'Generating lyrics and song...' })
              : copy(locale, { zh: '开始生成婚礼歌', en: 'Create My Song' })}
          </button>

          {submitError ? <p className="form-error">{submitError}</p> : null}
        </section>
      )}
    >
      <></>
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

function ShowcasePage({ locale }: ShowcasePageProps) {
  const navigate = useNavigate()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [activeTrackId, setActiveTrackId] = useState(productShowcaseTracks[0]?.id ?? '')
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  const [shouldAutoplay, setShouldAutoplay] = useState(false)
  const activeTrack = productShowcaseTracks.find((track) => track.id === activeTrackId) ?? productShowcaseTracks[0]

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0)
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

    const handleError = () => {
      setError(
        copy(locale, {
          zh: '样片音频暂时无法播放，请稍后再试或更换样片地址。',
          en: 'The sample audio is unavailable right now. Please try again later.',
        }),
      )
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [locale])

  useEffect(() => {
    const audio = audioRef.current

    if (!audio || !activeTrack) {
      return
    }

    setError('')
    setPlaying(false)
    setProgress(0)
    setCurrentTime(0)
    setDuration(0)
    audio.src = activeTrack.audioUrl
    audio.load()

    if (!shouldAutoplay) {
      return
    }

    const playSelectedTrack = async () => {
      try {
        await audio.play()
      } catch {
        setError(
          copy(locale, {
            zh: '浏览器拦截了自动播放，请再点击一次播放按钮。',
            en: 'Autoplay was blocked by the browser. Please press play again.',
          }),
        )
      } finally {
        setShouldAutoplay(false)
      }
    }

    void playSelectedTrack()
  }, [activeTrack, locale, shouldAutoplay])

  function handleSelectTrack(trackId: string) {
    if (trackId === activeTrackId) {
      void togglePlayback()
      return
    }

    setActiveTrackId(trackId)
    setShouldAutoplay(true)
  }

  async function togglePlayback() {
    const audio = audioRef.current

    if (!audio || !activeTrack?.audioUrl) {
      return
    }

    if (audio.paused) {
      try {
        setError('')
        await audio.play()
      } catch {
        setError(
          copy(locale, {
            zh: '当前样片无法播放，请稍后再试。',
            en: 'This sample cannot be played right now. Please try again later.',
          }),
        )
      }
      return
    }

    audio.pause()
  }

  function seekBy(deltaSeconds: number) {
    const audio = audioRef.current

    if (!audio || !audio.duration) {
      return
    }

    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + deltaSeconds))
  }

  function updateProgress(nextProgress: number) {
    const audio = audioRef.current

    setProgress(nextProgress)

    if (!audio || !audio.duration) {
      return
    }

    audio.currentTime = (nextProgress / 100) * audio.duration
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
      hideHero
    >
      <section className="showcase-layout">
        <article className="glass-panel player-panel showcase-player-panel">
          <div className="vinyl-stage">
            <img className="vinyl-record" src={recordImage} alt="" />
            <img className="vinyl-record vinyl-record-secondary" src={recordImage} alt="" />
            <img className="vinyl-stage-couple" src={coupleImage} alt="" />
            <img className="vinyl-stage-heart" src={pinkHeartImage} alt="" />
            <img className="vinyl-stage-note" src={noteImage} alt="" />
            <div className={`record-center ${playing ? 'is-playing' : ''}`}>
              <span>{activeTrack ? copy(locale, activeTrack.title) : 'MelodyVow'}</span>
            </div>
          </div>

          <audio ref={audioRef} preload="metadata" />

          {error ? <p className="form-error">{error}</p> : null}

          <div className="player-now-playing">
            <div>
              <p className="mini-eyebrow">{copy(locale, { zh: '产品展示', en: 'Showcase' })}</p>
              <h3>{activeTrack ? copy(locale, activeTrack.title) : 'MelodyVow'}</h3>
              <p>{activeTrack ? copy(locale, activeTrack.meta) : ''}</p>
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
              disabled={!activeTrack?.audioUrl}
            />
            <span>{formatDuration(duration)}</span>
          </div>

          <div className="player-controls">
            <button type="button" className="icon-button" onClick={() => updateProgress(0)} disabled={!activeTrack?.audioUrl}>
              ↺
            </button>
            <button type="button" className="icon-button" onClick={() => seekBy(-10)} disabled={!activeTrack?.audioUrl}>
              ⏮
            </button>
            <button type="button" className="play-button" onClick={() => void togglePlayback()} disabled={!activeTrack?.audioUrl}>
              {playing ? '❚❚' : '▶'}
            </button>
            <button type="button" className="icon-button" onClick={() => seekBy(10)} disabled={!activeTrack?.audioUrl}>
              ⏭
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => window.open(activeTrack?.audioUrl || '', '_blank', 'noopener,noreferrer')}
              disabled={!activeTrack?.audioUrl}
            >
              ♡
            </button>
          </div>
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
            {productShowcaseTracks.map((track, index) => {
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
                  <div className={`showcase-track-icon ${isActive && playing ? 'is-playing' : ''}`}>
                    {isActive && playing ? '❚❚' : '▶'}
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

function StylesPage({ locale, draft, setDraft }: StylesPageProps) {
  return (
    <SiteLayout
      locale={locale}
      title=""
      subtitle=""
      eyebrow="MelodyVow"
      active="styles"
      onOpenModal={() => undefined}
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
              onClick={() => setDraft((current) => ({ ...current, style: card.id }))}
            >
              {copy(locale, { zh: '选择曲风', en: 'Select Style' })}
            </button>
          </article>
        ))}
      </section>
    </SiteLayout>
  )
}

function PreviewPage({ locale, draft, onSaveHistory }: PreviewPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [job, setJob] = useState<SongJob | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [autoplayNotice, setAutoplayNotice] = useState('')
  const params = new URLSearchParams(location.search)
  const jobId = params.get('job')
  const activeJob = jobId ? job : null
  const primaryTrack = activeJob?.tracks[0] ?? null
  const primaryTrackPlaybackUrl = primaryTrack?.downloadUrl || primaryTrack?.audioUrl || ''
  const duration = primaryTrack?.duration ?? 0
  const displayedTitle = activeJob?.title ?? 'MelodyVow'
  const displayedLyrics = activeJob?.lyrics
    ?? (locale === 'zh'
      ? 'DeepSeek 生成的歌词会显示在这里。\nSuno 回调完成后，歌曲会自动尝试播放。'
      : 'Lyrics from DeepSeek will appear here.\nOnce Suno finishes the callback, the song will try to autoplay.')

  useEffect(() => {
    if (!activeJob || activeJob.status !== 'ready' || !primaryTrack) {
      return
    }

    onSaveHistory({
      id: activeJob.id,
      title: activeJob.title ?? displayedTitle,
      subtitle: summarizeStoryText(
        draft.loveStory || draft.meetingStory,
        copy(locale, {
          zh: `${draft.groom} & ${draft.bride} 的婚礼歌`,
          en: `${draft.groom} & ${draft.bride}'s wedding song`,
        }),
      ),
      status: copy(locale, { zh: '已生成', en: 'Ready' }),
      action: copy(locale, { zh: '播放', en: 'Play' }),
      audioUrl: primaryTrackPlaybackUrl,
      downloadUrl: primaryTrack?.downloadUrl || primaryTrackPlaybackUrl,
      createdAt: activeJob.updatedAt,
      languageLabel: draft.languageLabel,
      styleLabel: getStyleLabel(locale, draft.style),
      vocalLabel: getVocalLabel(locale, draft.vocal),
      lyricSnippet: summarizeStoryText(activeJob.lyrics ?? '', ''),
    })
  }, [activeJob, displayedTitle, draft, locale, onSaveHistory, primaryTrack, primaryTrackPlaybackUrl])

  async function loadJob(currentJobId: string) {
    const response = await fetch(apiUrl(`/api/jobs/${currentJobId}`))
    const data = (await response.json()) as SongJob | { message?: string }

    if (!response.ok) {
      throw new Error('message' in data && data.message ? data.message : '任务查询失败。')
    }

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
    const audio = audioRef.current

    if (!audio || !primaryTrackPlaybackUrl) {
      return
    }

    audio.src = primaryTrackPlaybackUrl
    audio.load()

    const tryAutoplay = async () => {
      try {
        await audio.play()
        setPlaying(true)
        setAutoplayNotice(
          copy(locale, {
            zh: '歌曲已生成，已开始自动播放。',
            en: 'The song is ready and autoplay has started.',
          }),
        )
      } catch {
        setAutoplayNotice(
          copy(locale, {
            zh: '歌曲已生成，但浏览器拦截了自动播放，请点击播放按钮。',
            en: 'The song is ready, but autoplay was blocked by the browser. Please press play.',
          }),
        )
      }
    }

    void tryAutoplay()
  }, [locale, primaryTrackPlaybackUrl])

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)

      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    }

    const handleEnded = () => {
      setPlaying(false)
      setProgress(100)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  function togglePlayback() {
    const audio = audioRef.current

    if (!audio || !primaryTrackPlaybackUrl) {
      return
    }

    if (audio.paused) {
      void audio.play()
      setPlaying(true)
      return
    }

    audio.pause()
    setPlaying(false)
  }

  function seekBy(deltaSeconds: number) {
    const audio = audioRef.current

    if (!audio || !audio.duration) {
      return
    }

    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + deltaSeconds))
  }

  function updateProgress(nextProgress: number) {
    const audio = audioRef.current

    setProgress(nextProgress)

    if (!audio || !audio.duration) {
      return
    }

    audio.currentTime = (nextProgress / 100) * audio.duration
  }

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
    >
      <section className="preview-layout">
        <article className="glass-panel player-panel">
          <div className="vinyl-stage">
            <img className="vinyl-record" src={recordImage} alt="" />
            <img className="vinyl-record vinyl-record-secondary" src={recordImage} alt="" />
            <img className="vinyl-stage-couple" src={coupleImage} alt="" />
            <img className="vinyl-stage-heart" src={pinkHeartImage} alt="" />
            <img className="vinyl-stage-note" src={noteImage} alt="" />
            <div className={`record-center ${playing ? 'is-playing' : ''}`}>
              <span>{displayedTitle}</span>
            </div>
          </div>

          <audio ref={audioRef} preload="auto" />

          {activeJob ? (
            <div className={`status-banner is-${activeJob.status}`}>
              {getJobStatusLabel(locale, activeJob.status, activeJob.callbackEnabled)}
            </div>
          ) : null}

          {autoplayNotice ? <p className="autoplay-notice">{autoplayNotice}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {!jobId ? (
            <p className="empty-state">
              {copy(locale, {
                zh: '请先回到首页填写名字、语言、曲风和声音，再开始真实生成。',
                en: 'Go back to the homepage, fill in the names, language, style and voice, then start a real generation.',
              })}
            </p>
          ) : null}

          <div className="player-now-playing">
            <div>
              <p className="mini-eyebrow">{copy(locale, { zh: '正在播放', en: 'Now Playing' })}</p>
              <h3>{displayedTitle}</h3>
              <p>
                {copy(locale, {
                  zh: `${draft.groom} & ${draft.bride} · ${getStyleLabel(locale, draft.style)} · ${getVocalLabel(locale, draft.vocal)}`,
                  en: `${draft.groom} & ${draft.bride} · ${getStyleLabel(locale, draft.style)} · ${getVocalLabel(locale, draft.vocal)}`,
                })}
              </p>
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
              disabled={!primaryTrackPlaybackUrl}
            />
            <span>{formatDuration(duration)}</span>
          </div>

          <div className="player-controls">
            <button type="button" className="icon-button" onClick={() => updateProgress(0)} disabled={!primaryTrackPlaybackUrl}>
              ↺
            </button>
            <button type="button" className="icon-button" onClick={() => seekBy(-10)} disabled={!primaryTrackPlaybackUrl}>
              ⏮
            </button>
            <button type="button" className="play-button" onClick={togglePlayback} disabled={!primaryTrackPlaybackUrl}>
              {playing ? '❚❚' : '▶'}
            </button>
            <button type="button" className="icon-button" onClick={() => seekBy(10)} disabled={!primaryTrackPlaybackUrl}>
              ⏭
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => window.open(primaryTrack?.downloadUrl || primaryTrack?.audioUrl || '', '_blank', 'noopener,noreferrer')}
              disabled={!primaryTrackPlaybackUrl}
            >
              ♡
            </button>
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
            onClick={() => navigate(primaryTrack?.audioUrl ? withLocale(locale, '/complete') : withLocale(locale))}
          >
            {primaryTrack?.audioUrl
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

function PricingPage({ locale, selectedPlan, setSelectedPlan }: PricingPageProps) {
  const navigate = useNavigate()

  const plans = locale === 'zh'
    ? [
        { name: 'Starter', price: '¥89', desc: ['5 次生成', 'AI 歌词', '名字入歌', 'MP3 下载'] },
        { name: 'Pro', price: '¥199', desc: ['完整歌词', '婚礼版本', '高清音频', '适合现场播放'], badge: '推荐' },
        { name: 'Premium', price: '¥499', desc: ['真人演唱', '高级编曲', '双版本混音', 'USB 礼盒'] },
      ]
    : [
        { name: 'Starter', price: '¥89', desc: ['5 previews', 'AI lyrics', 'Names in song', 'MP3 download'] },
        { name: 'Pro', price: '¥199', desc: ['Full lyrics', 'Wedding version', 'HD audio', 'Most balanced choice'], badge: 'Recommended' },
        { name: 'Premium', price: '¥499', desc: ['Real singer', 'Custom arrangement', 'Dual mix', 'Gift-box delivery'] },
      ]

  return (
    <SiteLayout
      locale={locale}
      title=""
      subtitle=""
      eyebrow="MelodyVow"
      active="pricing"
      onOpenModal={() => undefined}
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
            <div className="price-tag">{plan.price}</div>
            <ul>
              {plan.desc.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button
              type="button"
              className="primary-button compact"
              onClick={() => setSelectedPlan(plan.name)}
            >
              {copy(locale, { zh: '选择此套餐', en: 'Choose This Plan' })}
            </button>
          </article>
        ))}
      </section>

      <section className="glass-panel recommendation-bar">
        <p>
          {copy(locale, {
            zh: `当前建议：${selectedPlan}。如果你还不确定，先从 Pro 开始，试听满意后再升级。`,
            en: `Current recommendation: ${selectedPlan}. Start with Pro and upgrade after preview if needed.`,
          })}
        </p>
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate(withLocale(locale, '/auth'))}
        >
          {copy(locale, { zh: '继续下单', en: 'Continue to Account' })}
        </button>
      </section>

    </SiteLayout>
  )
}

function AuthPage({ locale, draft, selectedPlan, onOpenModal, onAuthSuccess }: AuthPageProps) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [partnerName, setPartnerName] = useState(draft.bride)
  const [authError, setAuthError] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [captchaChallenge, setCaptchaChallenge] = useState(createCaptchaChallenge)

  function refreshCaptcha() {
    setCaptchaChallenge(createCaptchaChallenge())
    setCaptchaInput('')
  }

  function handleAuthSubmit() {
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

    onAuthSuccess({
      email: email.trim(),
      partnerName: normalizedPartnerName,
      plan: selectedPlan,
      mode: tab,
      welcomeMessage: successMessage,
      lastAuthAt: new Date().toISOString(),
    })

    onOpenModal(
      successMessage,
    )
    refreshCaptcha()
    navigate(withLocale(locale, '/account'))
  }

  return (
    <SiteLayout
      locale={locale}
      title=""
      subtitle=""
      eyebrow="MelodyVow"
      active="account"
      onOpenModal={onOpenModal}
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
            onClick={handleAuthSubmit}
          >
            {tab === 'login'
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

function AccountPage({ locale, selectedPlan, onOpenModal, history, authSession }: AccountPageProps) {
  const menuItems = locale === 'zh'
    ? ['继续创作', '收藏夹', '最近生成', '账号设置', '帮助支持']
    : ['Continue', 'Favorites', 'Recent Generations', 'Account Settings', 'Support']
  const displayName = authSession?.partnerName
    ? `${authSession.partnerName} & MelodyVow`
    : locale === 'zh'
      ? 'Hao & Xin'
      : 'Hao & Xin'
  const memberLabel = authSession?.email ?? copy(locale, { zh: '未登录访客', en: 'Guest User' })
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

  return (
    <SiteLayout
      locale={locale}
      title={copy(locale, { zh: '我的婚礼歌曲', en: 'My Wedding Songs' })}
      subtitle={copy(locale, {
        zh: '管理你的专属婚礼歌曲、歌词和音频文件',
        en: 'Manage your custom wedding songs, lyrics and audio files.',
      })}
      eyebrow="MelodyVow"
      active="account"
      onOpenModal={onOpenModal}
    >
      <section className="glass-panel profile-strip">
        <div className="avatar-circle">{(authSession?.email?.[0] ?? 'M').toUpperCase()}</div>
        <div>
          <h3>{displayName}</h3>
          <p className="profile-email">{memberLabel}</p>
          <div className="tag-row">
            <span className="soft-pill accent">{selectedPlan} Member</span>
            {authTime ? (
              <span className="soft-pill">{copy(locale, { zh: `最近验证 ${authTime}`, en: `Verified ${authTime}` })}</span>
            ) : null}
          </div>
        </div>
        <button type="button" className="primary-button compact">
          {copy(locale, { zh: '升级至高级版', en: 'Upgrade to Premium' })}
        </button>
      </section>

      <section className="glass-card welcome-card">
        <div className="welcome-copy">
          <p className="mini-eyebrow">{welcomeTitle}</p>
          <h3>{copy(locale, { zh: '会员中心已为你准备好', en: 'Your Member Dashboard Is Ready' })}</h3>
          <p>{welcomeCopy}</p>
        </div>
        <div className="welcome-metrics">
          <div className="metric-chip">
            <strong>{history.length}</strong>
            <span>{copy(locale, { zh: '首生成品', en: 'Songs Saved' })}</span>
          </div>
          <div className="metric-chip">
            <strong>{selectedPlan}</strong>
            <span>{copy(locale, { zh: '当前套餐', en: 'Current Plan' })}</span>
          </div>
        </div>
      </section>

      <section className="history-layout">
        <div className="history-list">
          {history.length === 0 ? (
            <article className="glass-card history-card empty-history-card">
              <div className="history-copy">
                <span className="step-badge">0</span>
                <h3>{copy(locale, { zh: '还没有生成记录', en: 'No Songs Yet' })}</h3>
                <p>
                  {copy(locale, {
                    zh: '去首页填写你们的名字、故事和风格，生成后的歌单会自动出现在这里。',
                    en: 'Go to the homepage and create your first song. Completed generations will appear here automatically.',
                  })}
                </p>
              </div>
            </article>
          ) : null}
          {history.map((item, index) => (
            <article key={item.id} className="glass-card history-card">
              <div className="cover-art small">
                <img className="cover-disc" src={recordImage} alt="" />
                <img className="cover-couple" src={coupleImage} alt="" />
              </div>
              <div className="history-copy">
                <span className="step-badge">{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
                <div className="status-row">
                  <span>{item.status}</span>
                  <span>{item.languageLabel ?? ''}</span>
                  <span>{item.styleLabel ?? ''}</span>
                </div>
                {item.vocalLabel ? <p>{item.vocalLabel}</p> : null}
                {item.lyricSnippet ? <p>{item.lyricSnippet}</p> : null}
              </div>
              <button
                type="button"
                className="primary-button compact"
                onClick={() => {
                  if (item.downloadUrl || item.audioUrl) {
                    window.open(item.downloadUrl || item.audioUrl || '', '_blank', 'noopener,noreferrer')
                    return
                  }

                  onOpenModal(
                    copy(locale, {
                      zh: `${item.action}功能已保留接口，可接入真实音频文件和订单记录。`,
                      en: `${item.action} is prepared for real file delivery and order records.`,
                    }),
                  )
                }}
              >
                {item.downloadUrl || item.audioUrl
                  ? copy(locale, { zh: '下载音频', en: 'Download Audio' })
                  : item.action}
              </button>
            </article>
          ))}
        </div>

        <aside className="glass-card side-menu">
          {menuItems.map((item) => (
            <button key={item} type="button" className="ghost-button menu-item">
              {item}
            </button>
          ))}
        </aside>
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
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
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

      const result = (await response.json()) as AdminSession | { message?: string }

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
        <p className="admin-subtitle">先用本地管理账号登录，后面可以替换成真实后台权限系统。</p>
        <div className="form-grid single">
          <label className="field">
            <span>后台账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" />
          </label>
          <label className="field">
            <span>后台密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="admin123"
            />
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="button" className="primary-button wide" onClick={() => void handleSubmit()} disabled={isSubmitting}>
          {isSubmitting ? '登录中...' : '进入后台'}
        </button>
        <p className="admin-tip">当前本地默认账号：`admin` / `admin123`，后续可通过服务端环境变量覆盖。</p>
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
  const [tab, setTab] = useState<'overview' | 'songs' | 'orders' | 'config'>('overview')
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
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [selectedSong, setSelectedSong] = useState<AdminSong | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [config, setConfig] = useState<AdminConfig>({
    deepseekProvider: '',
    sunoProvider: '',
    publicBaseUrl: '',
    allowSignup: true,
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

        const [overviewRes, songsRes, ordersRes, configRes] = await Promise.all([
          fetch(apiUrl('/api/admin/overview'), { headers }),
          fetch(apiUrl('/api/admin/songs'), { headers }),
          fetch(apiUrl('/api/admin/orders'), { headers }),
          fetch(apiUrl('/api/admin/config'), { headers }),
        ])

        const [overviewData, songsData, ordersData, configData] = await Promise.all([
          overviewRes.json(),
          songsRes.json(),
          ordersRes.json(),
          configRes.json(),
        ])

        if ([overviewRes, songsRes, ordersRes, configRes].some((item) => !item.ok)) {
          const message = overviewData.message || songsData.message || ordersData.message || configData.message || '后台数据加载失败。'
          throw new Error(message)
        }

        if (!disposed) {
          setMetrics(overviewData.metrics)
          const nextSongs = Array.isArray(songsData.items) ? songsData.items : []
          const nextOrders = Array.isArray(ordersData.items) ? ordersData.items : []
          setSongs(nextSongs)
          setOrders(nextOrders)
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

      const result = (await response.json()) as AdminConfig | { message?: string }
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
      const result = (await response.json()) as AdminSong | { message?: string }
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
      const result = (await response.json()) as AdminOrder | { message?: string }
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
      const result = (await response.json()) as AdminOrder | { message?: string }
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

  const tabs = [
    { key: 'overview', label: '总览' },
    { key: 'songs', label: '歌曲记录' },
    { key: 'orders', label: '订单' },
    { key: 'config', label: '配置' },
  ] as const

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
                        <p>{item.couple}</p>
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
                    <p><strong>标题：</strong>{selectedSong.title}</p>
                    <p><strong>新人：</strong>{selectedSong.couple}</p>
                    <p><strong>语言：</strong>{selectedSong.languageLabel}</p>
                    <p><strong>曲风：</strong>{selectedSong.styleLabel}</p>
                    <p><strong>声音：</strong>{selectedSong.vocalLabel}</p>
                    <p><strong>错误信息：</strong>{selectedSong.error || '无'}</p>
                    <p><strong>爱情故事：</strong>{selectedSong.story?.loveStory || '未填写'}</p>
                    <p><strong>相识经历：</strong>{selectedSong.story?.meetingStory || '未填写'}</p>
                    <p><strong>誓言关键词：</strong>{selectedSong.story?.vowKeywords || '未填写'}</p>
                    <div className="admin-lyrics-box">
                      <strong>歌词</strong>
                      <p>{selectedSong.lyrics || selectedSong.lyricSnippet || '暂无歌词内容。'}</p>
                    </div>
                    {selectedSong.audioUrl ? (
                      <button type="button" className="primary-button compact" onClick={() => window.open(selectedSong.audioUrl, '_blank', 'noopener,noreferrer')}>
                        试听音频
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="empty-state">请选择一条歌曲记录查看详情。</p>
                )}
              </aside>
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
                        <p>{item.couple}</p>
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
                <label className="field form-span-2">
                  <span>后台备注</span>
                  <textarea
                    value={config.notes}
                    onChange={(event) => setConfig((current) => ({ ...current, notes: event.target.value }))}
                    rows={4}
                  />
                </label>
              </div>
              <label className="admin-switch">
                <input
                  type="checkbox"
                  checked={config.allowSignup}
                  onChange={(event) => setConfig((current) => ({ ...current, allowSignup: event.target.checked }))}
                />
                <span>允许前台用户注册</span>
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

function CompletePage({ locale, draft, onOpenModal }: CompletePageProps) {
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
    default:
      return ''
  }
}

export default App
