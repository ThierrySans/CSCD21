import { MerkleTree } from 'merkletreejs/MerkleTree';
import { keccak_256 } from "@noble/hashes/sha3.js";

// Phase 1 : Commit
const leaves = ['m0', 'm1', 'm2', 'm3'].map(x=>new TextEncoder().encode(x)).map(x => keccak_256(x))
const tree = new MerkleTree(leaves, keccak_256)
const root = tree.getRoot().toString('hex')
console.log(`Merkle Tree\n${tree.toString()}`)
console.log(`Merle Root (a.k.a commitment): ${root}`);

// // Phase 2: Reveal and Verify
const leaf = keccak_256(new TextEncoder().encode('m2'))
console.log(`m2 hash: ${Buffer.from(leaf).toString('hex')}`)
const proof = tree.getProof(leaf)
console.log(`Merkle Proof for m2\n ${proof.map(function({position, data}){
    return `${position}: ${data.toString('hex')}`;
}).join('\n ')}`);
console.log(`m2 is included in the collection: ${tree.verify(proof, leaf, root)}`);