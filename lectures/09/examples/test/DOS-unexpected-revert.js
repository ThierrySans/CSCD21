const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DOS with unexpected revert", function () {
    
  it("Should test the auction", async function () {
    const Auction = await ethers.getContractFactory("Auction");
    const auction = await Auction.deploy();
    await auction.deployed();

    expect(await auction.highestBidder()).to.equal(ethers.constants.AddressZero);
    expect(await auction.highestBid()).to.equal(0);

    const [alice, bob, charlie] = await ethers.getSigners();
    
    const aliceBid = ethers.utils.parseEther("10");
    await auction.connect(alice).bid({value: aliceBid});
    expect(await auction.highestBidder()).to.equal(alice.address);
    expect(await auction.highestBid()).to.equal(aliceBid);
    
    const bobBid = ethers.utils.parseEther("5");
    expect( auction.connect(bob).bid({value: bobBid})).to.be.reverted;
    
    const charlieBid = ethers.utils.parseEther("20");
    await auction.connect(charlie).bid({value: charlieBid});
    expect(await auction.highestBidder()).to.equal(charlie.address);
    expect(await auction.highestBid()).to.equal(charlieBid);
  });
  
   it("Should attack the auction", async function () {
       
       const Auction = await ethers.getContractFactory("Auction");
       const auction = await Auction.deploy();
       await auction.deployed();

       expect(await auction.highestBidder()).to.equal(ethers.constants.AddressZero);
       expect(await auction.highestBid()).to.equal(0);

       const [alice, mallory] = await ethers.getSigners();
       
       const AuctionAttack = await ethers.getContractFactory("AuctionAttack");
       const auctionAttack = await AuctionAttack.deploy(auction.address);
       await auctionAttack.deployed();
       
       const malloryBid = ethers.utils.parseEther("0.000001");
       await auctionAttack.connect(mallory).attack({value: malloryBid});
       expect(await auction.highestBidder()).to.equal(auctionAttack.address);
       expect(await auction.highestBid()).to.equal(malloryBid);
       
       const aliceBid = ethers.utils.parseEther("10");
       expect( auction.connect(alice).bid({value: aliceBid})).to.be.reverted;
       
       expect(await auction.highestBidder()).to.equal(auctionAttack.address);
       expect(await auction.highestBid()).to.equal(malloryBid);
   })
});
