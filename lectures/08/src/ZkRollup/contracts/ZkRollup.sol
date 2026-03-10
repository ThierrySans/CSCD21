// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "poseidon-solidity/PoseidonT2.sol";

import "./UpdateVerifier.sol";
import "./RollupVerifier.sol";

contract ZkRollup {

	UpdateVerifier private immutable updateVerifier;
	RollupVerifier private immutable rollupVerifier;
	
	uint256 private root;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
	event Update(uint256 root);
	
    constructor(UpdateVerifier _updateVerifier, RollupVerifier _rollupVerifier) {
		updateVerifier = _updateVerifier;
		rollupVerifier = _rollupVerifier;
    }

	function verifyUpdateProof(bytes calldata proof) public view returns(bool, uint256, uint256, uint256, uint256, uint256) {
		// unwrap the proof (to extract signals)
		( uint256[2] memory pi_a, uint256[2][2] memory pi_b, uint256[2] memory pi_c, uint256[5] memory signals)
			= abi.decode(proof, (uint256[2], uint256[2][2], uint256[2], uint256[5]));
		// check the proof
		(bool valid, ) = address(updateVerifier).staticcall(abi.encodeWithSelector(UpdateVerifier.verifyProof.selector, pi_a, pi_b, pi_c, signals));
		return (valid, signals[0], signals[1], signals[2], signals[3], signals[4]);
	}

    function deposit(bytes calldata proof) payable external {
        (bool valid, uint256 user, uint256 oldBalance, uint256 newBalance, uint256 oldRoot, uint256 newRoot) = verifyUpdateProof(proof);
		require(valid, "Proof verification failed");
		require(user == PoseidonT2.hash([uint256(uint160(msg.sender))]));
		require(newBalance - oldBalance == msg.value, "Deposit amount does not match the balance");
		require(oldRoot == root, "Invalid root");
		root = newRoot; 		
		emit Deposit(msg.sender, msg.value);
    }

    function withdraw(bytes calldata proof) external {
        (bool valid, uint256 user, uint256 oldBalance, uint256 newBalance, uint256 oldRoot, uint256 newRoot) = verifyUpdateProof(proof);
		require(valid, "Proof verification failed");
		require(user == PoseidonT2.hash([uint256(uint160(msg.sender))]));
		require(newBalance < oldBalance, "Withdrawal amount should be positive");
		require(oldRoot == root, "Invalid root");
		root = newRoot;
		uint256 amount = oldBalance - newBalance;
		(bool sent, ) = address(msg.sender).call{value: amount}("");
		require(sent, "Failed to send Ether");
        emit Withdrawal(msg.sender, amount);
    }

    function update(bytes calldata proof) external {
		// unwrap the proof (to extract signals)
		( uint256[2] memory pi_a, uint256[2][2] memory pi_b, uint256[2] memory pi_c, uint256[5] memory signals)
			= abi.decode(proof, (uint256[2], uint256[2][2], uint256[2], uint256[5]));
		// check the proof
		(bool valid, ) = address(rollupVerifier).staticcall(abi.encodeWithSelector(RollupVerifier.verifyProof.selector, pi_a, pi_b, pi_c, signals));
		require(valid, "Proof verification failed");
		(uint256 oldRoot, uint256 newRoot) = (signals[3], signals[4]);
		// check root
		require(oldRoot == root, "Invalid root");
		root = newRoot; 		
		emit Update(root);
    }
}

