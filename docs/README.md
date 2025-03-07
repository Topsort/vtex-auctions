# Topsort's Auctions Integration

## What is Topsort?

Topsort is a retail media platform that enables marketplaces and retailers to offer ad placements to their vendors or sellers. It allows vendors to bid for prime advertising spots on the marketplace, boosting their product visibility and driving sales. Topsort simplifies ad management and optimizes ad performance with a self-serve, auction-based system tailored to eCommerce platforms. Check it out [here](https://www.topsort.com)

## Auctions Integration

This app is an implementation of the VTEX search protocol that wraps the VTEX catalog searches related API calls integrated with Topsort's auction.

## How it works?

The store's search resolver will continue functioning as the standard VTEX search resolver for fetching organic results. However, once these organic results are retrieved, they will be passed to Topsort's API as part of a request to identify auction winners. The winning sponsored products will then be prioritized and placed at the top of the search results, followed by the organic results, and finally returned to the store.

## Advanced Auction Configuration

You can customize the auction behavior by using these additional parameters:

- `auctionProductsCount`: Maximum number of products to include in the auction (default: uses only the current page products)
- `auctionPagesToFetch`: Number of additional pages to fetch for auction participation (beyond the current page)

Example GraphQL query showing how to use these parameters:

```graphql
query productSearch($from: Int, $to: Int, $query: String, $map: String, $orderBy: String, $priceRange: String, $auctionPagesToFetch: Int, $auctionProductsCount: Int) {
  productSearch(
    from: $from,
    to: $to,
    query: $query,
    map: $map,
    orderBy: $orderBy,
    priceRange: $priceRange,
    auctionPagesToFetch: $auctionPagesToFetch,
    auctionProductsCount: $auctionProductsCount
  ) {
    products {
      productId
      productName
      # other product fields...
    }
    # other fields...
  }
}
```

With variables:
```json
{
  "from": 0,
  "to": 11,
  "query": "shoes",
  "map": "ft",
  "orderBy": "OrderByScoreDESC",
  "auctionPagesToFetch": 2,
  "auctionProductsCount": 100
}
```

This will fetch the current page (12 products) plus 2 additional pages (for a total of 36 products), and include up to 100 products in the auction. The final result will still only contain the products from the current page, but with sponsored products from the expanded pool of auction participants. **Note**: Fetching additional pages adds some processing time, so use these parameters thoughtfully based on your performance needs.

## Configuration

First, make sure you have created a `Marketplace API Key` in your Topsort's dashboard. Check out how to do it [here](https://api.docs.topsort.com/api-reference/authentication).

It is possible to install in your store either by using VTEX IO Toolbelt.

### Using VTEX IO Toolbelt

1. [Install](https://developers.vtex.com/docs/guides/vtex-io-documentation-vtex-io-cli-install) VTEX's CLI. You can confirm that the app has now been installed by running `vtex ls` again.
2. Run the command `vtex install topsortpartnercl.services@3.x.`
3. Run the command `vtex install topsortpartnercl.auctions@2.x.`
4. Go to the App Settings on VTEX's App Management, search for `Topsort's Services` and add your **Topsort Marketplace API Key**;
5. Click on **Save**;
6. Optionally, go to the App Settings on VTEX's App Management, search for `Topsort's Auctions Integration`;
7. Add the __Topsort Number of Sponsored Slots__;
8. Click on **Save**.

Now Topsort is running auctions and augmenting your search results successfully!

### Next Steps
See how to send your ad [events](https://developers.vtex.com/docs/apps/topsortpartnercl.events)

We're constantly improving and adding new features to help you get the most out of your retail media efforts. Stay tuned for upcoming updates and enhancements!

Follow us on social media to stay updated:
- [LinkedIn](https://www.linkedin.com/company/topsort)
