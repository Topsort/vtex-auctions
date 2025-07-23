import { ExternalClient, InstanceOptions, IOContext } from '@vtex/api'
import { parseState } from '../utils/searchState'
import { unveil } from '../resolvers/search/utils'

interface TopsortQueryArgParams {
  type: string
  value: string
}

let topsortQueryArgParams: TopsortQueryArgParams[] = []

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

const decodeQuery = (query: string) => {
  try {
    return decodeURIComponent(query)
  } catch (e) {
    return query
  }
}

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
        query: params.query,
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
    topsortQueryArgParams = []
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

    const queryArgs = result.queryArgs.selectedFacets
    const forbiddenKeywords = ['installHook.js.map']
    for (const arg of queryArgs) {
      if (!forbiddenKeywords.includes(arg.value)) {
        topsortQueryArgParams.push({
          type:
            arg.key === 'ft' || arg.key === 'b'
              ? 'query'
              : arg.key === 'c'
              ? 'category'
              : 'none',
          value: arg.value,
        })
      }
    }

    return result
  }
  public async productSearch(
    params: SearchResultArgs,
    path: string,
    shippingHeader?: string[]
  ) {
    const { query, leap, searchState, activateDebugSponsoredTags, sponsoredCount, transformCategoriesToPath } = params

    if (isPathTraversal(path)) {
      throw new Error('Malformed URL')
    }

    const result = await this.http.get(`/product_search/${path}`, {
      params: {
        query: query && decodeQuery(query),
        locale: this.locale,
        bgy_leap: leap ? true : undefined,
        ...parseState(searchState),
        ...params,
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

    const productIds = result.products.map((product: any) => product.productId)
    const newProducts = result.products || []

    const { data } = await this.http
      .get(
        `http://${this.context.workspace}--${this.context.account}.myvtex.com/_v/ts/settings`
      )
      .catch((error) => {
        console.error(`Error fetching Topsort Services settings: ${error}`)
        return undefined
      })

    const TOPSORT_API_KEY = unveil(data)?.marketplaceAPIKey || undefined

    const topsortQuery: any = {
      type: 'listings',
      products: { ids: productIds },
      slots: sponsoredCount,
    }

    if (params.query && params.query.length > 0) {
      topsortQuery.searchQuery = params.query
    }

    if (
      topsortQueryArgParams.length > 0 &&
      topsortQueryArgParams[0].type === 'category'
    ) {
      console.log("[DEBUG] transformCategoriesToPath", transformCategoriesToPath)
      topsortQuery.categories = {
        ids: transformCategoriesToPath 
          ? topsortQueryArgParams.reduce((paths: string[], _, index) => {
              const path = topsortQueryArgParams
                .slice(0, index + 1)
                .map(a => a.value)
                .join('/')
              return [...paths, `/${path}/`]
            }, [])
          : topsortQueryArgParams.map(arg => arg.value)
      }
    }

    console.log("[DEBUG] topsortQuery", topsortQuery)

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

      const winners: any = auctionResult.results[0].winners

      const missingProducts: any = winners.filter(
        (id: string) => !productIds.includes(id)
      )

      for (const winner of missingProducts) {
        const adProductResponse = await this.http.get(
          `/product_search/${path}`,
          {
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
        newProducts.push(adProductResponse.products[0])
      }
      for (const winner of winners) {
        const index = newProducts.findIndex(
          (product: any) => product.productId === winner.id
        )

        if (index !== -1) {
          const product = newProducts[index]
          product.productName = activateDebugSponsoredTags ? `[AD] ${product.productName}` : product.productName
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
      return result
    }
  }

  public async sponsoredProducts(
    params: SearchResultArgs,
    path: string,
    shippingHeader?: string[]
  ) {
    const { query, leap, searchState } = params
    if (isPathTraversal(path)) {
      throw new Error('Malformed URL')
    }

    return this.http.get(`/sponsored_products/${path}`, {
      params: {
        query: query && decodeQuery(query),
        locale: this.locale,
        bgy_leap: leap ? true : undefined,
        ...parseState(searchState),
        ...params,
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
}
