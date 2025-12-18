/**
 * Manually make deposit
 */
import hre from "hardhat";
import {expandDecimals } from "../../utils/math";
import { getPoolAmount } from "../../utils/market";
import { getBalanceOf } from "../../utils/token";

import { deployFixture } from "../utils/fixture2";

import { getDepositCount, getDepositKeys, createDeposit, executeDeposit, handleDeposit } from "../../utils/deposit";
import { setTimeout } from 'timers/promises';
import { printDeposit } from "../utils";

async function main() {
  //1. load fixture
  const fixture = await deployFixture();
  await depositBtcUsdc(fixture);
}

async function depositEthUsdMarket(fixture:any) {
    //1. load account
   let user0, user1, user2;
   let reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc, doge;
 
   ({ user0, user1, user2 } = fixture.accounts);
   ({ reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc, doge } = fixture.contracts);

    console.log("deposit both long & short ...");
    console.log("deposit count check sum before deposit: %s", await getDepositCount(dataStore));
    await createDeposit(fixture, {
      account: user2,
      receiver: user2,
      market: ethUsdMarket,
      longTokenAmount: expandDecimals(1, 18), //1
      shortTokenAmount: expandDecimals(1700, 6), // 2500
    });

    console.log("deposit count check sum after deposit: %s", await getDepositCount(dataStore));

    const depositKeys = await getDepositKeys(dataStore, 0, 100);
    const depositKey = depositKeys[depositKeys.length - 1];
    const deposit = await reader.getDeposit(dataStore.address, depositKey);
    console.log("deposit count before execute: %s", await getDepositCount(dataStore));

    //then execute the last one
    console.log("executing deposit with key : %s", depositKey);
    printDeposit(deposit);

    await executeDeposit(fixture, {
      precisions: [8, 18],
      minPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
      maxPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
      depositKey: depositKey,
    });
    console.log("executing deposit with key : %s ...DONE!", depositKey);
    console.log("deposit count after execute: %s", await getDepositCount(dataStore));

}

async function depositDoge(fixture:any) {
  //1. load account
 let user0, user1, user2;
 let reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, dogeUsdMarket, wnt, usdc, doge;

 ({ user0, user1, user2 } = fixture.accounts);
 ({ reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, dogeUsdMarket, wnt, usdc, doge} = fixture.contracts);

  console.log("deposit both long & short ...");
  console.log("deposit count check sum before deposit: %s", await getDepositCount(dataStore));
  await createDeposit(fixture, {
    account: user2,
    receiver: user2,
    market: dogeUsdMarket,
    longTokenAmount: expandDecimals(1, 18), // 1eth
    shortTokenAmount: expandDecimals(1700, 6), // 1700 USDC
  });
  console.log("deposit count check sum after deposit: %s", await getDepositCount(dataStore));

  const depositKeys = await getDepositKeys(dataStore, 0, 100);
  const depositKey = depositKeys[depositKeys.length - 1];
  const deposit = await reader.getDeposit(dataStore.address, depositKey);
  console.log("deposit count before execute: %s", await getDepositCount(dataStore));

  //then execute the last one
  console.log("executing deposit with key : %s", depositKey);
  printDeposit(deposit);

  await executeDeposit(fixture, {
    tokens: [doge.address, wnt.address, usdc.address],
    precisions: [14, 8, 18],
    minPrices: [expandDecimals(6916994, 0), expandDecimals(17983774, 0), expandDecimals(999904, 0)],
    maxPrices: [expandDecimals(6919108, 0), expandDecimals(17985257, 0),  expandDecimals(1000004, 0)],
    depositKey: depositKey,
  });
  console.log("executing deposit with key : %s ...DONE!", depositKey);
  console.log("deposit count after execute: %s", await getDepositCount(dataStore));

}

