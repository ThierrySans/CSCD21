// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract HelperLib {
    uint public num;

    function setNum(uint _num) public {
        num = _num;
    }
}