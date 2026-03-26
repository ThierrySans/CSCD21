// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract WalletProxy {
    address public owner;  
    address public lib;   

    constructor(address _lib) {
        lib = _lib;
		(bool success,) = lib.delegatecall(abi.encodeWithSignature("init(address)", msg.sender));
		require(success, "Init failed");
    }

    fallback() external payable {
        (bool success, ) = lib.delegatecall(msg.data);
        require(success, "Delegatecall failed");
    }

    receive() external payable {}
}
