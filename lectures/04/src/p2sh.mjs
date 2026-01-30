#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import * as bitcoin from 'bitcoinjs-lib';
import { BitcoinClient } from "./lib.mjs";

const network = bitcoin.networks.testnet;
const mempool = "https://mempool.space/testnet4/api";

const client = new BitcoinClient(network, mempool);

const mnemonic = JSON.parse(await readFile(process.argv[2]));

const account0 = client.getAccountWallet(mnemonic, 0);
console.log(`Account 0 address: ${account0.address}`);
console.log(`Account 0 Balance: ${await client.getBalance(account0.address)}`);
// console.log(await client.getUtxos(account0.address));


const account1 = client.getAccountWallet(mnemonic, 1);
console.log(`Account 1 address: ${account1.address}`);
console.log(`Account 1 Balance: ${await client.getBalance(account1.address)}`);

const account2 = client.getAccountWallet(mnemonic, 2);
console.log(`Account 2 address: ${account2.address}`);
console.log(`Account 2 Balance: ${await client.getBalance(account2.address)}`);

const wallet = await client.getMultiSigWallet([account0.publicKey, account1.publicKey, account2.publicKey], 2);
console.log(`Wallet address: ${wallet.address}`);
console.log(`Wallet Balance: ${await client.getBalance(wallet.address)}`);

const depositAmount = BigInt(Math.floor(0.002 * 100000000));
const unsignedDepositTx = await account0.createTransaction(wallet.address, depositAmount);
const signedDepositTx = await account0.signTransaction(unsignedDepositTx);
// console.log(await client.sendTransaction(signedDepositTx));

const amount = BigInt(Math.floor(0.001 * 100000000));
const unsignedTx = await wallet.createTransaction(account0.address, amount);
const partiallySignedTx = await account1.signTransaction(unsignedTx);
const signedTx = await account2.signTransaction(partiallySignedTx);
// console.log(await client.sendTransaction(signedTx));