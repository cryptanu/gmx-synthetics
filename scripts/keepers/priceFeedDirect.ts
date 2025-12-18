import hre, { ethers } from "hardhat";
import { deployFixture } from "../utils/fixture2";
import { loadApiPrices, loadPriceFeedMapping } from "../../utils/priceslive";

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const {accounts} = fixture;
  const user8 = accounts.user8;
  const oracleTokenCache = await loadPriceFeedMapping();

  for (const addr in oracleTokenCache) {
    oracleTokenCache[addr]["contract"] = await hre.ethers.getContract(`${oracleTokenCache[addr].symbol}PriceFeed`);
  }

  const wl = [
    'BSOL', 'BETH', 'BBTC', 'EURUSD', 'XAUUSD', 'DAK', 'YAKI', 'CHOG', 'WMONAD'
  ]
  while (true) {
    try {
      const prices = await loadApiPrices();
      const calls = [];
      for (const addr in prices) {
        const price = prices[addr];

        const priceFeedToken = oracleTokenCache[addr];
        if (!priceFeedToken || !wl.includes(priceFeedToken.symbol)) {
          continue;
        }
        /**
         * feed with multiplier: due to contract ignore this multipler and use pyth price directly > ignore
         * => Answer = api_price / 10^(30 - pricefeed.decimal - token.decimal)
        */
        const multiplierPoweredTen = ethers.BigNumber
          .from(10)
          .pow(priceFeedToken.answerMultiplier);

        const answer = ethers.BigNumber
          .from(price.minPrice)
          .add(price.maxPrice)
          .div(multiplierPoweredTen)
          .div(2);
        const currentAnswer = await priceFeedToken.contract.latestAnswer();
        if (currentAnswer.eq(answer)) {
          continue;
        }
        console.log("Set token %s by address %s --> price from %s to %s", priceFeedToken.symbol, addr, currentAnswer.toString(), answer);
        const tx = await priceFeedToken.contract.connect(user8).setAnswer(answer);
        await tx.wait();
        calls.push({
          target: priceFeedToken.contract.address,
          callData: priceFeedToken.contract.interface.encodeFunctionData("setAnswer", [answer])
        })
      }

      // const tx = await multicall.multicall(calls);
      // await tx.wait();
      // console.log("Set price feed success, tx hash:", tx.hash);
    } catch (error) {
      console.error("feed price got error %s", error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 5)); // wait for 10 minutes
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });