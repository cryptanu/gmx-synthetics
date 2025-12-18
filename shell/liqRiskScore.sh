#!/bin/bash
pm2 start  --watch true --name "liqRiskScore" "npx hardhat run --network lineaGoerli ../scripts/keepers/liquidationRiskScore.ts"
