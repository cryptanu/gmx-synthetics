import { createHash } from "crypto";
import { Pool } from 'pg';

export function hashToRange(input: string, maxRange: number): number {
    if (maxRange <= 0) throw new Error("maxRange must be greater than 0");
    const hash = createHash("sha256").update(input).digest("hex");
    const numericHash = parseInt(hash.substring(0, 8), 16); // Use first 8 characters
    return numericHash % maxRange;
}

//@todo secure pg connection
export function  makePgConnection() {
  return new Pool({
    user: "graph_node",
    host: "54.254.60.28",
    database: "graph_node",
    password: "BeanToTheMoon",
    port: Number(5432),
  });
}
