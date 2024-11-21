// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./Storage.sol";
import "./CommissionToken.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

contract Market is AutomationCompatibleInterface {
    CommissionToken commissionToken;
    Storage storageContract;
    address private owner;
    uint256 private minimumDuration; // Minimum duration for a binary option in seconds
    mapping(address => bool) private admins;

    event BinaryOptionCreated(uint256 id, string title, uint256 start, uint256 duration, uint256 commissionRate);
    event LongAdded(uint256 id, address user, uint256 amount);
    event ShortAdded(uint256 id, address user, uint256 amount);
    event BinaryOptionConcluded(uint256 id, bool outcome);
    event CommissionPaid(uint256 id);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyAdminOrOwner(address _address) {
        require(msg.sender == owner || admins[_address], "Only owner and admins can call this function");
        _;
    }

    modifier validStake(uint256 _amount) {
        require(_amount > 0, "Amount must be greater than 0");
        _;
    }

    modifier validTitle(string memory _title) {
        require(bytes(_title).length > 0, "Title cannot be empty");
        _;
    }

    modifier validDuration(uint256 _duration) {
        require(
            _duration >= minimumDuration, "Specified duration is shorter than the minimum duration for a binary option"
        );
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

    constructor(address _commissionToken, address payable _storageContract, uint256 _minimumDuration) {
        commissionToken = CommissionToken(_commissionToken);
        storageContract = Storage(_storageContract);
        owner = msg.sender;
        minimumDuration = _minimumDuration;
    }

    receive() external payable {
        revert("Contract does not accept Ether");
    }

    fallback() external payable {
        revert("Function does not exist");
    }

    function getCommissionTokenAddress() public view returns (address) {
        return address(commissionToken);
    }

    function getStorageAddress() public view returns (address) {
        return address(storageContract);
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function transferOwnership(address _newOwner) public onlyOwner {
        owner = _newOwner;
    }

    function getMinimumDuration() public view returns (uint256) {
        return minimumDuration;
    }

    function setMinimumDuration(uint256 _minimumDuration) public onlyOwner {
        minimumDuration = _minimumDuration;
    }

    function isAdmin(address _address) public view returns (bool) {
        return admins[_address];
    }

    function updateAdmin(address _address, bool _isAdmin) public onlyOwner {
        admins[_address] = _isAdmin;
    }

    function getBinaryOption(uint256 _id)
        public
        view
        validBinaryOption(_id)
        returns (Storage.sanitisedBinaryOption memory)
    {
        return storageContract.readBinaryOption(_id);
    }

    function getUserParticipatedOptions() public view returns (uint256[] memory) {
        return storageContract.readUserParticipatedOptions(msg.sender);
    }

    function getActiveBinaryOptions() public view returns (uint256[] memory) {
        return storageContract.readActiveBinaryOptions(); // not sorted
    }

    function getConcludedBinaryOptions() public view returns (uint256[] memory) {
        return storageContract.readConcludedBinaryOptions(); // not sorted
    }

    function getUserLongPosition(uint256 _id, address _user) public view returns (uint256) {
        return storageContract.readUserLongPosition(_id, _user);
    }

    function getUserShortPosition(uint256 _id, address _user) public view returns (uint256) {
        return storageContract.readUserShortPosition(_id, _user);
    }

    function addBinaryOption(string memory _title, uint256 _start, uint256 _duration, uint256 _commissionRate)
        public
        onlyAdminOrOwner(msg.sender)
        validTitle(_title)
        validDuration(_duration)
    {
        require(_start > block.timestamp, "Backdating the start of a binary option is not allowed");
        require(_start + _duration > block.timestamp, "Binary option must end in the future");
        require(_duration > 0, "Duration must be greater than 0");

        bool success = storageContract.createBinaryOption(_title, _start, _duration, _commissionRate);
        require(success, "Failed to create binary option");

        emit BinaryOptionCreated(
            storageContract.readBinaryOptionCounter() - 1, _title, _start, _duration, _commissionRate
        );
    }

    function addPosition(uint256 _id, bool _predictedOutcome)
        public
        payable
        validStake(msg.value)
        validBinaryOption(_id)
        activeBinaryOption(_id)
    {
        bool success = storageContract.createPosition(_id, msg.sender, msg.value, _predictedOutcome);
        require(success, "Failed to add position");

        if (_predictedOutcome) {
            emit LongAdded(_id, msg.sender, msg.value);
        } else {
            emit ShortAdded(_id, msg.sender, msg.value);
        }
    }

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
                expiredBinaryOptions[expiredCount] = activeBinaryOptions[i]; // Store expired option id
                expiredCount++; // Increment the count of expired options
            }
        }

        // Return the result with the expired options array encoded
        uint256[] memory trimmedExpiredBinaryOptions = new uint256[](expiredCount);
        for (uint256 i = 0; i < expiredCount; i++) {
            trimmedExpiredBinaryOptions[i] = expiredBinaryOptions[i];
        }

        // If there are no expired options, return false
        if (expiredCount == 0) {
            return (false, abi.encode(trimmedExpiredBinaryOptions)); // No upkeep needed
        }

        // Encode the result and return it
        return (true, abi.encode(trimmedExpiredBinaryOptions));
    }

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

    // Safeguards taken to prevent abuse:
    // - Outcome is retrieved from an oracle
    // - Time checks performed to ensure that the binary option has indeed expired
    // - Checks performed to ensure that a binary option can only be concluded once
    function concludeBinaryOption(uint256 _id)
        internal
        validBinaryOption(_id)
        expiredBinaryOption(_id)
        returns (bool)
    {
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);
        require(option.outcome == Storage.Outcome.notConcluded, "Binary option has already been concluded"); // Prevents a binary option from being concluded more than once

        bool outcome = retrieveOutcome(_id); // Retrieve outcome from oracle

        // Conclude binary option
        bool conclusionSuccess = storageContract.endBinaryOption(_id, outcome);
        require(conclusionSuccess, "Failed to conclude binary option");

        if ((outcome && option.totalLongs != 0) || (!outcome && option.totalShorts != 0)) {
            // Only pay out winnings if there are winners
            // Pay out winnings
            bool winningPaymentSuccess = payOutWinnings(_id, outcome);
            require(winningPaymentSuccess, "Failed to pay out winnings");
        }

        // Pay out commission
        if (commissionToken.totalSupply() > 0) {
            // Only pay out commission if there are OZ token holders
            bool commissionPaymentSuccess = payOutCommission(_id);
            require(commissionPaymentSuccess, "Failed to pay out commission");
        }

        emit BinaryOptionConcluded(_id, outcome);
        return true;
    }

    // Dummy function for retrieval of outcome from an oracle
    function retrieveOutcome(uint256 _id) internal view returns (bool) {
        // Retrieve binary option
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);

        // Derive identifier for option
        // - Identifier will be used to retrieve outcome from oracle
        string memory identifier = option.title; // Dummy code

        // Retrieve outcome from oracle using identifier
        // - Dummy code here returns random outcome
        // - in reality outcome is retrieved from oracle
        return block.prevrandao % 2 == 0;
    }

    function payOutCommission(uint256 _id) internal returns (bool) {
        uint256 totalCommission = storageContract.readBinaryOption(_id).commissionCollected;
        commissionToken.distributeCommission{value: totalCommission}();
        emit CommissionPaid(_id);
        return true;
    }

    function payOutWinnings(uint256 _id, bool _outcome) internal returns (bool) {
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);
        uint256 winnings = option.totalLongs + option.totalShorts;

        if (_outcome) {
            // Long stakers won
            address[] memory winners = option.longStakers;
            uint256 payoutPerETHOfWinningStake = winnings * 10 ** commissionToken.decimals() / option.totalLongs;
            for (uint256 i = 0; i < winners.length; i++) {
                payable(winners[i]).transfer(
                    payoutPerETHOfWinningStake * getUserLongPosition(_id, winners[i]) / 10 ** commissionToken.decimals()
                );
            }
        } else {
            // Short stakers won
            address[] memory winners = option.shortStakers;
            uint256 payoutPerETHOfWinningStake = winnings * 10 ** commissionToken.decimals() / option.totalShorts;
            for (uint256 i = 0; i < winners.length; i++) {
                payable(winners[i]).transfer(
                    payoutPerETHOfWinningStake * getUserShortPosition(_id, winners[i])
                        / 10 ** commissionToken.decimals()
                );
            }
        }

        return true;
    }
}
