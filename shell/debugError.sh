#!/bin/bash
if [ $# -ne 1 ]; then
    echo -n "no error code ? use: ./debugError.sh <errorBytes>"
    exit 1
else
    cd ../scripts
    ERROR="$1" npx hardhat run --network lineaGoerli --show-stack-traces  ../scripts/debugErrorReason.ts
fi
