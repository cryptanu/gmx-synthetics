import hre from "hardhat";
const { ethers } = hre;
const { provider } = ethers;

import { bigNumberify } from "../../utils/math";

import { ExchangeRouter, MintableToken } from "../typechain-types";
import { DepositUtils } from "../typechain-types/contracts/exchange/DepositHandler";
import { parseUnits } from "ethers/lib/utils";
import { loadOracleParams } from "../../utils/exchangelive";
import { genOracleParams } from "../../utils/exchange";
import { deployFixture } from "../utils/fixture2";


async function main() {
    const fixture = await deployFixture();

  const wethUsdMarketAddress = "0x7efAF9b4F2eC67EB0BAf737854C2232B6851BBa9"
  // const wethUsdMarketAddress = "0x04a0fd88B6f6f4eDaE7befEa50BaC38cDb81C37f"

  console.log("run createDepositWethUsdc");
  const depositVault = await ethers.getContract("DepositVault");
  const exchangeRouter: ExchangeRouter = await ethers.getContract("ExchangeRouter");
  const router = await ethers.getContract("Router");
  const [wallet] = await ethers.getSigners();
  
  const eth: MintableToken = await ethers.getContract("WETH");
  const wmon: MintableToken = await ethers.getContract("WMONAD");
  const usdc: MintableToken = await ethers.getContract("USDC");
  const shortTokenAmount = parseUnits('1', 18); // 100 USDC
  const usdcAllowance = await usdc.allowance(wallet.address, router.address);
  console.log("USDC address %s", usdc.address);
  console.log("USDC allowance %s", usdcAllowance.toString());
  if (usdcAllowance.lt(shortTokenAmount)) {
    console.log("approving USDC");
    await usdc.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
  const usdcBalance = await usdc.balanceOf(wallet.address);
  console.log("USDC balance %s", usdcBalance);

  const paramsCreate: DepositUtils.CreateDepositParamsStruct = {
    receiver: wallet.address,
    callbackContract: ethers.constants.AddressZero,
    market: wethUsdMarketAddress,
    minMarketTokens: 0,
    shouldUnwrapNativeToken: false,
    executionFee: 0,
    callbackGasLimit: 0,
    initialLongToken: wmon.address,
    initialShortToken: usdc.address,
    longTokenSwapPath: [],
    shortTokenSwapPath: [],
    uiFeeReceiver: ethers.constants.AddressZero,
  };

  const oracleBlock = await getBlockInfo();
  const tokenAddrs = [wmon.address, usdc.address]
  const oracleBlocks = Array(tokenAddrs.length).fill(oracleBlock, 0, tokenAddrs.length);

  const params2 = {
    ...await loadOracleParams(tokenAddrs),
    oracleBlocks
  };

  const orcParams1 = await genOracleParams(fixture, params2)
  const orcParams2 = await getFromApi();

  console.log('orcParams1', orcParams1);
  console.log('orcParams2', orcParams2);

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendTokens", [wmon.address, depositVault.address, shortTokenAmount]),
    exchangeRouter.interface.encodeFunctionData("createDepositAuto", [paramsCreate, orcParams2]),
  ];
  const tx = await exchangeRouter.multicall(multicallArgs);
  console.log("transaction sent", tx.hash);
  await tx.wait();
  console.log("receipt received");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });

async function getFromApi() {
  const res = await fetch("https://api.bean.exchange/v1/oracle-params", {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9,vi-VN;q=0.8,vi;q=0.7,fr-FR;q=0.6,fr;q=0.5",
      "content-type": "application/json",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Chromium\";v=\"130\", \"Google Chrome\";v=\"130\", \"Not?A_Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin"
    },
    "referrerPolicy": "strict-origin-when-cross-origin",
    "body": "{\n  \"owner\": \"0xCC4164e06d133316B67aCC0F12aBf676Bf7a18E6\",\n  \"market\": \"0x7efaf9b4f2ec67eb0baf737854c2232b6851bba9\"\n}",
    "method": "POST",
    "mode": "cors",
    "credentials": "include"
  });
  return await res.json();
}

async function getBlockInfo() {
  const oracleBlock = await provider.getBlock("finalized");
  return {
    number: oracleBlock.number,
    timestamp: oracleBlock.timestamp,
    hash: oracleBlock.hash,
  }
}