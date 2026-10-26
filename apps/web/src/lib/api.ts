import { createServerFn } from "@tanstack/react-start"
import { createHash } from "node:crypto"
import { getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server"
import type { SearchEventType, SearchSortBy } from "@martly/shared/constants"
import type {
  ApiResponse, StoreResolution, WebCategoryPage, WebCollectionPage, WebDepartmentPage, WebHome, WebHomeSectionsPage, WebListPage,
  WebProductPage, WebSearchLanding, WebSearchPage, WebSitemap, WebStorePage, WebSuggestion,
} from "@martly/shared/types"

const API_URL = process.env.MARTLY_API_URL ?? "http://localhost:7001/api/v1"

/** The shopper's store and town, remembered for a year so every page prices from the same store */
const STORE_COOKIE = "martly_store"
const TOWN_COOKIE = "martly_town"
const YEAR = 60 * 60 * 24 * 365

/** GETs from the Martly API; a 404 comes back as null so pages can show their own not-found */
async function get<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Martly API ${path} answered ${res.status}`)
  const body = (await res.json()) as ApiResponse<T>
  return body.data
}

async function required<T>(path: string) {
  const data = await get<T>(path)
  if (!data) throw new Error(`Martly API has nothing at ${path}`)
  return data
}

function remember(storeId: string, town?: string) {
  const options = { path: "/", maxAge: YEAR, sameSite: "lax" as const, httpOnly: true, secure: process.env.NODE_ENV === "production" }
  setCookie(STORE_COOKIE, storeId, options)
  if (town) setCookie(TOWN_COOKIE, town, options)
}

/** Query string carrying the remembered store and town, plus any page params */
function shopQuery(extra: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries({ store: getCookie(STORE_COOKIE), town: getCookie(TOWN_COOKIE), ...extra })) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  return `?${params}`
}

const seg = encodeURIComponent

// Server functions run on the server, so pages render with live data and the API needs no CORS for the site
export const getHome = createServerFn({ method: "GET" }).handler(() => required<WebHome>("/web/home"))

/** A store's page also makes it the shopper's store, so the shop opens on it */
export const getStorePage = createServerFn({ method: "GET" })
  .inputValidator((params: { town: string; store: string }) => params)
  .handler(async ({ data }) => {
    const page = await get<WebStorePage>(`/web/stores/${seg(data.town)}/${seg(data.store)}`)
    if (page) remember(page.store.id, page.town.slug)
    return page
  })

/** A page of the app's Home sections at the shopper's store; the first call has no cursor */
export const getHomeSections = createServerFn({ method: "GET" })
  .inputValidator((params: { cursor?: string }) => params)
  .handler(({ data }) => required<WebHomeSectionsPage>(`/web/home-sections${shopQuery({ cursor: data.cursor })}`))

export const getCollection = createServerFn({ method: "GET" })
  .inputValidator((params: { slug: string; aisle?: string; tile?: string; page?: number }) => params)
  .handler(({ data: { slug, ...filters } }) => get<WebCollectionPage>(`/web/collections/${seg(slug)}${shopQuery(filters)}`))

export const getBrand = createServerFn({ method: "GET" })
  .inputValidator((params: { slug: string; page?: number }) => params)
  .handler(({ data }) => get<WebListPage>(`/web/brands/${seg(data.slug)}${shopQuery({ page: data.page })}`))

export const getBuyGet = createServerFn({ method: "GET" })
  .inputValidator((params: { category?: string; page?: number }) => params)
  .handler(({ data }) => get<WebListPage>(`/web/offers/buy-get${shopQuery(data)}`))

export const getBestSellers = createServerFn({ method: "GET" }).handler(() => required<WebListPage>(`/web/best-sellers${shopQuery()}`))

export const getDeals = createServerFn({ method: "GET" })
  .inputValidator((params: { sectionId: string; band?: number; category?: string; page?: number }) => params)
  .handler(({ data: { sectionId, ...filters } }) => get<WebListPage>(`/web/deals/${seg(sectionId)}${shopQuery(filters)}`))

export const getDepartment = createServerFn({ method: "GET" })
  .inputValidator((params: { department: string }) => params)
  .handler(({ data }) => get<WebDepartmentPage>(`/web/departments/${seg(data.department)}${shopQuery()}`))

export const getCategory = createServerFn({ method: "GET" })
  .inputValidator((params: { department: string; category: string; sub?: string; page?: number }) => params)
  .handler(({ data }) => get<WebCategoryPage>(
    `/web/departments/${seg(data.department)}/${seg(data.category)}${shopQuery({ sub: data.sub, page: data.page })}`))

export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((params: { slug: string }) => params)
  .handler(({ data }) => get<WebProductPage>(`/web/products/${seg(data.slug)}${shopQuery()}`))

export interface SearchParams {
  q: string
  sub?: string
  tag?: string
  brand?: string
  size?: string
  food?: string
  offers?: 1
  sort?: SearchSortBy
  exact?: 1
}

export const searchShop = createServerFn({ method: "GET" })
  .inputValidator((params: SearchParams) => params)
  .handler(({ data }) => required<WebSearchPage>(`/web/search${shopQuery({ ...data })}`))

export const getSuggestions = createServerFn({ method: "GET" })
  .inputValidator((params: { q: string }) => params)
  .handler(({ data }) => required<WebSuggestion[]>(`/web/search/suggest${shopQuery({ q: data.q })}`))

export const getSearchLanding = createServerFn({ method: "GET" }).handler(() => required<WebSearchLanding>(`/web/search/landing${shopQuery()}`))

/**
 * POSTs for the site itself: WEB_API_SECRET proves to the API that it is the site, and the visitor is a hash of their IP,
 * so the API's rate limit counts each shopper rather than the site's server
 */
async function post<T>(path: string, body: unknown, visitor = false): Promise<T | null> {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (process.env.WEB_API_SECRET) headers["x-martly-web-secret"] = process.env.WEB_API_SECRET
  if (visitor) headers["x-martly-visitor"] = createHash("sha256").update(getRequestIP({ xForwardedFor: true }) ?? "unknown").digest("hex").slice(0, 32)
  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: JSON.stringify(body) })
  if (!res.ok) return null
  return ((await res.json()) as ApiResponse<T>).data
}

/** Feeds trending and ranking, like the app's search log; null when it wasn't logged, which never disturbs searching */
export const logSearch = createServerFn({ method: "POST" })
  .inputValidator((params: { storeId: string; query: string; resultCount: number }) => params)
  .handler(async ({ data }) => (await post<{ id: string }>("/web/search/log", data, true))?.id ?? null)

/** A result opened or added from a logged search; position is its 0-based place in the results */
export const logSearchEvent = createServerFn({ method: "POST" })
  .inputValidator((params: { searchLogId: string; product: string; type: SearchEventType; position: number }) => params)
  .handler(async ({ data }) => { await post("/web/search/event", data, true) })

/** Views and taps of sponsored results, counted against their banner like the app's */
export const recordAdEvents = createServerFn({ method: "POST" })
  .inputValidator((params: { storeId: string; events: { bannerId: string; type: "VIEW" | "TAP"; count: number }[] }) => params)
  .handler(async ({ data }) => { await post("/banners/events", data) })

export const getSitemap = createServerFn({ method: "GET" }).handler(() => required<WebSitemap>("/web/sitemap"))

/** Picks the shopper's store as the app does (a store, a town, or their location) and remembers it */
export const chooseStore = createServerFn({ method: "POST" })
  .inputValidator((params: { storeId?: string; town?: string; lat?: number; lng?: number }) => params)
  .handler(async ({ data }) => {
    const params = new URLSearchParams()
    if (data.storeId) params.set("current", data.storeId)
    if (data.town) params.set("town", data.town)
    if (data.lat !== undefined && data.lng !== undefined) {
      params.set("lat", String(data.lat))
      params.set("lng", String(data.lng))
    }
    const resolved = await get<StoreResolution<{ id: string; name: string }>>(`/stores/resolve?${params}`)
    if (!resolved) return null
    remember(resolved.store.id, data.town)
    return { name: resolved.store.name, deliversToYou: resolved.deliversToYou }
  })
