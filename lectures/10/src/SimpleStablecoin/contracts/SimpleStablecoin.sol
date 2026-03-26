// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./MockOracle.sol";

// import "hardhat/console.sol";

contract StableToken is ERC20, Ownable {
    constructor() ERC20("StableToken", "ST") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}

contract SimpleStablecoin {
    IERC20 public collateralToken;
	StableToken public stableToken;
    
	MockOracle public oracle;
	
	uint256 public constant RATE_DIVISOR = 100;
	uint256 public constant COLLATERALIZATION_RATIO = 150;

    mapping(address => uint256) public deposits;

    constructor(IERC20 _collateralToken, MockOracle _oracle) {
        collateralToken = _collateralToken;
		stableToken = new StableToken();
        oracle = _oracle;
    }

    function depositCollateral(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        require(collateralToken.transferFrom(msg.sender, address(this), amount), "Token transfer fail");
        deposits[msg.sender] += amount;
    }

    function mint(uint256 stablecoinAmount) external {
        uint256 collateralValue = deposits[msg.sender] * oracle.getExchangeRate() / RATE_DIVISOR;
        uint256 requiredCollateral = (stablecoinAmount * COLLATERALIZATION_RATIO) / RATE_DIVISOR;
        require(collateralValue >= requiredCollateral, "Insufficient collateral");
        stableToken.mint(msg.sender, stablecoinAmount);
    }

    function burn(uint256 stablecoinAmount) external {
        require(stableToken.balanceOf(msg.sender) >= stablecoinAmount, "Insufficient balance");
        stableToken.burn(msg.sender, stablecoinAmount);
    }

    function withdrawCollateral(uint256 amount) external {
		uint256 exchangeRate = oracle.getExchangeRate();
        uint256 collateralValue = deposits[msg.sender] * exchangeRate / RATE_DIVISOR;
        uint256 stablecoinDebt = stableToken.balanceOf(msg.sender);
        uint256 requiredCollateral = (stablecoinDebt * COLLATERALIZATION_RATIO) / RATE_DIVISOR;
        require(collateralValue - (amount * exchangeRate / RATE_DIVISOR) >= requiredCollateral, "Undercollateralized");
        deposits[msg.sender] -= amount;
        require(collateralToken.transfer(msg.sender, amount), "Token transfer fail");
    }

    function liquidate(address user) external {
		uint256 exchangeRate = oracle.getExchangeRate();
        uint256 collateralValue = deposits[user] * exchangeRate / RATE_DIVISOR;
        uint256 stablecoinDebt = stableToken.balanceOf(user);
        uint256 requiredCollateral = (stablecoinDebt * COLLATERALIZATION_RATIO) / RATE_DIVISOR;
        require(collateralValue < requiredCollateral, "Position is not undercollateralized");
        stableToken.burn(user, stablecoinDebt);
		deposits[user] = 0;
        require(collateralToken.transfer(msg.sender, deposits[user]), "Token transfer fail");
    }
}
