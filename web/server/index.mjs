import 'dotenv/config'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { getDatabaseConnectionString, PostgresPersistence } from './postgres-persistence.mjs'

const app = express()

const PORT = Number(process.env.PORT ?? 8787)
const DEEPSEEK_API_BASE = process.env.DEEPSEEK_API_BASE ?? 'https://api.deepseek.com/v1'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat'
const SUNO_MODEL = process.env.SUNO_MODEL ?? 'chirp-v4-5'
const SUNO_GENERATE_URL = process.env.SUNO_GENERATE_URL ?? 'https://api.wike.cc/api/suno/generate'
const SUNO_FEED_URL = process.env.SUNO_FEED_URL ?? 'https://api.wike.cc/api/suno/feed'
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '')
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN?.replace(/\/$/, '')
const STRIPE_SECRET_KEY = String(process.env.STRIPE_SECRET_KEY || '').trim()
const STRIPE_WEBHOOK_SECRET = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim()
const PAYPAL_CLIENT_ID = String(process.env.PAYPAL_CLIENT_ID || '').trim()
const PAYPAL_CLIENT_SECRET = String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
const PAYPAL_WEBHOOK_ID = String(process.env.PAYPAL_WEBHOOK_ID || '').trim()
const PAYPAL_MODE = String(process.env.PAYPAL_MODE || '').trim().toLowerCase() === 'live' ? 'live' : 'sandbox'
const JOB_TTL_MS = 1000 * 60 * 60 * 6
const POLL_INTERVAL_MS = Number(process.env.SUNO_POLL_INTERVAL_MS ?? 12000)
const MAX_POLL_ATTEMPTS = Number(process.env.SUNO_POLL_MAX_ATTEMPTS ?? 40)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const ADMIN_DATA_FILE = path.join(DATA_DIR, 'admin-data.json')
const DEBUG_ENV_FILE = path.join(process.cwd(), '.dbg', 'song-playback-regression.env')
const BACKGROUND_THEME_IDS = new Set(['vivid_rainbow', 'elegant_dark', 'soft_pink_gold', 'ocean_dream'])
const PLAN_TYPES = new Set(['subscription', 'credit_pack'])
const BILLING_INTERVALS = new Set(['month', 'year'])
const PAYMENT_PROVIDERS = new Set(['stripe_checkout', 'paypal', 'alipay'])
const CREDIT_BALANCE_TYPES = new Set(['subscription', 'topup'])
const WEBHOOK_EVENT_HISTORY_LIMIT = 5000
const CREDIT_LEDGER_LIMIT = 20000
const require = createRequire(import.meta.url)
let StripeModule = null
let stripe = null
let paypalAccessTokenCache = {
  token: '',
  expiresAt: 0,
}

const jobs = new Map()
const sunoTaskToJob = new Map()
const activePolls = new Set()
const adminSessions = new Map()
const memberSessions = new Map()
const lyricRequests = new Map()
const sunoTasks = new Map()

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

app.use((req, res, next) => {
  if (req.path === '/api/stripe/webhook') {
    express.raw({ type: 'application/json' })(req, res, next)
    return
  }

  express.json({ limit: '1mb' })(req, res, () => {
    express.urlencoded({ extended: true })(req, res, next)
  })
})
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

function normalizeBoolean(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeBackgroundTheme(value, fallback = 'vivid_rainbow') {
  const normalized = String(value || '').trim()
  return BACKGROUND_THEME_IDS.has(normalized) ? normalized : fallback
}

function normalizePlanType(value, fallback = 'subscription') {
  const normalized = String(value || '').trim().toLowerCase()
  return PLAN_TYPES.has(normalized) ? normalized : fallback
}

function normalizeBillingInterval(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return BILLING_INTERVALS.has(normalized) ? normalized : ''
}

function normalizePaymentProvider(value, fallback = 'paypal') {
  const normalized = String(value || '').trim().toLowerCase()
  return PAYMENT_PROVIDERS.has(normalized) ? normalized : fallback
}

function normalizePlanTypeList(value, fallback = ['credit_pack']) {
  const items = Array.isArray(value)
    ? value.map((item) => normalizePlanType(item, '')).filter(Boolean)
    : []

  return items.length ? Array.from(new Set(items)) : fallback
}

function normalizeCreditBalanceType(value, fallback = 'topup') {
  const normalized = String(value || '').trim().toLowerCase()
  return CREDIT_BALANCE_TYPES.has(normalized) ? normalized : fallback
}

function normalizePayPalCurrencyCode(value) {
  const normalized = String(value || '').trim().toUpperCase()

  // Current PayPal rollout for MelodyVow uses USD plans and USD checkout.
  // Older local data may still contain CNY, which causes PayPal order creation to fail.
  if (normalized === 'USD') {
    return 'USD'
  }

  return 'USD'
}

function getDefaultHeartBeansForPlan(input) {
  const key = `${String(input?.id || '').trim()} ${String(input?.name || '').trim()}`.toLowerCase()
  const type = normalizePlanType(input?.type, key.includes('topup') || key.includes('boost') || key.includes('pack') ? 'credit_pack' : 'subscription')

  if (type === 'credit_pack') {
    if (key.includes('boost') || key.includes('starter')) {
      return 5
    }

    if (key.includes('celebration') || key.includes('premium')) {
      return 40
    }

    if (key.includes('signature') || key.includes('pro')) {
      return 15
    }

    return 0
  }

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
        id: 'starter-monthly',
        name: 'Starter Monthly',
        price: 89,
        heartBeans: 5,
        type: 'subscription',
        billingInterval: 'month',
        stripePriceId: '',
        paypalPlanId: '',
        currency: 'USD',
        badge: '',
        features: ['每月自动续费', '每月发放 5 点订阅额度', 'AI 歌词生成', 'MP3 下载'],
      },
      {
        id: 'pro-monthly',
        name: 'Pro Monthly',
        price: 199,
        heartBeans: 15,
        type: 'subscription',
        billingInterval: 'month',
        stripePriceId: '',
        paypalPlanId: '',
        currency: 'USD',
        badge: '推荐',
        features: ['每月自动续费', '每月发放 15 点订阅额度', '完整歌词', '高清音频'],
      },
      {
        id: 'premium-monthly',
        name: 'Premium Monthly',
        price: 499,
        heartBeans: 40,
        type: 'subscription',
        billingInterval: 'month',
        stripePriceId: '',
        paypalPlanId: '',
        currency: 'USD',
        badge: '',
        features: ['每月自动续费', '每月发放 40 点订阅额度', '真人演唱', '双版本混音'],
      },
      {
        id: 'boost-5',
        name: 'Boost 5',
        price: 69,
        heartBeans: 5,
        type: 'credit_pack',
        billingInterval: '',
        stripePriceId: '',
        paypalPlanId: '',
        currency: 'USD',
        badge: '',
        features: ['一次性购买', '立即到账 5 点充值额度', '适合低频用户'],
      },
      {
        id: 'signature-15',
        name: 'Signature 15',
        price: 169,
        heartBeans: 15,
        type: 'credit_pack',
        billingInterval: '',
        stripePriceId: '',
        paypalPlanId: '',
        currency: 'USD',
        badge: '热门',
        features: ['一次性购买', '立即到账 15 点充值额度', '适合婚礼筹备期集中使用'],
      },
      {
        id: 'celebration-40',
        name: 'Celebration 40',
        price: 429,
        heartBeans: 40,
        type: 'credit_pack',
        billingInterval: '',
        stripePriceId: '',
        paypalPlanId: '',
        currency: 'USD',
        badge: '',
        features: ['一次性购买', '立即到账 40 点充值额度', '适合工作室或高频用户'],
      },
    ],
    showcaseTracks: productShowcaseTracks,
    paymentMethods: [
      {
        id: 'stripe_checkout',
        name: 'Stripe',
        enabled: true,
        provider: 'stripe_checkout',
        envKey: 'STRIPE_SECRET_KEY',
        supportedPlanTypes: ['subscription', 'credit_pack'],
        description: 'Stripe Checkout for subscriptions and top-ups',
      },
      {
        id: 'paypal',
        name: 'PayPal',
        enabled: true,
        provider: 'paypal',
        envKey: 'PAYPAL_CHECKOUT_URL',
        supportedPlanTypes: ['subscription', 'credit_pack'],
        description: 'PayPal Checkout & Subscriptions',
      },
      {
        id: 'alipay',
        name: '支付宝',
        enabled: false,
        provider: 'alipay',
        envKey: 'ALIPAY_CHECKOUT_URL',
        supportedPlanTypes: ['credit_pack'],
        description: 'Alipay payment link',
      },
    ],
    orders: [
      {
        id: 'ord-demo-001',
        couple: 'Hao & Xin',
        planId: 'pro-monthly',
        plan: 'Pro Monthly',
        planType: 'subscription',
        amount: 199,
        heartBeans: 15,
        creditsBalanceType: 'subscription',
        status: 'paid',
        email: 'hao@example.com',
        note: '婚礼开场曲，需提前交付伴奏版。',
        paymentMethod: 'stripe_checkout',
        mode: 'subscription',
        source: 'stripe',
        subscriptionCurrentPeriodEnd: nowIso(),
        createdAt: nowIso(),
      },
      {
        id: 'ord-demo-002',
        couple: 'Luna & Ethan',
        planId: 'signature-15',
        plan: 'Signature 15',
        planType: 'credit_pack',
        amount: 169,
        heartBeans: 15,
        creditsBalanceType: 'topup',
        status: 'processing',
        email: 'luna@example.com',
        note: '需要双语版本和 first dance mix。',
        paymentMethod: 'stripe_checkout',
        mode: 'payment',
        source: 'stripe',
        createdAt: nowIso(),
      },
    ],
    songs: [],
    creditLedger: [],
    processedStripeEvents: [],
    config: {
      deepseekProvider: 'DeepSeek',
      sunoProvider: 'Suno',
      publicBaseUrl: PUBLIC_BASE_URL || '',
      allowSignup: true,
      enableChineseSite: false,
      backgroundTheme: 'vivid_rainbow',
      heartBeansPerGeneration: 1,
      paypalCheckoutUrl: '',
      notes: '后台 MVP 阶段使用本地 JSON 持久化，后续可直接迁移到数据库。',
    },
  }
}

