import { createJsonRpcRequest } from "@cosmjs/tendermint-rpc/build/jsonrpc";
import dotenv from "dotenv";

import { trySomeArb } from "./arbitrage/arbitrage";
import * as Juno from "./juno/juno";
import { getSlackClient, sendSlackMessage } from "./logging/slacklogger";
import { getChainOperator } from "./node/chainoperator";
import { getSkipClient } from "./node/skipclients";
import * as Terra from "./terra/terra";
import { MempoolLoop } from "./types/arbitrage/mempoolLoop";
import { SkipLoop } from "./types/arbitrage/skipLoop";
import { setBotConfig } from "./types/core/botConfig";
import { getPathsFromPool, getPathsFromPools3Hop } from "./types/core/path";

// load env files
dotenv.config();
const botConfig = setBotConfig(process.env);

let getFlashArbMessages = Juno.getFlashArbMessages;
let getPoolStates = Juno.getPoolStates;
let initPools = Juno.initPools;

switch (process.env.CHAIN_PREFIX) {
  case "terra": {
    getFlashArbMessages = Terra.getFlashArbMessages;
    getPoolStates = Terra.getPoolStates;
    initPools = Terra.initPools;
    break;
  }
  default: {
    break;
  }
}

console.log("---".repeat(30));
console.log("Environmental variables for setup:");
console.log("RPC ENPDOINT: ", botConfig.rpcUrl);
console.log("OFFER DENOM: ", botConfig.offerAssetInfo);
console.log("POOLS: ", botConfig.poolEnvs);
console.log("FACTORIES_TO_ROUTERS_MAPPING", botConfig.mappingFactoryRouter);
console.log("USE MEMPOOL: ", botConfig.useMempool);
console.log("USE SKIP: ", botConfig.useSkip);
if (botConfig.useSkip) {
  console.log("SKIP URL: ", botConfig.skipRpcUrl);
}
console.log("---".repeat(30));

/**
 * Runs the main program.
 */
async function main() {
  console.log("Setting up connections and paths");
  const [account, botClients] = await getChainOperator(botConfig);
  let slackClient;
  if (botConfig.slackToken) {
    slackClient = getSlackClient(botConfig.slackToken);
  }

  const { accountNumber, sequence } = await botClients.SigningCWClient.getSequence(account.address);
  const chainId = await (
    await botClients.HttpClient.execute(createJsonRpcRequest("block"))
  ).result.block.header.chain_id;
  console.log("accountnumber: ", accountNumber, " sequence: ", sequence, "chainid: ",  chainId);
  console.log("Done, Clients established");
  console.log("---".repeat(30));
  console.log("Deriving paths for arbitrage");
  const pools = await initPools(botClients.WasmQueryClient, botConfig.poolEnvs, botConfig.mappingFactoryRouter);
  const paths = getPathsFromPool(pools, botConfig.offerAssetInfo);
  const paths2 = getPathsFromPools3Hop(pools, botConfig.offerAssetInfo);
  console.log("2 HOP paths: ", paths.length);
  console.log("3 HOP paths: ", paths2.length);
  paths.push(...paths2);
  console.log("total paths: ", paths.length);
  console.log("---".repeat(30));

  let loop;
  if (
    botConfig.useSkip &&
    botConfig.skipRpcUrl !== undefined &&
    botConfig.skipBidRate !== undefined &&
    botConfig.skipBidWallet !== undefined
  ) {
    console.log("Initializing skip loop");
    const [skipClient, skipSigner] = await getSkipClient(botConfig.skipRpcUrl);
    loop = new SkipLoop(skipClient, skipSigner, botConfig, slackClient);
  } else if (botConfig.useMempool) {
    loop = new MempoolLoop(botClients, botConfig, slackClient);
  }

  if (loop) {
    console.log("Starting arbitrage loop");
    trySomeArb(loop, accountNumber, sequence, chainId, paths);
    loop.start();
  } else {
    console.log("No loop initialized. Exiting program.");
  }
}

main();
