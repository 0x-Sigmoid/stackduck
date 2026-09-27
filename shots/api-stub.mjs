// =============================================================================
// DESIGN-REVIEW API STUB — NOT THE REAL BACKEND.
//
// Exists only so the signed-in screens can be screenshotted on a machine with
// no Postgres/Docker. It serves hand-written fixtures for the handful of read
// endpoints the UI calls on load; writes are accepted and echoed.
// Never point this at anything real, and never treat its data as app state.
//
//   node shots/api-stub.mjs            # listens on :3001
// =============================================================================
import { createServer } from 'node:http'

const PORT = Number(process.env.STUB_PORT ?? 3001)
const now = Date.now()
const iso = (minsAgo) => new Date(now - minsAgo * 60000).toISOString()

const USER = {
  id: 'u_stub_001',
  email: 'founder@example.com',
  displayName: 'NodeDots',
  photoUrl: null,
  createdAt: iso(60 * 24 * 90),
  providers: ['password', 'github'],
  prefs: { defaultWindowDays: 30, portfolioSort: 'updated', emailProductUpdates: true },
}

const project = (id, name, status, extra = {}) => ({
  id,
  ownerId: USER.id,
  name,
  status,
  stackTags: [],
  environment: 'production',
  createdAt: iso(60 * 24 * 40),
  updatedAt: iso(3),
  ...extra,
})

const ENTRY = (p, connectorStatuses, keyMetrics, homeStatus) => ({
  project: p, connectorStatuses, keyMetrics, homeStatus,
})

const PROJECTS = [
  ENTRY(
    project('p_1', 'Tabmeet', 'active', {
      description: 'Marketplace for swapping browser tabs.',
      stackTags: ['react', 'firebase', 'stripe'],
      repoUrl: 'https://github.com/example/tabmeet',
      liveUrl: 'https://tabmeet.app',
    }),
    ['connected'],
    [
      { metricType: 'user_metrics', key: 'total_users', value: 12480, at: iso(4) },
      { metricType: 'error_metrics', key: 'error_count', value: 3, at: iso(4) },
      { metricType: 'revenue_metrics', key: 'revenue_30d', value: 2840, at: iso(4) },
    ],
    'green',
  ),
  ENTRY(project('p_2', 'Swaptrick', 'active', { stackTags: ['next', 'supabase'] }), ['connected'], [], 'green'),
  ENTRY(
    project('p_3', 'Lendloop', 'active', { stackTags: ['django', 'postgres'] }),
    ['error'],
    [{ metricType: 'user_metrics', key: 'signups', value: 42, at: iso(180) }],
    'amber',
  ),
  ENTRY(project('p_4', 'Studydeck', 'paused', { stackTags: ['vue'] }), ['pending'], [], 'gray'),
  ENTRY(project('p_5', 'Signly', 'archived', {}), [], [], 'gray'),
]

const connector = (id, type, authType, fetchMode, capabilities, status, extra = {}) => ({
  id, type, authType, fetchMode, capabilities, status,
  createdAt: iso(60 * 24 * 20), ...extra,
})

const CONNECTORS = {
  p_1: [
    connector('conn_stub_firebase', 'firebase', 'service_account', 'poll', ['user_metrics', 'error_metrics'], 'connected', {
      lastHealthCheck: iso(12), lastFetchedAt: iso(4),
    }),
    connector('conn_stub_webhook', 'generic-webhook', 'none', 'push', ['custom'], 'connected', { lastFetchedAt: iso(9) }),
  ],
  p_2: [
    connector('conn_stub_supabase', 'supabase', 'api_key', 'poll', ['user_metrics'], 'connected', {
      lastHealthCheck: iso(30), lastFetchedAt: iso(31),
    }),
  ],
  p_3: [
    connector('conn_stub_stripe', 'stripe', 'api_key', 'both', ['revenue_metrics'], 'error', {
      lastError: 'Stripe rejected the key (401). Check it wasn’t truncated and isn’t a publishable key.',
      lastHealthCheck: iso(60),
    }),
  ],
  p_4: [connector('conn_stub_pending', 'generic-webhook', 'none', 'push', [], 'pending')],
  // Project whose credentials did not survive the migration (D34) — drives the
  // "Reconnect your project" prompt.
  p_6: [
    connector('conn_stub_migrated', 'firebase', 'service_account', 'poll', ['user_metrics'], 'error', {
      lastError: 'Migrated from Firestore — reconnect to re-enter credentials.',
    }),
  ],
}

