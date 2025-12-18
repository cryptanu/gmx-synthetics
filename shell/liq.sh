#!/bin/bash
pm2 start --watch true --name "liq2" "npx hardhat run --network lineaGoerli ../scripts/keepers/liquidationKeeper.ts"
