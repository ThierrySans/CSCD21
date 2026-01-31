import { describe, it, expect, beforeAll } from 'vitest';

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from 'vitest';

import solc from "solc";
import { createPublicClient, createWalletClient, http, parseGwei, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

function createClient(chain, server){
    const rpc = http(server);
    return createPublicClient({ chain, transport: rpc });
} 

function createWallet(client, pk){
    const chain = client.chain;
    const transport = http(client.transport.url);
    const account = privateKeyToAccount(pk);
    return createWalletClient({ chain, transport, account });
}

function compileContract(contract){
	const content = readFileSync(join('contracts', `${contract}.sol`), "utf8");
	const sources = {};
	sources[`${contract}.sol`] = { content };
  	const input = {
    	language: "Solidity",
    	sources,
    	settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
  	};
  	const output = JSON.parse(solc.compile(JSON.stringify(input)));
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
  	const c = output.contracts[`${contract}.sol`][contract];
	const abi = c.abi;
	const bytecode = `0x${c.evm.bytecode.object}`;
    return { abi, bytecode };
}

async function deployContract(client, wallet, { abi, bytecode }, args=[], value=0n){
    const hash = await wallet.deployContract({ abi, bytecode, args, value });
    const receipt = await client.waitForTransactionReceipt({ hash });
    return receipt.contractAddress;
}

describe("Lock Tests", function () {
	
    let client, wallet, abi, address, unlockTime, value;
    
    beforeAll(async () => {
        client = await createClient(foundry, "http://127.0.0.1:8545");
        wallet = await createWallet(client, "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
        const compiled = compileContract("Lock");
        abi = compiled.abi;
        const block = await client.getBlock({ blockTag: "latest" });
        const now = Number(block.timestamp); 
        const oneYear = 365 * 24 * 60 * 60;
        unlockTime = BigInt(now + oneYear);
        value = parseGwei('1');
        address = await deployContract(client, wallet, compiled, [unlockTime], value);
    })
    
    describe("Deployment Tests", function (){
    	
        it("Should have the right balance", async function () {
            const balance = await client.getBalance({address});
            expect(balance).to.equal(value);
    	});
    
    	it("Should have the right unlockTime", async function () {
            const time = await client.readContract({ address, abi, functionName: "unlockTime" });
            expect(time).to.equal(unlockTime);
    	});
    
    	it("Should have the right owner", async function () {
            const owner = await client.readContract({ address, abi, functionName: "owner" });
            expect(owner).to.equal(wallet.account.address);
    	});
        
    })
    
    describe("Present Tests", function (){
    	
        it("Should reject if withdrawing too soon", async function () {
            const request = wallet.writeContract({ address, abi, functionName: "withdraw" });
            await expect(request).rejects.toThrow("You can't withdraw yet");
    	});
    
    })
    
    describe("Future Tests", function (){
    
        beforeAll(async () => {
            // increase by time by one year
            await client.request({ method: "anvil_increaseTime", params: [365 * 24 * 60 * 60], });
            // // mine 1 block
            await client.request({method: "anvil_mine", params: [1] });
        })
        
        it("Should reject if withdrawing is not done by the owner", async function () {
            const anotherWallet = await createWallet(client, "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
            const request = anotherWallet.writeContract({ address, abi, functionName: "withdraw" });
            await expect(request).rejects.toThrow("You aren't the owner");
        });
        
        it("Should emit an event on withdrawals", async function () {
            const hash = await wallet.writeContract({ address, abi, functionName: "withdraw" });
            const receipt = await client.waitForTransactionReceipt({ hash });
            expect(receipt.logs).toHaveLength(1);
            const log = receipt.logs[0];
            const { args } = decodeEventLog({abi, data: log.data, topics: log.topics });
            expect(args.amount).to.equal(value);
            const block = await client.getBlock({ blockNumber: receipt.blockNumber });
            expect(args.when).to.equal(block.timestamp);
        });
    })
    	
});