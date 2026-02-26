// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.32;

import { PasswordWalletVerifier } from "./PasswordWalletVerifier.sol";

contract PasswordWallet {
	
	PasswordWalletVerifier private immutable VERIFIER;
	
    struct Record {
        uint256 amount;
		mapping(uint256 => bool) nonces;
    }
	
    mapping(uint256 => Record) public records;
	
    constructor(PasswordWalletVerifier _verifier) {
		VERIFIER = _verifier;
    }
    
    function balanceOf(uint256 passwordHash) external view returns(uint256){
        return records[passwordHash].amount;
    }

    function deposit(uint256 passwordHash) payable external {
		records[passwordHash].amount += msg.value;
    }

    function withdraw(bytes calldata proof) external { 
		// unwrap the proof (to extract signals)
		( uint256[2] memory pia, uint256[2][2] memory pib, uint256[2] memory pic, uint256[5] memory signals)
			= abi.decode(proof, (uint256[2], uint256[2][2], uint256[2], uint256[5]));
		// check the proof
		(bool valid, ) = address(VERIFIER).staticcall(abi.encodeWithSelector(PasswordWalletVerifier.verifyProof.selector, pia, pib, pic, signals));
		require(valid, "Proof verification failed");
		// extract parameters
		uint256 passwordHash = signals[0];
		address addr = address(uint160(signals[2]));
		uint256 amount = signals[3];
		uint256 nonce = signals[4];
		// check and update nonce reuse
		require(!records[passwordHash].nonces[nonce], "nonce has already been used");
		records[passwordHash].nonces[nonce] = true;
		// Check and update amount
		require(amount>0, "Amount should be greater than 0");
		require(records[passwordHash].amount >= amount, "insufficient balance");
		records[passwordHash].amount -= amount;
		// Transfer funds
		(bool sent, ) = addr.call{value: amount}("");
		require(sent, "Failed to send Ether");
    }
}
