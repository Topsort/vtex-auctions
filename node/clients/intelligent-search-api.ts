import { ExternalClient, InstanceOptions, IOContext } from "@vtex/api";
import { parseState } from "../utils/searchState";

const isPathTraversal = (str: string) => str.indexOf('..') >= 0
interface CorrectionParams {
  query: string
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

type AuctionType = "banners" | "listings";

interface Asset {
  url: string;
}

interface Winner {
  asset: Asset[];
  id: string;
  rank: number;
  resolvedBidId: string;
  type: string;
}

interface Result {
  error: boolean;
  resultType: AuctionType;
  winners: Winner[];
}

interface AuctionResult {
  results: Result[]
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
    super(`http://${context.workspace}--${context.account}.myvtex.com/_v/api/intelligent-search`, context, {
      ...options,
      headers: {
        ...options?.headers,
      }
    })

    const { locale, tenant } = context
    this.locale = locale ?? tenant?.locale
  }

  public async topSearches() {
    return this.http.get('/top_searches', {
      params: {
        locale: this.locale
      }, metric: 'topSearches'
    })
  }

  public async correction(params: CorrectionParams) {
    return this.http.get('/correction_search', { params: { ...params, locale: this.locale }, metric: 'correction' })
  }

  public async searchSuggestions(params: SearchSuggestionsParams) {
    return this.http.get('/search_suggestions', { params: { ...params, locale: this.locale }, metric: 'searchSuggestions' })
  }

  public async autocompleteSearchSuggestions(params: AutocompleteSearchSuggestionsParams) {
    return this.http.get('/autocomplete_suggestions', { params: { ...params, locale: this.locale }, metric: 'autocompleteSearchSuggestions' })
  }

  public async banners(params: BannersArgs, path: string) {
    if (isPathTraversal(path)) {
      throw new Error("Malformed URL")
    }

    return this.http.get(`/banners/${path}`, { params: { ...params, query: params.query, locale: this.locale }, metric: 'banners' })
  }

  public async facets(params: FacetsArgs, path: string, shippingHeader?: string[]) {
    if (isPathTraversal(path)) {
      throw new Error("Malformed URL")
    }

    const { query, leap, searchState } = params

    return this.http.get(`/facets/${path}`, {
      params: {
        ...params,
        query: query && decodeQuery(query),
        locale: this.locale,
        bgy_leap: leap ? true : undefined,
        ...parseState(searchState),
      },
      metric: 'facets',
      headers: {
        'x-vtex-shipping-options': shippingHeader ?? '',
      },
    })
  }

  public async productSearch(
    params: SearchResultArgs,
    path: string,
    shippingHeader?: string[],
  ) {
    const { query, leap, searchState } = params;
    if (isPathTraversal(path)) {
      throw new Error("Malformed URL");
    }

    const result = await this.http.get(`/product_search/${path}`, {
      params: {
        query: query && decodeQuery(query),
        locale: this.locale,
        bgy_leap: leap ? true : undefined,
        ...parseState(searchState),
        ...params,
      },
      metric: "product-search",
      headers: {
        "x-vtex-shipping-options": shippingHeader ?? "",
      },
    });

    if (result.products.length === 0) {
      return result;
    }


    const serviceSettings: ServiceSettings | undefined = await this.http
      .get(`http://${this.context.workspace}--${this.context.account}.myvtex.com/_v/ts/settings`)
      .catch((error) => {
        console.error(`Error fetching Topsort Services settings: ${error}`)
        return undefined
      });

    if (!serviceSettings?.advancedAPIKey) {
      this.context.logger.info({
        service: "IntelligentSearchApi",
        message: "Topsort API Key is not set",
      });

      return result;
    }

    const productIds = result.products.map((product: any) => product.productId);
    const auction = {
      auctions: [
        {
          type: "listings",
          slots: params.sponsoredCount || 2,
          products: {
            ids: productIds,
          },
        },
      ],
    };

    try {
      const auctionResult = await this.http.post<AuctionResult>('http://api.topsort.com/v2/auctions', auction, {
        headers: {
          "Content-Type": "application/json",
          "X-VTEX-Use-Https": true,
          "X-Vtex-Remote-Port": 443,
          "X-UA": `@topsort/vtex-search-resolver`,
          Accept: "application/json",
          Authorization: `Bearer ${serviceSettings.advancedAPIKey}`,
        }
      })

      const productMap = new Map(result.products.map((product: any) => [product.productId, product]));
      const sponsoredProducts: any[] = [];

      if (auctionResult.results[0].winners) {
        for (const winner of auctionResult.results[0].winners) {
          const product: any = productMap.get(winner.id);
          if (product) {
            const properties = product.properties || [];
            properties.push({
              name: "resolvedBidId",
              values: [winner.resolvedBidId],
            });
            sponsoredProducts.push({
              ...product,
              productName: `${product.productName} (Sponsored)`,
            });
          }
        }
      }

      if (sponsoredProducts.length > 0) {
        result.products = result.products.filter(
          (product: any) =>
            !productMap.has(product.productId) ||
            !sponsoredProducts.find(sp => sp.productId === product.productId)
        );

        result.products = [...sponsoredProducts, ...result.products];
      }

      this.context.logger.info({
        service: "IntelligentSearchApi",
        message: "createAuction axios api test passed",
        result: result.products,
      });
    } catch (err) {
      this.context.logger.warn({
        service: "IntelligentSearchApi",
        error: err.message,
        errorStack: err,
      });
    }

    result.products.length =
      result.products.length > Number(params.to) ? params.to : result.products.length;
    return result;
  }

  public async sponsoredProducts(params: SearchResultArgs, path: string, shippingHeader?: string[]) {
    const { query, leap, searchState } = params
    if (isPathTraversal(path)) {
      throw new Error("Malformed URL")
    }

    return this.http.get(`/sponsored_products/${path}`, {
      params: {
        query: query && decodeQuery(query),
        locale: this.locale,
        bgy_leap: leap ? true : undefined,
        ...parseState(searchState),
        ...params,
      },
      metric: 'product-search',
      headers: {
        'x-vtex-shipping-options': shippingHeader ?? '',
      },
    })
  }
}
