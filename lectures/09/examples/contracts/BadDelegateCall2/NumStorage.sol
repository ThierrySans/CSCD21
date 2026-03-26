// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// source: https://github.com/falconandrea/example-delegatecall-vulnerability

contract NumStorage {
    address public helper;
    address public owner;
    uint public num;

    constructor(address _helper) {
        helper = _helper;
        owner = msg.sender;
    }

    function setNum(uint _num) public {
        (bool success, ) = helper.delegatecall(abi.encodeWithSignature("setNum(uint256)", _num));
        require(success, "Delegate call failed");
    }
}