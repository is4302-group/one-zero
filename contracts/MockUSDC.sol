// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Import statements
// import "hardhat/console.sol"; // Uncomment this line to use console.log
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Simple mock for USDC to test OneZero's functionalities
contract MockUSDC is ERC20 {
    constructor(uint256 initialSupply) ERC20("Mock USDC", "USDC") {
        _mint(msg.sender, initialSupply); // Mint initial supply to the sender
    }

    // Override the decimals function to set 6 decimals
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
