#!/bin/bash

rm contracts/RollupVerifier.sol
rm contracts/UpdateVerifier.sol

# rm -Rf zk-data
# mkdir -p zk-data

# Phase 1
snarkjs powersoftau new bn128 19 zk-data/pot19_0000.ptau -v
snarkjs powersoftau contribute zk-data/pot19_0000.ptau zk-data/pot19_0001.ptau --name="First contribution" -v
snarkjs powersoftau prepare phase2 zk-data/pot19_0001.ptau zk-data/pot19_final.ptau -v

# compile circom
circom circuits/Update.circom --r1cs --wasm -o zk-data

# Phase 2 (contract specific)
snarkjs groth16 setup zk-data/Update.r1cs zk-data/pot19_final.ptau zk-data/Update.zkey
snarkjs zkey export verificationkey zk-data/Update.zkey zk-data/Update.vkey

# Generate solidty contract
snarkjs zkey export solidityverifier zk-data/Update.zkey contracts/Update.sol
sed -i "" "s/contract Groth16Verifier/contract UpdateVerifier/" contracts/UpdateVerifier.sol

# compile circom
circom circuits/Rollup.circom --r1cs --wasm -o zk-data

# Phase 2 (contract specific)
snarkjs groth16 setup zk-data/Rollup.r1cs zk-data/pot19_final.ptau zk-data/Rollup.zkey
snarkjs zkey export verificationkey zk-data/Rollup.zkey zk-data/Rollup.vkey

# Generate solidty contract
snarkjs zkey export solidityverifier zk-data/Rollup.zkey contracts/RollupVerifier.sol
sed -i "" "s/contract Groth16Verifier/contract RollupVerifier/" contracts/RollupVerifier.sol

# rm -f zk-data/*.r1cs
# rm -f zk-data/pot19*