const RULES = {
  p_1: [
    {
      id: 'rule_1', projectId: 'p_1', metricType: 'error_metrics', key: 'error_count',
      condition: 'above', threshold: 10, windowMinutes: 15, channel: 'email',
      channelTarget: 'founder@example.com', status: 'active', createdAt: iso(60 * 24 * 6),
      lastTriggeredAt: iso(90), cooldownMinutes: 60,
    },
    {
      id: 'rule_2', projectId: 'p_1', metricType: 'user_metrics', key: 'signups',
      condition: 'below', threshold: 5, windowMinutes: 1440, channel: 'webhook',
      channelTarget: 'https://hooks.example.com/stackduck', status: 'muted',
      createdAt: iso(60 * 24 * 3), cooldownMinutes: 60,
    },
  ],
  p_3: [
    {
      id: 'rule_3', projectId: 'p_3', metricType: 'revenue_metrics', key: 'failed_24h',
      condition: 'above', threshold: 3, windowMinutes: 60, channel: 'email',
      channelTarget: 'founder@example.com', status: 'active', createdAt: iso(60 * 24),
      lastTriggeredAt: iso(45), cooldownMinutes: 30,
    },
  ],
}

const KEYS = {
  p_1: [
    { metricType: 'user_metrics', key: 'total_users' },
    { metricType: 'error_metrics', key: 'error_count' },
    { metricType: 'revenue_metrics', key: 'revenue_30d' },
  ],
  p_3: [{ metricType: 'user_metrics', key: 'signups' }],
}


// Included so the migration "reconnect" prompt is reachable in screenshots.
PROJECTS.push(
  ENTRY(project('p_6', 'Oldsign', 'active', { stackTags: ['firebase'] }), ['error'], [], 'amber'),
)

/** 30 days of daily buckets for a key (intraday points on the newest two days). */
function bucketsFor(key) {
  const base = key === 'error_count' ? 4 : key === 'revenue_30d' ? 95 : key === 'signups' ? 18 : 1200
  const out = []
  for (let d = 29; d >= 0; d--) {
    const date = new Date(now - d * 86400000).toISOString().slice(0, 10)
    const wobble = Math.round(Math.sin(d / 3) * (base * 0.25))
    const value = Math.max(1, base + wobble)
    out.push({
      date,
      points:
        d <= 1
          ? [
              { time: `${date}T09:15:00.000Z`, value: Math.round(value * 0.9) },
              { time: `${date}T14:40:00.000Z`, value },
            ]
          : [],
      dailyAggregate: { sum: value, avg: value, max: value, min: value },
    })
  }
  return out
}

const entryFor = (id) => PROJECTS.find((e) => e.project.id === id)

function route(pathname, url) {
  if (pathname === '/v1/auth/refresh') {
    return { accessToken: 'stub-access-token', refreshToken: 'stub-refresh-token' }
  }
  if (pathname === '/v1/auth/me') return { user: USER }
  if (pathname === '/v1/auth/logout') return { ok: true }
  if (pathname === '/v1/projects') {
    // STUB_EMPTY=1 renders the zero-project empty state (first-run onboarding).
    return { projects: process.env.STUB_EMPTY === '1' ? [] : PROJECTS }
  }
  if (pathname === '/v1/billing/plans') return { plans: [], portalAvailable: false }

  const detail = pathname.match(/^\/v1\/projects\/([^/]+)$/)
  if (detail) return entryFor(detail[1]) ?? { error: { code: 'not_found', message: 'Project not found.' } }
  const connectors = pathname.match(/^\/v1\/projects\/([^/]+)\/connectors$/)
  if (connectors) return { connectors: CONNECTORS[connectors[1]] ?? [] }
  const rules = pathname.match(/^\/v1\/projects\/([^/]+)\/alerts$/)
  if (rules) return { rules: RULES[rules[1]] ?? [] }
  const keys = pathname.match(/^\/v1\/projects\/([^/]+)\/metric-keys$/)
  if (keys) return { keys: KEYS[keys[1]] ?? [] }
  const metrics = pathname.match(/^\/v1\/projects\/([^/]+)\/metrics$/)
  if (metrics) return { buckets: bucketsFor(url.searchParams.get('key') ?? '') }
  return null
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  // The dev server is on another origin (5173), so CORS is required here.
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }
  const body = route(url.pathname, url)
  if (body === null) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { code: 'not_found', message: `STUB has no route for ${url.pathname}` } }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
})

server.listen(PORT, () => {
  console.log(`[design-review stub] listening on http://localhost:${PORT} — NOT the real backend`)
})
