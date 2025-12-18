import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TOKEN_ORACLE_TYPES } from "../utils/oracle";
import { decimalToFloat } from "../utils/math";
import { BigNumber, BigNumberish } from "ethers";
import * as path from "path";
import * as fs from "fs";
const tokensJsonPath = path.join(__dirname, "tokensConfig.json");
const tokensJson = JSON.parse(fs.readFileSync(tokensJsonPath, "utf8"));
export type { OracleProvider } from "./types";

type OracleRealPriceFeed = {
  address: string;
  decimals: number;
  heartbeatDuration: number;
  stablePrice?: BigNumberish;
  deploy?: never;
  initPrice?: never;
};

type OracleTestPriceFeed = {
  address?: never;
  decimals: number;
  heartbeatDuration: number;
  stablePrice?: BigNumberish;
  deploy: true;
  initPrice: string;
};

type PythPriceFeed = {
  pythPriceFeedId: string;
  heartbeatDuration: number;
  stablePrice?: BigNumberish;
};

type OraclePriceFeed = OracleRealPriceFeed | OracleTestPriceFeed;

type TokenOracleConfig = {
  priceFeed?: OraclePriceFeed;
  pythPriceFeed?: PythPriceFeed;
  oracleType?: string;
};

export type OracleConfig = {
  signers: string[];
  dataStreamFeedVerifier?: string;
  minOracleSigners: number;
  minOracleBlockConfirmations: number;
  maxOraclePriceAge: number;
  maxOracleTimestampRange: number;
  maxRefPriceDeviationFactor: BigNumberish;
  chainlinkPaymentToken?: string;
  pythPriceFeedAddress?: string;
  pythPriceFeedAgeTimestamp?: number;
  pythPriceFeedProvderIsAtomic?: boolean;
  tokens?: {
    [tokenSymbol: string]: TokenOracleConfig;
  };
};

// Network-level oracle config (signers, verifiers, etc.)
type NetworkOracleConfig = Omit<OracleConfig, "tokens" | "signers"> & {
  signers?: string[];
};

const networkOracleConfigs: { [network: string]: NetworkOracleConfig } = {
  localhost: {
    minOracleSigners: 0,
    minOracleBlockConfirmations: 255,
    maxOraclePriceAge: 60 * 60 * 24,
    maxOracleTimestampRange: 60,
    maxRefPriceDeviationFactor: decimalToFloat(5, 1), // 50%
  },

  hardhat: {
    minOracleSigners: 0,
    minOracleBlockConfirmations: 255,
    maxOraclePriceAge: 60 * 60,
    maxOracleTimestampRange: 60,
    chainlinkPaymentToken: "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf",
    maxRefPriceDeviationFactor: decimalToFloat(5, 1), // 50%
  },

  monad: {
    signers: ["0x4a79377b91aA2009E15b130dF97509Ff6B563164"],
    maxOraclePriceAge: 5 * 60,
    maxOracleTimestampRange: 60,
    maxRefPriceDeviationFactor: decimalToFloat(5, 1), // 50%
    minOracleBlockConfirmations: 255,
    minOracleSigners: 1,
    dataStreamFeedVerifier: "0xEd813D895457907399E41D36Ec0bE103E32148c8",
    chainlinkPaymentToken: "0x76f257B1DDA5cC71bee4eF637Fbdde4C801310A9",
    pythPriceFeedAddress: "0x2880aB155794e7179c9eE2e38200202908C17B43",
    pythPriceFeedAgeTimestamp: 10, // @ghoulouis age timestamp for pyth price feed, if price is not updated within this time, it will be reverted
    pythPriceFeedProvderIsAtomic: true, // @ghoulouis set to enable atomic actions
  },

  arbitrum: {
    signers: ["0x0F711379095f2F0a6fdD1e8Fccd6eBA0833c1F1f"],
    maxOraclePriceAge: 5 * 60,
    maxOracleTimestampRange: 60,
    maxRefPriceDeviationFactor: decimalToFloat(5, 1), // 50%
    minOracleBlockConfirmations: 255,
    minOracleSigners: 1,
    dataStreamFeedVerifier: "0x478Aa2aC9F6D65F84e09D9185d126c3a17c2a93C",
    chainlinkPaymentToken: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
  },

  arbitrumGoerli: {
    signers: ["0xFb11f15f206bdA02c224EDC744b0E50E46137046", "0x23247a1A80D01b9482E9d734d2EB780a3b5c8E6c"],
    maxOraclePriceAge: 5 * 60,
    maxOracleTimestampRange: 60,
    maxRefPriceDeviationFactor: decimalToFloat(5, 1), // 50%
    minOracleBlockConfirmations: 255,
    minOracleSigners: 1,
  },
};

