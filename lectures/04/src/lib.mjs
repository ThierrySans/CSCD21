import * as bitcoin from 'bitcoinjs-lib';
import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from "ecpair";

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

const DUST = 546;

async function get(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.text();
}

async function jget(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}

async function post(path, body) {
    const r = await fetch(path, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body,
    });
    if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
    return r.text();
}

async function getUtxos(mempool, address){
    const utxos = await jget(`${mempool}/address/${address}/utxo`);
    utxos.forEach(function(u){
        u.value = BigInt(u.value);
    });
    return utxos;
}

async function selectUtxos(mempool, address, amount, feeSelection){
    // get network fees
    // - fastestFee: Urgent (next block)
    // - halfHourFee: default (within ~30min)
    // - hourFee: low (within ~1h)
    // - economyFee: cheapest (no time bounded)
    // - minimumFee: hard floor (tx rejected below that)
    const fees = await jget(`${mempool}/v1/fees/recommended`);

    // sort utxos - greedy select (largest first)
    const utxos = await getUtxos(mempool, address);
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

    return { utxos: utxos.slice(0, index), total, fee }
}

class AccountWallet{
    
    constructor(network, mempool, mnemonic, accountNumber) {
        const seed = bip39.mnemonicToSeedSync(mnemonic.join(" "));
        // BIP84 testnet coin_type = 1'
        // path: m/84'/1'/account'/0/0
        const root = bip32.fromSeed(seed, this.network);
        const node = root.deriveHardened(84).deriveHardened(1).deriveHardened(accountNumber).derive(0).derive(0);
        const pay = bitcoin.payments.p2wpkh({ pubkey: node.publicKey, network });
        this.network = network;
        this.mempool = mempool; 
        this.address = pay.address;
        this.publicKey = node.publicKey;
        this.privateKey = node.privateKey;
        this.script = pay.output;
    }
    
    signTransaction(psbtHex){
        const psbt = bitcoin.Psbt.fromHex(psbtHex, { network: this.network });
        for (let i=0; i<psbt.data.inputs.length; i++) {
            const keyPair = ECPair.fromPrivateKey(this.privateKey, { network: this.network });
            psbt.signInput(i, keyPair);
        };
        return psbt.toHex();
    }
    
    async createTransaction(toAddress, amount, feeSelection='halfHourFee'){
        const { utxos, total, fee } = await selectUtxos(this.mempool, this.address, amount, feeSelection);
    
        // create PSBT (Partially Signed Bitcoin Transaction)
        const psbt = new bitcoin.Psbt({ network: this.network });

        // inputs
        for (const inp of utxos) {
            psbt.addInput({
              hash: inp.txid,
              index: inp.vout,
              witnessUtxo: {
                script: this.script,
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
            psbt.addOutput({ address: this.address, value: change });
        }
    
        return psbt.toHex();
    }
}

class MultiSigWallet{
    
    constructor(network, mempool, publicKeys, threshold) {
        const pubkeys = [...publicKeys].sort(Buffer.compare);
        const redeem = bitcoin.payments.p2ms({ m: threshold, pubkeys, network: network });
        const p2sh = bitcoin.payments.p2sh({ redeem, network });
        this.network = network;
        this.mempool = mempool; 
        this.address = p2sh.address;
        this.script = redeem.output;
    }
    
    async createTransaction(toAddress, amount, feeSelection='halfHourFee'){
        const { utxos, total, fee } = await selectUtxos(this.mempool, this.address, amount, feeSelection);
    
        // Build spend PSBT
        const psbt = new bitcoin.Psbt({ network: this.network });

        for (const inp of utxos) {
            const txHex = await get(`${this.mempool}/tx/${inp.txid}/hex`)
            psbt.addInput({
              hash: inp.txid,
              index: inp.vout,
              nonWitnessUtxo: Buffer.from(txHex, 'hex'),
              redeemScript: this.script,
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
            psbt.addOutput({ address: this.address, value: change });
        }
    
        return psbt.toHex();
    }
}

export class BitcoinClient {
  
  constructor(network, mempool) {
      this.network = network;
      this.mempool = mempool;
  }
  
  getAccountWallet(mnemonic, accountNumber){
      return new AccountWallet(this.network, this.mempool, mnemonic, accountNumber);
  }

  getMultiSigWallet(publicKeys, threshold){
      return new MultiSigWallet(this.network, this.mempool, publicKeys, threshold);
  }
  
  getUtxos(address){
      return getUtxos(this.mempool, address);
  }
  
  async getBalance(address){
      return Number((await this.getUtxos(address)).reduce((acc,u)=>acc+u.value, 0n))/100000000;
  }
  
  sendTransaction(psbtHex){
      const psbt = bitcoin.Psbt.fromHex(psbtHex, { network: this.network });
      // for (let i=0; i<psbt.data.inputs.length; i++) {
      //     psbt.validateSignaturesOfInput(i);
      // }
      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();
      return post(`${this.mempool}/tx`, tx.toHex());
  }
 
}