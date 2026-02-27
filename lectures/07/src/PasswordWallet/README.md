# Password Wallet

## Compile the Circom Circuits

```
circom circuits/ProofOfCommitment.circom --r1cs --wasm -o zk-data
```

## Power of Tau Ceremony

Phase 1

```
snarkjs powersoftau new bn128 12 zk-data/pot12_0000.ptau -v
snarkjs powersoftau contribute zk-data/pot12_0000.ptau zk-data/pot12_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 zk-data/pot12_0001.ptau zk-data/pot12_final.ptau -v
```

> **Note:** For production use, you should not do your own phase 1 and rely on a multi-party trusted setup such as the [**Perpetual Powers of Tau Ceremony**](https://github.com/privacy-scaling-explorations/perpetualpowersoftau).

Phase 2

```
snarkjs groth16 setup zk-data/ProofOfCommitment.r1cs zk-data/pot12_final.ptau zk-data/ProofOfCommitment.zkey
snarkjs zkey export verificationkey zk-data/ProofOfCommitment.zkey zk-data/ProofOfCommitment.vkey
````

> **Note:** For production use, you should do a full Phase 2 ceremony. See the [Circom documentation](https://docs.circom.io/getting-started/proving-circuits/).

## Generate the Solidity Veriffier

```
snarkjs zkey export solidityverifier zk-data/ProofOfCommitment.zkey contracts/ProofOfCommitmentVerifier.sol
sed -i "" "s/contract Groth16Verifier/contract ProofOfCommitmentVerifier/" contracts/ProofOfCommitmentVerifier.sol
````

## Delete waste

```
rm -f zk-data/ProofOfCommitment.r1cs
rm -f zk-data/pot12*
```




