const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("SimpleDEX", function () {
    let dex, token1, token2, owner, user;

    beforeEach(async function () {
        [owner, user] = await ethers.getSigners();

        const Token = await ethers.getContractFactory("ERC20Mock");
        token1 = await Token.deploy("Token1", "TK1", owner.address, 1000000);
        await token1.waitForDeployment();

        token2 = await Token.deploy("Token2", "TK2", owner.address, 1000000);
        await token2.waitForDeployment();

        const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
        dex = await SimpleDEX.deploy(await token1.getAddress(), await token2.getAddress());
        await dex.waitForDeployment();
    });

    it("Should allow owner to add liquidity", async function () {
        const dexAddress = await dex.getAddress();

        await token1.approve(dexAddress, 1000);
        await token2.approve(dexAddress, 2000);
        await dex.addLiquidity(1000, 2000);

        expect(await dex.reserve1()).to.equal(1000);
        expect(await dex.reserve2()).to.equal(2000);
    });

    it("Should allow owner to withdraw liquidity", async function () {
        const dexAddress = await dex.getAddress();

        await token1.approve(dexAddress, 1000);
        await token2.approve(dexAddress, 2000);
        await dex.addLiquidity(1000, 2000);
		
		const token1Balance = await token1.balanceOf(owner.address);
		const token2Balance = await token2.balanceOf(owner.address);
		
        await dex.removeLiquidity(1000);

        // Expect to receive back the tokens
        expect(await token1.balanceOf(owner.address)).to.be.equal(token1Balance + 1000n);
        expect(await token2.balanceOf(owner.address)).to.be.equal(token2Balance + 2000n);
    });

    it("Should swap tokens and collect fees", async function () {
        const dexAddress = await dex.getAddress();
        const userAddress = user.address;

        await token1.approve(dexAddress, 1000);
        await token2.approve(dexAddress, 2000);
        await dex.addLiquidity(1000, 2000);

        await token1.transfer(userAddress, 100);
        await token1.connect(user).approve(dexAddress, 100);

        await dex.connect(user).swap(await token1.getAddress(), 100);
        const balanceAfter = await token2.balanceOf(userAddress);

        expect(balanceAfter).to.be.equal(180);
		
		const balanceBefore = await token1.balanceOf(owner.address);
		await dex.connect(owner).claimReward();
		expect(await token1.balanceOf(owner.address)).to.be.gt(balanceBefore);
    });
});
