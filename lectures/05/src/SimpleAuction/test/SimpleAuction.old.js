const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleAuction", function () {
  let auction;
  let owner, bidder1, bidder2, bidder3;
  // Set biddingTime (in seconds). For tests, a short time is fine.
  const biddingTime = 60; // 60 seconds bidding period

  beforeEach(async function () {
    // Get signers: owner and bidders.
    [owner, bidder1, bidder2, bidder3] = await ethers.getSigners();

    // Get the contract factory and deploy a new instance.
    const AuctionFactory = await ethers.getContractFactory("SimpleAuction", owner);	
    auction = await AuctionFactory.deploy(biddingTime);
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await auction.owner()).to.equal(owner.address);
    });

    it("Should set auctionEndTime greater than current time", async function () {
      const blockTimestamp = (await ethers.provider.getBlock("latest")).timestamp;
      const auctionEndTime = await auction.auctionEndTime();
      expect(auctionEndTime).to.be.gt(blockTimestamp);
    });
  });

  describe("Bidding", function () {
    it("Should allow a valid bid and update highest bid and bidder", async function () {
      const bidValue = ethers.parseEther("1");
      await expect(
        auction.connect(bidder1).bid({ value: bidValue })
      )
        .to.emit(auction, "BidPlaced")
        .withArgs(bidder1.address, bidValue);

      expect(await auction.highestBid()).to.equal(bidValue);
      expect(await auction.highestBidder()).to.equal(bidder1.address);
    });

    it("Should reject a bid lower than or equal to the current highest bid", async function () {
      // First valid bid.
      await auction.connect(bidder1).bid({ value: ethers.parseEther("1") });
      // A lower bid should revert.
      await expect(
        auction.connect(bidder2).bid({ value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("There already is a higher bid.");

      // A bid equal to the current highest bid should also revert.
      await expect(
        auction.connect(bidder2).bid({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("There already is a higher bid.");
    });

    it("Should update pending returns for the previous highest bidder", async function () {
      // Bidder1 makes the first bid.
      await auction.connect(bidder1).bid({ value: ethers.parseEther("1") });
      // Bidder2 makes a higher bid.
      await auction.connect(bidder2).bid({ value: ethers.parseEther("2") });

      // The pending return for bidder1 should be equal to their bid.
      const pending = await auction.pendingReturns(bidder1.address);
      expect(pending).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      // bidder1 and bidder2 place bids.
      await auction.connect(bidder1).bid({ value: ethers.parseEther("1") });
      await auction.connect(bidder2).bid({ value: ethers.parseEther("2") });
    });

    it("Should allow bidders to withdraw their pending returns", async function () {
      // Capture bidder1's balance before withdrawal.
      const initialBalance = await ethers.provider.getBalance(bidder1.address);

      // bidder1 should receive 1 ether (their pending return).
      await expect(() =>
        auction.connect(bidder1).withdraw()
      ).to.changeEtherBalance(bidder1, ethers.parseEther("1"));

      // Alternatively, check that pending returns are reset.
      const pendingAfter = await auction.pendingReturns(bidder1.address);
      expect(pendingAfter).to.equal(0);
    });

    it("Should revert withdrawal if there is no pending return", async function () {
      // bidder3 did not bid, so should have nothing to withdraw.
      await expect(auction.connect(bidder3).withdraw()).to.be.revertedWith("No funds to withdraw.");
    });
  });

  describe("Ending the Auction", function () {
    beforeEach(async function () {
      // Place a couple of bids.
      await auction.connect(bidder1).bid({ value: ethers.parseEther("1") });
      await auction.connect(bidder2).bid({ value: ethers.parseEther("2") });
    });

    it("Should not allow ending the auction before the end time", async function () {
      await expect(auction.endAuction()).to.be.revertedWith("Auction not yet ended.");
    });

    it("Should allow ending the auction after the bidding time has elapsed", async function () {
      // Increase the EVM time to after the auction end time.
      await ethers.provider.send("evm_increaseTime", [biddingTime + 1]);
      await ethers.provider.send("evm_mine");

      // Capture the owner's balance before ending the auction.
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);

      // End the auction. Should emit the AuctionEnded event.
      await expect(auction.endAuction())
        .to.emit(auction, "AuctionEnded")
        .withArgs(bidder2.address, ethers.parseEther("2"));

      // Verify that the auction state is updated.
      expect(await auction.ended()).to.equal(true);

      // Check that owner receives the funds (highest bid).
      // Note: Using changeEtherBalance might need adjustments for gas usage,
      // so here we use a balance delta check.
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      expect(finalOwnerBalance).to.be.gt(initialOwnerBalance);
    });

    it("Should revert if endAuction is called twice", async function () {
      // Increase time to after auction end.
      await ethers.provider.send("evm_increaseTime", [biddingTime + 1]);
      await ethers.provider.send("evm_mine");

      // End the auction the first time.
      await auction.endAuction();

      // A second call should revert.
      await expect(auction.endAuction()).to.be.revertedWith("endAuction has already been called.");
    });
  });
});
