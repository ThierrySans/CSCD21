// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Note, this is a reimplementation of EIP-2612 extending ERC-20 with permits
// I could have used this directly https://old-docs.openzeppelin.com/contracts-cairo/3.0.0-alpha.2/guides/erc20-permit
// However my goal is to illustrate how EIP-712 works at the contract level

contract MyGaselessToken is ERC20, EIP712 {
    using ECDSA for bytes32;
    
    bytes32 public constant PERMIT_TYPEHASH = keccak256(
        "Permit(address spender,uint256 amount,uint256 expiry,uint256 nonce)"
    );
    
    mapping(bytes32 => bool) public used;
    
	constructor() ERC20("MyGaselessToken", "MGT") EIP712("MyGaselessToken", "1") {
        // Mint an initial supply to the deployer
        _mint(msg.sender, 1000 * 10**decimals());
    }

    function transferFromWithPermit(
        address spender,
        address to, 
        uint256 amount, 
        uint256 expiry,
        uint256 nonce,
        bytes memory signature
    ) external {
        // create the hash assuming the permit allows the transaction caller to spend amount of token
        bytes32 hash = _hashTypedDataV4(keccak256(abi.encode(PERMIT_TYPEHASH, spender, amount, expiry, nonce)));
        // extract the signer (a.k.a token owner)
        address from = ECDSA.recover(hash, signature);
        // check if the permit has expired
        require(block.timestamp <= expiry, "Permit has expired");
        // check if the permit has been used already
        require(!used[hash], "Permit has been used already");
        // mark the permit as used
        used[hash] = true;
        // transfer tokens
        _transfer(from, to, amount);
    }
}
