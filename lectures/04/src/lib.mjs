import fs from "node:fs/promises";
import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from "ecpair";

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

// network config
const network = bitcoin.networks.testnet;
const MEMPOOL = "https://mempool.space/testnet4/api";
const DUST = 546;

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

export async function getAccount(mnemonicFile, accountNumber){
    const mnemonic = JSON.parse(await fs.readFile(mnemonicFile, "utf8"));
    const seed = await bip39.mnemonicToSeed(mnemonic.join(" "));

    // BIP84 testnet coin_type = 1'
    // path: m/84'/1'/account'/0/0/0
    const root = bip32.fromSeed(seed, network);
    const node = root.deriveHardened(84).deriveHardened(1).deriveHardened(accountNumber).derive(0).derive(0);
    const pay = bitcoin.payments.p2wpkh({ pubkey: node.publicKey, network });
    const address = pay.address;
    
    return { address, publicKey: node.publicKey, privateKey: node.privateKey, script: pay.output };
}

export async function getUtxos(address){
    const utxos = await jget(`/address/${address}/utxo`);
    utxos.forEach(function(u){
        u.value = BigInt(u.value);
    });
    return utxos;
}

export function signTransaction(psbtHex, privateKey){
    const psbt = bitcoin.Psbt.fromHex(psbtHex, { network });
    for (let i=0; i<psbt.data.inputs.length; i++) {
        const keyPair = ECPair.fromPrivateKey(privateKey, { network });
        psbt.signInput(i, keyPair);
    };
    return psbt.toHex();
}

export function sendTransaction(psbtHex){
    const psbt = bitcoin.Psbt.fromHex(psbtHex, { network });
    // for (let i=0; i<psbt.data.inputs.length; i++) {
    //     psbt.validateSignaturesOfInput(i);
    // }
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    return tpost("/tx", tx.toHex());
}

export async function createW2pkhTransaction(fromAccount, toAddress, amount, feeSelection='halfHourFee'){
    // get network fees
    // - fastestFee: Urgent (next block)
    // - halfHourFee: default (within ~30min)
    // - hourFee: low (within ~1h)
    // - economyFee: cheapest (no time bounded)
    // - minimumFee: hard floor (tx rejected below that)
    const fees = await jget("/v1/fees/recommended");

    // sort utxos - greedy select (largest first)
    const utxos = await getUtxos(fromAccount.address);
    utxos.sort((a, b) => (a.value < b.value ? 1 : -1));
    
    // select utxos
    let total = 0n;
    let fee = 0n;
    let index = 0;
    do{
        if (index>=utxos.length) throw new Error("Not enough funds");
        const utxo = utxos[index++];
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
            script: fromAccount.script,
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
    
    return psbt.toHex();
}