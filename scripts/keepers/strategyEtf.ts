import { deployFixture } from "../utils/fixture2";
import { setTimeout } from 'timers/promises';
import { printStrategyVault } from '../utils';
import { FLOAT_PRECISION } from "../../utils/math";
import { BigNumber } from "ethers";
import { getLogger } from "../utils/logger";
import { log } from "console";

const logger = getLogger("strategy-etf");

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const { strategyHandler } = fixture.contracts;

  const config = {
    percentScale: 100000,//100%
    bufferPercent: 30000, // 30%
    deltaBufferTvl: FLOAT_PRECISION.mul(500) //500*10^30 ~ = 500 usd
  }

  while (true) {
    const info = await strategyHandler.getVaultInfo();
    logger.info("\n ETF vault info:\n");
    printStrategyVault(info);
    const bufferTvlRequired: BigNumber = info.tvl.mul(config.bufferPercent).div(config.percentScale);
    if (
      bufferTvlRequired.gt(info.bufferTvl.add(config.deltaBufferTvl))
       ||
      bufferTvlRequired.lt(info.bufferTvl.sub(config.deltaBufferTvl))) {
      logger.info("rebalancing ...");
      await strategyHandler.rebalance();
      const info = await strategyHandler.getVaultInfo();
      printStrategyVault(info)
    }
    else{
      logger.info("Dont rebalance")
    }
    await setTimeout(5 * 1000); // 60s
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