import { randomBytes } from 'crypto';
import { generateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

import { HDKey } from '@scure/bip32';
import { sha256 } from '@noble/hashes/sha256';

const mn = generateMnemonic(wordlist);
const seed = await mnemonicToSeed(mn);

const key = HDKey.fromMasterSeed(seed);
console.log(key.privateExtendedKey, key.publicExtendedKey);

const receivingKey = key.derive("m/44'/1'/0'/0");
console.log(receivingKey.privateExtendedKey, receivingKey.publicExtendedKey);

const checkKey = key.derive("m/44'/1'/0'/0/0");
console.log(checkKey.privateExtendedKey, checkKey.publicExtendedKey);

const transactionKey = HDKey.fromExtendedKey(receivingKey.publicExtendedKey).deriveChild(0);
console.log(transactionKey.publicKey);
console.log(transactionKey.publicExtendedKey);

console.log(checkKey.publicExtendedKey == transactionKey.publicExtendedKey)

const msg = randomBytes(32);
const hash = sha256(msg);
const sig = checkKey.sign(hash);
console.log(sig);
console.log(checkKey.verify(hash, sig));
console.log(transactionKey.verify(hash, sig));

