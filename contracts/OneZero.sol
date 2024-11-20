// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Import statements
// import "hardhat/console.sol"; // Uncomment this line to use console.log
import "./Storage.sol";
import "./OZ.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

contract OneZero is AutomationCompatibleInterface {
    // State variables
    // - Consider setting to public as required for automatically generated getter functions
    OZ oz;
    Storage storageContract;
    address private owner;
    uint256 private minimumDuration; // Minimum duration for a binary option in seconds
    mapping(address => bool) private admin; // Mapping of admin addresses

    // Enums


    // Structs


    // Events
    event BinaryOptionCreated(uint256 id, string title, uint256 start, uint256 duration, uint256 commissionRate);
    event LongAdded(uint256 id, address user, uint256 amount);
    event ShortAdded(uint256 id, address user, uint256 amount);
    event BinaryOptionConcluded(uint256 id, bool outcome);
    event CommissionPaid(uint256 id);


    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyAdminOrOwner(address _address) {
        require(msg.sender == owner || admin[_address], "Only owner and admins can call this function");
        _;
    }

    modifier validStake(uint256 _amount){
        require(_amount > 0, "Amount must be greater than 0");
        _;
    }

    modifier validTitle(string memory _title){
        require(bytes(_title).length > 0, "Title cannot be empty");
        _;
    }

    modifier validDuration(uint256 _duration){
        require(_duration >= minimumDuration, "Specified duration is shorter than the minimum duration for a binary option");
        _;
    }

    modifier validBinaryOption(uint256 _id) {
        require(_id < storageContract.readBinaryOptionCounter(), "Binary option does not exist");
        _;
    }

    modifier activeBinaryOption(uint256 _id) {
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);
        require(block.timestamp >= option.start, "Binary option has not started yet");
        require(block.timestamp < option.start + option.duration, "Binary option has ended");
        _;
    }

    modifier expiredBinaryOption(uint256 _id) {
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);
        require(block.timestamp >= option.start + option.duration, "Duration for binary option has not passed");
        _;
    }


    // Constructor
    constructor(address payable _ozAddress, address payable _storageContractAddress, uint256 _minimumDuration) {
        oz = OZ(_ozAddress); // Instantiate OZ token
        storageContract = Storage(_storageContractAddress); // Instantiate storage contract
        owner = msg.sender; // Set owner of the contract
        minimumDuration = _minimumDuration; // Set minimum duration for a binary option
    }


    // Fallback and receive functions
    receive() external payable {
        revert("Contract does not accept Ether");
    }

    fallback() external payable {
        revert("Function does not exist");
    }


    // Public and external functions
    // Function to retrieve address of the OZ token
    function getOZAddress() public view returns (address) {
        return address(oz);
    }

    // Function to retrieve address of the storage contract
    function getStorageAddress() public view returns (address) {
        return address(storageContract);
    }

    // Function to retrieve owner of the contract
    function getOwner() public view returns (address) {
        return owner;
    }

    // Function to transfer ownership of the contract
    function transferOwnership(address _newOwner) public onlyOwner() {
        owner = _newOwner;
    }

    // Function to retrieve minimum duration of a binary option
    function getMinimumDuration() public view returns (uint256) {
        return minimumDuration;
    }

    // Function to set minimum duration of a binary option
    function setMinimumDuration(uint256 _minimumDuration) public onlyOwner() {
        minimumDuration = _minimumDuration;
    }

    // Function to check if an address is an admin
    function isAdmin(address _address) public view returns (bool) {
        return admin[_address];
    }

    // Function to update admin mapping
    function updateAdmin(address _address, bool _isAdmin) public onlyOwner() {
        admin[_address] = _isAdmin;
    }

    // Function to retrieve all details for a binary option
    function getBinaryOption(uint256 _id) public validBinaryOption(_id) view returns (Storage.sanitisedBinaryOption memory) {
        return storageContract.readBinaryOption(_id);
    }

    // Function to retrieve all binary options that a user has participated in
    // - Currently does not restrict who can call this function, but can be extended to restrict to only the user if required
    function getUserParticipatedOptions(address _user) public view returns (uint256[] memory) {
        return storageContract.readUserParticipatedOptions(_user);
    }

    // Function to retrieve all active binary options
    function getActiveBinaryOptions() public view returns (uint256[] memory) {
        return storageContract.readActiveBinaryOptions(); // not sorted
    }

    // Function to retrieve all concluded binary options
    function getConcludedBinaryOptions() public view returns (uint256[] memory) {
        return storageContract.readConcludedBinaryOptions(); // not sorted
    }

    // Function to retrieve user's long position in a binary option
    function getUserLongPosition(uint256 _id, address _user) public view returns (uint256) {
        return storageContract.readUserLongPosition(_id, _user);
    }

    // Function to retrieve user's short position in a binary option
    function getUserShortPosition(uint256 _id, address _user) public view returns (uint256) {
        return storageContract.readUserShortPosition(_id, _user);
    }

    // Function to create new binary option
    function addBinaryOption(string memory _title, uint256 _start, uint256 _duration, uint256 _commissionRate) public onlyAdminOrOwner(msg.sender) validTitle(_title) validDuration(_duration) {
        // Perform verification checks
        require(_start > block.timestamp, "Backdating the start of a binary option is not allowed");
        require(_start + _duration > block.timestamp, "Binary option must end in the future");
        require(_duration > 0, "Duration must be greater than 0");

        // Instantiate binary option
        bool success = storageContract.createBinaryOption(_title, _start, _duration, _commissionRate);

        require(success, "Failed to create binary option");
        emit BinaryOptionCreated(storageContract.readBinaryOptionCounter() - 1, _title, _start, _duration, _commissionRate);
    }

    // Function to add position to binary option
    function addPosition(uint256 _id, bool _predictedOutcome) public validStake(msg.value) validBinaryOption(_id) activeBinaryOption(_id) payable {
        // Add position to binary option
        bool success = storageContract.createPosition(_id, msg.sender, msg.value, _predictedOutcome);
        require(success, "Failed to add position");

        if (_predictedOutcome) {
            emit LongAdded(_id, msg.sender, msg.value);
        } else {
            emit ShortAdded(_id, msg.sender, msg.value);
        }
    }

    // Function for chainlink keeper to call to check if any binary options have expired
    // - Chainlink keepers will call this method periodically
    // - Identify binary options that have expired by iterating through activeBinaryOptions array
    // - Return True and the id(s) of the expired binary option(s) if any
    // - Else return False and empty performData
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        uint256[] memory activeBinaryOptions = storageContract.readActiveBinaryOptions(); // Retrieve active binary options
        uint256[] memory expiredBinaryOptions = new uint256[](activeBinaryOptions.length); // Allocate memory array for the expired options
        uint256 expiredCount = 0;

        // Check for expired options and store their ids in the array
        for (uint256 i = 0; i < activeBinaryOptions.length; i++) {
            Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(activeBinaryOptions[i]);
            if (block.timestamp >= option.start + option.duration) {
                expiredBinaryOptions[expiredCount] = activeBinaryOptions[i];  // Store expired option id
                expiredCount++;  // Increment the count of expired options
            }
        }

        // Return the result with the expired options array encoded
        uint256[] memory trimmedExpiredBinaryOptions = new uint256[](expiredCount);
        for (uint256 i = 0; i < expiredCount; i++) {
            trimmedExpiredBinaryOptions[i] = expiredBinaryOptions[i];
        }

        // If there are no expired options, return false
        if (expiredCount == 0) {
            return (false, abi.encode(trimmedExpiredBinaryOptions));  // No upkeep needed
        }

        // Encode the result and return it
        return (true, abi.encode(trimmedExpiredBinaryOptions));
    }


    // Function that actually concludes binary options
    // - Outcome for each binary option will only be retrieved here to prevent abuse
    // - Verification checks are also performed here again to prevent abuse
    // - Code contains computationally expensive logic if there are numerous expired binary options concluded at one go
    function performUpkeep(bytes calldata performData) external override {
        // Decode ids of expired binary options
        (uint256[] memory expiredBinaryOptions) = abi.decode(performData, (uint256[]));

        for (uint256 i = 0; i < expiredBinaryOptions.length; i++) {
            bool success = concludeBinaryOption(expiredBinaryOptions[i]);
            require(success, "Failed to conclude binary option");
        }
    }


    // Private and internal functions

    // Function to conclude binary option
    // - Safeguards taken to prevent abuse:
    //     - Outcome is retrieved from an oracle
    //     - Time checks performed to ensure that the binary option has indeed expired
    //     - Checks performed to ensure that a binary option can only be concluded once
    function concludeBinaryOption(uint256 _id) internal validBinaryOption(_id) expiredBinaryOption(_id) returns (bool) {
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);
        require(option.outcome == Storage.Outcome.notConcluded, "Binary option has already been concluded"); // Prevents a binary option from being concluded more than once

        bool outcome = retrieveOutcome(_id); // Retrieve outcome from oracle

        // Conclude binary option
        bool conclusionSuccess = storageContract.endBinaryOption(_id, outcome);
        require(conclusionSuccess, "Failed to conclude binary option");

        if ((outcome && option.totalLongs != 0) || (!outcome && option.totalShorts != 0)) { // Only pay out winnings if there are winners
            // Pay out winnings
            bool winningPaymentSuccess = payOutWinnings(_id, outcome);
            require(winningPaymentSuccess, "Failed to pay out winnings");
        }

        // Pay out commission
        if (oz.totalSupply() > 0) { // Only pay out commission if there are OZ token holders
            bool commissionPaymentSuccess = payOutCommission(_id);
            require(commissionPaymentSuccess, "Failed to pay out commission");
        }

        emit BinaryOptionConcluded(_id, outcome);
        return true;
    }

    // Dummy function for retrieval of Outcome from an oracle
    function retrieveOutcome(uint256 _id) internal view returns (bool) {
        // Retrieve binary option
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);

        // Derive identifier for option
        // - Identifier will be used to retrieve outcome from oracle
        string memory identifier = option.title; // Dummy code

        bool outcome;

        // Retrieve outcome from oracle using identifier
        // - Dummy code here will always return true here but in reality outcome is retrieved from oracle
        if (bytes(identifier).length > 0) {
            outcome = true;
        } else {
            outcome = false;
        }

        return outcome;
    }

    // Function to pay out commission
    function payOutCommission(uint256 _id) internal returns (bool) {
        uint256 totalSupply = oz.totalSupply();
        uint256 commissionPerToken = storageContract.readBinaryOption(_id).commissionCollected * 10 ** oz.decimals() / totalSupply;

        address[] memory holders = oz.getHolders();
        for (uint256 i = 0; i < holders.length; i++) {
            uint256 amount = oz.balanceOf(holders[i]) * commissionPerToken / 10 ** oz.decimals();
            payable(holders[i]).transfer(amount);
        }

        emit CommissionPaid(_id);
        return true;
    }

    // Function to pay out winnings
    function payOutWinnings(uint256 _id, bool _outcome) internal returns (bool) {
        // Retrieve binary option
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);
        uint256 winnings = option.totalLongs + option.totalShorts;

        if (_outcome) { // Long stakers won
            address[] memory winners = option.longStakers;
            uint256 payoutPerETHOfWinningStake = winnings * 10 ** oz.decimals() / option.totalLongs;
            for (uint256 i = 0; i < winners.length; i++) {
                payable(winners[i]).transfer(payoutPerETHOfWinningStake * getUserLongPosition(_id, winners[i]) / 10 ** oz.decimals());
            }
        } else { // Short stakers won
            address[] memory winners = option.shortStakers;
            uint256 payoutPerETHOfWinningStake = winnings * 10 ** oz.decimals() / option.totalShorts;
            for (uint256 i = 0; i < winners.length; i++) {
                payable(winners[i]).transfer(payoutPerETHOfWinningStake * getUserShortPosition(_id, winners[i]) / 10 ** oz.decimals());
            }
        }

        return true;
    }
}