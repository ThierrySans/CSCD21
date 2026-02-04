import {
  createPublicClient,
  createWalletClient,
  custom,
  formatEther,
  getAddress,
  parseAbiItem,
  parseEther
} from "https://esm.sh/viem@2.19.4";
import * as chains from "https://esm.sh/viem@2.19.4/chains";

const PAGE_SIZE = 6;
const ABI_EVENT = parseAbiItem(
  "event AuctionDeployed(address indexed auction, address indexed owner, string label, uint256 biddingTime)"
);
const ABI_CREATE = [
  {
    type: "function",
    name: "createAuction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "label", type: "string" },
      { name: "biddingTime", type: "uint256" }
    ],
    outputs: []
  }
];
const ABI_AUCTION_READ = [
  {
    type: "function",
    name: "highestBidder",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "highestBid",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "pendingReturns",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }]
  }
];
const ABI_AUCTION_BID = [
  {
    type: "function",
    name: "bid",
    stateMutability: "payable",
    inputs: [],
    outputs: []
  }
];
const ABI_AUCTION_END = [
  {
    type: "function",
    name: "endAuction",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  }
];
const ABI_AUCTION_WITHDRAW = [
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  }
];

const connectButton = document.getElementById("connectButton");
const networkSelect = document.getElementById("networkSelect");
const walletStatus = document.getElementById("walletStatus");
const message = document.getElementById("message");
const panelHead = document.getElementById("panelHead");
const grid = document.getElementById("grid");
const gridBody = document.getElementById("gridBody");
const pagination = document.getElementById("pagination");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");
const createAuctionButton = document.getElementById("createAuctionButton");
const refreshButton = document.getElementById("refreshButton");
const auctionForm = document.getElementById("auctionForm");
const auctionLabel = document.getElementById("auctionLabel");
const auctionDuration = document.getElementById("auctionDuration");
const cancelForm = document.getElementById("cancelForm");
const auctionModal = document.getElementById("auctionModal");
const closeAuctionModal = document.getElementById("closeAuctionModal");
const txModal = document.getElementById("txModal");
const closeModal = document.getElementById("closeModal");
const txBody = document.getElementById("txBody");
const contractLink = document.getElementById("contractLink");
const contractLinkUrl = document.getElementById("contractLinkUrl");
const bidModal = document.getElementById("bidModal");
const closeBidModal = document.getElementById("closeBidModal");
const bidForm = document.getElementById("bidForm");
const bidValue = document.getElementById("bidValue");

let allRows = [];
let totalPages = 1;
let isConnected = false;
let configCache = null;
let walletClient = null;
let publicClient = null;
let currentChainId = null;
let currentAccount = null;
let currentExplorerBase = null;
let currentBidAuction = null;

function setMessage(text, tone = "info") {
  message.textContent = text;
  message.dataset.tone = tone;
}

function formatAddress(value) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getPageFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get("page"));
  if (Number.isNaN(page) || page < 1) return 1;
  return page;
}

function updateUrl(page) {
  const params = new URLSearchParams(window.location.search);
  params.set("page", String(page));
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({ page }, "", newUrl);
}

