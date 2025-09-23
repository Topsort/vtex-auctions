import { ExternalClient, InstanceOptions, IOContext } from '@vtex/api'
import { parseState } from '../utils/searchState'
import { unveil } from '../resolvers/search/utils'

interface TopsortQueryArgParams {
  type: string
  value: string
}

const isPathTraversal = (str: string) => str.indexOf('..') >= 0

interface CorrectionParams {
  query: string
}

type AuctionType = 'banners' | 'listings'

interface Asset {
  url: string
}

interface Winner {
  asset: Asset[]
  id: string
  rank: number
  resolvedBidId: string
  type: string
}

interface Result {
  error: boolean
  resultType: AuctionType
  winners: Winner[]
}

interface AuctionResult {
  results: Result[]
}

interface SearchSuggestionsParams {
  query: string
}

interface AutocompleteSearchSuggestionsParams {
  query: string
}

interface BannersArgs {
  query: string
}

interface FacetsArgs {
  query?: string
  page?: number
  count?: number
  sort?: string
  operator?: string
  fuzzy?: string
  leap?: boolean
  tradePolicy?: number
  searchState?: string
  hideUnavailableItems?: boolean | null
  removeHiddenFacets?: boolean | null
  options?: Options
  initialAttributes?: string
  workspaceSearchParams?: object
  regionId?: string | null
}

interface Product {
  productId: string
  productName: string
  cacheId: string
  properties: {
    name: string
    originalName: string
    values: string[]
  }[]
}

interface TopsortQuery {
  type: string
  products: { ids: string[] }
  slots: number
  searchQuery?: string
  category?: {
    id: string
  }
}

// If not in your codebase, extend this as needed
interface SearchResultArgs extends FacetsArgs {
  activateDebugSponsoredTags?: boolean
  sponsoredCount?: number
  transformCategoriesToPath?: boolean
}

const decodeQuery = (query: string) => {
  try {
    return decodeURIComponent(query)
  } catch {
    return query
  }
}

// ---------- helpers that DO NOT touch `this` ----------
const forbiddenFacetValues = ['installHook.js.map']

function normalizeSelectedFacets(
  selectedFacets: Array<{ key: string; value: string }> | undefined
): TopsortQueryArgParams[] {
  const out: TopsortQueryArgParams[] = []
  for (const f of selectedFacets ?? []) {
    if (forbiddenFacetValues.includes(f.value)) continue
    out.push({
      type: f.key === 'ft' || f.key === 'b' ? 'query' : f.key === 'c' ? 'category' : 'none',
      value: f.value,
    })
  }
  return out
}

// Conservative best-effort: supports "/c/electronics/phones"
function extractCategoriesFromPath(path: string): TopsortQueryArgParams[] {
  const m = path.match(/(?:^|\/)c\/([^?]+)/)
  if (!m) return []
  const parts = m[1].split('/').filter(Boolean)
  return parts.map((value) => ({ type: 'category', value }))
}

// ------------------------------------------------

export class IntelligentSearchApi extends ExternalClient {
  private locale: string | undefined

