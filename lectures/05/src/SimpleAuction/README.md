# The Auction House

## Deploying on a Local Development Chain

1. Install dependencies

  ```
  npm install
  ```
  
2. Start the local the local chain using `anvil` (on a seperate terminal)

  ```
  anvil
  ```
  
3. Run the unit tests

The written in `tests`

  ```
  npm test
  ```
  
## Deploying on a Testnet Chain (e.g *Sepolia*)

### Setup

You need two things:

- An  API key to query and send transactions to the Ethereum Sepolia chain
- A private key account with some Sepolia Eth

Create an `.env` and fill the `ALCHEMY_API_KEY` with your own API key:
```
ALCHEMY_API_KEY=
ALCHEMY_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}
```
Let's load this `./env` file

```
source .env
```

Let's verify that your RPC works. 

```
cast chain-id --rpc-url $ALCHEMY_RPC_URL
```

This command should show the Sepolia chain ID `11155111`

Now let's record our key inside the Foundry keystore (use a strong password): 

```
cast wallet import deployer --private-key your_private_key
```

Check the output for the correct address:

[Export your private key from Metamask](https://support.metamask.io/configure/accounts/how-to-export-an-accounts-private-key)

Let's check your balance
```
cast balance \
  --rpc-url $ALCHEMY_RPC_URL \
  --ether $(cast wallet address --account deployer)
```

Make sure that you have at least 0.01 ETH

### Deploy the Contract

```
forge build
```

```
forge create contracts/AuctionHouse.sol:AuctionHouse \
  --rpc-url $ALCHEMY_RPC_URL \
  --account deployer \
  --broadcast
```

This should give you an output similar to this:
```
Deployer: <ACCOUNT_ADDRESS>
Deployed to: <DEPLOYED_ADDRESS>
Transaction hash: <TX_HASH_>
```

The `Deployed to` is your contract address and you can now check it on Etherscan: 

```
https://sepolia.etherscan.io/address/<DEPLOYED_ADDRESS>
```


Edit the file `static/config.json` and update the contract's address for the sepolia chain (`11155111`) with the contract address:

```
{
    "11155111": {
        "address": "<DEPLOYED_ADDRESS>",
    } 
}
```

### (Optional) Verify the Contract

First let's update the .env

```
forge verify-contract \
  --chain sepolia \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  <DEPLOYED_ADDRESS> \
  contracts/AuctionHouse.sol:AuctionHouse
```

### Running the Frontend

The frontend code is in the `static` folder. This code can be run a simple web server serving static pages.

As you develop the frontend, you should use a server that will automatically reload your file on changes. Any advanced code editor (like *Visual Studio* can do that. In my case, I'll use '`browser-sync` here:

1. If not done already, install [`browser-sync`](https://www.npmjs.com/package/browser-sync)
  ```
  npm install -g browser-sync
  ```

2. Run the static files

  ```
  cd static
  browser-sync start --files "**/*"
  ```
  
Your application runs on http://localhost:3000

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




