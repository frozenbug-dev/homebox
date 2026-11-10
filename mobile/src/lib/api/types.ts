// Subset of the Homebox API contracts the app uses. The full set is generated
// for the web frontend in frontend/lib/api/types/data-contracts.ts.

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

export interface UserOut {
  id: string
  name: string
  email: string
  defaultGroupId: string
  groupIds: string[]
  isSuperuser: boolean
  oidcIssuer: string
  oidcSubject: string
}

export interface TagSummary {
  id: string
  name: string
  color: string
}

export interface EntityTypeSummary {
  id: string
  name: string
  icon?: string
  isLocation: boolean
}

export interface EntitySummary {
  id: string
  assetId: string
  name: string
  description: string
  quantity: number
  archived: boolean
  insured: boolean
  purchasePrice: number
  imageId?: string | null
  thumbnailId?: string | null
  entityType?: EntityTypeSummary | null
  parent?: EntitySummary | null
  tags: TagSummary[]
  createdAt: string
  updatedAt: string
}

export interface EntityListResult {
  items: EntitySummary[]
  page: number
  pageSize: number
  total: number
  totalPrice: number
}
