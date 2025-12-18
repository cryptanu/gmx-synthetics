import { expandDecimals } from "../utils/math";
import * as keys from "../utils/keys";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { setAddressIfDifferent, setBytes32IfDifferent, setUintIfDifferent } from "../utils/dataStore";
import { OracleProvider } from "../config/oracle";

const func = async ({ gmx, deployments, network }: HardhatRuntimeEnvironment) => {
  const oracleConfig = await gmx.getOracle();

  if (!oracleConfig.pythPriceFeedAddress) {
    return;
  }

  const tokens = await gmx.getTokens();

  const { get } = deployments;

  const defaultOracleProvider: OracleProvider = network.name === "hardhat" ? "gmOracle" : "chainlinkDataStream";
  const oracleProviders = {
    pyth: (await get("PythPriceFeedProvider")).address,
    gmOracle: (await get("PythPriceFeedProvider")).address,
    chainlinkDataStream: (await get("ChainlinkDataStreamProvider")).address,
  };

  if (oracleConfig) {
    for (const tokenSymbol of Object.keys(oracleConfig.tokens)) {
      const token = tokens[tokenSymbol];
      if (!token) {
        throw new Error(`Missing token for ${tokenSymbol}`);
      }
      const { pythPriceFeed, oracleType } = oracleConfig.tokens[tokenSymbol];

      const oracleTypeKey = keys.oracleTypeKey(token.address);
      await setBytes32IfDifferent(oracleTypeKey, oracleType, "oracle type");

      const key = token.oracleProvider || defaultOracleProvider;

      const oracleProvider = oracleProviders[key];
      await setAddressIfDifferent(
        keys.oracleProviderForTokenKey(token.address),
        oracleProvider,
        `oracle provider ${key} for ${tokenSymbol}`
      );

      if (!pythPriceFeed) {
        continue;
      }

      const pythPriceFeedProvider = (await get("PythPriceFeedProvider")).address;

      const priceFeedKey = keys.priceFeedKey(token.address);
      await setAddressIfDifferent(priceFeedKey, pythPriceFeedProvider, `Pyth price feed`);

      const priceFeedMultiplierKey = keys.priceFeedMultiplierKey(token.address);
      const priceFeedMultiplier = expandDecimals(1, 60 - oracleConfig.pythPriceFeedProviderDecimals - token.decimals);
      await setUintIfDifferent(priceFeedMultiplierKey, priceFeedMultiplier, `${tokenSymbol} price feed multiplier`);

      if (pythPriceFeed.stablePrice) {
        const stablePriceKey = keys.stablePriceKey(token.address);
        const stablePrice = pythPriceFeed.stablePrice.div(expandDecimals(1, token.decimals));
        await setUintIfDifferent(stablePriceKey, stablePrice, `${tokenSymbol} stable price`);
      }

      await setUintIfDifferent(
        keys.priceFeedHeartbeatDurationKey(token.address),
        pythPriceFeed.heartbeatDuration,
        `${tokenSymbol} heartbeat duration`
      );
    }
  }
};

func.dependencies = [
  "Tokens",
  "PriceFeeds",
  "DataStore",
  "GmOracleProvider",
  "ChainlinkDataStreamProvider",
  "PythPriceFeedProvider",
  "ConfigureOracleTokens",
];
func.tags = ["ConfigurePythOracleTokens"];

export default func;
