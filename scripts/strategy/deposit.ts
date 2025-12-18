import { bigNumberify, expandDecimals } from "../../utils/math";
import { printStrategyVault } from "../utils";
import { deployFixture } from "../utils/fixture2";

// @todo review for new vault
async function main() {
  const fixture = await deployFixture();
  await config(fixture);
}

async function config(fixture: any) {
  const { user5 } = fixture.accounts;
  const { strategyHandler, usdc, wnt, strategyVault } = fixture.contracts;
  const vaultInfo = await strategyHandler.getVaultInfo();

  const depositAmount = expandDecimals(10000, 6);

  await wnt.mint(strategyVault.address, expandDecimals(vaultInfo.keeperFee, 0));
  await usdc.mint(strategyVault.address, depositAmount);

  const res = await strategyHandler.deposit({
    maker: user5.address,
    receiver: user5.address,
    tokenIn: usdc.address,
    minLpAmount: bigNumberify(0),
    executionFee: vaultInfo.keeperFee,
  });
  console.log(res);
  const info = await strategyHandler.getVaultInfo();
  printStrategyVault(info)
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });