// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// import "hardhat/console.sol";

contract MockDEX is Ownable{
    IERC20 public token1;
    IERC20 public token2;

    constructor(address _token1, address _token2) Ownable(msg.sender) {
		token1 = IERC20(_token1);
        token2 = IERC20(_token2);
    }

	function addLiquidity(uint256 amount1, uint256 amount2) external onlyOwner {
	    require(amount1 > 0 && amount2 > 0, "Amounts must be greater than zero");
		
		// transfer the funds from user to contract
	    require(token1.transferFrom(msg.sender, address(this), amount1), "Token1 transfer failed");
	    require(token2.transferFrom(msg.sender, address(this), amount2), "Token2 transfer failed");
	}

    function swap(address requester, address _fromToken, uint256 _amountIn) external {
		require(_amountIn > 0, "Amount must be greater than zero");
        require(_fromToken == address(token1) || _fromToken == address(token2), "Invalid token");

        bool isToken1 = _fromToken == address(token1);
        IERC20 from = isToken1 ? token1 : token2;
        IERC20 to = isToken1 ? token2 : token1;
        uint256 reserveIn = isToken1 ? token1.balanceOf(address(this)) : token2.balanceOf(address(this));
        uint256 reserveOut = isToken1 ? token2.balanceOf(address(this)) : token1.balanceOf(address(this));
				
		// calculate the amount of token to swap out
        uint256 amountOut = (_amountIn * reserveOut) / (reserveIn + _amountIn);

		// transfer the tokens from user to contract
        require(from.transferFrom(requester, address(this), _amountIn), "Swap transfer in failed");
		// transfer the tokens from contract to user
        require(to.transfer(requester, amountOut), "Swap transfer out failed");
    }
}
