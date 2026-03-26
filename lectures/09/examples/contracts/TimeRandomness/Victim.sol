// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Lottery {
    address public winner;
    uint256 public prevBlockTime;

    constructor() payable {}

    function play() external payable {
        require(msg.value == 1 ether, "Must send 1 ether to play.");
        require(block.timestamp != prevBlockTime, "Only one play per block.");

        prevBlockTime = block.timestamp;

        // Vulnerability: Timestamp dependence for randomness
        if (block.timestamp % 7 == 0) {
            winner = msg.sender;
            payable(msg.sender).transfer(address(this).balance);
        }
    }
}
