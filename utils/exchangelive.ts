import { prices as refPrices } from "./priceslive";

//@todo review
export async function loadOracleParams(tokenAddrs: any) {
  const priceInfos = await refPrices();

  const params = {
    tokens: [],
    precisions: [],
    minPrices: [],
    maxPrices: [],
  };

  if (Array.isArray(tokenAddrs) && tokenAddrs.length > 0) {
    for (let i = 0; i < tokenAddrs.length; i++) {
      const tokenAddr = tokenAddrs[i];
      const tokenInfo = priceInfos[tokenAddr];
      if (!tokenInfo) {
        throw new Error("Missing price info: " + tokenAddr);
      }
      params.tokens.push(tokenAddr);
      params.precisions.push(tokenInfo.precision);
      params.minPrices.push(tokenInfo.min);
      params.maxPrices.push(tokenInfo.max);
    }
  }

  return params;
}
