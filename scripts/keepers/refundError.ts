import { deployFixture } from "../utils/fixture2";
import { createClient } from 'redis';

const CHANNEL_ORDER = "keeper_order_cancel";
const CHANNEL_DEPOSIT = "keeper_deposit_cancel";
const CHANNEL_WITHDRAW = "keeper_withdraw_cancel";

const GAS_LIMIT = 800000;

async function main() {
  const fixture = await deployFixture();
  await runKeeper(fixture);
}

async function runKeeper(fixture: any) {
  const {depositHandler, withdrawalHandler, orderHandler } = fixture.contracts;

  const subscriber = createClient();
  subscriber.on('error', (err) => console.error('redis subscriber error', err));
  await subscriber.connect();
  console.log("redis sub state: open %s , ready %s ", subscriber.isOpen, subscriber.isReady);
  console.log("watching fail order ...");

  await subscriber.subscribe(CHANNEL_ORDER, async (orderKey) => {
    console.log(`found fail order key ${orderKey}`);
    try {
      const result = await orderHandler.cancelOrder(orderKey, {
          gasLimit: GAS_LIMIT
      });
      console.log("cancel order: orderkey: %s => tx %s", orderKey, result.hash);
    }
    catch(e){
        console.error("failed to cancel order > %s", e);
    }
  });


  await subscriber.subscribe(CHANNEL_DEPOSIT, async (depositKey) => {
    console.log(`found fail deposit key ${depositKey}`);
    try {
      const result = await depositHandler.cancelDeposit(depositKey, {
          gasLimit: GAS_LIMIT
      });
      console.log("cancel deposit: depositKey: %s => tx %s", depositKey, result.hash);
    }
    catch(e){
        console.error("failed to cancel deposit > %s", e);
    }
  });


  await subscriber.subscribe(CHANNEL_WITHDRAW, async (withdrawKey) => {
    console.log(`found fail withdraw key ${withdrawKey}`);
    try {
      const result = await withdrawalHandler.cancelWithdrawal(withdrawKey, {
          gasLimit: GAS_LIMIT
      });
      console.log("cancel withdraw: withdrawKey: %s => tx %s", withdrawKey, result.hash);
    }
    catch(e){
        console.error("failed to cancel withdraw > %s", e);
    }
  });



  process.on('SIGINT', async () => {
    console.log('closing Redis connection...');
    await subscriber.quit();
    process.exit(0);
});
}

main();