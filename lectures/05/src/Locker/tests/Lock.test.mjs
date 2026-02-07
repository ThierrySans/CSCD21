import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createPublicClient, createWalletClient, http, parseEther, decodeEventLog, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

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


function loadContract(contract) {
  const content = readFileSync(join('out', `${contract}.sol`, `${contract}.json`), "utf8");
  const artifact = JSON.parse(content);
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}

describe("Lock Tests", function () {
	
    let owner, notOwner, // wallets
        contract;        // contract
    
    const receipts = [];
    
    const YEAR = 365 * 24 * 60 * 60;
    
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
        [owner, notOwner] = await Promise.all(privateKeys.map(function(pk){
            return createWalletClient({ chain: foundry, transport: rpc , account: privateKeyToAccount(pk) });
        }));
        // compile the contract
        const { abi, bytecode } = loadContract("Lock");
        // the contract's constructor requires the argument "unlockTime"
        const block = await client.getBlock({ blockTag: "latest" });
        const now = Number(block.timestamp); 
        const unlockTime = BigInt(now + YEAR);
        // the constructor is payable
        const value = parseEther('1');
        // deploy contract
        const hash = await owner.deployContract({ abi, bytecode, args: [unlockTime], value });
        // wait for the transaction to be confirmed
        const receipt = await client.waitForTransactionReceipt({ hash });
        receipts.push({label: "Deployment", receipt});
        const address = receipt.contractAddress;
        contract = {address, abi, args: { unlockTime }, value};
    })
    
    describe("Deployment Tests", function (){
    	
        it("Should have the right balance", async function () {
            const { address, value } = contract;
            const balance = await client.getBalance({address});
            expect(balance).to.equal(value);
    	});
    
    	it("Should have the right unlockTime", async function () {
            const { address, abi, args } = contract;
            const time = await client.readContract({ address, abi, functionName: "unlockTime" });
            expect(time).to.equal(args.unlockTime);
    	});
    
    	it("Should have the right owner", async function () {
            const { address, abi, args } = contract;
            const contractOwner = await client.readContract({ address, abi, functionName: "owner" });
            expect(contractOwner).to.equal(owner.account.address);
    	});
        
    })
    
    describe("Present Tests", function (){
    	
        it("Should reject if withdrawing too soon", async function () {
            const { address, abi } = contract;
            const request = owner.writeContract({ address, abi, functionName: "withdraw" });
            await expect(request).rejects.toThrow("You can't withdraw yet");
    	});
    
    })
    
    describe("Future Tests", function (){
    
        beforeAll(async () => {
            // increase blockchain time by one year
            await client.request({ method: "anvil_increaseTime", params: [YEAR], });
            // mine 1 block
            await client.request({method: "anvil_mine", params: [1] });
        })
        
        it("Should reject if withdrawing is not done by the owner", async function () {
            const { address, abi } = contract;
            // call the contract from another wallet
            const request = notOwner.writeContract({ address, abi, functionName: "withdraw" });
            await expect(request).rejects.toThrow("You aren't the owner");
        });
        
        it("Should emit an event on withdrawals", async function () {
            const { address, abi, value } = contract;
            // call the contract (success)
            const hash = await owner.writeContract({ address, abi, functionName: "withdraw" });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Withdrawal", receipt});
            // check the logs looking of events
            expect(receipt.logs).toHaveLength(1);
            const log = receipt.logs[0];
            // parse and check event
            const { args, eventName } = decodeEventLog({abi, data: log.data, topics: log.topics });
            expect(eventName).to.equal('Withdrawal');
            expect(args.amount).to.equal(value);
            const block = await client.getBlock({ blockNumber: receipt.blockNumber });
            expect(args.when).to.equal(block.timestamp);
        });
    })
    	
});