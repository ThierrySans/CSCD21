import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createPublicClient, createWalletClient, http, parseEther, decodeEventLog, formatEther, encodePacked, keccak256, toBytes } from "viem";
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

async function signTransaction(signer, to, amount){
    const from = signer.account.address
    const messageHash = keccak256(encodePacked(
        ['address', 'address', 'uint256'],
        [from, to, amount]
    ));
    const signature = await signer.account.signMessage({
        message: { raw: toBytes(messageHash) }
    });
    return { from, to, amount, signature }
}

describe("Naive Rollup", function () {
	
    let deployer, alice, bob, charlie;  // wallets
    let contract;        // contract
    
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
        const { abi, bytecode } = loadContract("NaiveRollup");
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
            const balance = await client.readContract({ ...contract, functionName: "balances", args: [alice.account.address]});
            expect(balance).to.equal(parseEther('1.5'));
        });
    });
    
    describe("Withdraw", function () {
    
        it("should withdraw funds", async function () {
            const { abi, bytecode } = contract;
            const hash = await alice.writeContract({ ...contract, functionName: "withdraw", args: [parseEther("0.5")]});
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Withdraw", receipt});
            const balance = await client.readContract({ ...contract, functionName: "balances", args: [alice.account.address]});
            expect(balance).to.equal(parseEther('1.0'));
        });
    });
    
    describe("Rollup", function () {
    
        it("should rollup", async function () {
            // create transaction off chain
            const transactions = [];
            transactions.push(await signTransaction(alice, bob.account.address, parseEther("0.6")));
            transactions.push(await signTransaction(alice, charlie.account.address, parseEther("0.1")));
            transactions.push(await signTransaction(bob, charlie.account.address, parseEther("0.4")));
            
            // Rollup done by deployer by anyone could have done it
            const hash = await deployer.writeContract({ ...contract, functionName: "update", args: [transactions]});
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Rollup", receipt});
            
            // check balance
            const aliceBalance = await client.readContract({ ...contract, functionName: "balances", args: [alice.account.address]});
            expect(aliceBalance).to.equal(parseEther('0.3'));
            const bobBalance = await client.readContract({ ...contract, functionName: "balances", args: [bob.account.address]});
            expect(bobBalance).to.equal(parseEther('0.2'));
            const charlieBalance = await client.readContract({ ...contract, functionName: "balances", args: [charlie.account.address]});
            expect(charlieBalance).to.equal(parseEther('0.5'));
        });
    });
	
});