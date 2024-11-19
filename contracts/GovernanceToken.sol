// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Import statements
// import "hardhat/console.sol"; // Uncomment this line to use console.log
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GovernanceToken is ERC20, Ownable {
    uint256 private cap; // max supply of tokens

    // Constructor
    constructor(string memory name, string memory symbol, uint256 _cap) ERC20(name, symbol) Ownable(msg.sender) {
        require(_cap > 0, "Cap must be greater than 0");
        cap = _cap;
    }

    // Public and external functions
    // Function to retrieve maximum supply of OZ tokens
    function getCap() external view returns (uint256) {
        return cap;
    }

    // Function to update the maximum supply of OZ tokens
    function updateCap(uint256 _cap) external onlyOwner {
        require(_cap > totalSupply(), "Cap must be greater than the current number of circulating tokens");
        cap = _cap;
    }
}
