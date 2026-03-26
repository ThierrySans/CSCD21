// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./MockOracle.sol";

// import "hardhat/console.sol";

contract SimpleLending is Ownable {
    IERC20 public tokenA;
    IERC20 public tokenB;
    
	MockOracle public oracle;
	
	uint256 public constant RATE_DIVISOR = 100;
    uint256 public constant INTEREST_RATE = 5; // 5%
    uint256 public constant PENALTY_RATE = 10; // 10%
	uint256 public constant MATURITY = 10000; // ~ 30 hours
	uint256 public constant REQUIRED_RATIO = 150; // 150%
	uint256 public constant LIQUIDATION_RATIO = 120; // 120%

	uint256 public totalDeposits;
	uint256 public totalBorrows;
	uint256 public loanCounter;
	
    struct Loan {
        address borrower;
        uint256 collateralAmount;
        uint256 borrowAmount;
		uint256 maturity;
		bool active;
    }

    mapping(uint256 => Loan) public loans;

	event Borrowed(address indexed user, uint256 collateralAmount, uint256 borrowAmount, uint256 maturity);

    constructor(IERC20 _tokenA, IERC20 _tokenB, MockOracle _oracle) Ownable(msg.sender) {
        tokenA = _tokenA;
        tokenB = _tokenB;
        oracle = _oracle;
    }

    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than zero");
        require(tokenA.transferFrom(msg.sender, address(this), amount), "TokenA transfer failed");
        totalDeposits += amount;
    }

    function withdraw(uint256 amount) external onlyOwner{
        require(amount <= totalDeposits - totalBorrows, "Insufficient balance");
        totalDeposits -= amount;
        require(tokenA.transfer(msg.sender, amount), "TokenA transfer failed");
    }

    function claimInterest() external onlyOwner {
		uint256 amount = tokenA.balanceOf(address(this)) - totalDeposits;
		require(tokenA.transfer(msg.sender, amount), "TokenA transfer failed");
    }

    function borrow(uint256 collateralAmount, uint256 borrowAmount) external {
		uint256 exchangeRate = oracle.getExchangeRate();
		uint256 requiredCollateral = borrowAmount * exchangeRate / RATE_DIVISOR * REQUIRED_RATIO / RATE_DIVISOR;
		require(collateralAmount >= requiredCollateral, "Insufficient collateral");
        require(tokenB.transferFrom(msg.sender, address(this), collateralAmount), "TokenB transfer failed");
        require(tokenA.transfer(msg.sender, borrowAmount), "TokenA transfer failed");
        totalBorrows+= borrowAmount;
		uint256 maturity = block.timestamp + MATURITY;
		loans[loanCounter++] = Loan({
            borrower: msg.sender,
            collateralAmount: collateralAmount,
            borrowAmount: borrowAmount,
            maturity: maturity,
            active: true
        });
		emit Borrowed(msg.sender, collateralAmount, borrowAmount, maturity);
    }

    function repay(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Not the borrower");
        require(loan.active, "Loan not active");
        require(block.timestamp <= loan.maturity, "Maturity passed");
		uint256 amountToRepay = loan.borrowAmount * (RATE_DIVISOR + INTEREST_RATE) / RATE_DIVISOR;
		loan.active = false;
		totalBorrows-= loan.borrowAmount;
		require(tokenA.transferFrom(msg.sender, address(this), amountToRepay), "TokenA transfer failed");
        require(tokenB.transfer(msg.sender, loan.collateralAmount), "TokenB transfer failed");
    }

    function liquidate(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");
		bool isOverdue = block.timestamp > loan.maturity;
		uint256 exchangeRate = oracle.getExchangeRate();
		uint256 requiredCollateral = loan.borrowAmount * exchangeRate / RATE_DIVISOR * LIQUIDATION_RATIO / RATE_DIVISOR;
		bool isUndercollaterized = (loan.collateralAmount < requiredCollateral);
        require( isOverdue || isUndercollaterized, "Loan not eligible for liquidation");
		uint256 debtAmount = loan.borrowAmount * (RATE_DIVISOR + INTEREST_RATE) / RATE_DIVISOR;
		uint256 returnAmount = loan.borrowAmount * exchangeRate / RATE_DIVISOR * (RATE_DIVISOR + PENALTY_RATE) / RATE_DIVISOR;
		uint256 liquidatorAmmount = (returnAmount > loan.collateralAmount) ? loan.collateralAmount: returnAmount;
		uint256 borrowerAmmount = (loan.collateralAmount > liquidatorAmmount)? loan.collateralAmount - liquidatorAmmount : 0;
		loan.active = false;
		totalBorrows-= loan.borrowAmount;
		require(tokenA.transferFrom(msg.sender, address(this), debtAmount), "TokenA transfer failed");
        require(tokenB.transfer(msg.sender, liquidatorAmmount), "TokenB transfer failed");
        require(tokenB.transfer(loan.borrower, borrowerAmmount), "TokenB transfer failed");
    }
}
