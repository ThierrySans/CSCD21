// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// import "hardhat/console.sol";

contract SimpleDEX is Ownable{
    IERC20 public token1;
    IERC20 public token2;

    uint256 public reserve1;
    uint256 public reserve2;
    uint256 public constant FEE_PERCENT = 1; // 1% 
    uint256 public constant FEE_DIVISOR = 100;

    constructor(address _token1, address _token2) Ownable(msg.sender) {
		token1 = IERC20(_token1);
        token2 = IERC20(_token2);
    }

	function addLiquidity(uint256 amount1, uint256 amount2) external onlyOwner {
	    require(amount1 > 0 && amount2 > 0, "Amounts must be greater than zero");

	    uint256 correctAmount2;
		// check if the reserves are empty
		if (reserve1 == 0 && reserve2 == 0) {
			// if empty, the amount of token 1 and 2 set pool ratio (a.k.a the exchange rate)
	        correctAmount2 = amount2;
	    } else {
	        // calculate the right amount of token2 to add to preserve the liquidity pool ratio
			correctAmount2 = (amount1 * reserve2) / reserve1;
	        require(amount2 >= correctAmount2, "Insufficient token2 amount provided");
	        amount2 = correctAmount2;
	    }

	    // update the reserves
	    reserve1 += amount1;
	    reserve2 += correctAmount2;
		
		// transfer the funds from user to contract
	    require(token1.transferFrom(msg.sender, address(this), amount1), "Token1 transfer failed");
	    require(token2.transferFrom(msg.sender, address(this), correctAmount2), "Token2 transfer failed");
	}

    function removeLiquidity(uint256 amount1) external onlyOwner {
        require(amount1 > 0, "Amount must be greater than zero");
        require(reserve1 >= amount1, "Token 1 insufficient reserve");

		// calculate the amount of token 2
        uint256 amount2 = (amount1 * reserve2) / reserve1;
		
		// update the reserves
        reserve1 -= amount1;
        reserve2 -= amount2;
		
		// transfer the funds from contract to user
        require(token1.transfer(msg.sender, amount1), "Token1 transfer failed");
        require(token2.transfer(msg.sender, amount2), "Token2 transfer failed");
    }
	
	function claimReward() external onlyOwner {
		uint256 amount1 = token1.balanceOf(address(this)) - reserve1;
		uint256 amount2 = token2.balanceOf(address(this)) - reserve2;
		
		// transfer the funds from contract to user
        if (amount1>0) require(token1.transfer(msg.sender, amount1), "Token1 transfer failed");
        if (amount2>0) require(token2.transfer(msg.sender, amount2), "Token2 transfer failed");
	}

    function swap(address _fromToken, uint256 _amountIn) external {
		require(_amountIn > 0, "Amount must be greater than zero");
        require(_fromToken == address(token1) || _fromToken == address(token2), "Invalid token");

        bool isToken1 = _fromToken == address(token1);
        IERC20 from = isToken1 ? token1 : token2;
        IERC20 to = isToken1 ? token2 : token1;
        uint256 reserveIn = isToken1 ? reserve1 : reserve2;
        uint256 reserveOut = isToken1 ? reserve2 : reserve1;

		// deduct the fee from in
        uint256 amountMinusFee = (_amountIn * (FEE_DIVISOR - FEE_PERCENT)) / FEE_DIVISOR;
				
		// calculate the amount of token to swap out
        uint256 amountOut = (amountMinusFee * reserveOut) / (reserveIn + amountMinusFee);

		// update the reserves
        if (isToken1) {
            reserve1 += amountMinusFee;
            reserve2 -= amountOut;
        } else {
            reserve2 += amountMinusFee;
            reserve1 -= amountOut;
        }
		// transfer the tokens from user to contract
        require(from.transferFrom(msg.sender, address(this), _amountIn), "Swap transfer in failed");
		// transfer the tokens from contract to user
        require(to.transfer(msg.sender, amountOut), "Swap transfer out failed");
    }
}