function normalizeLoadedAdminData(parsed) {
  const defaults = createDefaultAdminData()

  return {
    ...defaults,
    ...parsed,
    members: Array.isArray(parsed?.members)
      ? parsed.members.map((member) => ({
          ...member,
          email: String(member?.email || '').trim().toLowerCase(),
          topupHeartBeansBalance: normalizePositiveNumber(
            member?.topupHeartBeansBalance,
            normalizePositiveNumber(member?.heartBeansBalance, 0),
          ),
          subscriptionHeartBeansBalance: normalizePositiveNumber(member?.subscriptionHeartBeansBalance, 0),
          heartBeansBalance: normalizePositiveNumber(
            member?.topupHeartBeansBalance,
            normalizePositiveNumber(member?.heartBeansBalance, 0),
          ) + normalizePositiveNumber(member?.subscriptionHeartBeansBalance, 0),
          subscriptionStatus: String(member?.subscriptionStatus || '').trim(),
          subscriptionPlanId: String(member?.subscriptionPlanId || '').trim(),
          subscriptionCurrentPeriodEnd: String(member?.subscriptionCurrentPeriodEnd || '').trim(),
          stripeCustomerId: String(member?.stripeCustomerId || '').trim(),
          paypalSubscriptionId: String(member?.paypalSubscriptionId || '').trim(),
          subscriptionProvider: String(member?.subscriptionProvider || '').trim(),
        }))
      : [],
    plans: Array.isArray(parsed?.plans) && parsed.plans.length
      ? parsed.plans.map((plan) => ({
          ...plan,
          id: String(plan?.id || ''),
          name: String(plan?.name || ''),
          price: normalizePositiveNumber(plan?.price, 0),
          heartBeans: normalizePositiveNumber(plan?.heartBeans, getDefaultHeartBeansForPlan(plan)),
          type: normalizePlanType(plan?.type, String(plan?.billingInterval || '').trim() ? 'subscription' : 'credit_pack'),
          billingInterval: normalizeBillingInterval(plan?.billingInterval),
          stripePriceId: String(plan?.stripePriceId || '').trim(),
          paypalPlanId: String(plan?.paypalPlanId || '').trim(),
          currency: String(plan?.currency || 'USD'),
          badge: String(plan?.badge || ''),
          features: Array.isArray(plan?.features) ? plan.features.map((item) => String(item || '').trim()).filter(Boolean) : [],
        }))
      : defaults.plans,
    showcaseTracks: Array.isArray(parsed?.showcaseTracks) && parsed.showcaseTracks.length ? parsed.showcaseTracks : defaults.showcaseTracks,
    paymentMethods: Array.isArray(parsed?.paymentMethods) && parsed.paymentMethods.length
      ? parsed.paymentMethods.map((method) => ({
          ...method,
          id: String(method?.id || '').trim(),
          name: String(method?.name || '').trim(),
          enabled: normalizeBoolean(method?.enabled, false),
          provider: normalizePaymentProvider(method?.provider, String(method?.id || '').trim() === 'stripe_checkout' ? 'stripe_checkout' : 'paypal'),
          envKey: String(method?.envKey || '').trim(),
          supportedPlanTypes: normalizePlanTypeList(method?.supportedPlanTypes, ['credit_pack']),
          description: String(method?.description || '').trim(),
        }))
      : defaults.paymentMethods,
    orders: Array.isArray(parsed?.orders)
      ? parsed.orders.map((order) => ({
          ...order,
          planId: String(order?.planId || '').trim(),
          planType: normalizePlanType(order?.planType, 'credit_pack'),
          heartBeans: normalizePositiveNumber(order?.heartBeans, getDefaultHeartBeansForPlan({ name: order?.plan })),
          creditsBalanceType: normalizeCreditBalanceType(order?.creditsBalanceType, order?.planType === 'subscription' ? 'subscription' : 'topup'),
          heartBeansGrantedAt: String(order?.heartBeansGrantedAt || '').trim(),
          paymentMethod: String(order?.paymentMethod || '').trim(),
          source: String(order?.source || '').trim(),
          mode: String(order?.mode || '').trim(),
          stripeCheckoutSessionId: String(order?.stripeCheckoutSessionId || '').trim(),
          stripeCustomerId: String(order?.stripeCustomerId || '').trim(),
          stripePaymentIntentId: String(order?.stripePaymentIntentId || '').trim(),
          stripeInvoiceId: String(order?.stripeInvoiceId || '').trim(),
          stripeSubscriptionId: String(order?.stripeSubscriptionId || '').trim(),
          paypalOrderId: String(order?.paypalOrderId || '').trim(),
          paypalCaptureId: String(order?.paypalCaptureId || '').trim(),
          paypalSubscriptionId: String(order?.paypalSubscriptionId || '').trim(),
          subscriptionCurrentPeriodEnd: String(order?.subscriptionCurrentPeriodEnd || '').trim(),
        }))
      : createDefaultAdminData().orders,
    songs: Array.isArray(parsed?.songs) ? parsed.songs : [],
    creditLedger: Array.isArray(parsed?.creditLedger) ? parsed.creditLedger.slice(0, CREDIT_LEDGER_LIMIT) : [],
    processedStripeEvents: Array.isArray(parsed?.processedStripeEvents)
      ? parsed.processedStripeEvents.map((item) => String(item || '').trim()).filter(Boolean).slice(0, WEBHOOK_EVENT_HISTORY_LIMIT)
      : [],
    config: {
      ...defaults.config,
      ...(parsed?.config ?? {}),
      allowSignup: normalizeBoolean(parsed?.config?.allowSignup, defaults.config.allowSignup),
      enableChineseSite: normalizeBoolean(parsed?.config?.enableChineseSite, defaults.config.enableChineseSite),
      backgroundTheme: normalizeBackgroundTheme(parsed?.config?.backgroundTheme, defaults.config.backgroundTheme),
      heartBeansPerGeneration: normalizePositiveNumber(parsed?.config?.heartBeansPerGeneration, defaults.config.heartBeansPerGeneration),
    },
  }
}

function loadAdminDataFromFile() {
  ensureDataDir()
  const defaults = createDefaultAdminData()

  if (!fs.existsSync(ADMIN_DATA_FILE)) {
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }

  try {
    const raw = fs.readFileSync(ADMIN_DATA_FILE, 'utf8')
    return normalizeLoadedAdminData(JSON.parse(raw))
  } catch {
    fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(defaults, null, 2), 'utf8')
    return defaults
  }
}

const databaseUrl = getDatabaseConnectionString()
const persistence = databaseUrl ? new PostgresPersistence(databaseUrl) : null
let persistenceSyncChain = Promise.resolve()
let adminData = loadAdminDataFromFile()

function saveAdminData() {
  ensureDataDir()
  fs.writeFileSync(ADMIN_DATA_FILE, JSON.stringify(adminData, null, 2), 'utf8')
  queuePersistenceSync('admin data changed')
}

function buildPersistenceSnapshot() {
  const timestamp = nowIso()

  return {
    settings: [
      { key: 'config', value: adminData.config, updatedAt: timestamp },
      { key: 'plans', value: adminData.plans, updatedAt: timestamp },
      { key: 'paymentMethods', value: adminData.paymentMethods, updatedAt: timestamp },
      { key: 'showcaseTracks', value: adminData.showcaseTracks, updatedAt: timestamp },
      { key: 'creditLedger', value: adminData.creditLedger, updatedAt: timestamp },
      { key: 'processedStripeEvents', value: adminData.processedStripeEvents, updatedAt: timestamp },
    ],
    members: adminData.members,
    orders: adminData.orders,
    songs: adminData.songs,
    memberSessions: Array.from(memberSessions.values()),
    jobs: Array.from(jobs.values()),
    lyricRequests: Array.from(lyricRequests.values()),
    sunoTasks: Array.from(sunoTasks.values()),
  }
}

function queuePersistenceSync(reason = 'state changed') {
  if (!persistence?.enabled) {
    return
  }

  const snapshot = buildPersistenceSnapshot()
  persistenceSyncChain = persistenceSyncChain
    .catch(() => {})
    .then(async () => {
      try {
        await persistence.persistSnapshot(snapshot)
      } catch (error) {
        console.error(`[persistence] Failed to sync ${reason}:`, error)
      }
    })
}

function hasRemoteSnapshot(snapshot) {
  if (!snapshot) {
    return false
  }

  return snapshot.settings.length > 0
    || snapshot.members.length > 0
    || snapshot.orders.length > 0
    || snapshot.songs.length > 0
    || snapshot.memberSessions.length > 0
    || snapshot.jobs.length > 0
    || snapshot.lyricRequests.length > 0
    || snapshot.sunoTasks.length > 0
}

function restoreStateFromSnapshot(snapshot) {
  const settingsMap = new Map(snapshot.settings.map((item) => [item.key, item.value]))
  adminData = normalizeLoadedAdminData({
    members: snapshot.members,
    orders: snapshot.orders,
    songs: snapshot.songs,
    config: settingsMap.get('config'),
    plans: settingsMap.get('plans'),
    paymentMethods: settingsMap.get('paymentMethods'),
    showcaseTracks: settingsMap.get('showcaseTracks'),
    creditLedger: settingsMap.get('creditLedger'),
    processedStripeEvents: settingsMap.get('processedStripeEvents'),
  })

  jobs.clear()
  lyricRequests.clear()
  sunoTasks.clear()
  memberSessions.clear()
  sunoTaskToJob.clear()

  snapshot.jobs.forEach((job) => {
    if (!job?.id) {
      return
    }

    jobs.set(job.id, job)
    if (job.sunoTaskId) {
      sunoTaskToJob.set(String(job.sunoTaskId), job.id)
    }
  })

  snapshot.lyricRequests.forEach((item) => {
    if (item?.jobId) {
      lyricRequests.set(item.jobId, item)
    }
  })

  snapshot.sunoTasks.forEach((item) => {
    if (!item?.jobId) {
      return
    }

    sunoTasks.set(item.jobId, item)
    if (item.taskId) {
      sunoTaskToJob.set(String(item.taskId), item.jobId)
    }
  })

  snapshot.memberSessions.forEach((session) => {
    if (session?.token) {
      memberSessions.set(session.token, session)
    }
  })
}

function recordLyricRequest(jobId, patch = {}) {
  const current = lyricRequests.get(jobId) || {
    jobId,
    status: 'pending',
    requestPayload: null,
    responsePayload: null,
    parsedPayload: null,
    error: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  const next = {
    ...current,
    ...patch,
    jobId,
    updatedAt: nowIso(),
  }

  lyricRequests.set(jobId, next)
  queuePersistenceSync('lyric request changed')
  return next
}

function recordSunoTask(jobId, patch = {}) {
  const current = sunoTasks.get(jobId) || {
    jobId,
    taskId: '',
    status: 'pending',
    requestPayload: null,
    createResponsePayload: null,
    callbackPayload: null,
    latestFeedPayload: null,
    error: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  const next = {
    ...current,
    ...patch,
    jobId,
    updatedAt: nowIso(),
  }

  if (current.taskId && current.taskId !== next.taskId) {
    sunoTaskToJob.delete(current.taskId)
  }

  if (next.taskId) {
    sunoTaskToJob.set(String(next.taskId), jobId)
  }

  sunoTasks.set(jobId, next)
  queuePersistenceSync('suno task changed')
  return next
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

function getStripeClient() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('缺少 STRIPE_SECRET_KEY。')
  }

  if (stripe) {
    return stripe
  }

  if (!StripeModule) {
    try {
      StripeModule = require('stripe')
    } catch {
      throw new Error('Stripe SDK 未安装，暂时无法启用 Stripe 支付。')
    }
  }

  const StripeCtor = StripeModule?.default || StripeModule
  stripe = new StripeCtor(STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' })
  return stripe
}

function getFrontendBaseUrl() {
  return FRONTEND_ORIGIN || PUBLIC_BASE_URL || 'http://127.0.0.1:5173'
}

function buildFrontendHashUrl(locale = 'en', pathName = '/account', query = {}) {
  const url = new URL(getFrontendBaseUrl())
  const normalizedPath = String(pathName || '/account').startsWith('/') ? String(pathName || '/account') : `/${String(pathName || '/account')}`
  const localizedPath = `/${locale === 'zh' ? 'zh' : 'en'}${normalizedPath}`
  const params = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return
    }

    params.set(key, String(value))
  })

  url.hash = `${localizedPath}${params.toString() ? `?${params.toString()}` : ''}`
  return url.toString()
}

function findPlanById(planId) {
  const normalized = String(planId || '').trim()
  return adminData.plans.find((item) => String(item?.id || '').trim() === normalized) || null
}

function findPlanByStripePriceId(priceId) {
  const normalized = String(priceId || '').trim()
  return adminData.plans.find((item) => String(item?.stripePriceId || '').trim() === normalized) || null
}

function findPlanByPayPalPlanId(planId) {
  const normalized = String(planId || '').trim()
  return adminData.plans.find((item) => String(item?.paypalPlanId || '').trim() === normalized) || null
}

function supportsPlanType(method, planType) {
  const supportedPlanTypes = normalizePlanTypeList(method?.supportedPlanTypes, ['credit_pack'])
  return supportedPlanTypes.includes(normalizePlanType(planType, 'credit_pack'))
}

function buildPersistedTrackSongId(jobId, index) {
  return `${String(jobId || '').trim()}__track_${index + 1}`
}

