#!/bin/bash
if [ $# -ne 2 ]; then
    echo -n "no network ? no scripts ?"
    exit 1
else
    cd ../scripts
    npx hardhat run --network "$1" --show-stack-traces "$2"
fi
