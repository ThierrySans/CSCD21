// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

// import "hardhat/console.sol";

contract NaiveRollup{

	using ECDSA for bytes32;
	using MessageHashUtils for bytes32;

    struct Transaction {
        address from;
		address to;
		uint256 amount;
		bytes signature;
    }
	
    mapping(address => uint256) public balances;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
	event Update(Transaction[] transactions);
	
    constructor() {}

    function deposit() payable external {
		balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
		require(balances[msg.sender] >= amount, "insufficient balance");
		balances[msg.sender] -= amount;
		(bool sent, ) = address(msg.sender).call{value: amount}("");
		require(sent, "Failed to send Ether");
        emit Withdrawal(msg.sender, amount);
    }

    function update(Transaction[] calldata transactions) external {
        for (uint256 i = 0; i < transactions.length; i++) {
            Transaction calldata txn = transactions[i];

            bytes32 txnHash = keccak256(abi.encodePacked(txn.from, txn.to, txn.amount)).toEthSignedMessageHash();
			require(txnHash.recover(txn.signature) == txn.from, "Invalid signature for transaction");
			
            // Ensure that the sender has sufficient funds.
            require(balances[txn.from] >= txn.amount, "Insufficient funds");

            // Update balances
            balances[txn.from] -= txn.amount;
            balances[txn.to] += txn.amount;
        }
		emit Update(transactions);
    }
}
