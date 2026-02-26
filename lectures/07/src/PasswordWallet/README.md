# Password Wallet

## Compile the Circom Circuits

```
circom circuits/PasswordWallet.circom --r1cs --wasm -o zk-data
```

## Power of Tau Ceremony

Phase 1

```
snarkjs powersoftau new bn128 12 zk-data/pot12_0000.ptau -v
snarkjs powersoftau contribute zk-data/pot12_0000.ptau zk-data/pot12_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 zk-data/pot12_0001.ptau zk-data/pot12_final.ptau -v
```

Phase 2

```
snarkjs groth16 setup zk-data/PasswordWallet.r1cs zk-data/pot12_final.ptau zk-data/PasswordWallet.zkey
snarkjs zkey export verificationkey zk-data/PasswordWallet.zkey zk-data/PasswordWallet.vkey
````

Generate the Solidity Veriffier

```
snarkjs zkey export solidityverifier zk-data/PasswordWallet.zkey contracts/PasswordWalletVerifier.sol
sed -i "" "s/contract Groth16Verifier/contract PasswordWalletVerifier/" contracts/PasswordWalletVerifier.sol
````

