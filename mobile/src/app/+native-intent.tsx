/**
 * The OIDC browser session returns to homecrate://auth/callback (see
 * OIDC_REDIRECT_URI). That URL is consumed by WebBrowser.openAuthSessionAsync,
 * not by a screen, so keep the router where it is instead of navigating to an
 * unmatched route.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    if (path.includes('auth/callback')) return initial ? '/' : null
    return path
  } catch {
    return '/'
  }
}
