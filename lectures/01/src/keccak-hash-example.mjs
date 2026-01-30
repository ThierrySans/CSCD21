import { keccak_256 } from "@noble/hashes/sha3.js";

const message = new TextEncoder().encode("Hell0, Keccak!") ;
const hash = keccak_256(message);

console.log(`Message: ${new TextDecoder().decode(message) }`);
console.log(`Keccak Hash: ${Buffer.from(hash).toString('hex')}`);