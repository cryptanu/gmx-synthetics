import { execute } from "../../../.graphclient";

export async function findMarketBy(pageSize: number, pageIndex: number) {
  const myQuery = `
    {
       marketInfos(first: ${pageSize}, skip: ${pageSize * pageIndex}) {
          indexToken
          id
          longToken
          shortToken
      }
    }
  `
  const result = await execute(myQuery, {})

  return result.data.marketInfos
}

export async function findAllMarketInfo() {
  let index = 0;
  const result = [];
  while (true){
    const markets = await findMarketBy(10, index++);
    if(markets == null || markets.length == 0) break;
    result.push(markets);
  }
  return result;
}
