const { expect } = require("chai");
const { ethers } = require("hardhat");

describe.only("Bad Delegate Call", function () {

	let owner, mallory;
	let walletProxy;

	beforeEach(async function () {
		[owner, mallory] = await ethers.getSigners();

		const WalletLib = await ethers.getContractFactory("WalletLib");
		walletLib = await WalletLib.deploy();
		await walletLib.waitForDeployment();

		const WalletProxy = await ethers.getContractFactory("WalletProxy");
		walletProxy = await WalletProxy.deploy(await walletLib.getAddress());
		await walletProxy.waitForDeployment();
	});

	it("Should test WalletProxy", async function () {

	});

	it("Should attack WalletProxy", async function () {
		
	})
});
