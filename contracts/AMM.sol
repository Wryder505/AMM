// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./Token.sol";

// [ ] Manage Pool
// [ ] Manage Deposits
// [ ] Facilitate Swaps (i.e. Trades)
// [ ] Manage Withdraws
contract AMM {
	Token public token1;
	Token public token2;

	constructor(Token _token1, Token _token2) {
		token1 = _token1;
		token2 = _token2;
	}
}