function syncJobToAdminData(job) {
  const baseEntry = {
    title: job.title || `${job.input.groom} & ${job.input.bride}`,
    couple: `${job.input.groom} & ${job.input.bride}`,
    email: job.input.userEmail || '',
    languageLabel: job.input.languageLabel,
    styleLabel: job.input.styleLabel || job.input.style,
    vocalLabel: job.input.vocalLabel,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    lyricSnippet: String(job.lyrics || '').slice(0, 160),
    lyrics: job.lyrics || '',
    error: job.error || '',
    story: {
      loveStory: job.input.loveStory || '',
      meetingStory: job.input.meetingStory || '',
      vowKeywords: job.input.vowKeywords || '',
    },
  }
  const trackCount = Array.isArray(job.tracks) ? job.tracks.length : 0
  const entries = trackCount
    ? job.tracks.map((track, index) => ({
        ...baseEntry,
        id: buildPersistedTrackSongId(job.id, index),
        jobId: job.id,
        trackId: String(track?.id || '').trim(),
        trackIndex: index,
        trackCount,
        variantLabel: trackCount > 1 ? `Version ${index + 1}` : '',
        title: String(track?.title || '').trim() || baseEntry.title,
        audioUrl: pickPreferredAudioUrl(track?.audioUrl, track?.downloadUrl),
        downloadUrl: pickPreferredAudioUrl(track?.downloadUrl, track?.audioUrl),
        sourceAudioUrl: pickPreferredAudioUrl(track?.sourceAudioUrl, track?.audioUrl),
        sourceDownloadUrl: pickPreferredAudioUrl(track?.sourceDownloadUrl, track?.downloadUrl),
      }))
    : [{
        ...baseEntry,
        id: job.id,
        jobId: job.id,
        trackId: '',
        trackIndex: 0,
        trackCount: 0,
        variantLabel: '',
        audioUrl: '',
        downloadUrl: '',
        sourceAudioUrl: '',
        sourceDownloadUrl: '',
      }]

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
      persistedEntryCount: entries.length,
      firstPersistedAudioUrl: entries[0]?.audioUrl || '',
      firstPersistedDownloadUrl: entries[0]?.downloadUrl || '',
      firstPersistedSourceAudioUrl: entries[0]?.sourceAudioUrl || '',
      firstPersistedSourceDownloadUrl: entries[0]?.sourceDownloadUrl || '',
      email: entries[0]?.email || '',
    },
  })
  // #endregion

  const nextSongs = [
    ...entries,
    ...adminData.songs.filter((item) => item.id !== job.id && item.jobId !== job.id),
  ].slice(0, 100)
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

function buildMemberCreditSnapshot(member) {
  const topupHeartBeansBalance = normalizePositiveNumber(
    member?.topupHeartBeansBalance,
    normalizePositiveNumber(member?.heartBeansBalance, 0),
  )
  const subscriptionHeartBeansBalance = normalizePositiveNumber(member?.subscriptionHeartBeansBalance, 0)

  return {
    topupHeartBeansBalance,
    subscriptionHeartBeansBalance,
    heartBeansBalance: topupHeartBeansBalance + subscriptionHeartBeansBalance,
  }
}

function upsertMember(member) {
  const creditSnapshot = buildMemberCreditSnapshot(member)
  const nextMember = {
    ...member,
    email: normalizeEmail(member.email),
    ...creditSnapshot,
    subscriptionStatus: String(member?.subscriptionStatus || '').trim(),
    subscriptionPlanId: String(member?.subscriptionPlanId || '').trim(),
    subscriptionCurrentPeriodEnd: String(member?.subscriptionCurrentPeriodEnd || '').trim(),
    stripeCustomerId: String(member?.stripeCustomerId || '').trim(),
    paypalSubscriptionId: String(member?.paypalSubscriptionId || '').trim(),
    subscriptionProvider: String(member?.subscriptionProvider || '').trim(),
  }

  adminData = {
    ...adminData,
    members: [nextMember, ...adminData.members.filter((item) => normalizeEmail(item.email) !== normalizeEmail(member.email))].slice(0, 5000),
  }
  saveAdminData()

  return nextMember
}

function appendCreditLedger(entry) {
  const nextEntry = {
    id: String(entry?.id || crypto.randomUUID()).trim(),
    memberEmail: normalizeEmail(entry?.memberEmail),
    delta: Number(entry?.delta || 0),
    balanceType: normalizeCreditBalanceType(entry?.balanceType, 'topup'),
    sourceType: String(entry?.sourceType || '').trim(),
    sourceId: String(entry?.sourceId || '').trim(),
    note: String(entry?.note || '').trim(),
    createdAt: entry?.createdAt || nowIso(),
  }

  adminData = {
    ...adminData,
    creditLedger: [nextEntry, ...(Array.isArray(adminData.creditLedger) ? adminData.creditLedger : [])].slice(0, CREDIT_LEDGER_LIMIT),
  }
  saveAdminData()
  return nextEntry
}

function hasProcessedStripeEvent(eventId) {
  const normalized = String(eventId || '').trim()
  return Boolean(normalized) && Array.isArray(adminData.processedStripeEvents) && adminData.processedStripeEvents.includes(normalized)
}

function markProcessedStripeEvent(eventId) {
  const normalized = String(eventId || '').trim()
  if (!normalized) {
    return
  }

  adminData = {
    ...adminData,
    processedStripeEvents: [normalized, ...(Array.isArray(adminData.processedStripeEvents) ? adminData.processedStripeEvents : []).filter((item) => item !== normalized)]
      .slice(0, WEBHOOK_EVENT_HISTORY_LIMIT),
  }
  saveAdminData()
}

function updateOrder(orderId, patch) {
  const index = adminData.orders.findIndex((item) => String(item.id || '').trim() === String(orderId || '').trim())
  if (index === -1) {
    return null
  }

  const current = adminData.orders[index]
  const next = {
    ...current,
    ...patch,
    id: current.id,
    updatedAt: nowIso(),
  }

  adminData = {
    ...adminData,
    orders: adminData.orders.map((item, itemIndex) => (itemIndex === index ? next : item)),
  }
  saveAdminData()
  return next
}

function findOrderByStripeReference({ checkoutSessionId = '', invoiceId = '', subscriptionId = '' } = {}) {
  return adminData.orders.find((order) => {
    if (checkoutSessionId && String(order?.stripeCheckoutSessionId || '').trim() === String(checkoutSessionId).trim()) {
      return true
    }

    if (invoiceId && String(order?.stripeInvoiceId || '').trim() === String(invoiceId).trim()) {
      return true
    }

    if (subscriptionId && String(order?.stripeSubscriptionId || '').trim() === String(subscriptionId).trim()) {
      return true
    }

    return false
  }) || null
}

function findOrderByPayPalReference({ orderId = '', captureId = '', subscriptionId = '' } = {}) {
  return adminData.orders.find((order) => {
    if (orderId && String(order?.paypalOrderId || '').trim() === String(orderId).trim()) {
      return true
    }

    if (captureId && String(order?.paypalCaptureId || '').trim() === String(captureId).trim()) {
      return true
    }

    if (subscriptionId && String(order?.paypalSubscriptionId || '').trim() === String(subscriptionId).trim()) {
      return true
    }

    return false
  }) || null
}

function upsertOrder(order) {
  const normalizedId = String(order?.id || '').trim() || `ord-${crypto.randomUUID()}`
  const nextOrder = {
    ...order,
    id: normalizedId,
    email: normalizeEmail(order?.email),
    planId: String(order?.planId || '').trim(),
    plan: String(order?.plan || '').trim(),
    planType: normalizePlanType(order?.planType, 'credit_pack'),
    heartBeans: normalizePositiveNumber(order?.heartBeans, 0),
    creditsBalanceType: normalizeCreditBalanceType(order?.creditsBalanceType, order?.planType === 'subscription' ? 'subscription' : 'topup'),
    paymentMethod: String(order?.paymentMethod || '').trim(),
    source: String(order?.source || '').trim(),
    mode: String(order?.mode || '').trim(),
    stripeCheckoutSessionId: String(order?.stripeCheckoutSessionId || '').trim(),
    stripeCustomerId: String(order?.stripeCustomerId || '').trim(),
    stripePaymentIntentId: String(order?.stripePaymentIntentId || '').trim(),
    stripeInvoiceId: String(order?.stripeInvoiceId || '').trim(),
    stripeSubscriptionId: String(order?.stripeSubscriptionId || '').trim(),
    paypalOrderId: String(order?.paypalOrderId || '').trim(),
    paypalCaptureId: String(order?.paypalCaptureId || '').trim(),
    paypalSubscriptionId: String(order?.paypalSubscriptionId || '').trim(),
    subscriptionCurrentPeriodEnd: String(order?.subscriptionCurrentPeriodEnd || '').trim(),
    createdAt: order?.createdAt || nowIso(),
    updatedAt: order?.updatedAt || nowIso(),
  }

  adminData = {
    ...adminData,
    orders: [nextOrder, ...adminData.orders.filter((item) => String(item.id || '').trim() !== normalizedId)].slice(0, 5000),
  }
  saveAdminData()
  return nextOrder
}

function awardHeartBeansToMember(email, amount, planName, balanceType = 'topup', metadata = {}) {
  const normalizedEmail = normalizeEmail(email)
  const heartBeans = normalizePositiveNumber(amount, 0)
  const normalizedBalanceType = normalizeCreditBalanceType(balanceType, 'topup')

  if (!normalizedEmail || heartBeans <= 0) {
    return null
  }

  const member = findMemberByEmail(normalizedEmail) || { email: normalizedEmail }
  const creditSnapshot = buildMemberCreditSnapshot(member)
  const nextMember = {
    ...member,
    email: normalizedEmail,
    plan: String(planName || member.plan || '').trim(),
    topupHeartBeansBalance: creditSnapshot.topupHeartBeansBalance + (normalizedBalanceType === 'topup' ? heartBeans : 0),
    subscriptionHeartBeansBalance: creditSnapshot.subscriptionHeartBeansBalance + (normalizedBalanceType === 'subscription' ? heartBeans : 0),
    updatedAt: nowIso(),
  }

  const savedMember = upsertMember(nextMember)
  appendCreditLedger({
    memberEmail: normalizedEmail,
    delta: heartBeans,
    balanceType: normalizedBalanceType,
    sourceType: metadata.sourceType || 'manual_award',
    sourceId: metadata.sourceId || '',
    note: metadata.note || `${String(planName || '').trim()} credits granted`,
  })
  return savedMember
}

function refundHeartBeansToMember(member, breakdown = { subscription: 0, topup: 0 }, metadata = {}) {
  const subscriptionCredits = normalizePositiveNumber(breakdown?.subscription, 0)
  const topupCredits = normalizePositiveNumber(breakdown?.topup, 0)
  const currentBalance = buildMemberCreditSnapshot(member)

  if (subscriptionCredits <= 0 && topupCredits <= 0) {
    return {
      ...member,
      ...currentBalance,
    }
  }

  const nextMember = {
    ...member,
    topupHeartBeansBalance: currentBalance.topupHeartBeansBalance + topupCredits,
    subscriptionHeartBeansBalance: currentBalance.subscriptionHeartBeansBalance + subscriptionCredits,
    updatedAt: nowIso(),
  }

  const savedMember = upsertMember(nextMember)

  if (subscriptionCredits > 0) {
    appendCreditLedger({
      memberEmail: savedMember.email,
      delta: subscriptionCredits,
      balanceType: 'subscription',
      sourceType: metadata.sourceType || 'refund',
      sourceId: metadata.sourceId || '',
      note: metadata.note || 'Refunded subscription credits',
    })
  }

  if (topupCredits > 0) {
    appendCreditLedger({
      memberEmail: savedMember.email,
      delta: topupCredits,
      balanceType: 'topup',
      sourceType: metadata.sourceType || 'refund',
      sourceId: metadata.sourceId || '',
      note: metadata.note || 'Refunded top-up credits',
    })
  }

  return savedMember
}

