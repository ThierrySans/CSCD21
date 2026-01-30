const fs = require("fs");
const { ethers } = require("ethers");

async function main() {
  // 1. Create a new random wallet
  const wallet = ethers.Wallet.createRandom();
  console.log("New wallet created:");
  console.log("Address:", wallet.address);
  console.log("Private Key:", wallet.privateKey);

  // 2. Save the wallet's data in wallet.json
  // We store the address, private key, and mnemonic phrase (if needed)
  const walletData = {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase,
  };
  
  fs.writeFileSync("wallet.json", JSON.stringify(walletData, null, 2));
  console.log("Wallet data saved to wallet.json\n");

  // 3. Connect to the Sepolia test network.
  // You can use the default provider or supply your own (e.g., Infura, Alchemy)
  // For production or detailed testing, consider using your API key.
  const provider = ethers.getDefaultProvider("sepolia", {
    // Example: infura: "YOUR_INFURA_PROJECT_ID",
  });

  // Connect the wallet to the provider
  const walletConnected = wallet.connect(provider);

  // 4. Retrieve and display the wallet balance
  const balanceBN = await walletConnected.getBalance();
  const balance = ethers.utils.formatEther(balanceBN);
  console.log(`Wallet balance on Sepolia: ${balance} ETH`);

  // 5. Transfer funds to another EOA on Sepolia
  // Replace the recipient address with the desired destination address
  const recipient = "0xYourRecipientAddressHere"; // <-- Replace with the actual address
  const amountInEther = "0.001"; // Amount to send

  console.log(`\nTransferring ${amountInEther} ETH to ${recipient}...`);
  const tx = await walletConnected.sendTransaction({
    to: recipient,
    value: ethers.utils.parseEther(amountInEther),
  });

  console.log("Transaction submitted. Hash:", tx.hash);
  console.log("Waiting for confirmation...");

  // Wait for the transaction to be mined
  const receipt = await tx.wait();
  console.log("Transaction confirmed in block", receipt.blockNumber);
}

main().catch((error) => {
  console.error("Error encountered:", error);
});
