// Auth-flow contracts, used before a session (and the typed client) exists.
// Everything else comes from the generated schema.d.ts (`pnpm api:types`).

export interface ServerStatus {
  health: boolean
  title: string
  build: { version: string; commit: string; buildTime: string }
  demo: boolean
  allowRegistration: boolean
  oidc: {
    enabled: boolean
    buttonText?: string
    autoRedirect?: boolean
    allowLocal: boolean
    /** Server supports OIDC sign-in from native apps (redirect_uri + code_challenge handoff). */
    appLogin?: boolean
  }
}

export interface TokenResponse {
  /** "Bearer <token>" */
  token: string
  expiresAt: string
  attachmentToken: string
}

/** GET /users/refresh returns the token detail, not a TokenResponse. */
export interface TokenDetail {
  raw: string
  expiresAt: string
  attachmentToken: string
}
