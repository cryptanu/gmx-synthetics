import { ApolloClient, InMemoryCache } from "@apollo/client";

const SUBGRAPH_URLS = {
  //@todo deprecated
  // monad: "https://subgraph.satsuma-prod.com/3b2ced13c8d9/gmx/synthetics-arbitrum-stats/api", 
  arbitrum: "https://subgraph.satsuma-prod.com/3b2ced13c8d9/gmx/synthetics-arbitrum-stats/api",
  avalanche: "https://subgraph.satsuma-prod.com/3b2ced13c8d9/gmx/synthetics-avalanche-stats/api",
};

export function getSubgraphUrl(networkName) {
  const url = SUBGRAPH_URLS[networkName];

  if (!url) {
    throw new Error("Unsupported network");
  }

  return url;
}

export function getSubgraphClient(networkName) {
  const url = getSubgraphUrl(networkName);
  return new ApolloClient({
    uri: url,
    cache: new InMemoryCache(),
  });
}
