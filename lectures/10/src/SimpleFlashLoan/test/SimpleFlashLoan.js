// Hardhat Test Cases for FixedRateLending Contract

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FixedRateLending Contract", function () {
		let tokenA, tokenB, dex1, dex2, flash;
		let owner, borrower;

	beforeEach(async function () {
		[owner, borrower] = await ethers.getSigners();

		const Token = await ethers.getContractFactory("ERC20Mock");
		token1 = await Token.deploy("TokenA", "TKA", owner.address, 10000);
		await token1.waitForDeployment();

		token2 = await Token.deploy("TokenB", "TKB", owner.address, 10000);
		await token2.waitForDeployment();

		const Dex = await ethers.getContractFactory("MockDEX");
		dex1 = await Dex.deploy(await token1.getAddress(), await token2.getAddress());
		await dex1.waitForDeployment();
        await token1.approve(await dex1.getAddress(), 1500);
        await token2.approve(await dex1.getAddress(), 2000);
        await dex1.addLiquidity(1500, 2000);
		
		dex2 = await Dex.deploy(await token1.getAddress(), await token2.getAddress());
		await dex2.waitForDeployment();
        await token1.approve(await dex2.getAddress(), 1785);
        await token2.approve(await dex2.getAddress(), 2000);
        await dex2.addLiquidity(1785, 2000);

		const Flash = await ethers.getContractFactory("SimpleFlashLoan");
		flash = await Flash.deploy(await token1.getAddress());
		await flash.waitForDeployment();
		
		await token1.approve(await flash.getAddress(), 1000);
        await flash.deposit(1000);
	});

	it("Should do a flash loan arbitrage", async function () {		
		expect(await token1.balanceOf(borrower.address)).to.be.eq(0);
		
        await token1.connect(borrower).approve(await dex1.getAddress(), 100);
		const call1 = {
		  target: await dex1.getAddress(),
		  callData: dex1.interface.encodeFunctionData("swap", [borrower.address, (await token1.getAddress()), 100])
		};
		
		await token2.connect(borrower).approve(await dex2.getAddress(), 125);
		const call2 = {
		  target: await dex2.getAddress(),
		  callData: dex2.interface.encodeFunctionData("swap", [borrower.address, (await token2.getAddress()), 125])
		};
		
		await token1.connect(borrower).approve(await flash.getAddress(), 101);
		await flash.connect(borrower).borrow(100, [call1, call2]);

		expect(await token1.balanceOf(borrower.address)).to.be.gt(0);
	});
});
