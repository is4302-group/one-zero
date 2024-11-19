// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Temporary contract to check block timestamp for remix VM (cancun)
contract TimeCheck {
    constructor() {
    }

    function viewTimeStamp() public view returns (uint256) {
        return block.timestamp;
    }
}
