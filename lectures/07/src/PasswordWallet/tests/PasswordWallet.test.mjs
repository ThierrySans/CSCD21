import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createPublicClient, createWalletClient, http, parseEther, decodeEventLog, formatEther, encodeAbiParameters } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { randomBytes } from '@noble/ciphers/webcrypto';
import { poseidon1, poseidon4 } from 'poseidon-lite';

import { groth16 } from 'snarkjs';

let wasmFile = join("zk-data", "PasswordWallet_js", "PasswordWallet.wasm");
let zkeyFile = join("zk-data", "PasswordWallet.zkey");
const vKey = JSON.parse(readFileSync(join("zk-data", "PasswordWallet.vkey")));

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

const p = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');

function randomBigInt32ModP() {
  const bytes = randomBytes(32)
  
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return BigInt('0x' + hex) % p;
}

describe("Lock Tests", function () {
	
    let deployer, user;  // wallets
    let contract;        // contract
    
    let password, passwordHash;
    
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
        // create Verifier
        [deployer, user] = await Promise.all(privateKeys.map(function(pk){
            return createWalletClient({ chain: foundry, transport: rpc , account: privateKeyToAccount(pk) });
        }));
        // Deploy verifier
        const hash = await deployer.deployContract(loadContract("PasswordWalletVerifier"));
        const receipt = await client.waitForTransactionReceipt({ hash });
        receipts.push({label: "Deployment", receipt});
        const verifierAddress = receipt.contractAddress;
        
        // deploy Password Wallet
        const { abi, bytecode } = loadContract("PasswordWallet");
        const hash2 = await deployer.deployContract({ abi, bytecode, args: [verifierAddress] });
        const receipt2 = await client.waitForTransactionReceipt({ hash:hash2 });
        receipts.push({label: "Deployment", receipt: receipt2});
        const address = receipt2.contractAddress;
        contract = { address, abi };
    })
    
    describe("Deposit", function (){
    	
        beforeAll(async () => {
        	password = randomBigInt32ModP();
        	passwordHash = poseidon1([password]);
            const hash = await deployer.writeContract({ ...contract, functionName: "deposit", args: [passwordHash], value: parseEther('1.0') });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Deposit", receipt});
        })
        
        it("Should have made a deposit", async function () {
            const balance = await client.readContract({ ...contract, functionName: "balanceOf", args: [passwordHash]});
            expect(balance).to.equal(parseEther('1.0'));
    	});
    
    })
    
    describe("Transfer", function (){

        it("Should transfer funds", async function () {

            // create the inputs
            const nonce = randomBigInt32ModP();
            const amount = parseEther("0.4");
            const address = BigInt(user.account.address);

            // crate the proof
            const { proof, publicSignals } = await groth16.fullProve({password, address, amount, nonce}, wasmFile, zkeyFile);

            // verify the proof locally
            expect(BigInt(publicSignals[0])).to.equal(passwordHash);
            const authHash = poseidon4([password, address, amount, nonce]);
            expect(BigInt(publicSignals[1])).to.equal(authHash);
            const res = await groth16.verify(vKey, publicSignals, proof);
            expect(res).to.be.true;

            // pack arguments
            const proofCalldata = await groth16.exportSolidityCallData( proof, publicSignals);
            const proofCalldataFormatted = JSON.parse("[" + proofCalldata + "]");
            const proofCallDataEncoded = encodeAbiParameters(
              [
                { type: 'uint256[2]' },
                { type: 'uint256[2][2]' },
                { type: 'uint256[2]' },
                { type: 'uint256[5]' },
              ],
              proofCalldataFormatted
            );
            // call the contract (success)
            const hash = await user.writeContract({ ...contract, functionName: "withdraw", args: [proofCallDataEncoded] });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Transfer", receipt});
            const balance = await client.readContract({ ...contract, functionName: "balanceOf", args: [passwordHash]});
            expect(balance).to.equal(parseEther('0.6'));
        });

    })
    	
});