function renderPage(page) {
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = allRows.slice(start, start + PAGE_SIZE);
  const explorer = currentExplorerBase;

  gridBody.innerHTML = "";
  slice.forEach((row) => {
    const auctionLink = explorer
      ? `<a href="${explorer}/address/${row.auction}" target="_blank" rel="noreferrer">${formatAddress(row.auction)}</a>`
      : formatAddress(row.auction);
    const ownerLink = explorer
      ? `<a href="${explorer}/address/${row.owner}" target="_blank" rel="noreferrer">${formatAddress(row.owner)}</a>`
      : formatAddress(row.owner);
    const isFuture =
      typeof row.endSeconds === "number" &&
      row.endSeconds > Math.floor(Date.now() / 1000);
    const endClass = isFuture ? "future" : "past";
    const endValue = row.endDate ?? "N/A";
    const isZeroBidder =
      row.highestBidder &&
      row.highestBidder.toLowerCase() ===
        "0x0000000000000000000000000000000000000000";
    const bidderLink = row.highestBidder && !isZeroBidder
      ? explorer
        ? `<a href="${explorer}/address/${row.highestBidder}" target="_blank" rel="noreferrer">${formatAddress(row.highestBidder)}</a>`
        : formatAddress(row.highestBidder)
      : "—";
    const bidButton =
      row.endSeconds && row.endSeconds > Math.floor(Date.now() / 1000)
        ? `<button class="btn ghost bid-btn" data-auction="${row.auction}" type="button">Bid</button>`
        : '<span class="action-placeholder"></span>';
    const hasPending =
      typeof row.pendingReturns === "bigint" && row.pendingReturns > 0n;
    const withdrawButton = hasPending
      ? `<button class="btn ghost withdraw-btn" data-auction="${row.auction}" type="button">Withdraw</button>`
      : '<span class="action-placeholder"></span>';
    const canEnd =
      row.endSeconds &&
      row.endSeconds <= Math.floor(Date.now() / 1000) &&
      currentAccount &&
      row.owner &&
      row.owner.toLowerCase() === currentAccount.toLowerCase();
    const endButton = canEnd
      ? `<button class="btn ghost end-btn" data-auction="${row.auction}" type="button">End</button>`
      : '<span class="action-placeholder"></span>';
    const line = document.createElement("div");
    line.className = "grid-row";
    line.innerHTML = `
      <div title="${row.auction}">${auctionLink}</div>
      <div title="${row.owner}">${ownerLink}</div>
      <div>${row.label}</div>
      <div><span class="auction-end ${endClass}">${endValue}</span></div>
      <div title="${row.highestBidder ?? ""}">${bidderLink}</div>
      <div>${row.highestBid ? `${row.highestBid} ETH` : "—"}</div>
      <div class="action-cell">${bidButton}</div>
      <div class="action-cell">${withdrawButton}</div>
      <div class="action-cell">${endButton}</div>
    `;
    gridBody.appendChild(line);
  });

  pageInfo.textContent = `Page ${safePage} of ${totalPages}`;
  prevPage.disabled = safePage === 1;
  nextPage.disabled = safePage === totalPages;
  updateUrl(safePage);
}

function resetUi() {
  isConnected = false;
  connectButton.textContent = "Connect Wallet";
  walletStatus.textContent = "";
  setMessage("Please connect your wallet first.");
  currentExplorerBase = null;
  currentBidAuction = null;
  auctionModal.hidden = true;
  createAuctionButton.hidden = true;
  refreshButton.hidden = true;
  grid.hidden = true;
  pagination.hidden = true;
  bidModal.hidden = true;
  panelHead.hidden = true;
  allRows = [];
  totalPages = 1;
  updateUrl(1);
}

async function loadConfig() {
  const response = await fetch("config.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load config.json");
  }
  return response.json();
}

function getChainName(chainId) {
  const id = Number(chainId);
  const entries = Object.values(chains);
  const chain = entries.find((item) => item && item.id === id);
  return chain ? chain.name : null;
}

function getChainById(chainId) {
  const id = Number(chainId);
  const entries = Object.values(chains);
  return entries.find((item) => item && item.id === id) ?? null;
}

function getExplorerBase(chainId) {
  const id = Number(chainId);
  const entries = Object.values(chains);
  const chain = entries.find((item) => item && item.id === id);
  return chain?.blockExplorers?.default?.url ?? null;
}

function populateNetworkSelect(config) {
  networkSelect.innerHTML = "";
  const ids = Object.keys(config);
  if (!ids.length) {
    const option = document.createElement("option");
    option.textContent = "No networks configured";
    option.value = "";
    networkSelect.appendChild(option);
    networkSelect.disabled = true;
    return;
  }
  ids.forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    const chainName = getChainName(id) ?? `Chain ${id}`;
    option.textContent = chainName;
    networkSelect.appendChild(option);
  });
}

function updateContractLink(chainId, address) {
  if (!chainId || !address) {
    contractLink.hidden = true;
    contractLinkUrl.href = "#";
    contractLinkUrl.textContent = "";
    return;
  }
  const explorerBase = getExplorerBase(chainId);
  if (explorerBase) {
    contractLinkUrl.href = `${explorerBase}/address/${address}`;
    contractLinkUrl.textContent = address;
    contractLink.hidden = false;
  } else {
    contractLink.hidden = true;
  }
}

async function initNetworks() {
  try {
    configCache = await loadConfig();
    populateNetworkSelect(configCache);
    const [firstChainId] = Object.keys(configCache);
    if (firstChainId && configCache[firstChainId]?.address) {
      updateContractLink(Number(firstChainId), configCache[firstChainId].address);
    }
  } catch (error) {
    setMessage(`Error: ${error.message}`);
  }
}

function ensureClients() {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Install MetaMask or another provider.");
  }
  if (!walletClient) {
    walletClient = createWalletClient({
      transport: custom(window.ethereum)
    });
  }
  if (!publicClient) {
    publicClient = createPublicClient({
      transport: custom(window.ethereum)
    });
  }
}

