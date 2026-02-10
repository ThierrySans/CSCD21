import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "crypto";

import { expect, describe, it, beforeAll, afterAll } from 'vitest';

import { createPublicClient, createWalletClient, http, getAddress, decodeEventLog, parseUnits } from "viem";
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


describe("Order Exchange", function () {
	
    let owner, receiver1, receiver2, market; // wallets
    let contract; // contracts

    const receipts = [];

    afterAll(async () =>{
        if (receipts.length === 0) return;

        console.log("\n=== Gas / ETH cost summary ===");
        
        for (const {label, receipt} of receipts){
            const costWei = receipt.gasUsed * receipt.effectiveGasPrice;
            console.log(`• ${label}: ${receipt.gasUsed.toLocaleString()} gas`);
        }
        console.log("================================\n");
    });
    
    beforeAll(async () => {
        // create wallets
        [owner, receiver1, receiver2, market] = await Promise.all(privateKeys.map(function(pk){
            return createWalletClient({ chain: foundry, transport: rpc , account: privateKeyToAccount(pk) });
        }));
        // compile the contract
        const { abi, bytecode } = loadContract("MyNFT");
        // deploy contract
        const hash = await owner.deployContract({ abi, bytecode });
        // wait for the transaction to be confirmed
        const receipt = await client.waitForTransactionReceipt({ hash });
        receipts.push({label: "Deployment", receipt});
        const address = receipt.contractAddress;
        contract = { address, abi };
    })
    
    describe("Deployment", function (){
        
        it("Should have the right owner", async function () {
            const { address, abi } = contract;
            const contractOwner = await client.readContract({ address, abi, functionName: "owner" });
            expect(contractOwner).to.equal(owner.account.address);
    	});
        
    });    
    
    describe("Mint", function (){

        const tokenURI = "https://example.com/token/0";
        
        beforeAll(async () => {
            const { address, abi } = contract;
            const hash = await owner.writeContract({
                address, abi,
                functionName: "safeMint",
                args:[receiver1.account.address, tokenURI]
            });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "mint", receipt});
        })

        it("Should have the right uri", async function () {
            const { address, abi } = contract;
            const uri = await client.readContract({ address, abi, functionName: "tokenURI", args:[0] });
            expect(uri).to.equal(tokenURI);
        });
        
        it("Should have the right owner", async function () {
            const { address, abi } = contract;
            const nftOwner = await client.readContract({ address, abi, functionName: "ownerOf", args:[0] });
            expect(nftOwner).to.equal(receiver1.account.address);
        });

        it("Should fail if not owner", async function () {
            const { address, abi } = contract;
            const anotherTokenURI = "https://example.com/token/1";
            const request = receiver1.writeContract({
                address, abi,
                functionName: "safeMint",
                args:[receiver1.account.address, anotherTokenURI]
            });
            await expect(request).rejects.toThrow("The contract function \"safeMint\" reverted.");
        });
    });
    
    describe("Transfer", function (){
        
        const tokenId = 1;
        
        beforeAll(async () => {
            const tokenURI = "https://example.com/token/1";
            const { address, abi } = contract;
            const hash = await owner.writeContract({
                address, abi,
                functionName: "safeMint",
                args:[receiver1.account.address, tokenURI]
            });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "mint", receipt});
        })
        
        it("Should allow owner to transfer", async function () {
            const { address, abi } = contract;
            const hash = await receiver1.writeContract({
                address, abi,
                functionName: "safeTransferFrom",
                args:[receiver1.account.address, receiver2.account.address, tokenId]
            });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "transfer", receipt});
            const nftOwner = await client.readContract({ address, abi, functionName: "ownerOf", args:[tokenId] });
            expect(nftOwner).to.equal(receiver2.account.address);
        });
    });
    
    describe("Delegate Transfer", function (){
        
        const tokenId = 2;
        
        beforeAll(async () => {
            const tokenURI = "https://example.com/token/2";
            const { address, abi } = contract;
            await owner.writeContract({
                address, abi,
                functionName: "safeMint",
                args:[receiver1.account.address, tokenURI]
            });
            const hash = await receiver1.writeContract({
                address, abi,
                functionName: "approve",
                args:[market.account.address, tokenId]
            });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "approve", receipt});
        })
        
        it("Should have set the right approval", async function () {
            const { address, abi } = contract;
            const approvee = await client.readContract({ address, abi, functionName: "getApproved", args:[tokenId] });
            expect(approvee).to.equal(market.account.address);
        });
        
        it("Should allow market to transfer", async function () {
            const { address, abi } = contract;
            const hash = await market.writeContract({
                address, abi,
                functionName: "safeTransferFrom",
                args:[receiver1.account.address, receiver2.account.address, tokenId]
            });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "transferFrom", receipt});
            const nftOwner = await client.readContract({ address, abi, functionName: "ownerOf", args:[tokenId] });
            expect(nftOwner).to.equal(receiver2.account.address);
        });
    });
});
