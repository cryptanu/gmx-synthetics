import { deployFixture } from "../utils/fixture2";

// @todo review for new vault
async function main() {
  const fixture = await deployFixture();
  await config(fixture);
}

async function config(fixture: any) {
  const { strategyHandler, usdc } = fixture.contracts;

  const acceptedTokens = [
    { token: "USDC", address: usdc.address },
    // { token: "WMON", address: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701" },
    { token: "BBTC", address: "0xcf5a6076cfa32686c0Df13aBaDa2b40dec133F1d" },
    { token: "BETH", address: "0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37" },
    { token: "BSOL", address: "0x5387C85A4965769f6B0Df430638a1388493486F1" },
    // { token: "shMON", address: "0x3a98250f98dd388c211206983453837c8365bdc1" },
  ]
  await strategyHandler.enableFundTokens(acceptedTokens.map((t) => t.address));

  return;
  const marketEnable = [
      { market: "0x9D292C4f9541100025B7Eaf915a53BACe15F2eb6", percent: 30 }, // bbtc
      { market: "0xD4CcFc29Ca7aF107262e07A77E3f3BB27386f30f", percent: 30 }, // eth
      { market: "0x5825e50AC8487D876b6830EE1876a5d4303A8D89", percent: 15 }, // sol
      { market: "0x7efAF9b4F2eC67EB0BAf737854C2232B6851BBa9", percent: 10 }, // monad,
      { market: "0x097E83EC40763b1808cb94De351d8F2494458bCA", percent: 7 }, // eur,
      { market: "0x68895C5d9895db16aEF7CDa66e376fF585AcE4d6", percent: 7 }, // xau,
      { market: "0xA17F3c69D511e60F2EF727bF08DFe345dCF8a6fa", percent: 1 }, // yaki,
      { market: "0x56c0244C149D61e866A3B3AFC2e9373fF1f68AA7", percent: 1 }, // chog,
      { market: "0xf6f6924dd606e29AB1866a81b4E3a89955B93acD", percent: 1 }, // dak,
      // { market: "0x81c56b14c9977E6AB239835eE02eE3e7Ceadd755", percent: 1 }, // shmon,
  ]

  await strategyHandler.enablePerps(marketEnable.map((m: any) => m.market));
  console.log(`Enable success ${marketEnable.length} markets to strategy!!!`);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });