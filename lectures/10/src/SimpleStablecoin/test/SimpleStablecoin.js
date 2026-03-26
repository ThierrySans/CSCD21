const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Stablecoin Contract", function () {
    let owner, user, liquidator;
    let collateralToken, stableToken, oracle, stablecoin;

    beforeEach(async function () {
        [owner, user, liquidator] = await ethers.getSigners();

		const Token = await ethers.getContractFactory("ERC20Mock");
		collateralToken = await Token.deploy("Token", "TK", owner.address, 10000);
		await collateralToken.waitForDeployment();
		await collateralToken.transfer(user.address, 1000);

		const Oracle = await ethers.getContractFactory("MockOracle");
		oracle = await Oracle.deploy(100);
		await oracle.waitForDeployment();

        const Stablecoin = await ethers.getContractFactory("SimpleStablecoin");
        stablecoin = await Stablecoin.deploy(await collateralToken.getAddress(), await oracle.getAddress());
        await stablecoin.waitForDeployment();
		
		const StableToken = await ethers.getContractFactory("StableToken");
		stableToken = StableToken.attach(await stablecoin.stableToken());			
    });

    it("should allow a user to deposit collateral", async function () {
        await collateralToken.connect(user).approve(await stablecoin.getAddress(), 100);
        await stablecoin.connect(user).depositCollateral(100);

        const balance = await stablecoin.deposits(user.address);
        expect(balance).to.equal(100);
    });

    it("should allow a user to mint stablecoins if properly collateralized", async function () {
        await collateralToken.connect(user).approve(await stablecoin.getAddress(), 150);
        await stablecoin.connect(user).depositCollateral(150);
        await stablecoin.connect(user).mint(100);

        const stablecoinBalance = await stableToken.balanceOf(user.address);
        expect(stablecoinBalance).to.equal(100);
    });

    it("should prevent minting if undercollateralized", async function () {
        await collateralToken.connect(user).approve(await stablecoin.getAddress(), 100);
        await stablecoin.connect(user).depositCollateral(100);
        await expect(stablecoin.connect(user).mint(100)).to.be.revertedWith("Insufficient collateral");
    });

    it("should allow a user to burn stablecoins", async function () {
        await collateralToken.connect(user).approve(await stablecoin.getAddress(), 150);
        await stablecoin.connect(user).depositCollateral(150);
        await stablecoin.connect(user).mint(100);

        await stablecoin.connect(user).burn(50);
        const stablecoinBalance = await stableToken.balanceOf(user.address);
        expect(stablecoinBalance).to.equal(50);
    });

    it("should allow a user to withdraw collateral if sufficiently collateralized", async function () {
        await collateralToken.connect(user).approve(await stablecoin.getAddress(), 200);
        await stablecoin.connect(user).depositCollateral(200);
        await stablecoin.connect(user).mint(100);
        await stablecoin.connect(user).withdrawCollateral(50);

        const remainingCollateral = await stablecoin.deposits(user.address);
        expect(remainingCollateral).to.equal(150);
    });

    it("should prevent undercollateralized withdrawals", async function () {
        await collateralToken.connect(user).approve(await stablecoin.getAddress(), 150);
        await stablecoin.connect(user).depositCollateral(150);
        await stablecoin.connect(user).mint(100);
        await expect(stablecoin.connect(user).withdrawCollateral(100)).to.be.revertedWith("Undercollateralized");
    });

    it("should allow liquidation of an undercollateralized position", async function () {
        await collateralToken.connect(user).approve(await stablecoin.getAddress(), 150);
        await stablecoin.connect(user).depositCollateral(150);
        await stablecoin.connect(user).mint(100);

        await oracle.setExchangeRate(80);

        await stablecoin.connect(liquidator).liquidate(user.address);
        const remainingCollateral = await stablecoin.deposits(user.address);
        expect(remainingCollateral).to.equal(0);
    });
});
