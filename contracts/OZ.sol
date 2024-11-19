// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Import statements
// import "hardhat/console.sol"; // Uncomment this line to use console.log
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract OZ is ERC20, Ownable {
    // State variables
    address[] private holders;
    mapping(address => bool) private _isHolder;
    mapping(address => uint256) private _holderIndex;
    uint256 private cap; // <ax supply of tokens
    uint256 private exchangeRate; // Price in wei per token


    // Constructor
    constructor(string memory name, string memory symbol, uint256 _cap, uint256 _exchangeRate) ERC20(name, symbol) Ownable(msg.sender) {
        require(_cap > 0, "Cap must be greater than 0");
        require(_exchangeRate > 0, "Price per token (in wei) must be greater than 0");
        cap = _cap;
        exchangeRate = _exchangeRate;
    }

    // Fallback and receive functions
    receive() external payable {
        revert("Ether sent without calling any function, call mint() function to mint tokens");
    }

    fallback() external payable {
        revert("Function does not exist");
    }

    // Public and external functions
    // Function to get the token holders
    function getExchangeRate() external view returns (uint256) {
        return exchangeRate;
    }

    function getHolders() external view returns (address[] memory) {
        return holders;
    }

    function updateCap(uint256 _cap) external onlyOwner() {
        require(_cap > 0, "Cap must be greater than 0");
        require(_cap > totalSupply(), "Cap must be greater than the current number of circulating tokens");
        cap = _cap;
    }

    function updateEchangeRate(uint256 _exchangeRate) external onlyOwner() {
        require(_exchangeRate > 0, "Price per token (in wei) must be greater than 0");
        exchangeRate = _exchangeRate;
    }

    function mint() external payable {
        require(msg.value > 0, "No ETH transferred, unable to mint token");
        uint256 tokensPurchased = msg.value * 10 ** decimals() / exchangeRate;
        _mint(msg.sender, tokensPurchased);
    } 

    // Private and internal functions
    // Override _update function to implement cap for number of tokens as well as tracking of holders
    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0)) { // Minting
            require(totalSupply() + value <= cap, "cap exceeded"); // Check that minting these tokens does not exceed cap

            // Add recipient to holders array if this address will become a new holder
            if (!_isHolder[to]) {
                _isHolder[to] = true;
                addHolder(to);
            }
        } else if (to == address(0)) { // Burning / Sellback
            // Remove sender from holders array if this address will no longer be a holder
            if (balanceOf(from) == value) {
                _isHolder[from] = false;
                removeHolder(from);
            }
        } else { // Transfer
            // Add recipient to holders array if this address will become a new holder
            if (!_isHolder[to]) {
                _isHolder[to] = true;
                addHolder(to);
            }

            // Remove sender from holders array if this address will no longer be a holder
            if (balanceOf(from) == value) {
                _isHolder[from] = false;
                removeHolder(from);
            }
        }

        super._update(from, to, value);
    }

    // Function to add a holder to the holders array
    function addHolder(address holder) private {
        require(_holderIndex[holder] == 0, "Holder already exists"); // Ensures no duplicates
        holders.push(holder);
        _holderIndex[holder] = holders.length - 1;
    }

    // Function to remove a holder from the holders array
    function removeHolder(address holder) private {
        uint256 index = _holderIndex[holder];
        require(index < holders.length, "Holder not found"); // Ensure the holder exists

        // Replace the holder to be removed with the last element in the array
        address lastHolder = holders[holders.length - 1];
        holders[index] = lastHolder;
        _holderIndex[lastHolder] = index;

        holders.pop(); // Remove the holder to be removed
        delete _holderIndex[holder];  // Delete the index of the removed holder from _holderIndex
    }
}