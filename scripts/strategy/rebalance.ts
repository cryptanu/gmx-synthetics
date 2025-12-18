import { parseUnits } from "ethers/lib/utils";
import { bigNumberify, expandDecimals, formatAmount } from "../../utils/math";
import { deployFixture } from "../utils/fixture2";

// @todo review for new vault
async function main() {
  const fixture = await deployFixture();
  await config(fixture);
}

async function config(fixture: any) {
  const { strategyHandler, usdc } = fixture.contracts;

  const rebalanceStrategy = {
    reserrve: 20, // 20%
    perp: 80, // 80%
  }
  const allowableFlex = 3; // 5%

  const perpMarketAlloc = [
    // {
    //   "name": "BBTC_BBTC_USDC",
    //   "address": "0x9D292C4f9541100025B7Eaf915a53BACe15F2eb6",
    //   "indexToken": "0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d",
    //   "longToken": "0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 30,
    // },
    // {
    //   "name": "BETH_BETH_USDC",
    //   "address": "0xD4CcFc29Ca7aF107262e07A77E3f3BB27386f30f",
    //   "indexToken": "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    //   "longToken": "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 30,
    // },
    // {
    //   "name": "BSOL_BSOL_USDC",
    //   "address": "0x5825e50AC8487D876b6830EE1876a5d4303A8D89",
    //   "indexToken": "0x5387C85A4965769f6B0Df430638a1388493486F1",
    //   "longToken": "0x5387C85A4965769f6B0Df430638a1388493486F1",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 15,
    // },
    // {
    //   "name": "WMONAD_WMONAD_USDC",
    //   "address": "0x7efAF9b4F2eC67EB0BAf737854C2232B6851BBa9",
    //   "indexToken": "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
    //   "longToken": "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 10,
    // },
    // {
    //   "name": "XAUUSD_USDC_USDC",
    //   "address": "0x68895C5d9895db16aEF7CDa66e376fF585AcE4d6",
    //   "indexToken": "0x3CAaA5D5d26d4Ac404DEd2B6F46b37d1b9e520DE",
    //   "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 5,
    // },
    // {
    //   "name": "EURUSD_USDC_USDC",
    //   "address": "0x097E83EC40763b1808cb94De351d8F2494458bCA",
    //   "indexToken": "0xcA8e660Fc923466D3f1d04517ab4C3A36BF5e554",
    //   "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 5,
    // },
    // { "name": "DAK_USDC_USDC",
    //   "address": "0xA17F3c69D511e60F2EF727bF08DFe345dCF8a6fa",
    //   "indexToken": "0x0F0BDEbF0F83cD1EE3974779Bcb7315f9808c714",
    //   "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 1,
    // },
    // {
    //   "name": "SHMON_SHMON_USDC",
    //   "address": "0x81c56b14c9977E6AB239835eE02eE3e7Ceadd755",
    //   "indexToken": "0x3a98250F98Dd388C211206983453837C8365BDc1",
    //   "longToken": "0x3a98250F98Dd388C211206983453837C8365BDc1",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 1,
    // },
    // {
    //   "name": "CHOG_USDC_USDC",
    //   "address": "0x56c0244C149D61e866A3B3AFC2e9373fF1f68AA7",
    //   "indexToken": "0xE0590015A873bF326bd645c3E1266d4db41C4E6B",
    //   "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 1,
    // },
    // {
    //   "name": "YAKI_USDC_USDC",
    //   "address": "0xf6f6924dd606e29AB1866a81b4E3a89955B93acD",
    //   "indexToken": "0xfe140e1dCe99Be9F4F15d657CD9b7BF622270C50",
    //   "longToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "shortToken": "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
    //   "percent": 1,
    // }
  ]

  const tx = await strategyHandler.mmBuy({
    isPerp: true,
    market: perpMarketAlloc[0].address,
    longToken: perpMarketAlloc[0].longToken,
    longAmt: 0,
    shortToken: perpMarketAlloc[0].shortToken,
    shortAmt: expandDecimals("5000", 6),
  });

  console.log(`Transaction successful: ${tx.hash}`);
  
  return;
  while (true) {
    const info = await strategyHandler.getVaultInfo();
    // console.log("=========================================");
    // console.log("Vault info:", info);
    // console.log("=========================================");
    // return;
    const tvl = bigNumberify(formatAmount(info.tvl, 30, 0));
    const reserveTvl = bigNumberify(formatAmount(info.reserveTvl, 30, 0));
    const perpTvl = bigNumberify(formatAmount(info.perpTvl, 30, 0));

    const reserveTarget = tvl.mul(rebalanceStrategy.reserrve).div(100);
    const reserveUper = tvl.mul(rebalanceStrategy.reserrve + allowableFlex).div(100);
    const reserveLower = tvl.mul(rebalanceStrategy.reserrve - allowableFlex).div(100);
    const perpTarget = tvl.mul(rebalanceStrategy.perp).div(100);

    console.log("TVL:", tvl.toString());
    console.log("Reserve TVL:", reserveTvl.toString());
    console.log("Reserve Target:", reserveTarget.toString());
    console.log("Perp TV:", perpTvl.toString());
    console.log("Perp Target:", perpTarget.toString());

    console.log("Reserve in range:", (reserveUper).toString(), (reserveLower).toString());
    console.log("=========================================");
    if (reserveTvl.gte(reserveUper) || reserveTvl.lte(reserveLower)) {
      console.warn('Reserve TVL is out of range, rebalancing...');
      const transferAmount = reserveTvl.sub(reserveTarget);
      console.log("Need transfer amount:", transferAmount.toString());
      const perpMarkets = info.perpMarkets.map((market: any) => {
        const marketAlloc = perpMarketAlloc.find((m: any) => m.market === market.market);
        if (marketAlloc) {
          const marketPercent = marketAlloc.percent;
          const marketTvl = bigNumberify(formatAmount(market.tvl, 30, 0));
          const marketTarget = perpTarget.mul(marketPercent * 10).div(1000);
          const marketError = marketTarget.sub(marketTvl);
          console.log(`market: ${market.market}, lpAmount: ${formatAmount(market.share, 18, 0)}, lpPrice: ${bigNumberify(formatAmount(market.sharePrice, 10, 0))}, tvl: ${marketTvl.toString()}, target: ${marketTarget.toString()}, error: ${marketError.toString()}`);
          return { market: market.market, lpAmount: market.share, lpPrice: bigNumberify(formatAmount(market.sharePrice, 10, 0)).toString(), target: marketTarget, tvl: marketTvl, error: marketError };
        }
      }).filter((v) => v !== undefined);

      for (const market of perpMarkets) {
        if (market.error != 0) {
          if (market.error > 5) {
            const fundAmount = expandDecimals(market.error, 6)
            console.log(`buy to market: ${market.market}, fundAmount: ${market.error.toString()}`);
            try {
              const tx = await strategyHandler.mmBuy({ isPerp: true, market: market.market, longToken: "0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d", longAmt: expandDecimals("0.2", 18), shortToken: usdc.address, shortAmt: fundAmount });
              await tx.wait();
              console.log(`Transaction successful: ${tx.hash}`);
            } catch (error) {
              console.error("Error occurred during strategy execution:", error);
            }
          } else if (market.error < -5) {
            const lpSellAmount = market.error.mul(-1).mul(100).div(market.lpPrice).div(2);
            const fundAmount = expandDecimals(lpSellAmount, 18)
            console.log(`sell to market: ${market.market}, LP amount: ${fundAmount.toString()}`);
            try {
              const tx = await strategyHandler.mmSell({ isPerp: true, market: market.market, lpAmount: fundAmount, tokenOut: usdc.address });
              await tx.wait();
              console.log(`Transaction successful: ${tx.hash}`);
            } catch (error) {
              console.error("Error occurred during strategy execution:", error);
            }
          }
        }
      }
    } else console.log('Reserve TVL is in range, no action taken');
    await new Promise((resolve) => setTimeout(resolve, 1000 * 60 * 5)); // wait for 5 minutes
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