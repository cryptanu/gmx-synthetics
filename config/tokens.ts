import { ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getSyntheticTokenAddress } from "../utils/token";
import { OracleProvider } from "./types";
import * as path from "path";
import * as fs from "fs";
export type { OracleProvider } from "./types";
const tokensJsonPath = path.join(__dirname, "tokensConfig.json");
const tokensJson = JSON.parse(fs.readFileSync(tokensJsonPath, "utf8"));

// synthetic token without corresponding token
// address will be generated in runtime in hardhat.config.ts
// should not be deployed
// should not be wrappedNative
type SyntheticTokenConfig = {
  address?: never;
  decimals: number;
  synthetic: true;
  wrappedNative?: never;
  deploy?: never;
  transferGasLimit?: never;
  dataStreamFeedId?: string;
  dataStreamFeedDecimals?: number;
  oracleProvider?: OracleProvider;
};

type RealTokenConfig = {
  address: string;
  decimals: number;
  transferGasLimit: number;
  synthetic?: never;
  wrappedNative?: true;
  deploy?: never;
  dataStreamFeedId?: string;
  dataStreamFeedDecimals?: number;
  oracleProvider?: OracleProvider;
};

// test token to deploy in local and test networks
// automatically deployed in localhost and hardhat networks
// `deploy` should be set to `true` to deploy on live networks
export type TestTokenConfig = {
  address?: never;
  decimals: number;
  transferGasLimit: number;
  deploy: true;
  wrappedNative?: boolean;
  synthetic?: never;
  dataStreamFeedId?: string;
  oracleProvider?: OracleProvider;
};

export type TokenConfig = SyntheticTokenConfig | RealTokenConfig | TestTokenConfig;
export type TokensConfig = { [tokenSymbol: string]: TokenConfig };

type JsonTokenConfig = {
  address?: string;
  decimals: number;
  transferGasLimit?: number;
  wrappedNative?: boolean;
  synthetic?: boolean;
  deploy?: boolean;
  oracle?: {
    dataStreamFeed?: {
      feedId: string;
      decimals: number;
    };
  };
};

function transformTokensConfig(networkConfig: { [key: string]: JsonTokenConfig }): TokensConfig {
  const result: TokensConfig = {};

  for (const [symbol, token] of Object.entries(networkConfig)) {
    const baseConfig: any = {
      decimals: token.decimals,
    };

    if (token.address) baseConfig.address = token.address;
    if (token.transferGasLimit) baseConfig.transferGasLimit = token.transferGasLimit;
    if (token.wrappedNative) baseConfig.wrappedNative = token.wrappedNative;
    if (token.synthetic) baseConfig.synthetic = token.synthetic;
    if (token.deploy) baseConfig.deploy = token.deploy;

    // Extract dataStreamFeed from oracle config
    if (token.oracle?.dataStreamFeed) {
      baseConfig.dataStreamFeedId = token.oracle.dataStreamFeed.feedId;
      baseConfig.dataStreamFeedDecimals = token.oracle.dataStreamFeed.decimals;
    }

    result[symbol] = baseConfig;
  }

  return result;
}

const config: { [network: string]: TokensConfig } = {};

for (const [network, tokens] of Object.entries(tokensJson)) {
  if (typeof tokens === "object" && tokens !== null) {
    config[network] = transformTokensConfig(tokens as { [key: string]: JsonTokenConfig });
  }
}

export default async function (hre: HardhatRuntimeEnvironment): Promise<TokensConfig> {
  const tokens = config[hre.network.name];

  if (!tokens) {
    throw new Error(`No token config found for network: ${hre.network.name}`);
  }

  for (const [tokenSymbol, token] of Object.entries(tokens as TokensConfig)) {
    (token as any).symbol = tokenSymbol;
    if (token.synthetic) {
      (token as any).address = getSyntheticTokenAddress(hre.network.config.chainId, tokenSymbol);
    }
    if (token.address) {
      (token as any).address = ethers.utils.getAddress(token.address);
    }
    if (!hre.network.live) {
      (token as any).deploy = true;
    }
  }

  return tokens;
}