async function fetchEvents(contractAddress, fromBlock) {
  return publicClient.getLogs({
    address: getAddress(contractAddress),
    event: ABI_EVENT,
    fromBlock: BigInt(fromBlock),
    toBlock: "latest"
  });
}

async function addTimestampsToLogs(logs) {
  const uniqueBlocks = Array.from(
    new Set(logs.map((log) => log.blockNumber?.toString()).filter(Boolean))
  );
  const blocks = await Promise.all(
    uniqueBlocks.map((blockNumber) =>
      publicClient.getBlock({ blockNumber: BigInt(blockNumber) })
    )
  );
  const timestampMap = new Map(
    blocks.map((block) => [block.number.toString(), Number(block.timestamp)])
  );
  return logs.map((log) => ({
    ...log,
    timestamp: timestampMap.get(log.blockNumber?.toString()) ?? null
  }));
}

function formatEndDate(timestamp, biddingTime) {
  if (!timestamp || !biddingTime) return { value: "N/A", endSeconds: null };
  const endSeconds = Number(timestamp) + Number(biddingTime);
  const date = new Date(endSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hourStr = String(hours).padStart(2, "0");
  return {
    value: `${year}-${month}-${day} ${hourStr}:${minutes}:${seconds} ${period}`,
    endSeconds
  };
}

async function resolveDeploymentBlock(chainConfig) {
  if (chainConfig.hash) {
    const receipt = await publicClient.getTransactionReceipt({
      hash: chainConfig.hash
    });
    return Number(receipt.blockNumber);
  }
  return Number(chainConfig.deploymentBlock ?? 0);
}

async function hydrateAuctionState(rows) {
  const results = await Promise.all(
    rows.map(async (row) => {
      try {
        const [highestBidder, highestBid, pendingReturns] = await Promise.all([
          publicClient.readContract({
            address: getAddress(row.auction),
            abi: ABI_AUCTION_READ,
            functionName: "highestBidder"
          }),
          publicClient.readContract({
            address: getAddress(row.auction),
            abi: ABI_AUCTION_READ,
            functionName: "highestBid"
          }),
          currentAccount
            ? publicClient.readContract({
                address: getAddress(row.auction),
                abi: ABI_AUCTION_READ,
                functionName: "pendingReturns",
                args: [currentAccount]
              })
            : Promise.resolve(0n)
        ]);
        return {
          ...row,
          highestBidder,
          highestBid: highestBid ? formatEther(highestBid) : null,
          pendingReturns: pendingReturns ?? 0n
        };
      } catch (error) {
        return { ...row, highestBidder: null, highestBid: null, pendingReturns: 0n };
      }
    })
  );
  return results;
}

async function connectWallet() {
  if (isConnected) {
    resetUi();
    return;
  }

  try {
    connectButton.disabled = true;
    setMessage("Connecting to wallet...");

    ensureClients();
    const accounts = await walletClient.requestAddresses();
    const address = accounts[0];
    if (!address) {
      setMessage("No account selected.");
      return;
    }
    currentAccount = address;
    walletStatus.textContent = `Connected: ${formatAddress(address)}`;
    panelHead.hidden = false;
    refreshButton.hidden = false;

    const chainId = await walletClient.getChainId();
    currentChainId = chainId;
    currentExplorerBase = getExplorerBase(chainId);
    const chainName = getChainName(chainId);

    if (!configCache) {
      configCache = await loadConfig();
      populateNetworkSelect(configCache);
    }
    networkSelect.value = String(chainId);

    const chainConfig = configCache[String(chainId)];
    if (!chainConfig || !chainConfig.address) {
      setMessage("This app has not been deployed on the connected chain.");
      contractLink.hidden = true;
      createAuctionButton.hidden = true;
      grid.hidden = true;
      pagination.hidden = true;
      isConnected = true;
      connectButton.textContent = "Disconnect Wallet";
      return;
    }

    updateContractLink(chainId, chainConfig.address);

    const deploymentBlock = await resolveDeploymentBlock(chainConfig);
    setMessage("Fetching AuctionDeployed events...");

    const logs = await fetchEvents(chainConfig.address, deploymentBlock);
    const logsWithTimestamps = await addTimestampsToLogs(logs);
    allRows = logsWithTimestamps.map((log) => {
      const endInfo = formatEndDate(log.timestamp, log.args.biddingTime);
      return {
        auction: log.args.auction,
        owner: log.args.owner,
        label: log.args.label,
        endDate: endInfo.value,
        endSeconds: endInfo.endSeconds
      };
    });
    allRows = await hydrateAuctionState(allRows);

    if (!allRows.length) {
      setMessage("No auctions have been deployed yet.");
      grid.hidden = true;
      pagination.hidden = true;
      createAuctionButton.hidden = false;
      isConnected = true;
      connectButton.textContent = "Disconnect Wallet";
      return;
    }

    setMessage("Auctions loaded.");
    createAuctionButton.hidden = false;
    grid.hidden = false;

    totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
    pagination.hidden = totalPages <= 1;

    const page = getPageFromUrl();
    renderPage(page);

    isConnected = true;
    connectButton.textContent = "Disconnect Wallet";
  } catch (error) {
    setMessage(`Error: ${error.message}`);
  } finally {
    connectButton.disabled = false;
  }
}

async function refreshAuctions() {
  if (!isConnected || !configCache || !currentChainId) return;
  const chainConfig = configCache[String(currentChainId)];
  if (!chainConfig || !chainConfig.address) return;
  const deploymentBlock = await resolveDeploymentBlock(chainConfig);
  const logs = await fetchEvents(chainConfig.address, deploymentBlock);
  const logsWithTimestamps = await addTimestampsToLogs(logs);
  allRows = logsWithTimestamps.map((log) => {
    const endInfo = formatEndDate(log.timestamp, log.args.biddingTime);
    return {
      auction: log.args.auction,
      owner: log.args.owner,
      label: log.args.label,
      endDate: endInfo.value,
      endSeconds: endInfo.endSeconds
    };
  });
  allRows = await hydrateAuctionState(allRows);
  if (!allRows.length) {
    setMessage("No auctions have been deployed yet.");
    grid.hidden = true;
    pagination.hidden = true;
    return;
  }
  totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  pagination.hidden = totalPages <= 1;
  grid.hidden = false;
  renderPage(getPageFromUrl());
}

prevPage.addEventListener("click", () => {
  const current = getPageFromUrl();
  renderPage(current - 1);
});

nextPage.addEventListener("click", () => {
  const current = getPageFromUrl();
  renderPage(current + 1);
});

networkSelect.addEventListener("change", async (event) => {
  if (!window.ethereum) {
    setMessage("No wallet detected. Install MetaMask or another provider.", "warn");
    return;
  }
  const chainId = event.target.value;
  if (!chainId) return;
  try {
    await walletClient.switchChain({
      id: Number(chainId)
    });
  } catch (error) {
    if (error && error.code === 4902) {
      setMessage("This network is not available in your wallet.");
      return;
    }
    setMessage(`Error: ${error.message}`);
  }
});

createAuctionButton.addEventListener("click", () => {
  if (!isConnected) {
    setMessage("Connect your wallet to create an auction.");
    return;
  }
  grid.hidden = true;
  pagination.hidden = true;
  auctionForm.reset();
  auctionModal.hidden = false;
});

refreshButton.addEventListener("click", async () => {
  if (!isConnected) {
    setMessage("Connect your wallet to refresh auctions.");
    return;
  }
  setMessage("Refreshing auctions...");
  await refreshAuctions();
});

cancelForm.addEventListener("click", () => {
  auctionModal.hidden = true;
  grid.hidden = !allRows.length;
  pagination.hidden = totalPages <= 1;
});

closeAuctionModal.addEventListener("click", () => {
  auctionModal.hidden = true;
  grid.hidden = !allRows.length;
  pagination.hidden = totalPages <= 1;
});

auctionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isConnected || !configCache || !currentChainId) return;
  const chainConfig = configCache[String(currentChainId)];
  if (!chainConfig || !chainConfig.address) {
    setMessage("This app has not been deployed on the connected chain.");
    return;
  }

  const label = auctionLabel.value.trim();
  const durationDays = Number(auctionDuration.value);
  if (!label) {
    setMessage("Label is required.");
    return;
  }
  if (!Number.isFinite(durationDays) || durationDays <= 0) {
    setMessage("Duration must be a positive number of days.");
    return;
  }

  try {
    setMessage("Submitting transaction...");
    const biddingTime = BigInt(Math.floor(durationDays * 24 * 60 * 60));
    const chain = getChainById(currentChainId);
    const hash = await walletClient.writeContract({
      account: currentAccount,
      address: getAddress(chainConfig.address),
      abi: ABI_CREATE,
      functionName: "createAuction",
      args: [label, biddingTime],
      chain: chain ?? undefined
    });

    const explorer = getExplorerBase(currentChainId);
    const link = explorer ? `${explorer}/tx/${hash}` : null;

    const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;
    txBody.innerHTML = link
      ? `Transaction confirmed. Hash: <a href="${link}" target="_blank" rel="noreferrer">${shortHash}</a>`
      : `Transaction confirmed. Hash: ${shortHash}`;
    txModal.hidden = false;

    auctionForm.reset();
    auctionModal.hidden = true;
  } catch (error) {
    setMessage(`Error: ${error.message}`);
  }
});

