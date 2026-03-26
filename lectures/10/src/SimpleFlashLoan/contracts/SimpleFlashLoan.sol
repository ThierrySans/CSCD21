// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

struct Call {
    address target;
    bytes callData;
}

contract SimpleFlashLoan is Ownable {
    IERC20 public token;
    	
	uint256 public constant RATE_DIVISOR = 100;
    uint256 public constant INTEREST_RATE = 1; // 1%

    constructor(IERC20 _token) Ownable(msg.sender) {
        token = _token;
    }
	
    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than zero");
        require(token.transferFrom(msg.sender, address(this), amount), "Token transfer failed");
    }

    function withdraw(uint256 amount) external onlyOwner{
        require(amount > 0, "Amount must be greater than zero");
        require(token.transfer(msg.sender, amount), "Token transfer failed");
    }

    function borrow(uint256 amount, Call[] memory calls) external {
        require(token.transfer(msg.sender, amount), "Token transfer failed");
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, ) = calls[i].target.call(calls[i].callData);
            require(success, "Call failed");
        }
		uint256 amountWithInterest =  amount * (RATE_DIVISOR + INTEREST_RATE) / RATE_DIVISOR;
		require(token.transferFrom(msg.sender, address(this), amountWithInterest), "Token transfer failed");
    }
}
