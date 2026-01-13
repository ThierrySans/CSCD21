import { generateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

// console.log(JSON.stringify(wordlist, null, 2));

import { HDKey } from '@scure/bip32';

const mn = generateMnemonic(wordlist);
console.log(mn);

const seed = await mnemonicToSeed(mn);
console.log(seed);