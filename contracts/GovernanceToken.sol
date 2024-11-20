// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";

contract GovernanceToken is ERC20Capped {
    constructor(string memory name_, string memory symbol_, uint256 cap_) ERC20Capped(cap_) ERC20(name_, symbol_) {
        _mint(msg.sender, cap_);
    }
}
