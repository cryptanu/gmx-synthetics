import hre from "hardhat";
import { deployFixture } from "../utils/fixture2";
import { setTimeout } from 'timers/promises';
import { loadOracleParams } from "../../utils/exchangelive";
import { loadApiPrices } from "../../utils/priceslive";
import { loadMarkets, printLiquidationInfo } from "../utils";
import { executeLiquidation } from "../../utils/liquidation";
import { printPosition } from '../utils';
import { TOKEN_ORACLE_TYPES } from "../../utils/oracle";
import { getLogger } from "../utils/logger";
import { findCandidateLiqPosition } from "./graph/orderGraphQuery";

const logger = getLogger("LIQ");
const { ethers } = hre;

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const { reader, dataStore, referralStorage } = fixture.contracts;
  const { wallet } = fixture.accounts;

  while(true){
    try {
        let positions = await findCandidateLiqPosition(100, 1, 1, 0, 1000);
        const probPrices = await loadApiPrices();
        const allMarkets = await loadMarkets();
        
        for (let index = 0; index < positions.length; index++) {
          try {
            const _pos = positions[index];
            const positionKey = _pos.positionKey;
            const position = await reader.getPosition(dataStore.address, positionKey);
            const market = allMarkets[position.addresses.market];

            if (!market || !probPrices) {
              logger.warn("Ignoring position due to missing market data or bad prices");
              printPosition(position);
              continue;
            }
            const probMarketPrice = {
              indexTokenPrice: {
                min: probPrices[market.indexToken.toLowerCase()].minPrice,
                max: probPrices[market.indexToken.toLowerCase()].maxPrice,
              },
              longTokenPrice: {
                min: probPrices[market.longToken.toLowerCase()].minPrice,
                max: probPrices[market.longToken.toLowerCase()].maxPrice,
              },
              shortTokenPrice: {
                min: probPrices[market.shortToken.toLowerCase()].minPrice,
                max: probPrices[market.shortToken.toLowerCase()].maxPrice,
              },
            };

            const liqInfo = await reader.isPositionLiquidatable(
              dataStore.address, referralStorage.address, position, market, probMarketPrice, true);

            if (!liqInfo[0]) {
              logger.info("skip healthy position > %s", positionKey);
              // printLiquidationInfo(positionKey, liqInfo);
              continue;
            }

            logger.info(">>>> liq... %s", positionKey);
            printPosition(position);

            const tokenAddrs = collectTokenInfos(market, position.addresses.collateralToken);
            const params = {
              exec: wallet,
              account: position.addresses.account,
              market: market,
              collateralToken: { address: position.addresses.collateralToken },
              isLong: position.flags.isLong,
              tokenOracleTypes: Array(tokenAddrs.length).fill(TOKEN_ORACLE_TYPES.DEFAULT),
              ...await loadOracleParams(tokenAddrs),
            };
        
            logger.warn("Using params: %s", JSON.stringify(params));
            await executeLiquidation(fixture, params);
            logger.warn("<<<< liq ...success");
          } catch (e) {
            logger.error("liq error %s > ", e);
          }
        }

        await setTimeout(2000);
      }
     catch (e) {
      logger.error("Error during liquidation: ", e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((ex) => {
    logger.error(ex);
    process.exit(1);
  });

function collectTokenInfos(market: any, collateralToken: any) {
  return [...new Set([
    market.indexToken,
    market.longToken,
    market.shortToken,
    collateralToken
  ].filter(addr => addr && addr !== ethers.constants.AddressZero))];
}
