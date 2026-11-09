import { queryOptions, skipToken } from '@tanstack/react-query'

import { unwrap, type ApiClient, type EntitySummary, type Schemas } from '@/lib/api/api'

export type BarcodeProduct = Schemas['repo.BarcodeProduct']

/** What a scanned code points at, before asking the server. */
export type ScanTarget =
  | { kind: 'entity'; id: string }
  | { kind: 'asset'; assetId: string }
  | { kind: 'product'; code: string }
  | { kind: 'text'; value: string }

/** What a scanned code turned out to be. */
export type ScanResult =
  | { kind: 'entity'; entity: EntitySummary }
  | { kind: 'product'; code: string; product?: BarcodeProduct; matches: EntitySummary[] }
  | { kind: 'not-found'; value: string; message: string }

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const ASSET_ID = /^\d{3}-?\d{3}$/

/**
 * Homebox labels encode links to the web app: `<server>/item/<id>`,
 * `<server>/location/<id>` or `<server>/a/<asset id>`. The host may be the
 * server's public name rather than the address the app uses, so only the
 * path is matched. Plain numbers are product barcodes (EAN/UPC) or, in the
 * 000-000 shape, asset IDs typed by hand.
 */
export function parseScan(raw: string): ScanTarget {
  const value = raw.trim()

  const entity = value.match(new RegExp(`/(?:item|location|items|locations|entities)/(${UUID})`, 'i'))
  if (entity) return { kind: 'entity', id: entity[1].toLowerCase() }

  const asset = value.match(/\/(?:a|assets)\/(\d{3}-?\d{3})(?:[/?#]|$)/)
  if (asset) return { kind: 'asset', assetId: normalizeAssetId(asset[1]) }

  if (new RegExp(`^${UUID}$`, 'i').test(value)) return { kind: 'entity', id: value.toLowerCase() }
  if (ASSET_ID.test(value)) return { kind: 'asset', assetId: normalizeAssetId(value) }
  if (/^\d{8,14}$/.test(value)) return { kind: 'product', code: value }

  return { kind: 'text', value }
}

function normalizeAssetId(id: string) {
  const digits = id.replace('-', '')
  return `${digits.slice(0, 3)}-${digits.slice(3)}`
}

export async function resolveScan(api: ApiClient, target: ScanTarget, signal?: AbortSignal): Promise<ScanResult> {
  switch (target.kind) {
    case 'entity': {
      try {
        const entity = await unwrap(api.GET('/v1/entities/{id}', { signal, params: { path: { id: target.id } } }))
        return { kind: 'entity', entity }
      } catch {
        return { kind: 'not-found', value: target.id, message: 'This label points to something that isn’t in this collection.' }
      }
    }
    case 'asset': {
      const result = await unwrap(api.GET('/v1/assets/{id}', { signal, params: { path: { id: target.assetId } } }))
      const entity = result.items?.[0]
      return entity
        ? { kind: 'entity', entity }
        : { kind: 'not-found', value: target.assetId, message: `No item has asset ID ${target.assetId}.` }
    }
    case 'product': {
      // Something you already own with this barcode (search also matches
      // serial / model numbers and custom fields)?
      const [owned, products] = await Promise.all([
        unwrap(api.GET('/v1/entities', { signal, params: { query: { q: target.code, pageSize: 5 } as never } })),
        unwrap(
          api.GET('/v1/products/search-from-barcode', { signal, params: { query: { productEAN: target.code } } }),
        ).catch(() => [] as BarcodeProduct[]),
      ])
      const matches = owned.items ?? []
      if (matches.length === 1) return { kind: 'entity', entity: matches[0] }
      // No match is a 204 with no body, so `products` can be undefined.
      return { kind: 'product', code: target.code, product: products?.[0], matches }
    }
    case 'text':
      return {
        kind: 'not-found',
        value: target.value,
        message: 'This code isn’t a Homebox label or a product barcode.',
      }
  }
}

/** Resolves a typed or linked code (e.g. an asset ID deep link). */
// The client is per session and the cache is cleared on sign-in and
// collection switch, so it doesn't belong in the key.
export const scanCodeQuery = (api: ApiClient | null, code: string) =>
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  queryOptions({
    queryKey: ['scan-code', code],
    queryFn: api ? ({ signal }) => resolveScan(api, parseScan(code), signal) : skipToken,
    retry: false,
  })
