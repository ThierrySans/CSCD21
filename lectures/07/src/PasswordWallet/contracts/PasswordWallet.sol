// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.32;

import { PoseidonT6 } from "poseidon-solidity/PoseidonT6.sol";
import { ProofOfCommitmentVerifier } from "./ProofOfCommitmentVerifier.sol";

contract PasswordWallet {
	
	ProofOfCommitmentVerifier private immutable VERIFIER;
	
    struct Record {
        uint256 amount;
		mapping(uint256 => bool) used;
    }
	
    mapping(uint256 => Record) public records;
	
    constructor(ProofOfCommitmentVerifier _verifier) {
		VERIFIER = _verifier;
    }
    
    function balanceOf(uint256 passwordHash) public view returns(uint256){
        return records[passwordHash].amount;
    }

    function deposit(uint256 passwordHash) payable public {
		records[passwordHash].amount += msg.value;
    }

    function getHash(address payable to, uint256 amount, uint256 nonce) public view returns(uint256) {
        return PoseidonT6.hash([
            uint256(block.chainid),           // to prevent reuse across multiple chains
            uint256(uint160(address(this))),  // to prevent reused with another contract
            uint256(uint160(address(to))),
            amount,
            nonce
        ]);
    }

    function transfer(bytes calldata proof, address payable to, uint256 amount, uint256 nonce) public { 
        // unwrap the proof (to extract signals)
        ( uint256[2] memory pia, uint256[2][2] memory pib, uint256[2] memory pic, uint256[3] memory signals)
            = abi.decode(proof, (uint256[2], uint256[2][2], uint256[2], uint256[3]));
        // check the proof
        (bool valid, ) = address(VERIFIER).staticcall(abi.encodeWithSelector(ProofOfCommitmentVerifier.verifyProof.selector, pia, pib, pic, signals));
        require(valid, "Proof verification failed"); 
        // extract data from signals
        uint256 hash = signals[2];     
        uint256 passwordHash = signals[0];      
        // check hash
        require(hash == getHash(to, amount, nonce));
        // check and update hash reuse
        require(!records[passwordHash].used[hash], "nonce has already been used");
        records[passwordHash].used[hash] = true;
        // Check and update amount
        require(amount>0, "Amount should be greater than 0");
        require(records[passwordHash].amount >= amount, "insufficient balance");
        records[passwordHash].amount -= amount;
        // Transfer funds
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Failed to send Ether");
    }
}
