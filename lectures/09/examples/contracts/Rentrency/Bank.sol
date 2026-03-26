//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.28;

contract Bank {
    
    mapping(address=>uint256) public userBalances;
    
    constructor(){}
    
    function deposit() public payable {
        userBalances[msg.sender] = userBalances[msg.sender] + msg.value; 
    }
    
    function balance() public view returns(uint256){
        return userBalances[msg.sender];
    }
    
    function withdraw() public {
        uint amount = userBalances[msg.sender];
        userBalances[msg.sender] = 0;
        (bool sent,) = msg.sender.call{value:amount}("");
        require(sent, "Failed to withdraw balance");
    }
}
