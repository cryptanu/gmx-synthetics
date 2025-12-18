#!/bin/bash
##export all info, just rerun it

## dump market info
./runOnNetwork.sh "$1" printMarkets.ts

##export tokens & contract info
./runOnNetwork.sh "$1" printDeploymentsForApps.ts

##copy to api
cp ../config/simulatetokens.json "../../bean-api/config/tokens.json"

##copy to interface
cp ../config/simulatetokens.json ../../bean-interface/src/config/tokens.json

##copy to subgraph
cp ../../bean-interface/src/config/contracts.json ../../bean-subgraph/config
cp ../../bean-interface/src/config/tokens.json ../../bean-subgraph/config
cp ../scripts/keepers/markets.json ../../bean-subgraph/config/