closeModal.addEventListener("click", async () => {
  txModal.hidden = true;
  await refreshAuctions();
});

closeBidModal.addEventListener("click", () => {
  bidModal.hidden = true;
  currentBidAuction = null;
});

gridBody.addEventListener("click", (event) => {
  const button = event.target.closest(".bid-btn");
  if (!button) return;
  const auction = button.getAttribute("data-auction");
  if (!auction) return;
  currentBidAuction = auction;
  bidForm.reset();
  bidModal.hidden = false;
});

bidForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentBidAuction || !currentAccount) return;
  const valueEth = bidValue.value.trim();
  if (!valueEth || Number(valueEth) <= 0) {
    setMessage("Bid value must be greater than 0.");
    return;
  }
  try {
    setMessage("Submitting bid...");
    const chain = getChainById(currentChainId);
    const hash = await walletClient.writeContract({
      account: currentAccount,
      address: getAddress(currentBidAuction),
      abi: ABI_AUCTION_BID,
      functionName: "bid",
      value: parseEther(valueEth),
      chain: chain ?? undefined
    });
    const link = currentExplorerBase
      ? `${currentExplorerBase}/tx/${hash}`
      : null;
    const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;
    txBody.innerHTML = link
      ? `Transaction confirmed. Hash: <a href="${link}" target="_blank" rel="noreferrer">${shortHash}</a>`
      : `Transaction confirmed. Hash: ${shortHash}`;
    txModal.hidden = false;
    bidModal.hidden = true;
    currentBidAuction = null;
    await refreshAuctions();
  } catch (error) {
    setMessage(`Error: ${error.message}`);
  }
});

