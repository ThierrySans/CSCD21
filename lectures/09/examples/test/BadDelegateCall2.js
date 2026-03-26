const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Bad Delegate Call 2", function () {

	let owner, mallory;
	let numStorage;

	beforeEach(async function () {
		[owner, mallory] = await ethers.getSigners();

		const HelperLib = await ethers.getContractFactory("HelperLib");
		helperLib = await HelperLib.deploy();
		await helperLib.waitForDeployment();

		const NumStorage = await ethers.getContractFactory("NumStorage");
		numStorage = await NumStorage.deploy(await helperLib.getAddress());
		await numStorage.waitForDeployment();
	});

	it("Should test NumStorage", async function () {
		 await numStorage.setNum(42);
		 // expect(await numStorage.num()).to.be.equal(42);
	});

	it("Should attack NumStorage", async function () {
		
	})
});
