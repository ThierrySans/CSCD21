// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.32;

import { SimpleAuction } from "./SimpleAuction.sol";

contract AuctionHouse {

    // Events
    event AuctionDeployed(
        address indexed auction, 
        address indexed owner,
        string label,
        uint biddingTime
    );
	
    function createAuction(string calldata label, uint biddingTime) public {
        SimpleAuction auction = new SimpleAuction(biddingTime);
        emit AuctionDeployed(address(auction), msg.sender, label, biddingTime);
    }
}
