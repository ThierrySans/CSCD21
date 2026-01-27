#!/usr/bin/env node
// Usage:
// node send-testnet.mjs <mnemonicJsonPath> <account> <toAddress> <amountBtc>
// Example:
// node send-testnet.mjs ./mnemonic.json 0 tb1q.... 0.001

import fs from "node:fs/promises";
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from "ecpair";

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

// networn config
const network = bitcoin.networks.testnet;
const MEMPOOL = "https://mempool.space/testnet4/api";
const DUST = 546;

// wallet discovery config
const gapLimit = 10; // 20 in a production wallet
const maxScanPerChain = 2000;

async function jget(path) {
  const r = await fetch(MEMPOOL + path);
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

async function tpost(path, body) {
    const r = await fetch(MEMPOOL + path, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body,
    });
    if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
    return r.text();
}

// extract arguments
const [mnemonicJsonPath, accountStr, toAddress, amountBtc] = process.argv.slice(2);

// read mnemonic phrase to get the seed
const mnemonic = JSON.parse(await fs.readFile(mnemonicJsonPath, "utf8"));
const seed = await bip39.mnemonicToSeed(mnemonic.join(" "));

// BIP84 testnet coin_type = 1'
// path: m/84'/1'/account'/0/0/0
const root = bip32.fromSeed(seed, network);
const base = root.deriveHardened(84).deriveHardened(1)

async function getAccountInfo(base, account){
    const node = base.deriveHardened(account).derive(0).derive(0);
    const pay = bitcoin.payments.p2wpkh({ pubkey: node.publicKey, network });
    const address = pay.address;
    const utxos = await jget(`/address/${address}/utxo`);
    utxos.forEach(function(u){
        u.privateKey = node.privateKey;
        u.script = pay.output;
        u.value = BigInt(u.value);
    });

    return { address, utxos }
}

const account0 = await getAccountInfo(base, 0);
console.log(account0);
console.log(`Account 0 Balance: ${Number(account0.utxos.reduce((acc,u)=>acc+u.value, 0n))/100000000}`)

const account1 = await getAccountInfo(base, 1);
console.log(account1);
console.log(`Account 1 Balance: ${Number(account1.utxos.reduce((acc,u)=>acc+u.value, 0n))/100000000}`)

async function createTransaction(fromAccount, toAddress, amount, feeSelection='halfHourFee'){
    // get network fees
    // - fastestFee: Urgent (next block)
    // - halfHourFee: default (within ~30min)
    // - hourFee: low (within ~1h)
    // - economyFee: cheapest (no time bounded)
    // - minimumFee: hard floor (tx rejected below that)
    const fees = await jget("/v1/fees/recommended");

    // sort utxos - greedy select (largest first)
    const utxos = [...fromAccount.utxos];
    utxos.sort((a, b) => (a.value < b.value ? 1 : -1));
    
    // select utxos
    let total = 0n;
    let fee = 0n;
    let index = 0;
    do{
        if (index>=account0.utxos.length) throw new Error("Not enough funds");
        const utxo = account0.utxos[index++];
        total += utxo.value;
        // estimate transaction bytes
        // - 10 bytes base
        // - 68 bytes per input
        // - 31 bytes per output (we assume we have two here)
        const size = 10 + 68 * (index+1) + 31 * 2;
        // calculate fee
        fee = BigInt(fees[feeSelection] * size);
    } while (total < (amount + fee))
    
    // create PSBT (Partially Signed Bitcoin Transaction)
    const psbt = new bitcoin.Psbt({ network });

    // inputs
    for (const inp of utxos.slice(0, index)) {
        psbt.addInput({
          hash: inp.txid,
          index: inp.vout,
          witnessUtxo: {
            script: inp.script,
            value: inp.value,
          },
        });
    }
    
    // transfer amount
    psbt.addOutput({
        address: toAddress,
        value: amount,
    });
    
    // change (if any)
    let change = total - amount - fee;
    if (change >= DUST) {
        psbt.addOutput({ address: fromAccount.address, value: change });
    }
    
    // sign
    for (let i=0; i<index; i++) {
        const keyPair = ECPair.fromPrivateKey(utxos[i].privateKey, { network });
        psbt.signInput(i, keyPair);
    };
    
    // finalize
    psbt.finalizeAllInputs();
    return psbt.extractTransaction();
}

const amount = BigInt(Math.floor(0.001 * 100000000));
const tx = await createTransaction(account0, account1.address, amount);

// const pushed = await tpost("/tx", tx.toHex());
// console.log("txid:", tx.getId());
// console.log("mempool response:", pushed);
