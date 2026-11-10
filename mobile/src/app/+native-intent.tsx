const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/**
 * Rewrites incoming links before routing:
 * - the OIDC browser session's return (homecrate://auth/callback) is consumed
 *   by WebBrowser.openAuthSessionAsync, so the router stays where it is;
 * - web-app style paths from Homebox labels map to app routes:
 *   /location/<id> → /place/<id>, /a/<asset id> → /asset/<asset id>
 *   (/item/<id> already matches).
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    if (path.includes('auth/callback')) return initial ? '/' : null

    const location = path.match(new RegExp(`/?locations?/(${UUID})`, 'i'))
    if (location) return `/place/${location[1].toLowerCase()}`

    const asset = path.match(/\/?a\/(\d{3}-?\d{3})(?:[/?#]|$)/)
    if (asset) return `/asset/${asset[1]}`

    return path
  } catch {
    return '/'
  }
}
