// Hardhat Test Cases for FixedRateLending Contract

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FixedRateLending Contract", function () {
		let tokenA, tokenB, oracle, lending;
		let owner, borrower, liquidator;

  beforeEach(async function () {
		[owner, borrower, liquidator] = await ethers.getSigners();

		const Token = await ethers.getContractFactory("ERC20Mock");
		tokenA = await Token.deploy("TokenA", "TKA", owner.address, 10000);
		await tokenA.waitForDeployment();

		tokenB = await Token.deploy("TokenB", "TKB", owner.address, 10000);
		await tokenB.waitForDeployment();

		const Oracle = await ethers.getContractFactory("MockOracle");
		oracle = await Oracle.deploy(100);
		await oracle.waitForDeployment();

		const Lending = await ethers.getContractFactory("SimpleLending");
		lending = await Lending.deploy(await tokenA.getAddress(), await tokenB.getAddress(), await oracle.getAddress());
		await lending.waitForDeployment();
  });

  describe("Lender Operations", function () {
	it("Should allow owner to deposit and withdraw TokenA", async function () {
		await tokenA.connect(owner).approve(await lending.getAddress(), 1000);
		await lending.connect(owner).deposit(1000);
		expect(await tokenA.balanceOf(owner)).to.equal(9000);

		await lending.connect(owner).withdraw(500);
		expect(await tokenA.balanceOf(owner)).to.equal(9500);
    });

    it("Should allow owner to claim interest", async function () {
		await tokenA.connect(owner).approve(await lending.getAddress(), 1000);
		await lending.connect(owner).deposit(1000);

		await tokenB.connect(owner).transfer(borrower.address, 1500);
		await tokenB.connect(borrower).approve(await lending.getAddress(), 1500);

		expect(await tokenA.balanceOf(borrower.address)).to.be.equal(0);
		expect(await tokenB.balanceOf(borrower.address)).to.be.equal(1500);

		await lending.connect(borrower).borrow(1500, 1000);

		expect(await tokenA.balanceOf(borrower.address)).to.be.equal(1000);
		expect(await tokenB.balanceOf(borrower.address)).to.be.equal(0);

		await tokenA.connect(owner).transfer(borrower.address, 50);
		await tokenA.connect(borrower).approve(await lending.getAddress(), 1050);

		await lending.connect(borrower).repay(0);

		expect(await tokenA.balanceOf(borrower.address)).to.be.equal(0);
		expect(await tokenB.balanceOf(borrower.address)).to.be.equal(1500);
  
		const ownerBalance = await tokenA.balanceOf(owner.address);
  
		await lending.connect(owner).claimInterest();
		expect(await tokenA.balanceOf(owner.address)).to.be.equal(ownerBalance + 50n);
      
    });
  });

  describe("Liquidation Process", function () {
    
	it("Should liquidate loan after maturity", async function () {
		await tokenA.connect(owner).approve(await lending.getAddress(), 1000);
		await lending.connect(owner).deposit(1000);

		await tokenB.connect(owner).transfer(borrower.address, 1500);
		await tokenB.connect(borrower).approve(await lending.getAddress(), 1500);

		await lending.connect(borrower).borrow(1500, 1000);

		await ethers.provider.send("evm_increaseTime", [10000]);
		await ethers.provider.send("evm_mine");

		await tokenA.connect(owner).transfer(liquidator.address, 1050);
		await tokenA.connect(liquidator).approve(await lending.getAddress(), 1050);
		
		expect((await lending.loans(0)).active).to.equal(true);
		await lending.connect(liquidator).liquidate(0);
		expect((await lending.loans(0)).active).to.equal(false);
		
		expect(await tokenA.balanceOf(liquidator.address)).to.be.equal(0);
		expect(await tokenB.balanceOf(liquidator.address)).to.be.equal(1100);
		expect(await tokenB.balanceOf(borrower.address)).to.be.equal(400);
		
    });

    it("Should liquidate loan if collateral value drops", async function () {
		await tokenA.connect(owner).approve(await lending.getAddress(), 1000);
		await lending.connect(owner).deposit(1000);

		await tokenB.connect(owner).transfer(borrower.address, 1500);
		await tokenB.connect(borrower).approve(await lending.getAddress(), 1500);

		await lending.connect(borrower).borrow(1500, 1000);

		await oracle.setExchangeRate(130);
		
		await tokenA.connect(owner).transfer(liquidator.address, 1050);
		await tokenA.connect(liquidator).approve(await lending.getAddress(), 1050);
		
		await lending.connect(liquidator).liquidate(0);
		
		expect(await tokenA.balanceOf(liquidator.address)).to.be.equal(0);
		expect(await tokenB.balanceOf(liquidator.address)).to.be.equal(1430);

    });
	
  });
});
