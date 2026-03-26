//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.28;

import "hardhat/console.sol";

contract Auction {
    
    address public highestBidder;
    uint256 public highestBid;

    constructor() {}
    
    function bid() payable public {
        require(msg.value > highestBid, "Bid should be higher than highest bid");
        if (highestBidder != address(0)){
            (bool sent,) = highestBidder.call{value:highestBid}("");
            require(sent, "Failed to reimburse highest bidder");
        }
        highestBidder = msg.sender;
        highestBid = msg.value;
    }
}