async function depositBtcUsdc(fixture:any) {
  //1. load account
 let user0, user1, user2;
 let reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, dogeUsdMarket, btcUsdMarket, wnt, usdc, doge, wbtc;

 ({ user0, user1, user2 } = fixture.accounts);
 ({ reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, dogeUsdMarket, btcUsdMarket, wnt, usdc, doge, wbtc} = fixture.contracts);

  console.log("deposit both long & short ...");
  console.log("deposit count check sum before deposit: %s", await getDepositCount(dataStore));
  await createDeposit(fixture, {
    account: user2,
    receiver: user2,
    market: btcUsdMarket,
    longTokenAmount: expandDecimals(1, 8), // 1btc
    shortTokenAmount: expandDecimals(34000, 6), // 1700 USDC
  });
  console.log("deposit count check sum after deposit: %s", await getDepositCount(dataStore));

  const depositKeys = await getDepositKeys(dataStore, 0, 100);
  const depositKey = depositKeys[depositKeys.length - 1];
  const deposit = await reader.getDeposit(dataStore.address, depositKey);
  console.log("deposit count before execute: %s", await getDepositCount(dataStore));

  //then execute the last one
  console.log("executing deposit with key : %s", depositKey);
  printDeposit(deposit);

  await executeDeposit(fixture, {
    tokens: [wbtc.address, usdc.address],
    precisions: [18, 18],
    minPrices: [expandDecimals(342566500, 0), expandDecimals(999904, 0)],
    maxPrices: [expandDecimals(342587637, 0), expandDecimals(1000004, 0)],
    depositKey: depositKey,
  });
  console.log("executing deposit with key : %s ...DONE!", depositKey);
  console.log("deposit count after execute: %s", await getDepositCount(dataStore));
}


async function handleDepositLongDoge(fixture) {
  //2. load account
  let user0, user1, user2;
  let reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc, doge, dogeUsdMarket;

  ({ user0, user1, user2 } = fixture.accounts);
  ({ reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc, doge, dogeUsdMarket } = fixture.contracts);

  //3. create deposit
  // User0 creates a deposit long token
  await createDeposit(fixture, {
    account: user0,
    receiver: user0,
    market: dogeUsdMarket,
    longTokenAmount: expandDecimals(1, 18), // 1eth
    shortTokenAmount: expandDecimals(50 * 1000, 6), // 50,000 usdc
  });


  const depositKeys = await getDepositKeys(dataStore, 0, 100);
  const depositKey = depositKeys[depositKeys.length - 1];
  const deposit = await reader.getDeposit(dataStore.address, depositKey);
  console.log("deposit count before execute: %s", await getDepositCount(dataStore));

  //then execute the last one
  console.log("executing deposit with key : %s", depositKey);
  printDeposit(deposit);

  await executeDeposit(fixture, {
    precisions: [8, 18],
    minPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
    maxPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
    depositKey: depositKey,
  });
  console.log("executing deposit with key : %s ...DONE!", depositKey);

     // Check that User1 have $50,000 worth of market token
   const marketTokenAmt = await getBalanceOf(dogeUsdMarket.marketToken, user0.address);
   console.log("marketTokenAmt : %s ", marketTokenAmt);

   // Check the pool received the deposited amount
   const poolAmtEth = await getPoolAmount(dataStore, dogeUsdMarket.marketToken, wnt.address);
   console.log("poolAmtEth : %s ", marketTokenAmt);

   const poolAmtUsdc = await getPoolAmount(dataStore, dogeUsdMarket.marketToken, usdc.address);
   console.log("poolAmtUsdc : %s ", marketTokenAmt);

   // Check that User1's deposit got executed and there is 0 deposits waiting to get executed
   console.log("deposit count after execute: %s", await getDepositCount(dataStore));
}

async function handleDepositLong(fixture) {
   //2. load account
   let user0, user1, user2;
   let reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc;
 
   ({ user0, user1, user2 } = fixture.accounts);
   ({ reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc } = fixture.contracts);
 
   //3. create deposit
   // User0 creates a deposit long token
   await createDeposit(fixture, {
     account: user0,
     receiver: user0,
     market: ethUsdMarket,
     longTokenAmount: expandDecimals(10, 18), // 10ETH
     executionFee: "50000000000000000"
   });
 
 
   const depositKeys = await getDepositKeys(dataStore, 0, 100);
   const depositKey = depositKeys[depositKeys.length - 1];
   const deposit = await reader.getDeposit(dataStore.address, depositKey);
   console.log("deposit count before execute: %s", await getDepositCount(dataStore));
 
   //then execute the last one
   console.log("executing deposit with key : %s ....", depositKey);
   await executeDeposit(fixture, {
     precisions: [8, 18],
     minPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
     maxPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
     depositKey: depositKey,
   });
   console.log("executing deposit with key : %s ...DONE!", depositKey);

      // Check that User1 have $50,000 worth of market token
    const marketTokenAmt = await getBalanceOf(ethUsdMarket.marketToken, user0.address);
    console.log("marketTokenAmt : %s ", marketTokenAmt);

    // Check the pool received the deposited amount
    const poolAmtEth = await getPoolAmount(dataStore, ethUsdMarket.marketToken, wnt.address);
    console.log("poolAmtEth : %s ", marketTokenAmt);

    const poolAmtUsdc = await getPoolAmount(dataStore, ethUsdMarket.marketToken, usdc.address);
    console.log("poolAmtUsdc : %s ", marketTokenAmt);

    // Check that User1's deposit got executed and there is 0 deposits waiting to get executed
    console.log("deposit count after execute: %s", await getDepositCount(dataStore));
}

