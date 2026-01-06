import { keygen, signAsync, verifyAsync } from '@noble/secp256k1';

// Generate a random private key (32 bytes)
const { secretKey, publicKey } = keygen();
console.log(`Secret Key: ${Buffer.from(secretKey).toString('hex')}`);
console.log(`Public Key: ${Buffer.from(publicKey).toString('hex')}`);

// Generate a signature
const message = new TextEncoder().encode('Hello Secp256k1') ;
const sig = await signAsync(message, secretKey);

console.log(`Message: ${new TextDecoder().decode(message) }`);
console.log(`Signature: ${Buffer.from(sig).toString('hex')}`);

// Verify the signature
console.log(`Verify signature: ${await verifyAsync(sig, message, publicKey)}`)