#!/bin/bash
if [ $# -ne 1 ]; then
    echo -n "no network ?"
    exit 1
else
  CWD=`pwd`
  npx hardhat run --network "$1" ../scripts/keepers/refundOrder.ts > "$CWD/refundOrder.$1.log" 2>&1 &
fi