#!/usr/bin/env node

import { getAccount, getUtxos, createW2pkhTransaction, signTransaction, sendTransaction, createMultiSigWallet, createW2shTransaction } from "./lib.mjs";

// extract arguments
const [mnemonicFile] = process.argv.slice(2);

const account0 = await getAccount(mnemonicFile, 0);
console.log(`Account 0 address: ${account0.address}`);
console.log(`Account 0 Balance: ${Number((await getUtxos(account0.address)).reduce((acc,u)=>acc+u.value, 0n))/100000000}`);

const account1 = await getAccount(mnemonicFile, 1);
console.log(`Account 1 address: ${account1.address}`);
console.log(`Account 1 Balance: ${Number((await getUtxos(account1.address)).reduce((acc,u)=>acc+u.value, 0n))/100000000}`);

const account2 = await getAccount(mnemonicFile, 2);
console.log(`Account 2 address: ${account2.address}`);
console.log(`Account 2 Balance: ${Number((await getUtxos(account2.address)).reduce((acc,u)=>acc+u.value, 0n))/100000000}`);

const wallet = await createMultiSigWallet([account0.publicKey, account1.publicKey, account2.publicKey], 2);
console.log(`MultiSig Wallet address: ${wallet.address}`);
console.log(`MultiSig Wallet Balance: ${Number((await getUtxos(wallet.address)).reduce((acc,u)=>acc+u.value, 0n))/100000000}`);

const deposit = BigInt(Math.floor(0.002 * 100000000));
const unsignedDepositTx = await createW2pkhTransaction(account0, wallet.address, deposit);
const signedDepositTx = await signTransaction(account0, unsignedDepositTx);
// console.log(await sendTransaction(signedDepositTx));
// console.log(`MultiSig Wallet Balance: ${Number((await getUtxos(wallet.address)).reduce((acc,u)=>acc+u.value, 0n))/100000000}`);

const amount = BigInt(Math.floor(0.001 * 100000000));
const unsignedTx = await createW2shTransaction(wallet, account0.address, amount);
const partiallySignedTx = await signTransaction(account1, unsignedTx);
const signedTx = await signTransaction(account2, partiallySignedTx);
// console.log(await sendTransaction(signedTx));