  public constructor(context: IOContext, options?: InstanceOptions) {
    super(
      `http://${context.workspace}--${context.account}.myvtex.com/_v/api/intelligent-search`,
      context,
      {
        ...options,
        headers: {
          ...options?.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )

    const { locale, tenant } = context
    this.locale = locale ?? tenant?.locale
  }

  public async topSearches() {
    return this.http.get('/top_searches', {
      params: {
        locale: this.locale,
        _t: Date.now(),
      },
      metric: 'topSearches',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  }

  public async correction(params: CorrectionParams) {
    return this.http.get('/correction_search', {
      params: { ...params, locale: this.locale, _t: Date.now() },
      metric: 'correction',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  }

  public async searchSuggestions(params: SearchSuggestionsParams) {
    return this.http.get('/search_suggestions', {
      params: { ...params, locale: this.locale, _t: Date.now() },
      metric: 'searchSuggestions',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  }

  public async autocompleteSearchSuggestions(
    params: AutocompleteSearchSuggestionsParams
  ) {
    return this.http.get('/autocomplete_suggestions', {
      params: { ...params, locale: this.locale, _t: Date.now() },
      metric: 'autocompleteSearchSuggestions',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  }

  public async banners(params: BannersArgs, path: string) {
    if (isPathTraversal(path)) {
      throw new Error('Malformed URL')
    }

    return this.http.get(`/banners/${path}`, {
      params: {
        ...params,
        query: decodeQuery(params.query),
        locale: this.locale,
        _t: Date.now(),
      },
      metric: 'banners',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  }

  public async facets(
    params: FacetsArgs,
    path: string,
    shippingHeader?: string[]
  ) {
    if (isPathTraversal(path)) {
      throw new Error('Malformed URL')
    }

    const { query, leap, searchState } = params

    const result = await this.http.get(`/facets/${path}`, {
      params: {
        ...params,
        query: query && decodeQuery(query),
        locale: this.locale,
        bgy_leap: leap ? true : undefined,
        ...parseState(searchState),
        _t: Date.now(),
      },
      metric: 'facets',
      headers: {
        'x-vtex-shipping-options': shippingHeader ?? '',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })

    // Expose normalized facets to callers if useful
    const selected = normalizeSelectedFacets(result?.queryArgs?.selectedFacets ?? [])
    ;(result as any).__selectedFacets = selected

    return result
  }

  public async productSearch(
    params: SearchResultArgs,
    path: string,
    shippingHeader?: string[]
  ) {
    const {
      query,
      leap,
      searchState,
      activateDebugSponsoredTags,
      sponsoredCount,
      transformCategoriesToPath,
      ...restParams
    } = params

    if (isPathTraversal(path)) {
      throw new Error('Malformed URL')
    }

    const result = await this.http.get(`/product_search/${path}`, {
      params: {
        query: query && decodeQuery(query),
        locale: this.locale,
        bgy_leap: leap ? true : undefined,
        ...parseState(searchState),
        ...restParams,
        _t: Date.now(),
      },
      metric: 'product-search',
      headers: {
        'x-vtex-shipping-options': shippingHeader ?? '',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })

    const productIds = (result.products || []).map((product: Product) => product.productId)
    const newProducts: Product[] = result.products || []

    const { data } = await this.http
      .get(
        `http://${this.context.workspace}--${this.context.account}.myvtex.com/_v/ts/settings`
      )
      .catch((error) => {
        console.error(`Error fetching Topsort Services settings: ${error}`)
        return undefined
      })

    const TOPSORT_API_KEY = unveil(data)?.marketplaceAPIKey || undefined

    const topsortQuery: TopsortQuery = {
      type: 'listings',
      products: { ids: productIds },
      slots: sponsoredCount || 2,
    }

    if (query && query.length > 0) {
      topsortQuery.searchQuery = query
    } else {
      // Resolve category facets fresh for THIS request
      const selectedFacets = await this.resolveSelectedFacetsForPath(
        params,
        path,
        shippingHeader,
        result
      )

      const categoryFacets = selectedFacets.filter((f) => f.type === 'category')
      if (categoryFacets.length > 0) {
        const lastCategory = categoryFacets[categoryFacets.length - 1]
        topsortQuery.category = {
          id: transformCategoriesToPath
            ? `/${categoryFacets.map((p) => p.value).join('/')}`
            : lastCategory.value,
        }
      }
    }

    console.log('[DEBUG] topsortQuery', topsortQuery)

    try {
      const auctionResult = await this.http.post<AuctionResult>(
        'http://api.topsort.com/v2/auctions',
        {
          auctions: [topsortQuery],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VTEX-Use-Https': true,
            'X-Vtex-Remote-Port': 443,
            'X-UA': '@topsort/vtex-search-resolver',
            Accept: 'application/json',
            Authorization: `Bearer ${TOPSORT_API_KEY}`,
          },
        }
      )

      const winners: Winner[] = auctionResult.results[0].winners

      const missingProducts: Winner[] = winners.filter(
        (winner: Winner) => !productIds.includes(winner.id)
      )

      console.log('[DEBUG] path', path)
      for (const winner of missingProducts) {
        const adProductResponse = await this.http.get('/product_search', {
          params: {
            query: `product:${winner.id}`,
            locale: this.locale,
            bgyLeap: undefined,
            _t: Date.now(),
          },
          metric: 'product-search-ad',
          headers: {
            'x-vtex-shipping-options': shippingHeader ?? '',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        })

        if (adProductResponse.products && adProductResponse.products[0]) {
          newProducts.push(adProductResponse.products[0])
        }
      }

      for (const winner of winners) {
        const index = newProducts.findIndex(
          (product: Product) => product && product.productId === winner.id
        )

        if (index !== -1) {
          const product = newProducts[index]
          if (!product) continue

          product.productName = activateDebugSponsoredTags
            ? `[AD] ${product.productName}`
            : product.productName
          product.cacheId = `ad-${product.cacheId}-${Math.random()}`

          product.properties.push({
            name: 'resolvedBidId',
            originalName: 'resolvedBidId',
            values: [winner.resolvedBidId],
          })

          newProducts.splice(index, 1)
          newProducts.unshift(product)
        }
      }

      result.products = newProducts
      return result
    } catch (error) {
      console.error('Error in auction processing:', error)
      return result
    }
  }

  public async sponsoredProducts(
    params: SearchResultArgs,
    path: string,
    shippingHeader?: string[]
  ) {
    const { query, leap, searchState, ...rest } = params
    if (isPathTraversal(path)) {
      throw new Error('Malformed URL')
    }

    return this.http.get(`/sponsored_products/${path}`, {
      params: {
        query: query && decodeQuery(query),
        locale: this.locale,
        bgy_leap: leap ? true : undefined,
        ...parseState(searchState),
        ...rest,
        _t: Date.now(),
      },
      metric: 'product-search',
      headers: {
        'x-vtex-shipping-options': shippingHeader ?? '',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  }

  // --------- MOVED INSIDE CLASS so `this.http` (protected) is allowed ----------
  private async resolveSelectedFacetsForPath(
    baseParams: FacetsArgs,
    path: string,
    shippingHeader?: string[],
    maybeProductSearchResult?: any
  ): Promise<TopsortQueryArgParams[]> {
    // 1) From current product_search result (fastest if available)
    const candidateFromProductSearch = normalizeSelectedFacets(
      maybeProductSearchResult?.queryArgs?.selectedFacets
    )
    if (candidateFromProductSearch.length) return candidateFromProductSearch

    // 2) Fresh facets fetch for the SAME path (authoritative)
    try {
      const { query, leap, searchState } = baseParams
      const facetsResult = await this.http.get(`/facets/${path}`, {
        params: {
          ...baseParams,
          query: query && decodeQuery(query),
          locale: this.locale,
          bgy_leap: leap ? true : undefined,
          ...parseState(searchState),
          _t: Date.now(),
        },
        metric: 'facets-for-productSearch',
        headers: {
          'x-vtex-shipping-options': shippingHeader ?? '',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })

      const candidateFromFacets = normalizeSelectedFacets(
        facetsResult?.queryArgs?.selectedFacets
      )
      if (candidateFromFacets.length) return candidateFromFacets
    } catch {
      // swallow; will fallback to path parsing
    }

    // 3) Last resort: infer from path format
    return extractCategoriesFromPath(path)
  }
}
