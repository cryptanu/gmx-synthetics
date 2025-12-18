import hre from "hardhat";
import { deployFixture } from "../utils/fixture2";
import { setTimeout } from 'timers/promises';
import { loadOracleParams} from "../../utils/exchangelive";
import { loadApiPrices } from "../../utils/priceslive";
import { getIsAdlEnabled, updateAdlState, executeAdl } from "../../utils/adl";
import { printMarket, printPosition} from '../utils';
import { TOKEN_ORACLE_TYPES } from "../../utils/oracle";


const { ethers } = hre;

async function main() {
 const fixture = await deployFixture();
 await startKeeper(fixture);
}

async function startKeeper(fixture:any) {
  let reader, dataStore;
  ({ reader, dataStore } = fixture.contracts);

  while (true) {
    await setTimeout(5000);
    console.log("------------------------ Scanning ADL ------------------------");
    try {
      const markets = [...(await reader.getMarkets(dataStore.address, 0, 100))];
      
      for await (const market of markets){
        if(market.indexToken === undefined || market.indexToken === ethers.constants.AddressZero){
            continue;
        }
        
        const priceInfos = await loadApiPrices();
        
        const adlProbPrice =  {
          indexTokenPrice: {
            min: priceInfos[market.indexToken].minPrice, 
            max: priceInfos[market.indexToken].maxPrice, 
          },
          longTokenPrice: {
            min: priceInfos[market.longToken].minPrice, 
            max: priceInfos[market.longToken].maxPrice, 
          },
          shortTokenPrice: {
            min: priceInfos[market.shortToken].minPrice, 
            max: priceInfos[market.shortToken].maxPrice, 
          },
        };
        
        ////long side
        {
          const adlState = await reader.getAdlState(dataStore.address, market.marketToken, true, adlProbPrice);

          if(adlState[1]){
            try{
              const updateAdlParam = {
                market: { marketToken: market.marketToken },
                isLong: true,
                ...await loadOracleParams(collectTokenInfos(market)),
              };

              fillTokenOracleTypes(updateAdlParam);
              
              await updateAdlState(fixture, updateAdlParam);

              const isAdlEnabled = await getIsAdlEnabled(dataStore, market.marketToken, true);

              if(isAdlEnabled){
                  console.warn("force adl long side for market >>");
                  printMarket(market);
                  const groupedPositions = await collectMarketPositions(reader, dataStore, market.marketToken);
                  const emptyPos  = !groupedPositions[market.marketToken] || !groupedPositions[market.marketToken]["true"];
                  
                  if(!emptyPos){
                    const adlLongPositions = groupedPositions[market.marketToken]["true"];
    
                    for(const [account, positions] of Object.entries(adlLongPositions)){
                      for  (const position of positions){
                        try{
                          const accountAdlParam = {
                            account: account,
                            market: market,
                            collateralToken: {address: position.addresses.collateralToken},
                            isLong: true,
                            sizeDeltaUsd: position.numbers.sizeInUsd, //@todo review sizeDeltaUsd vs sizeInUsd
                            ...await loadOracleParams(collectTokenInfos2(market, position.addresses.collateralToken))
                          };

                          fillTokenOracleTypes(accountAdlParam);

                          console.warn("adl long side for account with params >> %s ...", JSON.stringify(accountAdlParam));
                          await executeAdl(fixture, accountAdlParam);
                          console.warn("adl long side for account with params >> %s ...done!", JSON.stringify(accountAdlParam));
                        }
                      catch(e){
                        console.error("adl position long side got error >", e);
                        printPosition(position);
                      }
                    }
                  }
                }
              }
            }
            catch(e){
              console.error("adl market long side error>", e);
            }
          } 
          else{
            console.log("dont adl long side for market >>");
            printMarket(market);
          }

        }

        ////short side
        {
          const adlState = await reader.getAdlState(dataStore.address, market.marketToken, true, adlProbPrice);

          if(adlState[1]){
            try{
              const updateAdlParam = {
                market: { marketToken: market.marketToken },
                isLong: false,
                ...await loadOracleParams(collectTokenInfos(market)),
              };

              fillTokenOracleTypes(updateAdlParam);
              
              await updateAdlState(fixture, updateAdlParam);

              const isAdlEnabled = await getIsAdlEnabled(dataStore, market.marketToken, false);

              if(isAdlEnabled){
                console.warn("force adl short side for market >>");
                printMarket(market);

                const groupedPositions = await collectMarketPositions(reader, dataStore, market.marketToken);
                const emptyPos  = !groupedPositions[market.marketToken] || !groupedPositions[market.marketToken]["false"];
                  
                  if(!emptyPos){
                    const adlShortPositions = groupedPositions[market.marketToken]["false"];
    
                    for(const [account, positions] of Object.entries(adlShortPositions)){
                      for  (const position of positions){
                        try{
                          const accountAdlParam = {
                            account: account,
                            market: market,
                            collateralToken: {address: position.addresses.collateralToken},
                            isLong: true,
                            sizeDeltaUsd: position.numbers.sizeInUsd, //@todo review sizeDeltaUsd vs sizeInUsd
                            ...await loadOracleParams(collectTokenInfos2(market, position.addresses.collateralToken))
                          };

                          fillTokenOracleTypes(accountAdlParam);

                          console.warn("adl short side for account with params >> %s ...", JSON.stringify(accountAdlParam));
                          await executeAdl(fixture, accountAdlParam);
                          console.warn("adl short side for account with params >> %s ...done!", JSON.stringify(accountAdlParam));
                        }
                      catch(e){
                        console.error("adl position got error >>", e);
                        printPosition(position);
                      }
                    }
                  }
                }
              }
            }
            catch(e){
              console.error("adl market short side error >", e);
            }
          } 
          else{
            console.log("dont adl short side for market >");
            printMarket(market);
          }
        }
      }
    } catch (error) {
      console.error("Get markets error %s", error);
    }
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


function collectTokenInfos(market: any){
  let all = [market.indexToken, market.longToken, market.shortToken]
            .filter( token => (token !== undefined) && (token !== ethers.constants.AddressZero))

  return [...new Set(all)];
}

function collectTokenInfos2(market: any, collateralToken: any){
  let all = [market.indexToken, market.longToken, market.shortToken, collateralToken]
            .filter( token => (token !== undefined) && (token !== ethers.constants.AddressZero))
  return [...new Set(all)];
}

//@todo should collect positions for adl market
async function  collectPositions(reader: any, dataStore: any){
  const classified = {};
  const pKeys = await reader.getPositionKeys(dataStore.address, 0,  await reader.getPositionCount(dataStore.address));
  const positions = await Promise.all(pKeys.map(async (pKey) => await reader.getPosition(dataStore.address, pKey)));
  
  positions.forEach(position => {
      const market = position.addresses.market;
      const account = position.addresses.account;
      const isLong = position.flags.isLong;
      
      if(!classified[market])
        classified[market] = {};
  
      if(!classified[market][isLong])
        classified[market][isLong] = {};
  
      if(!classified[market][isLong][account])
        classified[market][isLong][account] = [];
  
      classified[market][isLong][account].push(position)
  });
  return classified;
}

async function  collectMarketPositions(reader, dataStore, marketAddr){
const classified = {};
const positions = await reader.getMarketPositions(dataStore.address,  marketAddr, 0,  await reader.getMarketPositionCount(dataStore.address, marketAddr));

positions.forEach(position => {
    const market = position.addresses.market;
    const account = position.addresses.account;
    const isLong = position.flags.isLong;
    
    if(!classified[market])
      classified[market] = {};

    if(!classified[market][isLong])
      classified[market][isLong] = {};

    if(!classified[market][isLong][account])
      classified[market][isLong][account] = [];

    classified[market][isLong][account].push(position)
});
return classified;
}

function fillTokenOracleTypes(adlParams: any){
  adlParams.tokenOracleTypes = [];
  for(let index = 0; index < adlParams.tokens.length; index++){
    adlParams.tokenOracleTypes.push(TOKEN_ORACLE_TYPES.DEFAULT);
  }
}