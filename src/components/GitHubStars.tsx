import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'

const REPO = '0x-Sigmoid/stackduck'
const CACHE_KEY = 'stackduck:gh-stars:' + REPO
const CACHE_TTL_MS = 60 * 60 * 1000

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

function GitHubMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/**
 * Header button linking to the public repo, with a live star count.
 * Count is cached for an hour; the button works fine without it.
 */
export default function GitHubStars() {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as {
        count: number
        at: number
      } | null
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        setStars(cached.count)
        return
      }
    } catch {
      // Corrupt cache — fall through to a fresh fetch.
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 5000)
    void fetch(`https://api.github.com/repos/${REPO}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { stargazers_count?: number } | null) => {
        if (cancelled || typeof data?.stargazers_count !== 'number') return
        setStars(data.stargazers_count)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ count: data.stargazers_count, at: Date.now() }))
        } catch {
          // Private-mode storage — the button still works, just uncached.
        }
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer))
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [])

  return (
    <a
      href={`https://github.com/${REPO}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Stackduck on GitHub"
      title="Stackduck on GitHub"
      className="btn-ghost flex items-center gap-2 !py-2 text-sm"
    >
      <GitHubMark />
      <span className="hidden font-inter font-medium md:inline">GitHub</span>
      {/* Hide the count until the repo has real stars — "★ 0" reads as a bug. */}
      {stars !== null && stars > 0 && (
        <span className="flex items-center gap-1 border-l border-line pl-2 font-inter font-semibold text-ink">
          <Star size={14} aria-hidden="true" />
          {formatCount(stars)}
        </span>
      )}
    </a>
  )
}
