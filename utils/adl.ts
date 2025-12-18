import { bigNumberify, expandDecimals } from "./math";
import { executeWithOracleParams } from "./exchange";
import { TOKEN_ORACLE_TYPES } from "./oracle";
import * as keys from "./keys";

export async function getIsAdlEnabled(dataStore, market, isLong) {
  return await dataStore.getBool(keys.isAdlEnabledKey(market, isLong));
}

export async function getLatestAdlBlock(dataStore, market, isLong) {
  return await dataStore.getUint(keys.latestAdlBlockKey(market, isLong));
}

export async function updateAdlState(fixture, overrides = {}) {
  const { adlHandler } = fixture.contracts;
  const { market, isLong, gasUsageLabel } = overrides;
  const { wnt, usdc } = fixture.contracts;
  const tokens = overrides.tokens || [wnt.address, usdc.address];
  const dataStreamTokens = overrides.dataStreamTokens || [];
  const dataStreamData = overrides.dataStreamData || [];
  const priceFeedTokens = overrides.priceFeedTokens || [];
  const tokenOracleTypes = overrides.tokenOracleTypes || [TOKEN_ORACLE_TYPES.DEFAULT, TOKEN_ORACLE_TYPES.DEFAULT];
  const precisions = overrides.precisions || [8, 18];
  const minPrices = overrides.minPrices || [expandDecimals(5000, 4), expandDecimals(1, 6)];
  const maxPrices = overrides.maxPrices || [expandDecimals(5000, 4), expandDecimals(1, 6)];

  const block = await ethers.provider.getBlock();

  const params = {
    // @todo the old version
    // oracleBlockNumber: bigNumberify(block.number - 1),
    oracleBlockNumber: bigNumberify(block.number),
    tokens,
    tokenOracleTypes,
    precisions,
    minPrices,
    maxPrices,
    dataStreamTokens,
    dataStreamData,
    priceFeedTokens,
    execute: async (key, oracleParams) => {
      return await adlHandler.updateAdlState(market.marketToken, isLong, oracleParams);
    },
    gasUsageLabel,
  };

  await executeWithOracleParams(fixture, params);
}

export async function executeAdl(fixture, overrides = {}) {
  const { adlHandler } = fixture.contracts;
  const { account, market, collateralToken, isLong, sizeDeltaUsd, gasUsageLabel } = overrides;
  const { wnt, usdc } = fixture.contracts;
  const tokens = overrides.tokens || [wnt.address, usdc.address];
  
  //@todo add pyth tokens ?
  const dataStreamTokens = overrides.dataStreamTokens || [];
  const dataStreamData = overrides.dataStreamData || [];
  const priceFeedTokens = overrides.priceFeedTokens || [];
  const pythPriceFeedTokens = overrides.pythPriceFeedTokens || [];


  const tokenOracleTypes = overrides.tokenOracleTypes || [TOKEN_ORACLE_TYPES.DEFAULT, TOKEN_ORACLE_TYPES.DEFAULT];

  const precisions = overrides.precisions || [8, 18];
  const minPrices = overrides.minPrices || [expandDecimals(5000, 4), expandDecimals(1, 6)];
  const maxPrices = overrides.maxPrices || [expandDecimals(5000, 4), expandDecimals(1, 6)];

  const block = overrides.block || (await ethers.provider.getBlock());

  const params = {
    oracleBlockNumber: bigNumberify(block.number),
    tokens,
    tokenOracleTypes,
    precisions,
    minPrices,
    maxPrices,
    dataStreamTokens,
    dataStreamData,
    priceFeedTokens,
    pythPriceFeedTokens,
    execute: async (key, oracleParams) => {
      return await adlHandler.executeAdl(
        account,
        market.marketToken,
        collateralToken.address,
        isLong,
        sizeDeltaUsd,
        oracleParams
      );
    },
    gasUsageLabel,
  };

  await executeWithOracleParams(fixture, params);
}

//@fixme contract support executeAdlClosePosition
export async function forceAdl(fixture, overrides: any = {}) {
  const { adlHandler, wnt, usdc  } = fixture.contracts;
  const { wallet  } = fixture.accounts;
  const { exec, account, market, collateralToken, isLong, gasUsageLabel } = overrides;
  const executer = exec || wallet
  const tokens = overrides.tokens || [wnt.address, usdc.address];
  const realtimeFeedTokens = overrides.realtimeFeedTokens || [];
  const realtimeFeedData = overrides.realtimeFeedData || [];
  const priceFeedTokens = overrides.priceFeedTokens || [];
  const tokenOracleTypes = overrides.tokenOracleTypes || [TOKEN_ORACLE_TYPES.DEFAULT, TOKEN_ORACLE_TYPES.DEFAULT];
  const precisions = overrides.precisions || [8, 18];
  const minPrices = overrides.minPrices || [expandDecimals(5000, 4), expandDecimals(1, 6)];
  const maxPrices = overrides.maxPrices || [expandDecimals(5000, 4), expandDecimals(1, 6)];

  const block = overrides.block || (await ethers.provider.getBlock('finalized'));
  const oracleBlocks = Array(tokens.length).fill(block, 0, tokens.length);

  const params = {
    oracleBlocks,
    tokens,
    tokenOracleTypes,
    precisions,
    minPrices,
    maxPrices,
    realtimeFeedTokens,
    realtimeFeedData,
    priceFeedTokens,
    execute: async (key, oracleParams) => {
      return await adlHandler.connect(executer).executeAdlClosePosition(
        account,
        market.marketToken,
        collateralToken.address,
        isLong,
        oracleParams
      );
    },
    gasUsageLabel,
  };

  return await executeWithOracleParams(fixture, params);
}