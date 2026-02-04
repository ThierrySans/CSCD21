# The Auction House

## Deploying on a Local Development Chain

1. Install dependencies

  ```bash
  npm install
  ```
2. Compile the Solidity contracts

  ```bash
  forge build
  ```

3. Start the local chain using `anvil` (in a separate terminal)

  ```bash
  anvil
  ```
  
4. Run the unit tests

  ```bash
  npm test
  ```
  
For educational purposes, I wrote these tests in JavaScript using the Ethereum library [`viem`](https://viem.sh/) and the test framework [vitest](https://vitest.dev/).

FYI, the *Foundry* framework has a different approach to writing unit tests using Solidity directly.
  
## Deploying on a Testnet Chain (e.g *Sepolia*)

## Prerequisites

To deploy your app, you need two things:

- A private key account with some Sepolia ETH. There are different wallets for Ethereum; we are going to use [MetaMask](https://metamask.io/) here.
- An RPC endpoint for sending queries and transactions to the Ethereum Sepolia network. There are several Ethereum RPC providers such as [Alchemy](https://www.alchemy.com/) (our choice here) and [Infura](https://www.infura.io/).

1. Install MetaMask, create a wallet, and [export your private key](https://support.metamask.io/configure/accounts/how-to-export-an-accounts-private-key).

2. Provision your account with Sepolia ETH. To get those ETH, you can use a faucet such as [Google Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) or [Sepolia PoW Faucet](https://sepolia-faucet.pk910.de/).

3. Create an account on [Alchemy](https://www.alchemy.com/), then create and export an API key for Sepolia.

### Setup

1. Create an `.env` file and set `ALCHEMY_API_KEY`:

  ```
  ALCHEMY_API_KEY=
  ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}
  ```

2. Load this `.env` file:

  ```bash
  source .env
  ```

3. Verify that your RPC endpoint works. This command should show the Sepolia chain ID `11155111`:

  ```bash
  cast chain-id --rpc-url $ALCHEMY_RPC_URL
  ```

4. Record your key inside the Foundry keystore (use a strong password):

  ```bash
  cast wallet import deployer --private-key your_private_key
  ```

5. Check your balance on Sepolia and make sure that you have at least 0.01 ETH on your account:

  ```
  cast balance \
    --rpc-url $ALCHEMY_RPC_URL \
    --ether $(cast wallet address --account deployer)
  ```

### Deploy the Contract

```bash
forge create contracts/AuctionHouse.sol:AuctionHouse \
  --rpc-url $ALCHEMY_RPC_URL \
  --account deployer \
  --broadcast
```

This should give the following output:

```bash
Deployer: <ACCOUNT_ADDRESS>
Deployed to: <DEPLOYED_ADDRESS>
Transaction hash: <TX_HASH>
```

Your contract has been deployed to `<DEPLOYED_ADDRESS>` and `<TX_HASH>` contains the transaction that includes the deployment.

You can look at this contract on Etherscan: 

```
https://sepolia.etherscan.io/address/<DEPLOYED_ADDRESS>
```

And the transaction hash:

```
https://sepolia.etherscan.io/tx/<TX_HASH>
```

Edit the file `static/config.json` and update the contract's address and transaction hash for the Sepolia chain (`11155111`):

```
{
    "11155111": {
        "address": "<DEPLOYED_ADDRESS>",
        "hash": "<TX_HASH>"
    } 
}
```

### (Optional) Verify the Contract on Etherscan

Verifying a smart contract on Etherscan makes its source code publicly readable and provably matches the deployed bytecode, building trust and transparency. It allows users, auditors, and integrators to understand exactly what the contract does; reducing the risk of hidden logic, backdoors, or malicious behavior.

```bash
forge verify-contract \
  --chain sepolia \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  <DEPLOYED_ADDRESS> \
  contracts/AuctionHouse.sol:AuctionHouse
```

### Running the Frontend

The frontend code for our app is in the `static` folder. This code can be run a simple web server serving static pages.

As you develop the frontend, you should use a server that automatically reloads your files on changes. Any advanced code editor (like *Visual Studio Code*) can do that. Here, I'll use `browser-sync`:

1. If not done already, install [`browser-sync`](https://www.npmjs.com/package/browser-sync)
 
  ```bash
  npm install -g browser-sync
  ```

2. Run the static files

  ```bash
  cd static
  browser-sync start --files "**/*"
  ```
  
Your application runs on `http://localhost:3000`. Ideally, you want to deploy your app on a public server with HTTPS. 

## Deploying on a Mainnet Chain (e.g. *Ethereum* Mainnet)

Once everything works on the Testnet chain, you can deploy on a production chain such as 

- *Ethereum* Mainnet (chain id: `1`), 
- *BNB Smart Chain (BSC)* Mainnet (chain id: `56`)
- *Polygon* PoS Mainnet (chain id: `137`)
- *Base* Mainnet (chain id: `8453`)
- and others

> [!WARNING]
> Deploying on a production Mainnet costs "real" cryptocurrencies

Follow the same process as for *Sepolia* but you'll need: 

- a private key account with a positive balance on that chain
- a new Alchemy API key for that chain



