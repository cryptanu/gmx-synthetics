#!/bin/bash
# Check if two arguments are provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 {start|stop}"
    exit 1
fi

# Get the arguments
action=$1

# Perform actions based on argument
case "$action" in
    start)
        echo "Starting all keepers with PM2..."
        pm2 start --name "masterDeposit" "npx hardhat run --network lineaGoerli ../scripts/keepers/masterDeposit.ts"
        pm2 start --name "masterWithdraw" "npx hardhat run --network lineaGoerli ../scripts/keepers/masterWithdraw.ts"
        pm2 start --name "masterOrder" "npx hardhat run --network lineaGoerli ../scripts/keepers/masterOrder.ts"

        pm2 start --name "orderKeeper0" "APP_INDEX=0 npx hardhat run --network lineaGoerli ../scripts/keepers/orderWorker.ts"
        pm2 start --name "orderKeeper1" "APP_INDEX=1 npx hardhat run --network lineaGoerli ../scripts/keepers/orderWorker.ts"
        # pm2 start --name "orderKeeper" "APP_INDEX=1 npx hardhat run --network lineaGoerli ../scripts/keepers/orderWorker.ts"
        # pm2 start --name "orderKeeper" "APP_INDEX=1 npx hardhat run --network lineaGoerli ../scripts/keepers/orderWorker.ts"
        # pm2 start --name "orderKeeper" "APP_INDEX=1 npx hardhat run --network lineaGoerli ../scripts/keepers/orderWorker.ts"

        pm2 start --name "depositKeeper0" "APP_INDEX=0 npx hardhat run --network lineaGoerli ../scripts/keepers/depositWorker.ts"
        pm2 start --name "depositKeeper1" "APP_INDEX=1 npx hardhat run --network lineaGoerli ../scripts/keepers/depositWorker.ts"

        pm2 start --name "withdrawKeeper0" "APP_INDEX=0 npx hardhat run --network lineaGoerli ../scripts/keepers/withdrawWorker.ts"
        pm2 start --name "withdrawKeeper1" "APP_INDEX=1 npx hardhat run --network lineaGoerli ../scripts/keepers/withdrawWorker.ts"

        echo "all keepers started with PM2."
        ;;
    stop)
        echo "Stopping all keepers with PM2..."

        pm2 delete masterOrder
        pm2 delete masterWithdraw
        pm2 delete masterDeposit

        pm2 delete orderKeeper
        pm2 delete depositKeeper
        pm2 delete withdrawKeeper

        pm2 delete orderKeeper0
        pm2 delete depositKeeper0
        pm2 delete withdrawKeeper0

        pm2 delete orderKeeper1
        pm2 delete depositKeeper1
        pm2 delete withdrawKeeper1

        echo "all keepers stopped."
        ;;
    *)
        echo "Invalid argument. Use 'start' or 'stop'."
        exit 1
        ;;
esac