function consumeHeartBeansFromMember(member, amount) {
  const heartBeans = normalizePositiveNumber(amount, 0)
  const currentBalance = buildMemberCreditSnapshot(member)

  if (heartBeans <= 0) {
    return {
      ...member,
      ...currentBalance,
      debited: {
        subscription: 0,
        topup: 0,
      },
    }
  }

  if (currentBalance.heartBeansBalance < heartBeans) {
    throw new Error(`服务额度不足：当前剩余 ${currentBalance.heartBeansBalance}，本次需要 ${heartBeans}。`)
  }

  const debitedSubscription = Math.min(currentBalance.subscriptionHeartBeansBalance, heartBeans)
  const debitedTopup = heartBeans - debitedSubscription
  const nextMember = {
    ...member,
    topupHeartBeansBalance: currentBalance.topupHeartBeansBalance - debitedTopup,
    subscriptionHeartBeansBalance: currentBalance.subscriptionHeartBeansBalance - debitedSubscription,
    updatedAt: nowIso(),
  }

  const savedMember = upsertMember(nextMember)

  if (debitedSubscription > 0) {
    appendCreditLedger({
      memberEmail: savedMember.email,
      delta: -debitedSubscription,
      balanceType: 'subscription',
      sourceType: 'song_generation',
      sourceId: '',
      note: 'Consumed subscription credits for generation',
    })
  }

  if (debitedTopup > 0) {
    appendCreditLedger({
      memberEmail: savedMember.email,
      delta: -debitedTopup,
      balanceType: 'topup',
      sourceType: 'song_generation',
      sourceId: '',
      note: 'Consumed top-up credits for generation',
    })
  }

  return {
    ...savedMember,
    debited: {
      subscription: debitedSubscription,
      topup: debitedTopup,
    },
  }
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
  const creditSnapshot = buildMemberCreditSnapshot(member)
  const token = crypto.randomUUID()
  const session = {
    token,
    email: normalizeEmail(member.email),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  memberSessions.set(token, session)
  queuePersistenceSync('member session created')

  return {
    token,
    profile: {
      email: normalizeEmail(member.email),
      partnerName: String(member.partnerName || '').trim(),
      plan: String(member.plan || '').trim(),
      heartBeansBalance: creditSnapshot.heartBeansBalance,
      topupHeartBeansBalance: creditSnapshot.topupHeartBeansBalance,
      subscriptionHeartBeansBalance: creditSnapshot.subscriptionHeartBeansBalance,
      subscriptionStatus: String(member.subscriptionStatus || '').trim(),
      subscriptionPlanId: String(member.subscriptionPlanId || '').trim(),
      subscriptionCurrentPeriodEnd: String(member.subscriptionCurrentPeriodEnd || '').trim(),
      stripeCustomerId: String(member.stripeCustomerId || '').trim(),
      paypalSubscriptionId: String(member.paypalSubscriptionId || '').trim(),
      subscriptionProvider: String(member.subscriptionProvider || '').trim(),
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
    queuePersistenceSync('member session removed')
    res.status(401).json({ message: '会员账号不存在，请重新登录。' })
    return
  }

  if (member.disabled) {
    memberSessions.delete(token)
    queuePersistenceSync('member session removed')
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
    queuePersistenceSync('member session removed')
    return { session: null, member: null, error: '会员账号不存在，请重新登录。', status: 401 }
  }

  if (member.disabled) {
    memberSessions.delete(token)
    queuePersistenceSync('member session removed')
    return { session: null, member: null, error: '该会员账号已被禁用，请联系管理员。', status: 403 }
  }

  return { session, member, error: '', status: 200 }
}

async function ensureStripeCustomerForMember(member) {
  const stripeClient = getStripeClient()
  const existingCustomerId = String(member?.stripeCustomerId || '').trim()

  if (existingCustomerId) {
    return existingCustomerId
  }

  const customer = await stripeClient.customers.create({
    email: normalizeEmail(member?.email),
    name: String(member?.partnerName || '').trim() || undefined,
    metadata: {
      memberEmail: normalizeEmail(member?.email),
    },
  })

  const savedMember = upsertMember({
    ...member,
    stripeCustomerId: customer.id,
    updatedAt: nowIso(),
  })

  return String(savedMember.stripeCustomerId || customer.id).trim()
}

async function syncMemberSubscriptionFromStripe(member, subscriptionId, fallbackPlan = null) {
  if (!member || !subscriptionId) {
    return member
  }

  const stripeClient = getStripeClient()
  const subscription = await stripeClient.subscriptions.retrieve(String(subscriptionId).trim())
  const subscriptionPriceId = String(subscription?.items?.data?.[0]?.price?.id || '').trim()
  const resolvedPlan = fallbackPlan || findPlanByStripePriceId(subscriptionPriceId)
  const savedMember = upsertMember({
    ...member,
    stripeCustomerId: String(subscription.customer || member.stripeCustomerId || '').trim(),
    plan: resolvedPlan?.name || member.plan || '',
    subscriptionPlanId: resolvedPlan?.id || member.subscriptionPlanId || '',
    subscriptionStatus: String(subscription.status || '').trim(),
    subscriptionProvider: 'stripe',
    subscriptionCurrentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : String(member.subscriptionCurrentPeriodEnd || '').trim(),
    updatedAt: nowIso(),
  })

  return savedMember
}

async function createStripeCheckoutForPlan({ member, plan, order, locale }) {
  const stripeClient = getStripeClient()
  const customerId = await ensureStripeCustomerForMember(member)
  const planType = normalizePlanType(plan?.type, 'credit_pack')
  const mode = planType === 'subscription' ? 'subscription' : 'payment'
  const session = await stripeClient.checkout.sessions.create({
    mode,
    customer: customerId,
    success_url: buildFrontendHashUrl(locale, '/account', {
      checkout: 'success',
      source: planType,
      session_id: '{CHECKOUT_SESSION_ID}',
      planId: plan.id,
    }),
    cancel_url: buildFrontendHashUrl(locale, '/checkout', {
      checkout: 'cancel',
      planId: plan.id,
    }),
    line_items: [
      {
        price: String(plan.stripePriceId || '').trim(),
        quantity: 1,
      },
    ],
    metadata: {
      orderId: order.id,
      memberEmail: normalizeEmail(member.email),
      planId: plan.id,
      planType,
    },
    subscription_data: mode === 'subscription'
      ? {
          metadata: {
            orderId: order.id,
            memberEmail: normalizeEmail(member.email),
            planId: plan.id,
          },
        }
      : undefined,
  })

  const savedOrder = updateOrder(order.id, {
    stripeCheckoutSessionId: session.id,
    stripeCustomerId: customerId,
    mode,
    source: 'stripe',
  }) || order

  return {
    checkoutUrl: session.url,
    checkoutSessionId: session.id,
    order: savedOrder,
  }
}

function isPayPalConfigured() {
  return Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET)
}

function getPayPalApiBase() {
  return PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

async function getPayPalAccessToken() {
  if (!isPayPalConfigured()) {
    throw new Error('PayPal 未配置客户端密钥。')
  }

  if (paypalAccessTokenCache.token && paypalAccessTokenCache.expiresAt > Date.now() + 30_000) {
    return paypalAccessTokenCache.token
  }

  const response = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en_US',
      Authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.error_description || payload?.error || '获取 PayPal access token 失败。')
  }

  paypalAccessTokenCache = {
    token: String(payload.access_token || '').trim(),
    expiresAt: Date.now() + (Math.max(Number(payload.expires_in || 0), 60) - 30) * 1000,
  }

  return paypalAccessTokenCache.token
}

async function paypalRequest(requestPath, { method = 'GET', body, idempotencyKey = '' } = {}) {
  const accessToken = await getPayPalAccessToken()
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (idempotencyKey) {
    headers['PayPal-Request-Id'] = String(idempotencyKey).trim()
  }

  const response = await fetch(`${getPayPalApiBase()}${requestPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error_description || `PayPal 请求失败（${response.status}）。`)
  }

  return payload
}

function extractPayPalApproveLink(payload) {
  const links = Array.isArray(payload?.links) ? payload.links : []
  return String(
    links.find((item) => ['approve', 'payer-action'].includes(String(item?.rel || '').trim()))?.href || '',
  ).trim()
}

async function verifyPayPalWebhook(event, headers) {
  if (!PAYPAL_WEBHOOK_ID) {
    return true
  }

  const accessToken = await getPayPalAccessToken()
  const response = await fetch(`${getPayPalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: String(headers['paypal-auth-algo'] || '').trim(),
      cert_url: String(headers['paypal-cert-url'] || '').trim(),
      transmission_id: String(headers['paypal-transmission-id'] || '').trim(),
      transmission_sig: String(headers['paypal-transmission-sig'] || '').trim(),
      transmission_time: String(headers['paypal-transmission-time'] || '').trim(),
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    }),
  })

  const result = await response.json().catch(() => ({}))
  return response.ok && String(result?.verification_status || '').trim().toUpperCase() === 'SUCCESS'
}

async function getPayPalSubscription(subscriptionId) {
  return paypalRequest(`/v1/billing/subscriptions/${encodeURIComponent(String(subscriptionId || '').trim())}`)
}

async function syncMemberSubscriptionFromPayPal(member, subscriptionId, fallbackPlan = null) {
  if (!member || !subscriptionId) {
    return member
  }

  const subscription = await getPayPalSubscription(subscriptionId)
  const resolvedPlan = fallbackPlan || findPlanByPayPalPlanId(String(subscription?.plan_id || '').trim())
  const billingInfo = subscription?.billing_info || {}
  const nextBillingTime = String(
    billingInfo?.next_billing_time
    || subscription?.start_time
    || member.subscriptionCurrentPeriodEnd
    || '',
  ).trim()

  return upsertMember({
    ...member,
    plan: resolvedPlan?.name || member.plan || '',
    subscriptionPlanId: resolvedPlan?.id || member.subscriptionPlanId || '',
    subscriptionStatus: String(subscription?.status || member.subscriptionStatus || '').trim().toLowerCase(),
    subscriptionCurrentPeriodEnd: nextBillingTime,
    paypalSubscriptionId: String(subscription?.id || subscriptionId).trim(),
    subscriptionProvider: 'paypal',
    updatedAt: nowIso(),
  })
}