type JsonOracleConfig = {
  priceFeed?: {
    address?: string;
    decimals: number;
    heartbeatDuration: number;
    stablePrice?: string;
    deploy?: boolean;
    initPrice?: string;
  };
  pythPriceFeed?: {
    pythPriceFeedId: string;
    heartbeatDuration: number;
    stablePrice?: string;
  };
};

type JsonTokenConfig = {
  oracle?: JsonOracleConfig;
};

function extractTokenOracleConfigs(networkTokens: { [key: string]: JsonTokenConfig }): {
  [tokenSymbol: string]: TokenOracleConfig;
} {
  const result: { [tokenSymbol: string]: TokenOracleConfig } = {};

  for (const [symbol, token] of Object.entries(networkTokens)) {
    if (!token.oracle) continue;

    const oracleConfig: TokenOracleConfig = {};

    if (token.oracle.priceFeed) {
      const pf = token.oracle.priceFeed;
      if (pf.deploy) {
        oracleConfig.priceFeed = {
          decimals: pf.decimals,
          heartbeatDuration: pf.heartbeatDuration,
          deploy: true,
          initPrice: pf.initPrice!,
          stablePrice: pf.stablePrice ? BigNumber.from(pf.stablePrice) : undefined,
        };
      } else if (pf.address) {
        oracleConfig.priceFeed = {
          address: pf.address,
          decimals: pf.decimals,
          heartbeatDuration: pf.heartbeatDuration,
          stablePrice: pf.stablePrice ? BigNumber.from(pf.stablePrice) : undefined,
        };
      }
    }

    if (token.oracle.pythPriceFeed) {
      const pyth = token.oracle.pythPriceFeed;
      oracleConfig.pythPriceFeed = {
        pythPriceFeedId: pyth.pythPriceFeedId,
        heartbeatDuration: pyth.heartbeatDuration,
        stablePrice: pyth.stablePrice ? BigNumber.from(pyth.stablePrice) : undefined,
      };
    }

    if (Object.keys(oracleConfig).length > 0) {
      result[symbol] = oracleConfig;
    }
  }

  return result;
}

export default async function (hre: HardhatRuntimeEnvironment): Promise<OracleConfig> {
  const network = hre.network;

  let testSigners: string[] = [];
  if (!network.live) {
    testSigners = (await hre.ethers.getSigners()).slice(10).map((signer) => signer.address);
  }

  const networkConfig = networkOracleConfigs[network.name];
  if (!networkConfig) {
    throw new Error(`No oracle config for network: ${network.name}`);
  }

  // Extract token oracle configs from tokens.json
  const networkTokens = tokensJson[network.name] || {};
  const tokenOracleConfigs = extractTokenOracleConfigs(networkTokens);

  const oracleConfig: OracleConfig = {
    signers: networkConfig.signers || testSigners,
    minOracleSigners: networkConfig.minOracleSigners,
    minOracleBlockConfirmations: networkConfig.minOracleBlockConfirmations,
    maxOraclePriceAge: networkConfig.maxOraclePriceAge,
    maxOracleTimestampRange: networkConfig.maxOracleTimestampRange,
    maxRefPriceDeviationFactor: networkConfig.maxRefPriceDeviationFactor,
    dataStreamFeedVerifier: networkConfig.dataStreamFeedVerifier,
    chainlinkPaymentToken: networkConfig.chainlinkPaymentToken,
    pythPriceFeedAddress: networkConfig.pythPriceFeedAddress,
    pythPriceFeedAgeTimestamp: networkConfig.pythPriceFeedAgeTimestamp,
    pythPriceFeedProvderIsAtomic: networkConfig.pythPriceFeedProvderIsAtomic,
    tokens: tokenOracleConfigs,
  };

  // Get token symbols directly from JSON to avoid circular dependency
  const tokenSymbols = Object.keys(networkTokens);

  // to make sure all tokens have an oracle type so oracle deployment/configuration script works correctly
  for (const tokenSymbol of tokenSymbols) {
    if (oracleConfig.tokens![tokenSymbol] === undefined) {
      oracleConfig.tokens![tokenSymbol] = {};
    }
  }

  // validate there are corresponding tokens for price feeds
  for (const tokenSymbol of Object.keys(oracleConfig.tokens!)) {
    if (!tokenSymbols.includes(tokenSymbol)) {
      throw new Error(`Missing token for ${tokenSymbol}`);
    }

    if (oracleConfig.tokens![tokenSymbol].oracleType === undefined) {
      oracleConfig.tokens![tokenSymbol].oracleType = TOKEN_ORACLE_TYPES.DEFAULT;
    }
  }

  return oracleConfig;
}
