#!/usr/bin/env node

import { getAccount, getUtxos, createW2pkhTransaction, signTransaction, sendTransaction } from "./lib.mjs";

// extract arguments
const [mnemonicFile] = process.argv.slice(2);

const account0 = await getAccount(mnemonicFile, 0);
console.log(`Account 0 address: ${account0.address}`);
console.log(`Account 0 Balance: ${Number((await getUtxos(account0.address)).reduce((acc,u)=>acc+u.value, 0n))/100000000}`);
console.log(await getUtxos(account0.address))

const account1 = await getAccount(mnemonicFile, 1);
console.log(`Account 1 address: ${account1.address}`);
console.log(`Account 1 Balance: ${Number((await getUtxos(account1.address)).reduce((acc,u)=>acc+u.value, 0n))/100000000}`);
console.log(await getUtxos(account1.address))

const amount = BigInt(Math.floor(0.001 * 100000000));
const unsignedTx = await createW2pkhTransaction(account0, account1.address, amount);
const signedTx = await signTransaction(unsignedTx, account0.privateKey);

console.log(await sendTransaction(signedTx));
