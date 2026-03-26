// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract WalletLib {
    // Storage layout must match Proxy contract!
    address public owner;
    
    // Vulnerable init function
    function init(address _owner) public {
        owner = _owner;
    }
    
    // Withdraw funds to owner
    function withdraw() public {
        require(msg.sender == owner, "Not owner");
        payable(owner).transfer(address(this).balance);
    }
    
    // Allow receiving Ether
    receive() external payable {}
}
