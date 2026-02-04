import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, describe, it, expect, beforeAll, afterAll } from 'vitest';

import { createPublicClient, createWalletClient, http, parseEther, decodeEventLog, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

const rpc = http("http://127.0.0.1:8545");
const client = await createPublicClient({ chain: foundry, transport: rpc });

const privateKeys = [
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
    "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
    "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
    "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
    "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97",
    "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
];

function loadContract(contract) {
  const content = readFileSync(join('out', `${contract}.sol`, `${contract}.json`), "utf8");
  const artifact = JSON.parse(content);
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}

describe("Simple Auction", function () {
	
    let owner, bidder1, bidder2, bidder3, // wallet
        contract;                         // contract
    
    const receipts = [];
    
    const biddingTime = BigInt(60);
    const firstBid = parseEther("1");
    const secondBid = parseEther("2");
    
    afterAll(async () =>{
        if (receipts.length === 0) return;

        console.log("\n=== Gas / ETH cost summary ===");
        
        for (const {label, receipt} of receipts){
            const costWei = receipt.gasUsed * receipt.effectiveGasPrice;
            console.log(`• ${label}\n  gas: ${receipt.gasUsed} | cost: ${formatEther(costWei)} ETH`);
        }
        console.log("================================\n");
    });
    
    beforeAll(async () => {
        // create wallets
        [,,owner, bidder1, bidder2, bidder3] = await Promise.all(privateKeys.map(function(pk){
            return createWalletClient({ chain: foundry, transport: rpc , account: privateKeyToAccount(pk) });
        })); 
        // compile the contract
        const { abi, bytecode } = loadContract("SimpleAuction");        
        // deploy contract
        const hash = await owner.deployContract({ abi, bytecode, args: [biddingTime]});
        // wait for the transaction to be confirmed
        const receipt = await client.waitForTransactionReceipt({ hash });
        receipts.push({label: "Deployment", receipt});
        const block = await client.getBlock({ blockNumber: receipt.blockNumber });
        const auctionEndTime = block.timestamp + biddingTime;
        const address = receipt.contractAddress;
        contract = {address, abi, args:{ auctionEndTime }};
    })
    
    describe("Deployment", function (){
        
    	it("Should have the right unlockTime", async function () {
            const { address, abi, args } = contract;
            const time = await client.readContract({ address, abi, functionName: "auctionEndTime" });
            expect(time).to.equal(args.auctionEndTime);
    	});
    
    	it("Should have the right owner", async function () {
            const { address, abi, args } = contract;
            const contractOwner = await client.readContract({ address, abi, functionName: "owner" });
            expect(contractOwner).to.equal(owner.account.address);
    	});
        
    	it("Should have the highestBidder being 0", async function () {
            const { address, abi, args } = contract;
            const highestBidder = await client.readContract({ address, abi, functionName: "highestBidder" });
            expect(highestBidder).to.equal("0x0000000000000000000000000000000000000000");
    	});
        
    	it("Should have the highestBid being 0", async function () {
            const { address, abi, args } = contract;
            const highestBid = await client.readContract({ address, abi, functionName: "highestBid" });
            expect(highestBid).to.equal(0n);
    	});
        
    	it("Should have the ended being false", async function () {
            const { address, abi, args } = contract;
            const ended = await client.readContract({ address, abi, functionName: "ended" });
            expect(ended).to.equal(false);
    	});
    })
    
    describe("First Bid", function () {
      
        let receipt;
      
        beforeAll(async () => {
            const { address, abi } = contract;
            const hash = await bidder1.writeContract({ address, abi, functionName: "bid", value: firstBid });
            receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Bidding 1", receipt});
        }); 
        
        it("Should have the right balance", async function () {
            const { address, value } = contract;
            const balance = await client.getBalance({address});
            expect(balance).to.equal(firstBid);
    	}); 
        
        it("Should have emitted an event after bidding", async function () { 
             const { abi } = contract;
            // check the logs looking of events
            expect(receipt.logs).toHaveLength(1);
            const log = receipt.logs[0];
            // parse and check event
            const { args, eventName } = decodeEventLog({abi, data: log.data, topics: log.topics });
            expect(eventName).to.equal('BidPlaced');
            expect(args.bidder).to.equal(bidder1.account.address);
            expect(args.amount).to.equal(firstBid);
        });
      
        it("Should have set the highestBidder", async function () {
              const { address, abi, args } = contract;
              const highestBidder = await client.readContract({ address, abi, functionName: "highestBidder" });
              expect(highestBidder).to.equal(bidder1.account.address);
        });

        it("Should have set the highestBid", async function () {
              const { address, abi, args } = contract;
              const highestBid = await client.readContract({ address, abi, functionName: "highestBid" });
              expect(highestBid).to.equal(firstBid);
        });
    });


    describe("Second Bid", function () {
        
      it("Should reject a bid lower than or equal to the current highest bid", async function () {
          const { address, abi } = contract;
          const request = bidder2.writeContract({ address, abi, functionName: "bid", value: firstBid });
          await expect(request).rejects.toThrow("There already is a higher bid.");
      });

      it("Should accept a bid higher than the current highest bid", async function () {
          const { address, abi } = contract;
          const hash = await bidder2.writeContract({ address, abi, functionName: "bid", value: secondBid });
          const receipt = await client.waitForTransactionReceipt({ hash });
          receipts.push({label: "Bidding 2", receipt});
      });
    });
    
    describe("Withdraw", function () {
        
        it("Should allow bidders to withdraw their pending returns", async function () {
            const { address, abi } = contract;
            const before = await client.getBalance({ address: bidder1.account.address });
            const hash = await bidder1.writeContract({ address, abi, functionName: "withdraw" });
            const receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "Withdraw", receipt});
            const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
            const after = await client.getBalance({ address: bidder1.account.address });
            const netReceived = (after - before) + gasCost;
            expect(netReceived).toBe(firstBid);
        });
        
        it("Should not allow the highest bidder to withdraw", async function () {
            const { address, abi } = contract;
            const request = bidder2.writeContract({ address, abi, functionName: "withdraw" });
            await expect(request).rejects.toThrow("No funds to withdraw.");
        });
    });
    
    describe("End Auction (present)", function () {
        
        it("Should not allow to call endAuction before the end", async function () {
            const { address, abi } = contract;
            const request = bidder2.writeContract({ address, abi, functionName: "endAuction" });
            await expect(request).rejects.toThrow("Auction not yet ended.");
        });
        
    });
    
    describe("End Auction (future)", function () {
        
        let before, receipt;
        
        beforeAll(async () => {
            // increase blockchain time by one year
            await client.request({ method: "anvil_increaseTime", params: [biddingTime+1n], });
            // mine 1 block
            await client.request({method: "anvil_mine", params: [1] });
            // endAuction
            const { address, abi } = contract;
            before = await client.getBalance({ address: owner.account.address });
            const hash = await owner.writeContract({ address, abi, functionName: "endAuction" });
            receipt = await client.waitForTransactionReceipt({ hash });
            receipts.push({label: "End Auction", receipt});
        })
        
    	it("Should have the ended being true", async function () {
            const { address, abi, args } = contract;
            const ended = await client.readContract({ address, abi, functionName: "ended" });
            expect(ended).to.equal(true);
    	});
        
        it("Should have refunded the owner", async function () {            
            const gasCost = receipt.gasUsed * receipt.effectiveGasPrice;
            const after = await client.getBalance({ address: owner.account.address });
            const netReceived = (after - before) + gasCost;
            expect(netReceived).toBe(secondBid);
        });
        
        it("Should have emitted an event", async function () {            
            const { abi } = contract;
           // check the logs looking of events
           expect(receipt.logs).toHaveLength(1);
           const log = receipt.logs[0];
           // parse and check event
           const { args, eventName } = decodeEventLog({abi, data: log.data, topics: log.topics });
           expect(eventName).to.equal('AuctionEnded');
           expect(args.winner).to.equal(bidder2.account.address);
           expect(args.amount).to.equal(secondBid);
        });
        
    });	
});