gridBody.addEventListener("click", async (event) => {
  const withdraw = event.target.closest(".withdraw-btn");
  const end = event.target.closest(".end-btn");
  if (!withdraw && !end) return;
  const auction = (withdraw ?? end).getAttribute("data-auction");
  if (!auction || !currentAccount) return;
  try {
    const chain = getChainById(currentChainId);
    if (withdraw) {
      setMessage("Submitting withdraw...");
      const hash = await walletClient.writeContract({
        account: currentAccount,
        address: getAddress(auction),
        abi: ABI_AUCTION_WITHDRAW,
        functionName: "withdraw",
        chain: chain ?? undefined
      });
      const link = currentExplorerBase
        ? `${currentExplorerBase}/tx/${hash}`
        : null;
      const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;
      txBody.innerHTML = link
        ? `Transaction confirmed. Hash: <a href="${link}" target="_blank" rel="noreferrer">${shortHash}</a>`
        : `Transaction confirmed. Hash: ${shortHash}`;
      txModal.hidden = false;
      await refreshAuctions();
      return;
    }
    if (end) {
      setMessage("Ending auction...");
      const hash = await walletClient.writeContract({
        account: currentAccount,
        address: getAddress(auction),
        abi: ABI_AUCTION_END,
        functionName: "endAuction",
        chain: chain ?? undefined
      });
      const link = currentExplorerBase
        ? `${currentExplorerBase}/tx/${hash}`
        : null;
      const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;
      txBody.innerHTML = link
        ? `Transaction confirmed. Hash: <a href="${link}" target="_blank" rel="noreferrer">${shortHash}</a>`
        : `Transaction confirmed. Hash: ${shortHash}`;
      txModal.hidden = false;
      await refreshAuctions();
    }
  } catch (error) {
    setMessage(`Error: ${error.message}`);
  }
});

connectButton.addEventListener("click", connectWallet);

window.addEventListener("popstate", () => {
  if (!allRows.length) return;
  renderPage(getPageFromUrl());
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    if (!accounts || accounts.length === 0) {
      resetUi();
    } else if (isConnected) {
      resetUi();
      connectWallet();
    }
  });

  window.ethereum.on("chainChanged", () => {
    if (isConnected) {
      resetUi();
      connectWallet();
    }
  });
}

txModal.hidden = true;
initNetworks();
resetUi();
