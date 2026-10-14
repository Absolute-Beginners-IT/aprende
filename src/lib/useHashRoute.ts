import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'platform'; platform: string }
  | { name: 'runbook'; platform: string; task: string }
  | { name: 'fundamentals' }
  | { name: 'fundamental'; article: string }
  | { name: 'not-found' }

export function parseRoute(hash: string): Route {
  const segments = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const [root, platform, task, ...rest] = segments

  if (root === undefined) return { name: 'home' }
  if (root === 'f' && task === undefined) {
    return platform === undefined ? { name: 'fundamentals' } : { name: 'fundamental', article: platform }
  }
  if (root !== 'p' || platform === undefined || rest.length > 0) return { name: 'not-found' }
  return task === undefined ? { name: 'platform', platform } : { name: 'runbook', platform, task }
}

export const platformHref = (platform: string) => `#/p/${platform}`
export const runbookHref = (platform: string, task: string) => `#/p/${platform}/${task}`
export const fundamentalsHref = (article?: string) => (article ? `#/f/${article}` : '#/f')

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

// Hash routing keeps navigation working when index.html is opened straight from disk.
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}