async function createPayPalCheckoutForPlan({ member, plan, order, locale }) {
  if (!isPayPalConfigured()) {
    throw new Error('PayPal 环境变量未配置完成。')
  }

  const planType = normalizePlanType(plan?.type, 'credit_pack')
  const returnBase = PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`

  if (planType === 'subscription') {
    const paypalPlanId = String(plan?.paypalPlanId || '').trim()
    if (!paypalPlanId) {
      throw new Error('该订阅套餐尚未配置 PayPal Plan ID。')
    }

    const payload = await paypalRequest('/v1/billing/subscriptions', {
      method: 'POST',
      idempotencyKey: order.id,
      body: {
        plan_id: paypalPlanId,
        custom_id: order.id,
        application_context: {
          brand_name: 'MelodyVow',
          locale: locale === 'zh' ? 'zh-CN' : 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${returnBase}/api/paypal/checkout/return?mode=subscription&orderId=${encodeURIComponent(order.id)}&locale=${encodeURIComponent(locale)}`,
          cancel_url: `${returnBase}/api/paypal/checkout/cancel?mode=subscription&orderId=${encodeURIComponent(order.id)}&locale=${encodeURIComponent(locale)}`,
        },
        subscriber: {
          email_address: normalizeEmail(member?.email),
        },
      },
    })

    const approveUrl = extractPayPalApproveLink(payload)
    if (!approveUrl) {
      throw new Error('PayPal 订阅链接为空。')
    }

    const savedOrder = updateOrder(order.id, {
      source: 'paypal',
      mode: 'subscription',
      paypalSubscriptionId: String(payload?.id || '').trim(),
    }) || order

    return {
      checkoutUrl: approveUrl,
      paypalSubscriptionId: String(payload?.id || '').trim(),
      order: savedOrder,
    }
  }

  const payload = await paypalRequest('/v2/checkout/orders', {
    method: 'POST',
    idempotencyKey: order.id,
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: order.id,
          invoice_id: order.id,
          custom_id: order.id,
          description: `${plan.name} (${plan.heartBeans} credits)`,
          amount: {
            currency_code: normalizePayPalCurrencyCode(plan.currency),
            value: Number(plan.price || 0).toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'MelodyVow',
            locale: locale === 'zh' ? 'zh-CN' : 'en-US',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: `${returnBase}/api/paypal/checkout/return?mode=payment&orderId=${encodeURIComponent(order.id)}&locale=${encodeURIComponent(locale)}`,
            cancel_url: `${returnBase}/api/paypal/checkout/cancel?mode=payment&orderId=${encodeURIComponent(order.id)}&locale=${encodeURIComponent(locale)}`,
          },
        },
      },
    },
  })

  const approveUrl = extractPayPalApproveLink(payload)
  if (!approveUrl) {
    throw new Error('PayPal 支付链接为空。')
  }

  const savedOrder = updateOrder(order.id, {
    source: 'paypal',
    mode: 'payment',
    paypalOrderId: String(payload?.id || '').trim(),
  }) || order

  return {
    checkoutUrl: approveUrl,
    paypalOrderId: String(payload?.id || '').trim(),
    order: savedOrder,
  }
}

