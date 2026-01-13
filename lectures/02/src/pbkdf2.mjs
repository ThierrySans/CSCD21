import secp256k1 from 'secp256k1';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

const password = "CSCD71R0CK5!"
const salt = "Where would we be without salt?"

const privKey = pbkdf2(sha256, password, salt, { c: 32, dkLen: 32 });

console.log(privKey);

console.log(secp256k1.privateKeyVerify(privKey))