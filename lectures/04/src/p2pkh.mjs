#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import * as bitcoin from 'bitcoinjs-lib';
import { BitcoinClient } from "./lib.mjs";

const network = bitcoin.networks.testnet;
const mempool = "https://mempool.space/testnet4/api";

const client = new BitcoinClient(network, mempool);

const mnemonic = JSON.parse(await readFile(process.argv[2]));

const account0 =  client.getAccountWallet(mnemonic, 0);
console.log(`Account 0 address: ${account0.address}`);
console.log(`Account 0 Balance: ${await client.getBalance(account0.address)}`);
// console.log(await client.getUtxos(account0.address));

const account1 =  client.getAccountWallet(mnemonic, 1);
console.log(`Account 1 address: ${account1.address}`);
console.log(`Account 1 Balance: ${await client.getBalance(account1.address)}`);
// console.log(await client.getUtxos(account1.address));
//
const amount = BigInt(Math.floor(0.001 * 100000000));
const unsignedTx = await account0.createTransaction(account1.address, amount);
const signedTx = await account0.signTransaction(unsignedTx);
// console.log(await client.sendTransaction(signedTx));