async function handleDepositShort(fixture) {
  //load env
  let user0, user1, user2;
  let reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc;

  ({ user0, user1, user2 } = fixture.accounts);
  ({ reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc } = fixture.contracts);

  await createDeposit(fixture, {
    account: user1,
    receiver: user1,
    market: ethUsdMarket,
    shortTokenAmount: expandDecimals(50 * 1000, 6), // 50,000 usdc
    executionFee: "50000000000000000"
  });


  const depositKeys = await getDepositKeys(dataStore, 0, 100);
  const depositKey = depositKeys[depositKeys.length - 1];
  const deposit = await reader.getDeposit(dataStore.address, depositKey);
  console.log("deposit count before execute: %s", await getDepositCount(dataStore));

  // Execute the deposit
  console.log("executing deposit with key : %s ...", depositKey);
  await executeDeposit(fixture, {
    precisions: [8, 18],
    minPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
    maxPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
    depositKey: depositKey,
  });
  console.log("executing deposit with key : %s ...DONE!", depositKey);

  // Check that User1 have $50,000 worth of market token
  const marketTokenAmt = await getBalanceOf(ethUsdMarket.marketToken, user1.address);
  console.log("marketTokenAmt : %s ", marketTokenAmt);

  // Check the pool received the deposited amount
  const poolAmtEth = await getPoolAmount(dataStore, ethUsdMarket.marketToken, wnt.address);
  console.log("poolAmtEth : %s ", marketTokenAmt);

  const poolAmtUsdc = await getPoolAmount(dataStore, ethUsdMarket.marketToken, usdc.address);
  console.log("poolAmtUsdc : %s ", marketTokenAmt);


  // Check that User1's deposit got executed and there is 0 deposits waiting to get executed
  console.log("deposit count after execute: %s", await getDepositCount(dataStore));
}

async function handleDepositBoth(fixture: any) {
   //1. load account
   let user0, user1, user2;
   let reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc;
 
   ({ user0, user1, user2 } = fixture.accounts);
   ({ reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc } = fixture.contracts);

   // User2 creates a deposit for $25,000 worth of long token and $25,000 worth of short token
   await createDeposit(fixture, {
    account: user2,
    receiver: user2,
    market: ethUsdMarket,
    longTokenAmount: expandDecimals(5, 18), // 5WETH
    shortTokenAmount: expandDecimals(25 * 1000, 6), // 25000 USDC
    executionFee: "50000000000000000"
  });


   
  const depositKeys = await getDepositKeys(dataStore, 0, 100);
  const depositKey = depositKeys[depositKeys.length - 1];
  const deposit = await reader.getDeposit(dataStore.address, depositKey);
  console.log("deposit count before execute: %s", await getDepositCount(dataStore));


  // Execute the deposit
  console.log("executing deposit with key : %s ...", depositKey);
  await executeDeposit(fixture, {
    precisions: [8, 18],
    minPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
    maxPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
    depositKey: depositKey,
  });
  console.log("executing deposit with key : %s ...DONE!", depositKey);

  const marketTokenAmt = await getBalanceOf(ethUsdMarket.marketToken, user2.address);
  console.log("marketTokenAmt : %s ", marketTokenAmt);

  // Check the pool received the deposited amount
  const poolAmtEth = await getPoolAmount(dataStore, ethUsdMarket.marketToken, wnt.address);
  console.log("poolAmtEth : %s ", marketTokenAmt);

  const poolAmtUsdc = await getPoolAmount(dataStore, ethUsdMarket.marketToken, usdc.address);
  console.log("poolAmtUsdc : %s ", marketTokenAmt);

  // Check that User1's deposit got executed and there is 0 deposits waiting to get executed
  console.log("deposit count after execute: %s", await getDepositCount(dataStore));
}

