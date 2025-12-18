import { parseUnits } from "ethers/lib/utils";
import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const wethUsdMarketAddress = "0xF8074Be6fee9657bE60C9540DB8fAcE94F0F6DFC"

  console.log("run createDepositWethUsdc");
  const withdrawalVault = await ethers.getContract("WithdrawalVault");
  const exchangeRouter = await ethers.getContract("ExchangeRouter");
  const [wallet] = await ethers.getSigners();
  

  const shortTokenAmount = parseUnits('1', 18);
  const paramsCreate= {
    receiver: wallet.address,
    callbackContract: ethers.constants.AddressZero,
    market: wethUsdMarketAddress,
    shouldUnwrapNativeToken: false,
    executionFee: 0,
    callbackGasLimit: 0,
    minLongTokenAmount: 0,
    minShortTokenAmount: 0,
    longTokenSwapPath: [],
    shortTokenSwapPath: [],
    uiFeeReceiver: ethers.constants.AddressZero,
  };

  const orcParams = await getFromApi();

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendTokens", [wethUsdMarketAddress, withdrawalVault.address, shortTokenAmount]),
    exchangeRouter.interface.encodeFunctionData("createWithdrawalAuto", [paramsCreate, orcParams]),
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
  const res = await fetch("http://localhost:3000/v1/excecute-params/order", {
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
    "body": "{\n  \"owner\": \"0xCC4164e06d133316B67aCC0F12aBf676Bf7a18E6\",\n  \"market\": \"0xf8074be6fee9657be60c9540db8face94f0f6dfc\"\n}",
    "method": "POST",
    "mode": "cors",
    "credentials": "include"
  });
  return await res.json();
}
