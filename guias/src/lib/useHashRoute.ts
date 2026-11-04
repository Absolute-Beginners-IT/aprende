import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'platform'; platform: string }
  /** `deviceId` is an inventory device whose values the runbook opens with (`?equipo=<id>`). */
  | { name: 'runbook'; platform: string; task: string; deviceId?: string }
  | { name: 'fundamentals' }
  | { name: 'fundamental'; article: string }
  | { name: 'status' }
  | { name: 'plan' }
  | { name: 'not-found' }

// Only a runbook reads its query; any other query, or an unknown key, is ignored.
const DEVICE_QUERY_KEY = 'equipo'

export function parseRoute(hash: string): Route {
  // Splits at the first «?» only: the query itself may hold more.
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split(/\?(.*)/s)
  const segments = path.split('/').filter(Boolean)
  const [root, second, third, ...rest] = segments

  if (root === undefined) return { name: 'home' }
  if (root === 'status' && second === undefined) return { name: 'status' }
  if (root === 'plan' && second === undefined) return { name: 'plan' }
  if (root === 'f' && third === undefined) {
    return second === undefined ? { name: 'fundamentals' } : { name: 'fundamental', article: second }
  }
  const [platform, task] = [second, third]
  if (root !== 'p' || platform === undefined || rest.length > 0) return { name: 'not-found' }
  if (task === undefined) return { name: 'platform', platform }
  // URLSearchParams decodes the id and never throws on a broken escape.
  const deviceId = new URLSearchParams(query).get(DEVICE_QUERY_KEY)
  return deviceId ? { name: 'runbook', platform, task, deviceId } : { name: 'runbook', platform, task }
}

export const platformHref = (platform: string) => `#/p/${platform}`
export const runbookHref = (platform: string, task: string, deviceId?: string) =>
  `#/p/${platform}/${task}${deviceId ? `?${DEVICE_QUERY_KEY}=${encodeURIComponent(deviceId)}` : ''}`
export const statusHref = '#/status'
export const planHref = '#/plan'
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
