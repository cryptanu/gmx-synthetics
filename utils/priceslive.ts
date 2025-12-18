import fetch from "node-fetch";
import hre from "hardhat";
import { expandDecimals, bigNumberify } from "./math";

/**
 * @todo 
 * - review 
 * - optimize & clean code
 */
export async function fetchTickerPrices() {
  const tickersUrl = getTickersUrl();
  const tokenPricesResponse = await fetch(tickersUrl);
  const tokenPrices = await tokenPricesResponse.json();
  const pricesByTokenAddress = {};

  for (const tokenPrice of tokenPrices) {
    pricesByTokenAddress[tokenPrice.tokenAddress.toLowerCase()] = {
      min: bigNumberify(tokenPrice.minPrice).mul(expandDecimals(1, tokenPrice.oracleDecimals)),
      max: bigNumberify(tokenPrice.maxPrice).mul(expandDecimals(1, tokenPrice.oracleDecimals)),
    };
  }

  return pricesByTokenAddress;
}

export async function fetchTickersV2() {
  try {
    const _tickers = await fetch(getTickersUrl());
    const tickers = await _tickers.json();
    const bySymbol = {};

    for (const ticker of tickers) {
      bySymbol[ticker.tokenSymbol.toLowerCase()] = {
        min: ticker.minPrice,
        max: ticker.maxPrice,
        pythSignedData: ticker.pythSignedData
      };
    }
    return bySymbol;
  } catch (e) {
    console.error("*** failed to fetch ticker %s", JSON.stringify(e));
  }
}

export function getTickersUrl() {
  if (hre.network.name === "monad") {
    return "https://mainnet-price-int.bean.exchange/prices/tickers";
  }

  if (hre.network.name === "arbitrum") {
    return "https://arbitrum-api.bean.exchange/prices/tickers";
  }

  throw new Error("Unsupported network");
}

export function getPythSigsUrl() {
  if (hre.network.name === "monad") {
    return "https://mainnet-price-int.bean.exchange/pythsigs";
  }

  if (hre.network.name === "arbitrum") {
    return "https://arbitrum-api.bean.exchange/pythsigs";
  }

  throw new Error("Unsupported network");
}

/**
 * @dev this is price with decissions
 **/
export async function prices() {
  const configs = await hre.gmx.getTokens();

  if (configs === undefined) {
    throw new Error("Unsupported network: " + hre.network.name);
  }

  let prices = {};
  let tickers = await fetchTickersV2();

  for(const [_symbol, tokenConfig] of Object.entries(configs)){
    try {
      let price = Object.assign({}, tokenConfig);
      let symbol = _symbol.toLowerCase();
       //@todo review token price bysymbol
      symbol = (symbol === "wnt" || symbol === "wmonad") ? "wmon" :  ((symbol === "weth" || symbol === "eth") ? "eth" : (symbol === "wbtc" ? "btc" : symbol));

      symbol = (symbol === "wmonad") ? "wmon": symbol; 
      let livePrice = tickers[symbol];

      price.min = bigNumberify(livePrice.min).div(expandDecimals(1, price.precision));
      price.max = bigNumberify(livePrice.max).div(expandDecimals(1, price.precision));
      price.pythSignedData = livePrice.pythSignedData;
      prices[price.address] = price;

    } catch (e) {
      console.log("failed to load live prices token %s , details: %s", _symbol, JSON.stringify(e));
    }
  }
  return prices;
}

/**
 * @dev origin price from api, dont modify:
 */
export async function loadApiPrices() {
  try {
    const response = await fetch(getTickersUrl());
    const prices = await response.json();
    const pricesByAddr = {};

    for (const tokenPrice of prices) {
      pricesByAddr[tokenPrice.tokenAddress.toLowerCase()] = tokenPrice;
    }

    return pricesByAddr;
  } catch (e) {
    console.error("*** loadApiPrices failed >> %s", JSON.stringify(e));
  }
}

/**
 * @todo review using this
 */
export async function loadPriceFeedMapping(){
  const oracleTokens = (await hre.gmx.getOracle()).tokens;
  const tokens = await hre.gmx.getTokens();

  let result = {};
  for(const tokenName in tokens){
    let token = tokens[tokenName];
    let priceFeed = oracleTokens[tokenName]["priceFeed"];
    if(priceFeed === undefined)
      continue;

    const value = {
      address: token.address.toLowerCase(),
      symbol: tokenName,
      tokenDecimal: token.decimals,
      priceFeedDecimal: priceFeed.decimals,
      priceFeedHeartBeat: priceFeed.heartbeatDuration,
      precission: token.precision,
      answerMultiplier: 30 - priceFeed.decimals - token.decimals,
      priceFeedDirectOrExternal: priceFeed.priceFeedDirectOrExternal
    };

    result[token.address.toLowerCase()] = value;
  };

  return result;
}
export async function loadPythSigs(){
  try {
    const response = await fetch(getPythSigsUrl());
    return await response.json();
  } catch (e) {
      console.error("*** failed to loadPythSigs %s", JSON.stringify(e));
  }
}
