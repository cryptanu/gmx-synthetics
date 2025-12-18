import { createClient } from "redis";
import { setTimeout } from "timers/promises";
import { findAllMarketInfo } from "./marketInfoGraphQuery";

export const MARKET_LONG_TOKENS = "MARKET_LONG_TOKENS";
export const MARKET_SHORT_TOKENS = "MARKET_SHORT_TOKENS";

async function main() {
  await run();
}

async function run() {
  const redisCli = createClient();
  redisCli.on('error', (err) => console.error('Redis sender error', err));
  await redisCli.connect();

  while (true) {
    await setTimeout(1200);
    try {
      const marketInfos = await findAllMarketInfo();
      console.log(marketInfos)
      const longTokens = marketInfos.map((market: { longToken: string }) => market.longToken);
      const shortToken = marketInfos.map((market: { shortToken: string }) => market.shortToken);

      await redisCli.lPush(MARKET_LONG_TOKENS, longTokens);
      await redisCli.lPush(MARKET_SHORT_TOKENS, shortToken);
    } catch (error) {
      console.error("load order error %s", error);
    }
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
