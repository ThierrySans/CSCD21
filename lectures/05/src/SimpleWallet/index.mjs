// call with the private key directly
// node index.mjs --env-file=.env 0x...

// or using foundry keystore
// node index.mjs --env-file=.env `cast wallet private-key --account deployer`

import { createPublicClient, createWalletClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const chain = sepolia;

// for readonly, you can use http("https://rpc.sepolia.org")
// for write, you should use a proper RPC provider as either Alchemy or Sepolia 
// for browser-based code, you can use access the RPC provider through browser-extension wallet via the window.ethereum object 
const transport = http(process.env.ALCHEMY_RPC_URL) // custom(window.ethereum) on the browser

// You can use the client to "read" anything on the blockchain: balance, bytecode, attribute values, "view" methods and so on
const client = createPublicClient({ chain, transport });

// You need a wallet when you want to "write" (i.e send a transaction) anything on the blockchain: transfer ETH, deploy contrcat, call non-"view" methods and so on 
const pk = process.argv[3];
const wallet = createWalletClient({ chain, transport , account: privateKeyToAccount(pk) });

// Get the current latest block
const latest = await client.getBlockNumber();
console.log(`Latest block: ${latest}`);
// get that block (fyi client.getBlock() returns the latest one directly)
const block = await client.getBlock({ blockNumber: latest });
console.log(`Latest block hash: ${block.hash}`);

// Get the address
const address = wallet.account.address;
console.log(`address: ${address}`);

// Get the balance
console.log(`Balance: ${await client.getBalance({address})}`);

// Transfer Eth transaction
const hash = await wallet.sendTransaction({ to: "0xAFe6e998139F7fb13B80D221AC05bb0348488A36", value: parseEther("0.0001") });
console.log(`Transaction hash: ${hash}`);

// Wait for the transaction to be confirmed
const receipt = await client.waitForTransactionReceipt({ hash });
console.log(`Block hash: ${receipt.blockHash}`);

// Show transaction cost
const costWei = receipt.gasUsed * receipt.effectiveGasPrice;
console.log(`gas: ${receipt.gasUsed} | cost: ${formatEther(costWei)} ETH`);

// Other methods

// get attribute or call a "view" method: 
// await client.readContract({ address, abi, functionName: "attributeOrFunctionName", args });

// deploy a contract 
// await wallet.deployContract({ abi, bytecode, args, value });

// call non-"view" method
// await wallet.writeContract({ address, abi, functionName: "functionName", args, value });


// Special methods to use in the browser

// Get the accounts addresses (but you cannot acces the private jeys that stay in the browser extension)
// const accounts = await walletClient.requestAddresses()

// Get the chain-id that the wallet is cuirrently on
// const chainId = await walletClient.getChainId();

// Ask the wallet to change chain
// await walletClient.switchChain({ id });


