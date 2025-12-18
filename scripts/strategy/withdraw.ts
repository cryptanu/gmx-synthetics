import { contractAt } from "../../utils/deploy";
import { bigNumberify, expandDecimals } from "../../utils/math";
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

  const lpAmount = expandDecimals(1, 18);

  await wnt.mint(strategyVault.address, expandDecimals(vaultInfo.keeperFee, 0));
  const marketToken = await contractAt("MarketToken", vaultInfo.lpAddress);
  await marketToken.connect(user5).transfer(strategyVault.address, lpAmount);

  const res = await strategyHandler.withdraw({
    maker: user5.address,
    receiver: user5.address,
    tokenOut: usdc.address,
    minTokenOut: bigNumberify(0),
    executionFee: vaultInfo.keeperFee,
  });
  console.log(res);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });