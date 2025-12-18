import { expandDecimals } from "../../utils/math";
import { printStrategyVault } from "../utils";
import { deployFixture } from "../utils/fixture2";
import hre from "hardhat";

// @todo review for new vault
async function main() {
  const fixture = await deployFixture();
  await config(fixture);
}

async function config(fixture: any) {
  const { strategyHandler, usdc } = fixture.contracts;
  const { wallet } = fixture.accounts;
  const info = await strategyHandler.getVaultInfo();

  const perpMarketAlloc = [
    // { market: "0xa78bD6F9a1b52218172F039103c62E42A22b8A95", percent: 25 }, // btc
    // { market: "0x04a0fd88B6f6f4eDaE7befEa50BaC38cDb81C37f", percent: 22.5 }, // eth
    // { market: "0x04A46041F20104923037d5bB3945Fe5E64e01598", percent: 12.5 }, // sol
    { market: "0x7efAF9b4F2eC67EB0BAf737854C2232B6851BBa9", percent: 7.5 }, // monad,
    // { market: "0x097E83EC40763b1808cb94De351d8F2494458bCA", percent: 10 }, // eur,
    // { market: "0x68895C5d9895db16aEF7CDa66e376fF585AcE4d6", percent: 10 }, // xau,
    // { market: "0xA17F3c69D511e60F2EF727bF08DFe345dCF8a6fa" }, // dak,
    // { market: "0x56c0244C149D61e866A3B3AFC2e9373fF1f68AA7" }, // xau,
    // { market: "0xf6f6924dd606e29AB1866a81b4E3a89955B93acD" }, // yarki,
  ]
  const lpAmount = expandDecimals(10000, 18)
  for (const market of perpMarketAlloc) {
    const marketAlloc = info.perpMarkets.find((m: any) => m.market === market.market);
    if (marketAlloc) {
      await strategyHandler.mmSell({ isPerp: true, market: marketAlloc.market, lpAmount: lpAmount, tokenOut: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701"});
      const info = await strategyHandler.getVaultInfo();
      printStrategyVault(info)
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