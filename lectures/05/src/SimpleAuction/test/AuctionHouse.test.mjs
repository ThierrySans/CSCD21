import { readFileSync } from "node:fs";
import { join, resolve, } from "node:path";

import { expect, describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createPublicClient, createWalletClient, http, parseEther, decodeEventLog, formatEther, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import solc from "solc";

const rpc = http("http://127.0.0.1:8545");
const client = await createPublicClient({ chain: foundry, transport: rpc });

const privateKeys = [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
    "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
    "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
    "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
];

function findImports(importPath) {
  try {
    const fullPath = resolve("contracts", importPath);
    return { contents: readFileSync(fullPath, "utf8") };
  } catch (e) {
    return { error: "File not found" };
  }
}

function compileContract(contract){
    // read contract source code
	const content = readFileSync(join('contracts', `${contract}.sol`), "utf8");
	const sources = {};
	sources[`${contract}.sol`] = { content };
  	const input = {
    	language: "Solidity",
    	sources,
    	settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
  	};
    // compile the program
  	const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
    // show warnings and errors 
    if (output.errors) {
      for (const e of output.errors) {
        console.error(
          `${e.severity.toUpperCase()}: ${e.formattedMessage}`
        );
      }
      // fail hard on errors
      if (output.errors.some((e) => e.severity === "error")) {
        process.exit(1);
      }
    }
    // extract bytecode and abi (interface)
  	const c = output.contracts[`${contract}.sol`][contract];
	const abi = c.abi;
	const bytecode = `0x${c.evm.bytecode.object}`;
    return { abi, bytecode };
}

describe("Auction House", function () {
	
    let owner, user1; // wallets
    let contract; // contract
    
    const receipts = [];
    
    afterAll(async () =>{
        if (receipts.length === 0) return;

        console.log("\n=== Gas / ETH cost summary ===");
        
        for (const {label, receipt} of receipts){
            const costWei = receipt.gasUsed * receipt.effectiveGasPrice;
            console.log(`• ${label}\n  gas: ${receipt.gasUsed} | cost: ${formatEther(costWei)} ETH`);
        }
        console.log("================================\n");
    });
    
    beforeAll(async () => {
        // create wallets
        [owner, user1] = await Promise.all(privateKeys.map(function(pk){
            return createWalletClient({ chain: foundry, transport: rpc , account: privateKeyToAccount(pk) });
        })); 
        // compile the contract
        const { abi, bytecode } = compileContract("AuctionHouse");        
        // deploy contract
        const hash = await owner.deployContract({ abi, bytecode });
        // wait for the transaction to be confirmed
        const receipt = await client.waitForTransactionReceipt({ hash });
        receipts.push({ label: "Deployment", receipt });
        const address = receipt.contractAddress;
        contract = { address, abi };
    })
    
    describe("New Auction", function (){
        
    	it("Should create a new auction", async function () {
            const { address, abi } = contract;
            // parameters
            const label = "User1's auction";
            const biddingTime = BigInt(60);
            // send transaction
            const hash = await user1.writeContract({ address, abi, functionName: "createAuction", args:[label, biddingTime] });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Create Auction", receipt});
            // check the logs looking of events
            expect(receipt.logs).toHaveLength(1);
            const log = receipt.logs[0];
            // parse and check event
            const { args, eventName } = decodeEventLog({abi, data: log.data, topics: log.topics });
            expect(eventName).to.equal('AuctionDeployed');
            // check auction
            expect(isAddress(args.auction)).toBe(true);
            // check owner
            expect(args.owner).to.equal(user1.account.address);
            // check label
            expect(args.label).to.equal(label);
             // check label
            expect(args.biddingTime).to.equal(biddingTime);
    	});
    })
});