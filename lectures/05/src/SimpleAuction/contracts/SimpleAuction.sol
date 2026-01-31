// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.32;

contract SimpleAuction {
    // State variables
    address public owner;
    uint public auctionEndTime;
    address public highestBidder;
    uint public highestBid;
    bool public ended;

    // Mapping to allow refunds to previous bidders
    mapping(address => uint) public pendingReturns;

    // Events
    event BidPlaced(address bidder, uint amount);
    event AuctionEnded(address winner, uint amount);

    constructor(uint _biddingTime) {
        owner = msg.sender;
        auctionEndTime = block.timestamp + _biddingTime;
    }

    // Modifier to restrict functions
    modifier onlyBeforeEnd() {
        require(block.timestamp < auctionEndTime, "Auction already ended.");
        _;
    }
	
    // Bid function: allows users to place a bid
    function bid() public payable onlyBeforeEnd {
        require(msg.value > highestBid, "There already is a higher bid.");

        // If there's a previous bid, add it to the pending returns
        if (highestBid != 0) {
            pendingReturns[highestBidder] += highestBid;
        }
        
        highestBidder = msg.sender;
        highestBid = msg.value;
        emit BidPlaced(msg.sender, msg.value);
    }

    // Withdraw function for outbid participants
    function withdraw() public returns (bool) {
        uint amount = pendingReturns[msg.sender];
        require(amount > 0, "No funds to withdraw.");

        pendingReturns[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{ value: amount }("");
        if (!success) {
            pendingReturns[msg.sender] = amount;
            return false;
        }

        return true;
    }

    // End the auction and send funds to the owner
    function endAuction() public {
        require(block.timestamp >= auctionEndTime, "Auction not yet ended.");
        require(!ended, "endAuction has already been called.");

        ended = true;
        emit AuctionEnded(highestBidder, highestBid);

        // Transfer funds to the owner
        (bool success, ) = payable(owner).call{ value: highestBid }("");
        require(success, "ETH transfer failed");
    }
}
