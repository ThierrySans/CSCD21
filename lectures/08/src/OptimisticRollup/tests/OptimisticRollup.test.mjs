import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createPublicClient, createWalletClient, http, parseEther, decodeEventLog, formatEther, encodePacked, keccak256, toBytes, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

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

import { encodePacked, keccak256, toBytes } from 'viem'

export async function addTransaction(balances, transactions, signer, from, to, amount){
    const messageHash = keccak256(encodePacked(
        ['address', 'address', 'uint256'],
        [from, to, amount]
    ));
    
    const signature = await signer.account.signMessage({message: { raw: toBytes(messageHash) }})

    if (from !== zeroAddress) {
        if (!(from in balances) || balances[from] < amount)
            { throw new Error('Insufficient balance'); }
        else balances[from] -= amount;
    }

    if (to !== zeroAddress) {
        if (!(to in balances)) { balances[to] = amount; }
        else balances[to] += amount
    }

    transactions.push({ from, to, amount, signature })
}

describe("Optimistic Rollup", function () {
	
    let deployer, alice, bob, charlie;  // wallets
    let contract;        // contract
    
	const balances = {};
	const transactions = [];
    let tree;
    
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
        
        // Create Accounts
        [deployer, alice, bob, charlie] = await Promise.all(privateKeys.map(function(pk){
            return createWalletClient({ chain: foundry, transport: rpc , account: privateKeyToAccount(pk) });
        }));
        
        // Deploy Contract =
        const { abi, bytecode } = loadContract("OptimisticRollup");
        const hash = await deployer.deployContract({abi, bytecode});
        const receipt = await client.waitForTransactionReceipt({ hash });
        receipts.push({label: "Deployment", receipt});
        const address = receipt.contractAddress;
        contract = { address, abi };
    })
    
    describe("Deposit", function () {
    
        it("should deposit funds", async function () {
            const { abi, bytecode } = contract;
            const hash = await alice.writeContract({ ...contract, functionName: "deposit", value: parseEther("1.5")});
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Deposit", receipt});
            
            // adding transaction to the rollup
            await addTransaction(balances, transactions, deployer, zeroAddress, alice.account.address, parseEther("1.0"));
            
        });
    });
    
    describe("Rollup", function () {
    
        it("should rollup", async function () {		
    		// other transactions
    		await addTransaction(balances, transactions, alice, alice.account.address, bob.account.address, parseEther("0.6"));
    		await addTransaction(balances, transactions, alice, alice.account.address, charlie.account.address, parseEther("0.1"));
    		await addTransaction(balances, transactions, bob, bob.account.address, charlie.account.address, parseEther("0.4"));

            // create the merkle tree
            tree = StandardMerkleTree.of(Object.entries(balances), ["address", "uint256"]);
            
            // rollup
            const { abi, bytecode } = contract;
            const hash = await deployer.writeContract({ ...contract, functionName: "update", args: [transactions, tree.root]});
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Rollup", receipt});
        });
    });
    
    describe("Balances", function () {
    
        let value, proof;
    
        beforeAll(async () => {
            value = [alice.account.address, balances[alice.account.address]];
            proof = tree.getProof(value);
        })
    
        it("should verify Alice's balance off chain", async function () {		
            const res = tree.verify(value, proof);
            expect(res).to.be.true;
        });
        
        it("should verify Alice's balance on chain", async function () {		
            const res = await client.readContract({ ...contract, functionName: "verifyProof", args: [
                alice.account.address, 
                balances[alice.account.address], 
                proof
            ]});
            expect(res).to.be.true;
        });
    });
       
    describe("Withdraw", function () {
        
        it("should allow Alice to withdraw funds", async function () {
            const value = [alice.account.address, balances[alice.account.address]];
            const proof = tree.getProof(value);
            const amount = parseEther("0.2");
            const hash = await alice.writeContract({ ...contract, functionName: "withdraw", args: [balances[alice.account.address], amount, proof]});
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Withdraw", receipt});
            
            // add transaction off chain
            await addTransaction(balances, transactions, deployer, alice.account.address, zeroAddress, amount);
            await expect(balances[alice.account.address]).to.be.equal(parseEther("0.1"));
        });
    });
     
    describe("More tests", function () {
        
        it("should allow Bob to withdraw 0.2 ETH", async function () {
            // allow bob to withdraw 
            const bobProof = tree.getProof([bob.account.address, balances[bob.account.address]]);
            const bobAmount = parseEther("0.2");
            const bobHash = await bob.writeContract({ ...contract, functionName: "withdraw", args: [balances[bob.account.address], bobAmount, bobProof]});
            await client.waitForTransactionReceipt({ hash: bobHash });
            await addTransaction(balances, transactions, deployer, bob.account.address, zeroAddress, bobAmount);
            await expect(balances[bob.account.address]).to.be.equal(parseEther("0"));
        });
 
        it("should not allow Charlie to withdraw 0.6 ETH (out of 0.5 ETH)", async function () {
            const charlieProof = tree.getProof([charlie.account.address, balances[charlie.account.address]]);
            const tx = bob.writeContract({ ...contract, functionName: "withdraw", args: [balances[charlie.account.address], parseEther("0.6"), charlieProof]});
            await expect(tx).rejects.toThrow("Insufficient funds");
            await expect(balances[charlie.account.address]).to.be.equal(parseEther("0.5"));
        });    
    });    

});