async function reclaimOrderCredits(order, note = 'Order refunded') {
  const email = normalizeEmail(order?.email)
  const member = findMemberByEmail(email)
  if (!member) {
    return null
  }

  const credits = normalizePositiveNumber(order?.heartBeans, 0)
  if (credits <= 0) {
    return member
  }

  const balanceType = normalizeCreditBalanceType(order?.creditsBalanceType, order?.planType === 'subscription' ? 'subscription' : 'topup')
  const currentBalance = buildMemberCreditSnapshot(member)
  const available = balanceType === 'subscription' ? currentBalance.subscriptionHeartBeansBalance : currentBalance.topupHeartBeansBalance

  if (available < credits) {
    return null
  }

  const savedMember = upsertMember({
    ...member,
    topupHeartBeansBalance: currentBalance.topupHeartBeansBalance - (balanceType === 'topup' ? credits : 0),
    subscriptionHeartBeansBalance: currentBalance.subscriptionHeartBeansBalance - (balanceType === 'subscription' ? credits : 0),
    updatedAt: nowIso(),
  })

  appendCreditLedger({
    memberEmail: savedMember.email,
    delta: -credits,
    balanceType,
    sourceType: 'refund_reclaim',
    sourceId: String(order?.id || '').trim(),
    note,
  })

  return savedMember
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

function pickUsableAudioUrl(...values) {
  const candidates = values
    .map((value) => String(value || '').trim())
    .filter(Boolean)

  return pickPreferredAudioUrl(...candidates) || candidates[0] || ''
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

  recordSunoTask(jobId, {
    taskId,
    status: 'callback_received',
    callbackPayload: payload,
  })
  const next = applySunoStatus(jobId, payload)
  // #region debug-point D:callback-apply-status
  reportDebugEvent({
    hypothesisId: 'D',
    location: 'web/server/index.mjs:handleSunoCallback',
    msg: '[DEBUG] Applied callback payload to current Suno job state',
    data: {
      taskId,
      jobId,
      nextStatus: next?.status || '',
      nextTrackCount: Array.isArray(next?.tracks) ? next.tracks.length : 0,
      nextFirstTrackAudioUrl: next?.tracks?.[0]?.audioUrl || '',
      nextFirstTrackDownloadUrl: next?.tracks?.[0]?.downloadUrl || '',
    },
  })
  // #endregion
  if (next?.status !== 'ready' && next?.status !== 'error') {
    void pollSunoTask(jobId, taskId)
  }
  res.json({ ok: true })
}

function reportDebugEvent(event) {
  let debugServerUrl = 'http://127.0.0.1:7777/event'
  let debugSessionId = 'song-playback-regression'

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
  const safeGroom = groom || 'Groom'
  const safeBride = bride || 'Bride'
  const safeStyle = style || 'soft_pop'
  const safeStyleLabel = styleLabel || 'Soft Pop'
  const safeLanguageCode = languageCode || 'en'
  const safeLanguageLabel = languageLabel || 'English'
  const safeVocal = vocal || 'female'
  const safeVocalLabel = vocalLabel || 'Female Vocal'

  return {
    groom: safeGroom,
    bride: safeBride,
    userEmail,
    occasion,
    style: safeStyle,
    styleLabel: safeStyleLabel,
    languageCode: safeLanguageCode,
    languageLabel: safeLanguageLabel,
    vocal: safeVocal,
    vocalLabel: safeVocalLabel,
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
    jobId: song.jobId || song.id,
    trackCount: Number(song.trackCount || 0),
    trackIndex: Number(song.trackIndex || 0),
    title: song.title,
    subtitle: song.variantLabel ? `${song.couple} · ${song.variantLabel}` : song.couple,
    status: song.status === 'ready' ? '已生成' : song.status,
    rawStatus: song.status,
    action: '下载音频',
    audioUrl: playbackUrl,
    downloadUrl,
    sourceAudioUrl: pickPreferredAudioUrl(song.sourceAudioUrl, song.audioUrl),
    sourceDownloadUrl: pickPreferredAudioUrl(song.sourceDownloadUrl, song.downloadUrl),
    createdAt: song.updatedAt || song.createdAt,
    languageLabel: song.languageLabel || '',
    styleLabel: song.styleLabel || '',
    vocalLabel: song.vocalLabel || '',
    variantLabel: song.variantLabel || '',
    lyricSnippet: song.lyricSnippet || '',
    lyrics: song.lyrics || '',
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

async function generateLyrics(jobId, { groom, bride, occasion, style, styleLabel, languageLabel, vocalLabel, loveStory, meetingStory, vowKeywords }) {
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

  const requestPayload = {
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
  }

  recordLyricRequest(jobId, {
    status: 'requested',
    requestPayload,
    error: '',
  })

  let data
  try {
    data = await requestJson(
      `${DEEPSEEK_API_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getDeepSeekKey()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      },
      'DeepSeek',
    )
  } catch (error) {
    recordLyricRequest(jobId, {
      status: 'error',
      error: error instanceof Error ? error.message : 'DeepSeek 请求失败。',
    })
    throw error
  }

  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    recordLyricRequest(jobId, {
      status: 'error',
      responsePayload: data,
      error: 'DeepSeek 没有返回歌词内容。',
    })
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
    recordLyricRequest(jobId, {
      status: 'error',
      responsePayload: data,
      parsedPayload: parsed,
      error: 'DeepSeek 返回的歌词格式不完整。',
    })
    throw new Error('DeepSeek 返回的歌词格式不完整。')
  }

  const result = {
    title: sanitizeTitle(parsed.title, groom, bride),
    lyrics: String(parsed.lyrics).trim(),
    stylePrompt: String(parsed.stylePrompt).trim(),
  }

  recordLyricRequest(jobId, {
    status: 'completed',
    responsePayload: data,
    parsedPayload: result,
    error: '',
  })

  return result
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

  recordSunoTask(job.id, {
    status: 'requested',
    requestPayload: payload,
    error: '',
  })

  let data
  try {
    data = await requestJson(
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
  } catch (error) {
    recordSunoTask(job.id, {
      status: 'error',
      requestPayload: payload,
      error: error instanceof Error ? error.message : 'Suno 创建任务失败。',
    })
    throw error
  }

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
    recordSunoTask(job.id, {
      status: 'error',
      requestPayload: payload,
      createResponsePayload: data,
      error: 'Suno 没有返回 taskId。',
    })
    throw new Error('Suno 没有返回 taskId。')
  }

  recordSunoTask(job.id, {
    taskId: String(taskId),
    status: 'submitted',
    requestPayload: payload,
    createResponsePayload: data,
    error: '',
  })
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
      const sourceAudioUrl = pickPreferredAudioUrl(
        track?.audio_url,
        track?.audioUrl,
        track?.stream_audio_url,
        track?.streamAudioUrl,
      )
      const sourceDownloadUrl = pickPreferredAudioUrl(
        track?.download_url,
        track?.downloadUrl,
        track?.audio_url,
        track?.audioUrl,
        track?.stream_audio_url,
        track?.streamAudioUrl,
      )
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
    data?.stream_audio_url,
    data?.streamAudioUrl,
    payload?.download_url,
    payload?.downloadUrl,
    payload?.audio_url,
    payload?.audioUrl,
    payload?.stream_audio_url,
    payload?.streamAudioUrl,
  )
  const state = String(pickFirstDefined(data?.state, payload?.state) || '').trim().toLowerCase()

  if ((rawStatus === 3 || rawStatus === '3' || state === 'completed') && audioUrl) {
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

  const jobId = sunoTaskToJob.get(String(taskId))
  if (jobId) {
    recordSunoTask(jobId, {
      taskId: String(taskId),
      status: 'polled',
      latestFeedPayload: data,
    })
  }

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
    recordSunoTask(jobId, {
      taskId,
      status: 'error',
      error: error instanceof Error ? error.message : '轮询 Suno 结果失败。',
    })
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

  queuePersistenceSync('cleanup expired jobs')
}

setInterval(cleanupJobs, 1000 * 60 * 30).unref()

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    databaseEnabled: Boolean(persistence?.enabled),
    callbackEnabled: Boolean(PUBLIC_BASE_URL),
    stripeConfigured: Boolean(stripe),
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
    topupHeartBeansBalance: normalizePositiveNumber(
      existing?.topupHeartBeansBalance,
      normalizePositiveNumber(existing?.heartBeansBalance, 0),
    ),
    subscriptionHeartBeansBalance: normalizePositiveNumber(existing?.subscriptionHeartBeansBalance, 0),
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    lastAuthAt: timestamp,
    disabled: false,
  }

  const savedMember = upsertMember(nextMember)
  res.status(existing ? 200 : 201).json(createMemberSession(savedMember))
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

  const savedMember = upsertMember(nextMember)
  res.json(createMemberSession(savedMember))
})

app.get('/api/member/session', requireMemberAuth, (req, res) => {
  const creditSnapshot = buildMemberCreditSnapshot(req.member)
  res.json({
    email: normalizeEmail(req.member.email),
    partnerName: String(req.member.partnerName || '').trim(),
    plan: String(req.member.plan || '').trim(),
    heartBeansBalance: creditSnapshot.heartBeansBalance,
    topupHeartBeansBalance: creditSnapshot.topupHeartBeansBalance,
    subscriptionHeartBeansBalance: creditSnapshot.subscriptionHeartBeansBalance,
    subscriptionStatus: String(req.member.subscriptionStatus || '').trim(),
    subscriptionPlanId: String(req.member.subscriptionPlanId || '').trim(),
    subscriptionCurrentPeriodEnd: String(req.member.subscriptionCurrentPeriodEnd || '').trim(),
    stripeCustomerId: String(req.member.stripeCustomerId || '').trim(),
    paypalSubscriptionId: String(req.member.paypalSubscriptionId || '').trim(),
    subscriptionProvider: String(req.member.subscriptionProvider || '').trim(),
    lastAuthAt: req.member.lastAuthAt || '',
    avatarUrl: String(req.member.avatarUrl || '').trim(),
  })
})

app.post('/api/member/logout', requireMemberAuth, (req, res) => {
  memberSessions.delete(readMemberToken(req))
  queuePersistenceSync('member session removed')
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
  const nextPlanId = String(patch.planId || current.planId || '').trim()
  const nextPlan = String(patch.plan || current.plan || '').trim()
  const nextPlanType = normalizePlanType(patch.planType || current.planType, 'credit_pack')
  const nextHeartBeans = normalizePositiveNumber(
    patch.heartBeans,
    normalizePositiveNumber(current.heartBeans, getDefaultHeartBeansForPlan({ id: nextPlanId, name: nextPlan, type: nextPlanType })),
  )
  const nextCreditsBalanceType = normalizeCreditBalanceType(
    patch.creditsBalanceType || current.creditsBalanceType,
    nextPlanType === 'subscription' ? 'subscription' : 'topup',
  )
  const next = {
    ...current,
    ...patch,
    id: current.id,
    email: nextEmail,
    planId: nextPlanId,
    plan: nextPlan,
    heartBeans: nextHeartBeans,
    planType: nextPlanType,
    creditsBalanceType: nextCreditsBalanceType,
  }
  const hasGrantedBefore = Boolean(String(current.heartBeansGrantedAt || '').trim())

  if (currentStatus !== 'paid' && nextStatus === 'paid' && !hasGrantedBefore) {
    if (!nextEmail) {
      res.status(400).json({ message: '订单缺少会员邮箱，无法发放订阅服务额度。' })
      return
    }

    awardHeartBeansToMember(nextEmail, nextHeartBeans, nextPlan, nextCreditsBalanceType, {
      sourceType: nextPlanType === 'subscription' ? 'subscription_manual' : 'topup_manual',
      sourceId: current.id,
      note: `Order ${current.id} marked paid by admin`,
    })
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

    const creditSnapshot = buildMemberCreditSnapshot(member)
    const available = nextCreditsBalanceType === 'subscription'
      ? creditSnapshot.subscriptionHeartBeansBalance
      : creditSnapshot.topupHeartBeansBalance
    if (available < nextHeartBeans) {
      res.status(400).json({ message: `会员当前仅剩 ${available} 点可回收额度，无法回收该订单的 ${nextHeartBeans} 点服务额度。` })
      return
    }

    void reclaimOrderCredits(next, `Order ${current.id} reclaimed by admin`)
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
      allowSignup: normalizeBoolean(patch.allowSignup, adminData.config.allowSignup),
      enableChineseSite: normalizeBoolean(patch.enableChineseSite, adminData.config.enableChineseSite),
      backgroundTheme: normalizeBackgroundTheme(patch.backgroundTheme, adminData.config.backgroundTheme),
      heartBeansPerGeneration: normalizePositiveNumber(patch.heartBeansPerGeneration, adminData.config.heartBeansPerGeneration),
    },
  }
  saveAdminData()
  res.json(adminData.config)
})

app.get('/api/site-config', (_req, res) => {
  res.json({
    enableChineseSite: normalizeBoolean(adminData.config.enableChineseSite, false),
    backgroundTheme: normalizeBackgroundTheme(adminData.config.backgroundTheme, 'vivid_rainbow'),
  })
})

app.get('/api/plans', (_req, res) => {
  res.json({ items: adminData.plans })
})

app.get('/api/showcase/tracks', (_req, res) => {
  const items = adminData.showcaseTracks.length ? adminData.showcaseTracks : productShowcaseTracks
  res.json({ items })
})

app.get('/api/payment/methods', (req, res) => {
  const requestedPlanId = String(req.query?.planId || '').trim()
  const requestedPlan = requestedPlanId ? findPlanById(requestedPlanId) : null
  const items = adminData.paymentMethods
    .filter((method) => Boolean(method?.enabled))
    .filter((method) => !requestedPlan || supportsPlanType(method, requestedPlan.type))
    .map((method) => ({
      id: String(method.id || ''),
      name: String(method.name || ''),
      description: String(method.description || ''),
      provider: normalizePaymentProvider(method.provider, 'paypal'),
      supportedPlanTypes: normalizePlanTypeList(method.supportedPlanTypes, ['credit_pack']),
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

app.post('/api/payment/create-order', async (req, res) => {
  const planId = String(req.body?.planId || '').trim()
  const methodId = String(req.body?.methodId || '').trim()
  const locale = String(req.body?.locale || 'en').trim() === 'zh' ? 'zh' : 'en'
  const memberToken = readMemberToken(req)
  const { session: memberSession, member, error, status } = getValidMemberFromToken(memberToken)

  if (!memberSession || !member) {
    res.status(status).json({ message: error })
    return
  }

  const email = normalizeEmail(memberSession.email)
  const plan = findPlanById(planId)
  if (!plan) {
    res.status(400).json({ message: '套餐不存在。' })
    return
  }

  const method = adminData.paymentMethods.find((item) => String(item.id) === methodId && Boolean(item.enabled)) || null
  if (!method) {
    res.status(400).json({ message: '支付方式不可用。' })
    return
  }

  if (!supportsPlanType(method, plan.type)) {
    res.status(400).json({ message: '该支付方式不支持当前套餐类型。' })
    return
  }

  const order = upsertOrder({
    id: `ord-${crypto.randomUUID()}`,
    couple: '',
    planId: plan.id,
    plan: plan.name,
    planType: normalizePlanType(plan.type, 'credit_pack'),
    amount: plan.price,
    heartBeans: normalizePositiveNumber(plan.heartBeans, getDefaultHeartBeansForPlan(plan)),
    creditsBalanceType: plan.type === 'subscription' ? 'subscription' : 'topup',
    status: 'pending',
    email,
    note: `${method.name} checkout`,
    paymentMethod: method.id,
    source: normalizePaymentProvider(method.provider, 'paypal') === 'stripe_checkout' ? 'stripe' : normalizePaymentProvider(method.provider, 'paypal'),
    mode: plan.type === 'subscription' ? 'subscription' : 'payment',
    createdAt: nowIso(),
  })

  try {
    const provider = normalizePaymentProvider(method.provider, 'paypal')

    if (provider === 'stripe_checkout') {
      if (!String(plan.stripePriceId || '').trim()) {
        res.status(400).json({ message: '当前 Stripe 套餐缺少 stripePriceId。' })
        return
      }

      const stripeResult = await createStripeCheckoutForPlan({
        member,
        plan,
        order,
        locale,
      })

      res.json({
        orderId: order.id,
        checkoutUrl: stripeResult.checkoutUrl,
        checkoutSessionId: stripeResult.checkoutSessionId,
      })
      return
    }

    if (provider === 'paypal') {
      const paypalResult = await createPayPalCheckoutForPlan({
        member,
        plan,
        order,
        locale,
      })

      res.json({
        orderId: order.id,
        checkoutUrl: paypalResult.checkoutUrl,
        paypalOrderId: paypalResult.paypalOrderId || '',
        paypalSubscriptionId: paypalResult.paypalSubscriptionId || '',
      })
      return
    }

    const checkoutUrl = getPaymentCheckoutUrl(method)
    if (!checkoutUrl) {
      res.status(400).json({ message: '该支付方式未配置收款链接。' })
      return
    }

    res.json({ orderId: order.id, checkoutUrl })
  } catch (error) {
    updateOrder(order.id, {
      status: 'error',
      note: error instanceof Error ? error.message : '创建支付会话失败。',
    })
    res.status(500).json({ message: error instanceof Error ? error.message : '创建支付会话失败。' })
  }
})

app.get('/api/paypal/checkout/return', async (req, res) => {
  const locale = String(req.query?.locale || 'en').trim() === 'zh' ? 'zh' : 'en'
  const mode = String(req.query?.mode || '').trim()
  const localOrderId = String(req.query?.orderId || '').trim()
  const token = String(req.query?.token || '').trim()
  const subscriptionId = String(req.query?.subscription_id || req.query?.ba_token || '').trim()
  const order = adminData.orders.find((item) => String(item.id || '').trim() === localOrderId) || findOrderByPayPalReference({
    orderId: token,
    subscriptionId,
  })

  try {
    if (!order) {
      res.redirect(buildFrontendHashUrl(locale, '/account', { checkout: 'error', provider: 'paypal' }))
      return
    }

    if (mode === 'payment') {
      const paypalOrderId = token || String(order.paypalOrderId || '').trim()
      if (!paypalOrderId) {
        throw new Error('缺少 PayPal order id。')
      }

      let captureId = String(order.paypalCaptureId || '').trim()
      if (!captureId) {
        const capturePayload = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
          method: 'POST',
          idempotencyKey: `${order.id}-capture`,
        })
        const capture = capturePayload?.purchase_units?.[0]?.payments?.captures?.[0] || null
        captureId = String(capture?.id || '').trim()
        updateOrder(order.id, {
          status: String(capture?.status || '').trim().toUpperCase() === 'COMPLETED' ? 'paid' : 'processing',
          paypalOrderId,
          paypalCaptureId: captureId,
        })
      }

      const refreshedOrder = adminData.orders.find((item) => item.id === order.id) || order
      if (!String(refreshedOrder.heartBeansGrantedAt || '').trim()) {
        awardHeartBeansToMember(refreshedOrder.email, refreshedOrder.heartBeans, refreshedOrder.plan, 'topup', {
          sourceType: 'paypal_topup',
          sourceId: captureId || paypalOrderId,
          note: `PayPal top-up order ${refreshedOrder.id}`,
        })
        updateOrder(refreshedOrder.id, {
          status: 'paid',
          heartBeansGrantedAt: nowIso(),
          paypalOrderId,
          paypalCaptureId: captureId,
        })
      }

      res.redirect(buildFrontendHashUrl(locale, '/account', {
        checkout: 'success',
        provider: 'paypal',
        planId: refreshedOrder.planId,
      }))
      return
    }

    if (mode === 'subscription') {
      const effectiveSubscriptionId = subscriptionId || token || String(order.paypalSubscriptionId || '').trim()
      updateOrder(order.id, {
        status: 'processing',
        paypalSubscriptionId: effectiveSubscriptionId,
      })

      const member = findMemberByEmail(order.email)
      if (member && effectiveSubscriptionId) {
        try {
          await syncMemberSubscriptionFromPayPal(member, effectiveSubscriptionId, findPlanById(order.planId))
        } catch {
          // Wait for webhook confirmation if the subscription is not queryable yet.
        }
      }

      res.redirect(buildFrontendHashUrl(locale, '/account', {
        checkout: 'success',
        provider: 'paypal',
        subscription: 'pending',
        planId: order.planId,
      }))
      return
    }

    res.redirect(buildFrontendHashUrl(locale, '/account', { checkout: 'success', provider: 'paypal' }))
  } catch {
    res.redirect(buildFrontendHashUrl(locale, '/account', { checkout: 'error', provider: 'paypal', planId: order?.planId || '' }))
  }
})

app.get('/api/paypal/checkout/cancel', (req, res) => {
  const locale = String(req.query?.locale || 'en').trim() === 'zh' ? 'zh' : 'en'
  const planId = String(req.query?.planId || '').trim()
  res.redirect(buildFrontendHashUrl(locale, '/checkout', {
    checkout: 'cancel',
    provider: 'paypal',
    planId,
  }))
})

app.post('/api/stripe/create-billing-portal', requireMemberAuth, async (req, res) => {
  try {
    const customerId = String(req.member?.stripeCustomerId || '').trim()
    if (!customerId) {
      res.status(400).json({ message: '当前会员还没有 Stripe 订阅记录。' })
      return
    }

    const stripeClient = getStripeClient()
    const locale = String(req.body?.locale || 'en').trim() === 'zh' ? 'zh' : 'en'
    const portalSession = await stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: buildFrontendHashUrl(locale, '/account', { portal: 'returned' }),
    })

    res.json({ url: portalSession.url })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : '创建订阅管理入口失败。' })
  }
})

app.post('/api/stripe/webhook', async (req, res) => {
  if (!STRIPE_WEBHOOK_SECRET) {
    res.status(400).json({ message: '缺少 STRIPE_WEBHOOK_SECRET。' })
    return
  }

  let event

  try {
    const stripeClient = getStripeClient()
    const signatureHeader = req.headers['stripe-signature']
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
    event = stripeClient.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Webhook 验签失败。' })
    return
  }

  if (hasProcessedStripeEvent(event.id)) {
    res.json({ received: true, duplicated: true })
    return
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const orderId = String(session.metadata?.orderId || '').trim()
      const planId = String(session.metadata?.planId || '').trim()
      const memberEmail = normalizeEmail(session.metadata?.memberEmail)
      const plan = findPlanById(planId)
      const order = findOrderByStripeReference({ checkoutSessionId: session.id }) || adminData.orders.find((item) => item.id === orderId) || null

      if (order) {
        const patch = {
          status: plan?.type === 'subscription' ? 'active' : (session.payment_status === 'paid' ? 'paid' : order.status),
          stripeCheckoutSessionId: session.id,
          stripeCustomerId: String(session.customer || order.stripeCustomerId || '').trim(),
          stripePaymentIntentId: String(session.payment_intent || '').trim(),
          stripeInvoiceId: String(session.invoice || '').trim(),
          stripeSubscriptionId: String(session.subscription || '').trim(),
          mode: String(session.mode || order.mode || '').trim(),
          source: 'stripe',
        }
        updateOrder(order.id, patch)
      }

      if (plan?.type === 'credit_pack' && session.payment_status === 'paid' && order && !String(order.heartBeansGrantedAt || '').trim()) {
        awardHeartBeansToMember(memberEmail, order.heartBeans, order.plan, 'topup', {
          sourceType: 'stripe_topup',
          sourceId: session.id,
          note: `Stripe top-up order ${order.id}`,
        })
        updateOrder(order.id, {
          status: 'paid',
          heartBeansGrantedAt: nowIso(),
        })
      }

      if (plan?.type === 'subscription' && memberEmail && session.subscription) {
        const member = findMemberByEmail(memberEmail)
        if (member) {
          await syncMemberSubscriptionFromStripe(member, String(session.subscription).trim(), plan)
        }
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object
      const subscriptionId = String(invoice.subscription || '').trim()
      const customerId = String(invoice.customer || '').trim()
      const invoiceId = String(invoice.id || '').trim()
      const priceId = String(invoice.lines?.data?.[0]?.price?.id || '').trim()
      const member = adminData.members.find((item) => String(item?.stripeCustomerId || '').trim() === customerId) || null
      const plan = findPlanByStripePriceId(priceId)

      if (member && plan && subscriptionId) {
        const existingLedger = (adminData.creditLedger || []).some((entry) =>
          String(entry?.sourceType || '').trim() === 'subscription_cycle'
          && String(entry?.sourceId || '').trim() === invoiceId,
        )

        const savedMember = await syncMemberSubscriptionFromStripe(member, subscriptionId, plan)

        if (!existingLedger) {
          awardHeartBeansToMember(savedMember.email, plan.heartBeans, plan.name, 'subscription', {
            sourceType: 'subscription_cycle',
            sourceId: invoiceId,
            note: `Stripe subscription invoice ${invoiceId}`,
          })
        }

        const existingOrder = findOrderByStripeReference({ invoiceId, subscriptionId })
        const periodEnd = invoice.lines?.data?.[0]?.period?.end
          ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
          : savedMember.subscriptionCurrentPeriodEnd || ''
        if (existingOrder) {
          updateOrder(existingOrder.id, {
            status: 'paid',
            stripeInvoiceId: invoiceId,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            heartBeansGrantedAt: existingOrder.heartBeansGrantedAt || nowIso(),
            subscriptionCurrentPeriodEnd: periodEnd,
          })
        } else {
          upsertOrder({
            id: `ord-${crypto.randomUUID()}`,
            couple: '',
            planId: plan.id,
            plan: plan.name,
            planType: 'subscription',
            amount: normalizePositiveNumber(invoice.amount_paid, 0) / 100,
            heartBeans: normalizePositiveNumber(plan.heartBeans, 0),
            creditsBalanceType: 'subscription',
            status: 'paid',
            email: savedMember.email,
            note: 'Stripe subscription renewal',
            paymentMethod: 'stripe_checkout',
            source: 'stripe',
            mode: 'subscription',
            stripeInvoiceId: invoiceId,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: customerId,
            heartBeansGrantedAt: nowIso(),
            subscriptionCurrentPeriodEnd: periodEnd,
            createdAt: nowIso(),
          })
        }
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object
      const customerId = String(invoice.customer || '').trim()
      const subscriptionId = String(invoice.subscription || '').trim()
      const member = adminData.members.find((item) => String(item?.stripeCustomerId || '').trim() === customerId) || null
      if (member) {
        upsertMember({
          ...member,
          subscriptionStatus: 'past_due',
          subscriptionProvider: 'stripe',
          updatedAt: nowIso(),
        })
      }

      const order = findOrderByStripeReference({ invoiceId: invoice.id, subscriptionId })
      if (order) {
        updateOrder(order.id, {
          status: 'payment_failed',
          stripeInvoiceId: String(invoice.id || '').trim(),
          stripeSubscriptionId: subscriptionId,
        })
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const customerId = String(subscription.customer || '').trim()
      const priceId = String(subscription.items?.data?.[0]?.price?.id || '').trim()
      const member = adminData.members.find((item) => String(item?.stripeCustomerId || '').trim() === customerId) || null
      const plan = findPlanByStripePriceId(priceId)
      if (member) {
        upsertMember({
          ...member,
          plan: plan?.name || member.plan || '',
          subscriptionPlanId: plan?.id || member.subscriptionPlanId || '',
          subscriptionStatus: String(subscription.status || '').trim(),
          subscriptionProvider: 'stripe',
          subscriptionCurrentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : '',
          updatedAt: nowIso(),
        })
      }

      const order = findOrderByStripeReference({ subscriptionId: subscription.id })
      if (order) {
        updateOrder(order.id, {
          status: event.type === 'customer.subscription.deleted' ? 'cancelled' : String(subscription.status || order.status || '').trim(),
          stripeSubscriptionId: String(subscription.id || '').trim(),
          subscriptionCurrentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : '',
        })
      }
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object
      const invoiceId = String(charge.invoice || '').trim()
      const paymentIntentId = String(charge.payment_intent || '').trim()
      const order = adminData.orders.find((item) =>
        String(item?.stripeInvoiceId || '').trim() === invoiceId
        || String(item?.stripePaymentIntentId || '').trim() === paymentIntentId,
      ) || null

      if (order) {
        await reclaimOrderCredits(order, `Stripe refund ${String(charge.id || '').trim()}`)
        updateOrder(order.id, {
          status: 'refunded',
        })
      }
    }

    markProcessedStripeEvent(event.id)
    res.json({ received: true })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Webhook 处理失败。' })
  }
})

app.post('/api/paypal/webhook', async (req, res) => {
  const event = req.body && typeof req.body === 'object' ? req.body : null
  if (!event) {
    res.status(400).json({ message: 'Webhook payload 无效。' })
    return
  }

  try {
    const verified = await verifyPayPalWebhook(event, req.headers)
    if (!verified) {
      res.status(400).json({ message: 'PayPal webhook 验签失败。' })
      return
    }

    const eventType = String(event.event_type || '').trim()
    const resource = event.resource || {}

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const captureId = String(resource.id || '').trim()
      const orderId = String(resource.supplementary_data?.related_ids?.order_id || '').trim()
      const order = findOrderByPayPalReference({ captureId, orderId })

      if (order) {
        updateOrder(order.id, {
          status: 'paid',
          paypalOrderId: orderId || order.paypalOrderId || '',
          paypalCaptureId: captureId,
        })

        const latestOrder = adminData.orders.find((item) => item.id === order.id) || order
        if (!String(latestOrder.heartBeansGrantedAt || '').trim()) {
          awardHeartBeansToMember(latestOrder.email, latestOrder.heartBeans, latestOrder.plan, 'topup', {
            sourceType: 'paypal_topup',
            sourceId: captureId || orderId,
            note: `PayPal top-up capture ${captureId || orderId}`,
          })
          updateOrder(latestOrder.id, {
            heartBeansGrantedAt: nowIso(),
          })
        }
      }
    }

    if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const captureId = String(resource.id || resource.capture_id || '').trim()
      const order = findOrderByPayPalReference({ captureId })
      if (order) {
        await reclaimOrderCredits(order, `PayPal refund ${captureId}`)
        updateOrder(order.id, {
          status: 'refunded',
        })
      }
    }

    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'BILLING.SUBSCRIPTION.UPDATED') {
      const paypalSubscriptionId = String(resource.id || '').trim()
      const plan = findPlanByPayPalPlanId(String(resource.plan_id || '').trim())
      const order = findOrderByPayPalReference({ subscriptionId: paypalSubscriptionId })
        || adminData.orders.find((item) => String(item.id || '').trim() === String(resource.custom_id || '').trim())
        || null
      const member = order ? findMemberByEmail(order.email) : null

      if (order) {
        updateOrder(order.id, {
          status: String(resource.status || '').trim().toLowerCase() || 'active',
          paypalSubscriptionId,
          subscriptionCurrentPeriodEnd: String(resource.billing_info?.next_billing_time || '').trim(),
        })
      }

      if (member && paypalSubscriptionId) {
        const syncedMember = await syncMemberSubscriptionFromPayPal(member, paypalSubscriptionId, plan || findPlanById(order?.planId || ''))
        const initialSourceId = `paypal-subscription-activation:${paypalSubscriptionId}`
        const alreadyGranted = (adminData.creditLedger || []).some((entry) =>
          String(entry?.sourceId || '').trim() === initialSourceId,
        )

        if (!alreadyGranted && plan) {
          awardHeartBeansToMember(syncedMember.email, plan.heartBeans, plan.name, 'subscription', {
            sourceType: 'subscription_cycle',
            sourceId: initialSourceId,
            note: `PayPal subscription activation ${paypalSubscriptionId}`,
          })
          if (order) {
            updateOrder(order.id, {
              heartBeansGrantedAt: order.heartBeansGrantedAt || nowIso(),
              status: 'active',
            })
          }
        }
      }
    }

    if (eventType === 'PAYMENT.SALE.COMPLETED') {
      const billingAgreementId = String(resource.billing_agreement_id || '').trim()
      const transactionId = String(resource.id || '').trim()
      const amountValue = normalizePositiveNumber(resource.amount?.total, 0)
      const plan = adminData.plans.find((item) =>
        String(item.paypalPlanId || '').trim() && findOrderByPayPalReference({ subscriptionId: billingAgreementId })?.planId === item.id,
      ) || null
      const order = findOrderByPayPalReference({ subscriptionId: billingAgreementId })
      const member = order ? findMemberByEmail(order.email) : null

      if (member && order) {
        const sourceId = `paypal-subscription-cycle:${transactionId}`
        const alreadyGranted = (adminData.creditLedger || []).some((entry) =>
          String(entry?.sourceId || '').trim() === sourceId,
        )

        if (!alreadyGranted) {
          awardHeartBeansToMember(member.email, order.heartBeans, order.plan, 'subscription', {
            sourceType: 'subscription_cycle',
            sourceId,
            note: `PayPal subscription renewal ${transactionId}`,
          })
        }

        upsertOrder({
          id: `ord-${crypto.randomUUID()}`,
          couple: '',
          planId: order.planId,
          plan: order.plan,
          planType: 'subscription',
          amount: amountValue || order.amount,
          heartBeans: order.heartBeans,
          creditsBalanceType: 'subscription',
          status: 'paid',
          email: member.email,
          note: 'PayPal subscription renewal',
          paymentMethod: 'paypal',
          source: 'paypal',
          mode: 'subscription',
          paypalSubscriptionId: billingAgreementId,
          heartBeansGrantedAt: nowIso(),
          subscriptionCurrentPeriodEnd: String(resource.next_payment_date || '').trim(),
          createdAt: nowIso(),
        })
      }
    }

    if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
      const paypalSubscriptionId = String(resource.id || '').trim()
      const order = findOrderByPayPalReference({ subscriptionId: paypalSubscriptionId })
      const member = order ? findMemberByEmail(order.email) : adminData.members.find((item) => String(item?.paypalSubscriptionId || '').trim() === paypalSubscriptionId) || null

      if (member) {
        upsertMember({
          ...member,
          subscriptionStatus: String(resource.status || eventType.split('.').pop() || '').trim().toLowerCase(),
          subscriptionProvider: 'paypal',
          updatedAt: nowIso(),
        })
      }

      if (order) {
        updateOrder(order.id, {
          status: String(resource.status || '').trim().toLowerCase() || 'cancelled',
          paypalSubscriptionId,
        })
      }
    }

    if (eventType === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
      const paypalSubscriptionId = String(resource.id || resource.subscription_id || '').trim()
      const order = findOrderByPayPalReference({ subscriptionId: paypalSubscriptionId })
      const member = order ? findMemberByEmail(order.email) : adminData.members.find((item) => String(item?.paypalSubscriptionId || '').trim() === paypalSubscriptionId) || null

      if (member) {
        upsertMember({
          ...member,
          subscriptionStatus: 'payment_failed',
          subscriptionProvider: 'paypal',
          updatedAt: nowIso(),
        })
      }

      if (order) {
        updateOrder(order.id, {
          status: 'payment_failed',
          paypalSubscriptionId,
        })
      }
    }

    res.json({ received: true })
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'PayPal webhook 处理失败。' })
  }
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
    paymentMethods: items.map((item) => ({
      id: String(item?.id || '').trim(),
      name: String(item?.name || '').trim(),
      enabled: normalizeBoolean(item?.enabled, false),
      provider: normalizePaymentProvider(item?.provider, String(item?.id || '').trim() === 'stripe_checkout' ? 'stripe_checkout' : 'paypal'),
      envKey: String(item?.envKey || '').trim(),
      supportedPlanTypes: normalizePlanTypeList(item?.supportedPlanTypes, ['credit_pack']),
      description: String(item?.description || '').trim(),
    })),
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

  const savedMember = upsertMember(next)
  res.json(savedMember)
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
    plans: items.map((item) => ({
      ...item,
      id: String(item?.id || '').trim(),
      name: String(item?.name || '').trim(),
      type: normalizePlanType(item?.type, String(item?.billingInterval || '').trim() ? 'subscription' : 'credit_pack'),
      billingInterval: normalizeBillingInterval(item?.billingInterval),
      stripePriceId: String(item?.stripePriceId || '').trim(),
      paypalPlanId: String(item?.paypalPlanId || '').trim(),
      price: normalizePositiveNumber(item?.price, 0),
      heartBeans: normalizePositiveNumber(item?.heartBeans, getDefaultHeartBeansForPlan(item)),
      currency: String(item?.currency || 'USD').trim() || 'USD',
      badge: String(item?.badge || '').trim(),
      features: Array.isArray(item?.features) ? item.features.map((feature) => String(feature || '').trim()).filter(Boolean) : [],
    })),
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

app.post('/api/paypal/create-order', async (req, res) => {
  const planId = String(req.body?.planId || '').trim()
  const locale = String(req.body?.locale || 'en').trim() === 'zh' ? 'zh' : 'en'
  const memberToken = readMemberToken(req)
  const { session: memberSession, member, error, status } = getValidMemberFromToken(memberToken)

  if (!memberSession || !member) {
    res.status(status).json({ message: error })
    return
  }

  const email = normalizeEmail(memberSession.email)
  const plan = findPlanById(planId)
  if (!plan) {
    res.status(400).json({ message: '套餐不存在。' })
    return
  }

  const method = adminData.paymentMethods.find((item) => String(item.id) === 'paypal' && Boolean(item.enabled)) || {
    id: 'paypal',
    name: 'PayPal',
    enabled: true,
    envKey: 'PAYPAL_CHECKOUT_URL',
    provider: 'paypal',
    supportedPlanTypes: ['subscription', 'credit_pack'],
    description: 'PayPal Checkout & Subscriptions',
  }

  if (!supportsPlanType(method, plan.type)) {
    res.status(400).json({ message: 'PayPal 不支持当前套餐类型。' })
    return
  }

  const nextOrder = upsertOrder({
    id: `ord-${crypto.randomUUID()}`,
    couple: '',
    planId: plan.id,
    plan: plan.name,
    planType: normalizePlanType(plan.type, 'credit_pack'),
    amount: plan.price,
    heartBeans: normalizePositiveNumber(plan.heartBeans, getDefaultHeartBeansForPlan(plan)),
    creditsBalanceType: normalizePlanType(plan.type, 'credit_pack') === 'subscription' ? 'subscription' : 'topup',
    status: 'pending',
    email,
    note: 'PayPal checkout',
    paymentMethod: 'paypal',
    source: 'paypal',
    mode: normalizePlanType(plan.type, 'credit_pack') === 'subscription' ? 'subscription' : 'payment',
    createdAt: nowIso(),
  })

  try {
    const paypalResult = await createPayPalCheckoutForPlan({
      member,
      plan,
      order: nextOrder,
      locale,
    })

    res.json({
      orderId: nextOrder.id,
      checkoutUrl: paypalResult.checkoutUrl,
      paypalOrderId: paypalResult.paypalOrderId || '',
      paypalSubscriptionId: paypalResult.paypalSubscriptionId || '',
    })
  } catch (error) {
    updateOrder(nextOrder.id, {
      status: 'error',
      note: error instanceof Error ? error.message : '创建 PayPal 会话失败。',
    })
    res.status(500).json({ message: error instanceof Error ? error.message : '创建 PayPal 会话失败。' })
  }
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
    const lyrics = await generateLyrics(job.id, input)
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

    // Always keep a polling fallback alive. Production normally relies on callback,
    // but callback loss would otherwise leave jobs stuck in generating_song forever.
    void pollSunoTask(job.id, sunoTaskId)

    res.json({
      jobId: job.id,
      callbackEnabled: Boolean(PUBLIC_BASE_URL),
    })
  } catch (error) {
    if (debitedMember) {
      refundHeartBeansToMember(debitedMember, debitedMember.debited, {
        sourceType: 'generation_refund',
        sourceId: job.id,
        note: 'Generation failed, credits refunded',
      })
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

function resolveSongSource(songId) {
  const storedSong = adminData.songs.find((item) => item.id === songId)
  const relatedJobId = String(storedSong?.jobId || songId).trim()
  const job = jobs.get(relatedJobId)
  const relatedTrack = Number.isInteger(storedSong?.trackIndex)
    ? job?.tracks?.[storedSong.trackIndex]
    : job?.tracks?.[0]
  const sourceUrl = pickUsableAudioUrl(
    relatedTrack?.downloadUrl,
    relatedTrack?.audioUrl,
    relatedTrack?.sourceDownloadUrl,
    relatedTrack?.sourceAudioUrl,
    storedSong?.downloadUrl,
    storedSong?.audioUrl,
    storedSong?.sourceDownloadUrl,
    storedSong?.sourceAudioUrl,
  )

  return {
    storedSong,
    sourceUrl,
  }
}

function buildSongFileName(song) {
  const title = String(song?.title || 'MelodyVow Song')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${title || 'MelodyVow Song'}.mp3`
}

async function proxySongAudio(req, res, disposition = 'inline') {
  const songId = String(req.params.songId || '').trim()
  const { storedSong, sourceUrl } = resolveSongSource(songId)
  const rangeHeader = String(req.headers.range || '').trim()

  // #region debug-point C:proxy-song-audio
  reportDebugEvent({
    hypothesisId: 'C',
    location: 'web/server/index.mjs:proxySongAudio',
    msg: '[DEBUG] Proxying song audio request',
    data: {
      songId,
      disposition,
      hasStoredSong: Boolean(storedSong),
      sourceUrl: sourceUrl || '',
      storedSongAudioUrl: storedSong?.audioUrl || '',
      storedSongDownloadUrl: storedSong?.downloadUrl || '',
      storedSongSourceAudioUrl: storedSong?.sourceAudioUrl || '',
      storedSongSourceDownloadUrl: storedSong?.sourceDownloadUrl || '',
      jobId: storedSong?.jobId || '',
      trackIndex: storedSong?.trackIndex ?? -1,
      rangeHeader,
    },
  })
  // #endregion

  if (!sourceUrl) {
    res.status(404).json({ message: '当前歌曲还没有可下载的音频链接。' })
    return
  }

  try {
    const upstream = await fetch(sourceUrl, {
      headers: rangeHeader ? { Range: rangeHeader } : undefined,
    })
    if (!upstream.ok) {
      throw new Error(`upstream_${upstream.status}`)
    }

    const fileName = buildSongFileName(storedSong)
    const contentType = upstream.headers.get('content-type') || 'audio/mpeg'
    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes'
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`)
    res.setHeader('Accept-Ranges', acceptRanges)
    if (contentLength) {
      res.setHeader('Content-Length', contentLength)
    }
    if (contentRange) {
      res.setHeader('Content-Range', contentRange)
    }

    const upstreamBody = upstream.body ? Readable.fromWeb(upstream.body) : null
    res.status(upstream.status)

    if (!upstreamBody) {
      res.end()
      return
    }

    upstreamBody.on('error', (streamError) => {
      if (!res.headersSent) {
        res.status(502).json({ message: disposition === 'attachment' ? '下载歌曲失败，请稍后再试。' : '歌曲播放链接暂时不可用。' })
        return
      }

      res.destroy(streamError)
    })

    upstreamBody.pipe(res)
  } catch (error) {
    // #region debug-point C:proxy-song-audio-error
    reportDebugEvent({
      hypothesisId: 'C',
      location: 'web/server/index.mjs:proxySongAudio',
      msg: '[DEBUG] Proxy song audio request failed',
      data: {
        songId,
        disposition,
        sourceUrl,
        rangeHeader,
        error: error instanceof Error ? error.message : 'unknown',
      },
    })
    // #endregion
    res.status(502).json({ message: disposition === 'attachment' ? '下载歌曲失败，请稍后再试。' : '歌曲播放链接暂时不可用。' })
  }
}

app.get('/api/songs/:songId/stream', async (req, res) => {
  await proxySongAudio(req, res, 'inline')
})

app.get('/api/songs/:songId/download', async (req, res) => {
  await proxySongAudio(req, res, 'attachment')
})

app.get('/api/suno/callback', handleSunoCallback)
app.post('/api/suno/callback', handleSunoCallback)

function resumePendingSunoJobs() {
  for (const job of jobs.values()) {
    if (!job?.id || !job?.sunoTaskId) {
      continue
    }

    if (job.status === 'generating_song' || job.status === 'lyrics_ready') {
      void pollSunoTask(job.id, job.sunoTaskId)
    }
  }
}

async function bootstrap() {
  if (persistence?.enabled) {
    try {
      await persistence.testConnection()
      const remoteSnapshot = await persistence.hydrateSnapshot()
      if (hasRemoteSnapshot(remoteSnapshot)) {
        restoreStateFromSnapshot(remoteSnapshot)
        saveAdminData()
        resumePendingSunoJobs()
        console.log('[persistence] Restored state from Supabase Postgres.')
      }
      else {
        await persistence.persistSnapshot(buildPersistenceSnapshot())
        console.log('[persistence] Imported local JSON state into Supabase Postgres.')
      }
    } catch (error) {
      console.error('[persistence] Database bootstrap failed, fallback to local JSON only:', error)
    }
  }
  else {
    console.log('[persistence] DATABASE_URL 未配置，当前继续使用本地 JSON 持久化。')
  }

  app.listen(PORT, () => {
    console.log(`MelodyVow API server listening on http://127.0.0.1:${PORT}`)
  })
}

void bootstrap()