async function handleDepositWithSwapPath(fixture:any) {
  //1. load account
  let user0, user1, user2;
  let reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc;

  ({ user0, user1, user2 } = fixture.accounts);
  ({ reader, dataStore, ethUsdMarket, ethUsdSpotOnlyMarket, wnt, usdc } = fixture.contracts);

  {
    // User0 add liq to ethUsdSpotOnlyMarket
    console.log("Depositing & executing to ethUsdSpotOnlyMarket ...");
    await createDeposit(fixture, {
      account: user0,
      receiver: user0,
      market: ethUsdSpotOnlyMarket,
      longTokenAmount: expandDecimals(10, 18), // $50,000
      shortTokenAmount: expandDecimals(50 * 1000, 6), // $50,000
      executionFee: "50000000000000000"
    });

    const depositKeys = await getDepositKeys(dataStore, 0, 100);
    const depositKey = depositKeys[depositKeys.length - 1];
    await executeDeposit(fixture, {
      precisions: [8, 18],
      minPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
      maxPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
      depositKey: depositKey,
    });
  }


  {
    // User0 add liq to ethUsdMarket
    console.log("Depositing & executing to ethUsdMarket...");
    await createDeposit(fixture, {
      account: user0,
      receiver: user0,
      market: ethUsdMarket,
      longTokenAmount: expandDecimals(10, 18), // $50,000
      shortTokenAmount: expandDecimals(50 * 1000, 6), // $50,000
      executionFee: "50000000000000000"
    });


    const depositKeys = await getDepositKeys(dataStore, 0, 100);
    const depositKey = depositKeys[depositKeys.length - 1];

    await executeDeposit(fixture, {
      precisions: [8, 18],
      minPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
      maxPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
      depositKey: depositKey,
    });
  }

    console.log("[ethUsdMarket] Pool amount WETH --> %s", await getPoolAmount(dataStore, ethUsdMarket.marketToken, wnt.address));
    console.log("[ethUsdMarket] Pool amount USDC --> %s", await getPoolAmount(dataStore, ethUsdMarket.marketToken, usdc.address));
    console.log("[ethUsdSpotOnlyMarket] Pool amount WETH --> %s", await getPoolAmount(dataStore, ethUsdSpotOnlyMarket.marketToken, wnt.address));
    console.log("[ethUsdSpotOnlyMarket] Pool amount USDC --> %s", await getPoolAmount(dataStore, ethUsdSpotOnlyMarket.marketToken, usdc.address));

    {
      /**
       * User2 creates a deposit
       * - for $50,000 worth of long token
       * - provides a long token swap path: will swap via ethUsdSpotOnlyMarket first, then deposit usdc to ethUsdMarket 
       */
      await createDeposit(fixture, {
        account: user2,
        receiver: user2,
        market: ethUsdMarket,
        initialLongToken: ethUsdMarket.longToken,
        longTokenAmount: expandDecimals(10, 18), // $50,000
        longTokenSwapPath: [ethUsdSpotOnlyMarket.marketToken, ethUsdMarket.marketToken],
        executionFee: "50000000000000000"
      });

      const depositKeys = await getDepositKeys(dataStore, 0, 100);
      const depositKey = depositKeys[depositKeys.length - 1];

      console.log("executing deposit with key : %s ....", depositKey);
      await executeDeposit(fixture, {
        precisions: [8, 18],
        minPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
        maxPrices: [expandDecimals(179838, 2), expandDecimals(1, 6)],
        depositKey: depositKey,
      });

      // Check that User2 have $50,000 worth of market token
      console.log("Market token of user % --> %s", user2, await getBalanceOf(ethUsdMarket.marketToken, user2.address));
      console.log("Pool amount WETH --> %s", await getPoolAmount(dataStore, ethUsdMarket.marketToken, wnt.address));
      console.log("Pool amount USDC --> %s", await getPoolAmount(dataStore, ethUsdMarket.marketToken, usdc.address));
  
      console.log("[SPOT] Pool amount WETH --> %s", await getPoolAmount(dataStore, ethUsdSpotOnlyMarket.marketToken, wnt.address));
      console.log("[SPOT] Pool amount USDC --> %s", await getPoolAmount(dataStore, ethUsdSpotOnlyMarket.marketToken, usdc.address));
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