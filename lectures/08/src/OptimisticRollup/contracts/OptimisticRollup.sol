// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract OptimisticRollup {

    struct Transaction {
        address from;
		address to;
		uint256 amount;
		bytes signature;
    }
	
	bytes32 private root;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
	event Update(bytes32 indexed root, Transaction[] transactions);
	
    constructor() {}

    function deposit() payable external {
        emit Deposit(msg.sender, msg.value);
    }

	function verifyProof(address addr, uint256 balance, bytes32[] memory proof) public view returns(bool) {
		bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(addr, balance))));
		return MerkleProof.verify(proof, root, leaf);
	}

    function withdraw(uint256 balance, uint256 amount, bytes32[] memory proof) external {
		require(balance >= amount, "Insufficient funds");
		require(verifyProof(msg.sender, balance, proof) , "Invalid proof");
        emit Withdrawal(msg.sender, amount);
    }

    function update(Transaction[] calldata transactions, bytes32 _root) external {
		// here we trust the aggregator for verifying the transactions and producing the right root
		// the comments below are unimplemented
		// in a real optimistic rollup, the coordinator must deposit a stake
		// there is usually 7 days to verify and challenge whether the root is correct
		// if incorrect the rollup is rolled back and coordinator stake is slashed
		root = _root;
		emit Update(root, transactions);
    }
}

