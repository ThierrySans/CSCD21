import { encodeAbiParameters, isAddress, keccak256 } from "https://esm.sh/viem@2.45.1";

const walletButton = document.getElementById("walletButton");
const walletAddressEl = document.getElementById("walletAddress");
const statusEl = document.getElementById("status");
const chainSelect = document.getElementById("chainSelect");
const erc20AddressEl = document.getElementById("erc20Address");
const spenderInput = document.getElementById("spenderInput");
const amountInput = document.getElementById("amountInput");
const expiryDaysInput = document.getElementById("expiryDaysInput");
const regularSignBtn = document.getElementById("regularSignBtn");
const eip712SignBtn = document.getElementById("eip712SignBtn");
const signatureOutputEl = document.getElementById("signatureOutput");

let connectedAccount = null;
let erc20ContractAddress = null;
let tokenDecimals = null;

function hasProvider() {
  return typeof window.ethereum !== "undefined";
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function setStatus(message) {
  statusEl.textContent = message || "";
}

function setSignatureOutput(message) {
  signatureOutputEl.textContent = message || "";
}

function setContractAddress(address) {
  erc20AddressEl.textContent = `ERC-20 address: ${address}`;
}

function randomNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return BigInt(hex);
}

async function getTokenDecimals() {
  if (typeof tokenDecimals === "number") {
    return tokenDecimals;
  }

  if (!hasProvider()) {
    throw new Error("MetaMask not found.");
  }

  if (!erc20ContractAddress || !isAddress(erc20ContractAddress)) {
    throw new Error("Missing valid ERC-20 contract address from config.json.");
  }

  const result = await window.ethereum.request({
    method: "eth_call",
    params: [
      {
        to: erc20ContractAddress,
        data: "0x313ce567"
      },
      "latest"
    ]
  });

  tokenDecimals = Number(BigInt(result));
  return tokenDecimals;
}

async function parsePermitInputs() {
  const spender = spenderInput.value.trim();
  const amountRaw = amountInput.value.trim();
  const expiryDaysRaw = expiryDaysInput.value.trim();

  if (!isAddress(spender)) {
    throw new Error("Spender must be a valid Ethereum address.");
  }

  if (!/^\d+$/.test(amountRaw)) {
    throw new Error("Amount must be a valid uint256 integer.");
  }

  if (!/^\d+$/.test(expiryDaysRaw)) {
    throw new Error("Expiry must be a non-negative integer number of days.");
  }

  const tokenAmount = BigInt(amountRaw);
  const decimals = await getTokenDecimals();
  const amount = tokenAmount * 10n ** BigInt(decimals);
  const expiryDays = BigInt(expiryDaysRaw);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const expiry = now + expiryDays * 86400n;
  const nonce = randomNonce();

  return { spender, tokenAmount, amount, expiry, nonce, decimals };
}

function renderWalletState() {
  if (connectedAccount) {
    walletButton.textContent = "Disconnect Wallet";
    walletAddressEl.textContent = `Connected wallet: ${shortAddress(connectedAccount)}`;
  } else {
    walletButton.textContent = "Connect Wallet";
    walletAddressEl.textContent = "Wallet not connected.";
  }
}

async function switchToSelectedChain() {
  if (!hasProvider()) {
    setStatus("MetaMask not found.");
    return;
  }

  const chainId = chainSelect.value;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }]
    });
    setStatus(`Switched to chain ${chainSelect.options[chainSelect.selectedIndex].text}.`);
  } catch (error) {
    setStatus(error?.message || "Failed to switch chain.");
  }
}

async function connectWallet() {
  if (!hasProvider()) {
    setStatus("MetaMask is not installed.");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    connectedAccount = accounts?.[0] || null;
    renderWalletState();

    if (connectedAccount) {
      await switchToSelectedChain();
    }
  } catch (error) {
    setStatus(error?.message || "Connection failed.");
  }
}

function disconnectWallet() {
  connectedAccount = null;
  renderWalletState();
  setStatus("Disconnected locally. To fully disconnect, remove this site in MetaMask connected sites.");
}

async function ensureConnectedAccount() {
  if (connectedAccount) {
    return connectedAccount;
  }

  await connectWallet();
  if (!connectedAccount) {
    throw new Error("Connect wallet before signing.");
  }

  return connectedAccount;
}

