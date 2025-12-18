import { execute } from "../../../.graphclient";

export async function findOrderCreatedBy(lstOrderType: number[],
                                         pageSize: number,
                                         pageIndex: number,
                                         triggerPrice: string,
                                         isLong: boolean,
                                         marketAddress: string) {
  const orderQuery = `
    {
      orders(
        where: {
          orderType_in: [${lstOrderType.toString()}],
          status: Created,
          isLong: ${isLong}
          marketAddress: "${marketAddress.toLowerCase()}",
          ${isLong ? `triggerPrice_lte: ${triggerPrice}` : `triggerPrice_gte: ${triggerPrice}`}
        }
        first: ${pageSize}
        skip: ${pageSize * pageIndex}
        orderBy: executedTxn__timestamp
        orderDirection: desc
      ) {
        id
      }
    }
  `;

  console.debug(">>> GraphQuery: %s", orderQuery);
  const result = await execute(orderQuery, {})
  return result.data.orders
}

export async function findAllShotLimitOrderTriggeredBy(triggerPrice: string, marketAddress: string): Promise<any> {
  let index = 0;
  const result = [];
  while (true){
    const orders = await findOrderCreatedBy([3,5], 20, index++, triggerPrice, false, marketAddress);
    if(orders == null || orders.length == 0) break;
    result.push(...orders);
  }
  return result;
}

export async function findAllLongLimitOrderTriggeredBy(triggerPrice: string, marketAddress: string): Promise<any>{
  let index = 0;
  const result = [];
  while (true){
    const orders = await findOrderCreatedBy([3,5], 20, index++, triggerPrice, true, marketAddress);
    if(orders == null || orders.length == 0) break;
    result.push(...orders);
  }
  return result;
}

export async function findCandidateLiqPosition(riskScore: number, leverage: number, sizeUsd: number, skip: 0, first: 1000): Promise<any>{
  const myQuery = `
    {
      riskScores(
        where: {riskScore_lte: "${riskScore}", sizeInUsd_gte: "${sizeUsd}", leverage_gte: "${leverage}"}
        skip: ${skip}
        first: ${first}
      ) {
        account
        id
        leverage
        marketAddress
        positionKey
        riskScore
        sizeInUsd
      }
  }
  `;

  // console.debug(">>> Liq Candidate GraphQuery: %s", myQuery);
  const result = (await execute(myQuery, {})).data.riskScores;
  // console.log(">> query result: %s", JSON.stringify(result));
  return result;
}