// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// import "hardhat/console.sol";

contract LPToken is ERC20, Ownable {
    constructor() ERC20("LPToken", "LPT") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}

contract SimpleDEXwithRewardToken {
    IERC20 public token1;
    IERC20 public token2;
	LPToken public lpToken;

    uint256 public reserve1;
    uint256 public reserve2;
    uint256 public constant FEE_PERCENT = 1; // 1% fee
    uint256 public constant FEE_DIVISOR = 100;

	uint256 public rewardPerToken1;
	uint256 public rewardPerToken2;
	mapping(address => bool) public isStaking;
	mapping(address => uint256) public rewardPerToken1Paid;
	mapping(address => uint256) public rewardPerToken2Paid;

    constructor(address _token1, address _token2) {
		token1 = IERC20(_token1);
        token2 = IERC20(_token2);
		lpToken = new LPToken();
    }

	function addLiquidity(uint256 amount1, uint256 amount2) external {
	    require(amount1 > 0 && amount2 > 0, "Amounts must be greater than zero");

	    uint256 correctAmount2;
		uint256 liquidityMinted;
		// check if the reserves are empty
		if (reserve1 == 0 && reserve2 == 0) {
			// if empty, the amount of token 1 and 2 set pool ratio (a.k.a the exchange rate)
	        correctAmount2 = amount2;
			// and the amount of lpToken to mint is (amount1* amount2)^2
			liquidityMinted = amount1 * amount2 * amount1 * amount2; 
	    } else {
	        // calculate the right amount of token2 to add to preserve the liquidity pool ratio
			correctAmount2 = (amount1 * reserve2) / reserve1;
	        require(amount2 >= correctAmount2, "Insufficient token2 amount provided");
	        amount2 = correctAmount2;
			// calculate the amount of lpToken to mint
			liquidityMinted = amount1 * lpToken.totalSupply() / reserve1;
	    }
		
		uint256 amount1ToPay = amount1;
		uint256 amount2ToPay = correctAmount2;

		uint256 token1Reward;
		uint256 token2Reward;
		(token1Reward, token2Reward) = calculateReward(msg.sender);
		amount1ToPay -= token1Reward;
		amount2ToPay -= token2Reward;

		// mint the lpToken
	    lpToken.mint(msg.sender, liquidityMinted);
		isStaking[msg.sender] = true;
		
		// update rewardPerTokenPaid
		rewardPerToken1Paid[msg.sender] = rewardPerToken1;
		rewardPerToken2Paid[msg.sender] = rewardPerToken2;

	    // update the reserves
	    reserve1 += amount1;
	    reserve2 += correctAmount2;
		
		// transfer the funds from user to contract
	    require(token1.transferFrom(msg.sender, address(this), amount1ToPay), "Token1 transfer failed");
	    require(token2.transferFrom(msg.sender, address(this), amount2ToPay), "Token2 transfer failed");
	}

    function removeLiquidity(uint256 lpAmount) external {
        require(lpAmount > 0, "Invalid LP token amount");
        require(lpToken.balanceOf(msg.sender) >= lpAmount, "Insufficient LP balance");
		require(lpToken.totalSupply() > 0, "LP Token supply is currently zero");

		// calculate the amounts of token1 and token 2
        uint256 totalSupply = lpToken.totalSupply();
        uint256 amount1 = (lpAmount * reserve1) / totalSupply;
        uint256 amount2 = (lpAmount * reserve2) / totalSupply;
		
		uint256 token1Reward;
		uint256 token2Reward;
		(token1Reward, token2Reward) = calculateReward(msg.sender);
		
		// update rewardPerTokenPaid
		rewardPerToken1Paid[msg.sender] = rewardPerToken1;
		rewardPerToken2Paid[msg.sender] = rewardPerToken2;
		
		// update the reserves
        reserve1 -= amount1;
        reserve2 -= amount2;
		
		// burn the lpTokens
        lpToken.burn(msg.sender, lpAmount);
		isStaking[msg.sender] = (lpToken.balanceOf(msg.sender) > 0);
		
		// transfer the funds from contract to user
        require(token1.transfer(msg.sender, amount1 + token1Reward), "Token1 transfer failed");
        require(token2.transfer(msg.sender, amount2 + token2Reward), "Token2 transfer failed");
    }
	
	function calculateReward(address user) public view returns (uint256 token1Reward, uint256 token2Reward){
		token1Reward = 0;
		token2Reward = 0;
		if (isStaking[msg.sender]){
			token1Reward =  rewardPerToken1 - rewardPerToken1Paid[user];
			token2Reward =  rewardPerToken2 - rewardPerToken2Paid[user];
		}
	}
	
	function claimReward() external {
		uint256 amount1;
		uint256 amount2; 
		(amount1, amount2) = calculateReward(msg.sender);
		rewardPerToken1Paid[msg.sender] = rewardPerToken1;
		rewardPerToken2Paid[msg.sender] = rewardPerToken2;
	    require(token1.transfer(msg.sender, amount1), "Token1 transfer failed");
	    require(token2.transfer(msg.sender, amount2), "Token2 transfer failed");
	}

    function swap(address _fromToken, uint256 _amountIn) external returns (uint256 amountOut) {
		require(_amountIn > 0, "Amount must be greater than zero");
        require(_fromToken == address(token1) || _fromToken == address(token2), "Invalid token");

        bool isToken1 = _fromToken == address(token1);
        IERC20 from = isToken1 ? token1 : token2;
        IERC20 to = isToken1 ? token2 : token1;
        uint256 reserveIn = isToken1 ? reserve1 : reserve2;
        uint256 reserveOut = isToken1 ? reserve2 : reserve1;

		// deduct the fee from in and add to rewardPerToken
        uint256 amountMinusFee = (_amountIn * (FEE_DIVISOR - FEE_PERCENT)) / FEE_DIVISOR;
		
		// caluclate rewards
		if (isToken1){
		    rewardPerToken1 += (_amountIn - amountMinusFee) / lpToken.totalSupply();
		} else {
		    rewardPerToken2 += (_amountIn - amountMinusFee) / lpToken.totalSupply();
		}
		
		// calculate the amount of token to swap out
        amountOut = (amountMinusFee * reserveOut) / (reserveIn + amountMinusFee);

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