async function signRegularPermit() {
  try {
    const account = await ensureConnectedAccount();
    const { spender, tokenAmount, amount, expiry, nonce, decimals } = await parsePermitInputs();

    const encoded = encodeAbiParameters(
      [
        { name: "spender", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ],
      [spender, amount, expiry, nonce]
    );

    const hash = keccak256(encoded);

    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [hash, account]
    });

    setSignatureOutput(
      [
        "Regular Signature",
        `spender: ${spender}`,
        `tokenAmount: ${tokenAmount}`,
        `decimals: ${decimals}`,
        `amount: ${amount}`,
        `expiry: ${expiry}`,
        `nonce: ${nonce}`,
        `encoded: ${encoded}`,
        `hash: ${hash}`,
        `signature: ${signature}`
      ].join("\n")
    );

    setStatus("Regular signature created.");
  } catch (error) {
    setStatus(error?.message || "Regular signature failed.");
  }
}

async function signEip712Permit() {
  try {
    const account = await ensureConnectedAccount();

    if (!erc20ContractAddress || !isAddress(erc20ContractAddress)) {
      throw new Error("Missing valid ERC-20 contract address from config.json.");
    }

    const { spender, tokenAmount, amount, expiry, nonce, decimals } = await parsePermitInputs();
    const chainId = parseInt(chainSelect.value, 16);

    const typedData = {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        Permit: [
          { name: "spender", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "nonce", type: "uint256" }
        ]
      },
      primaryType: "Permit",
      domain: {
        name: "MyGaselessToken",
        version: "1",
        chainId,
        verifyingContract: erc20ContractAddress
      },
      message: {
        spender,
        amount: amount.toString(),
        expiry: expiry.toString(),
        nonce: nonce.toString()
      }
    };

    const signature = await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [account, JSON.stringify(typedData)]
    });

    setSignatureOutput(
      [
        "EIP-712 Signature",
        `spender: ${spender}`,
        `tokenAmount: ${tokenAmount}`,
        `decimals: ${decimals}`,
        `amount: ${amount}`,
        `expiry: ${expiry}`,
        `nonce: ${nonce}`,
        `domain.chainId: ${chainId}`,
        `domain.verifyingContract: ${erc20ContractAddress}`,
        `signature: ${signature}`
      ].join("\n")
    );

    setStatus("EIP-712 signature created.");
  } catch (error) {
    setStatus(error?.message || "EIP-712 signature failed.");
  }
}

async function loadContractAddress() {
  try {
    const response = await fetch("./config.json");
    if (!response.ok) {
      throw new Error("Could not load config.json");
    }

    const config = await response.json();
    const contractAddress = config?.["31337"]?.contract;

    if (!contractAddress) {
      throw new Error("Contract address not found for chain 31337");
    }

    erc20ContractAddress = contractAddress;
    tokenDecimals = null;
    setContractAddress(contractAddress);
  } catch (_error) {
    erc20ContractAddress = null;
    tokenDecimals = null;
    setContractAddress("not found");
  }
}

async function initialize() {
  await loadContractAddress();
  renderWalletState();

  if (!hasProvider()) {
    setStatus("MetaMask not detected. Install MetaMask to continue.");
    walletButton.disabled = true;
    chainSelect.disabled = true;
    regularSignBtn.disabled = true;
    eip712SignBtn.disabled = true;
    return;
  }

  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  connectedAccount = accounts?.[0] || null;
  renderWalletState();

  const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
  const matchingOption = Array.from(chainSelect.options).find(
    (option) => option.value.toLowerCase() === String(currentChainId).toLowerCase()
  );

  if (matchingOption) {
    chainSelect.value = matchingOption.value;
  }

  window.ethereum.on("accountsChanged", (accountsChanged) => {
    connectedAccount = accountsChanged?.[0] || null;
    renderWalletState();
    if (!connectedAccount) {
      setStatus("Wallet disconnected.");
    }
  });

  window.ethereum.on("chainChanged", (newChainId) => {
    tokenDecimals = null;
    const option = Array.from(chainSelect.options).find(
      (opt) => opt.value.toLowerCase() === String(newChainId).toLowerCase()
    );
    if (option) {
      chainSelect.value = option.value;
      setStatus(`Now on ${option.text}.`);
    }
  });
}

walletButton.addEventListener("click", async () => {
  if (connectedAccount) {
    disconnectWallet();
    return;
  }

  await connectWallet();
});

chainSelect.addEventListener("change", async () => {
  await switchToSelectedChain();
});

regularSignBtn.addEventListener("click", async () => {
  await signRegularPermit();
});

eip712SignBtn.addEventListener("click", async () => {
  await signEip712Permit();
});

initialize().catch((error) => {
  setStatus(error?.message || "Initialization failed.");
});
