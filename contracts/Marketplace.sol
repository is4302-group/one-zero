// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./Storage.sol";
import "./GovernanceToken.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

contract OneZero is AutomationCompatibleInterface {
    // State variables
    // - Consider setting to public as required for automatically generated getter functions
    GovernanceToken governanceToken;
    Storage storageContract;
    address private owner;
    uint256 private minimumPeriod; // Minimum period for a binary option in seconds

    // Enums

    // Structs

    // Events
    event BinaryOptionCreated(uint256 id, string title, uint256 start, uint256 period, uint256 commissionRate);
    event LongAdded(uint256 id, address user, uint256 amount);
    event ShortAdded(uint256 id, address user, uint256 amount);
    event BinaryOptionConcluded(uint256 id);
    event CommissionPaid(uint256 id);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier validStake(uint256 _amount) {
        require(_amount > 0, "Amount must be greater than 0");
        _;
    }

    modifier validBinaryOption(uint256 _id) {
        require(_id < storageContract.readBinaryOptionCounter(), "Binary option does not exist");
        _;
    }

    modifier activeBinaryOption(uint256 _id) {
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);
        require(block.timestamp >= option.start, "Binary option has not started yet");
        require(block.timestamp < option.start + option.period, "Binary option has ended");
        _;
    }

    modifier expiredBinaryOption(uint256 _id) {
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);
        require(block.timestamp >= option.start + option.period, "Binary option has not ended yet");
        _;
    }

    // Constructor
    constructor(address payable _tokenAddress, address payable _storageAddress) {
        governanceToken = GovernanceToken(_tokenAddress);

        storageContract = Storage(_storageAddress); // Instantiate storage contract

        // Set address for owner
        owner = msg.sender;
    }

    // Fallback and receive functions
    receive() external payable {
        revert("Contract does not accept Ether");
    }

    fallback() external payable {
        revert("Function does not exist");
    }

    // Public and external functions
    // Function to retrive owner of the contract
    function getOwner() public view returns (address) {
        return owner;
    }

    // Function to retrieve minimum period of a binary option
    function getMinimumPeriod() public view returns (uint256) {
        return minimumPeriod;
    }

    // Function to retrieve all details for a binary option
    function getBinaryOption(uint256 _id)
        public
        view
        validBinaryOption(_id)
        returns (Storage.sanitisedBinaryOption memory)
    {
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
    function addBinaryOption(string memory _title, uint256 _start, uint256 _period, uint256 _commissionRate)
        public
        onlyOwner
    {
        // Perform verification checks
        require(_start > block.timestamp, "Backdating the start of a binary option is not allowed");
        require(_start + _period > block.timestamp, "Binary option must end in the future");
        require(_period > 0, "Period must be greater than 0");

        // Instantiate binary option
        bool success = storageContract.createBinaryOption(_title, _start, _period, _commissionRate);

        require(success, "Failed to create binary option");
        emit BinaryOptionCreated(
            storageContract.readBinaryOptionCounter() - 1, _title, _start, _period, _commissionRate
        );
    }

    // Function to add position to binary option
    function addPosition(uint256 _id, bool _predictedOutcome)
        public
        payable
        validStake(msg.value)
        validBinaryOption(_id)
        activeBinaryOption(_id)
    {
        // Add position to binary option
        bool success = storageContract.createPosition(_id, msg.sender, msg.value, _predictedOutcome);
        require(success, "Failed to add position");

        if (_predictedOutcome) {
            emit LongAdded(_id, msg.sender, msg.value);
        } else {
            emit ShortAdded(_id, msg.sender, msg.value);
        }
    }

    // Function to conclude binary option
    function concludeBinaryOption(uint256 _id) public onlyOwner expiredBinaryOption(_id) returns (bool) {
        Storage.Outcome status = storageContract.readBinaryOption(_id).outcome;
        require(status == Storage.Outcome.notConcluded, "Binary option has already been concluded"); // Prevents a binary option from being concluded more than once

        bool outcome = retrieveOutcome(_id); // Retrieve outcome from oracle

        // Conclude binary option
        bool conclusionSuccess = storageContract.endBinaryOption(_id, outcome);
        require(conclusionSuccess, "Failed to conclude binary option");

        // Pay out winnings
        bool winningPaymentSuccess = payOutWinnings(_id, outcome);
        require(winningPaymentSuccess, "Failed to pay out winnings");

        // Pay out commission
        bool commissionPaymentSuccess = payOutCommission(_id);
        require(commissionPaymentSuccess, "Failed to pay out commission");

        emit BinaryOptionConcluded(_id);
        return true;
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
            if (block.timestamp >= option.start + option.period) {
                expiredBinaryOptions[expiredCount] = activeBinaryOptions[i]; // Store expired option id
                expiredCount++; // Increment the count of expired options
            }
        }

        // If there are no expired options, return false
        if (expiredCount == 0) {
            return (false, bytes("")); // No upkeep needed
        }

        // Return the result with the expired options array encoded
        uint256[] memory trimmedExpiredBinaryOptions = new uint256[](expiredCount);
        for (uint256 i = 0; i < expiredCount; i++) {
            trimmedExpiredBinaryOptions[i] = expiredBinaryOptions[i];
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
    // Dummy function for retrieval of Outcome from an oracle
    function retrieveOutcome(uint256 _id) internal view returns (bool) {
        // Retrieve binary option
        Storage.sanitisedBinaryOption memory option = storageContract.readBinaryOption(_id);

        // Derive identifier for option
        // - Identifier will be used to retrieve outcome from oracle
        string memory identifier = "sample identifier"; // dummy code

        // Retrieve outcome from oracle
        bool outcome = true; // Dummy code here but in reality outcome is retrieved from oracle

        return outcome;
    }

    // Function to pay out commission
    function payOutCommission(uint256 _id) internal returns (bool) {
        uint256 totalSupply = governanceToken.totalSupply();
        uint256 commissionPerToken =
            storageContract.readBinaryOption(_id).commissionCollected * 10 ** governanceToken.decimals() / totalSupply;

        address[] memory holders = governanceToken.getHolders();
        for (uint256 i = 0; i < holders.length; i++) {
            uint256 amount =
                governanceToken.balanceOf(holders[i]) * commissionPerToken / 10 ** governanceToken.decimals();
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

        if (_outcome) {
            // Long stakers won
            address[] memory winners = option.longStakers;
            uint256 payoutPerETHOfWinningStake = winnings * 10 ** governanceToken.decimals() / option.totalLongs;
            for (uint256 i = 0; i < winners.length; i++) {
                payable(winners[i]).transfer(
                    payoutPerETHOfWinningStake * getUserLongPosition(_id, winners[i]) / 10 ** governanceToken.decimals()
                );
            }
        } else {
            // Short stakers won
            address[] memory winners = option.shortStakers;
            uint256 payoutPerETHOfWinningStake = winnings * 10 ** governanceToken.decimals() / option.totalShorts;
            for (uint256 i = 0; i < winners.length; i++) {
                payable(winners[i]).transfer(
                    payoutPerETHOfWinningStake * getUserShortPosition(_id, winners[i])
                        / 10 ** governanceToken.decimals()
                );
            }
        }

        return true;
    }
}

contract Marketplace {
    enum Role {
        User,
        Admin,
        Owner
    }

    struct Option {
        uint256 id;
    }

    modifier isRole(Role role) {
        require(members[msg.sender] >= role, "insufficient permissions");
        _;
    }

    uint256 private fee;

    mapping(address => Role) private members;

    // use first bit to indicate long or short
    // id = uint256 >> 1, uint256 & 1 = set:long, unset:short
    mapping(uint256 => Option) private options;

    mapping(uint256 => mapping(address => uint256)) private option_members;

    mapping(address => mapping(uint256 => uint256)) private member_options;

    constructor(address payable _owner, uint256 _fee) {
        members[_owner] = Role.Owner;
        fee = _fee;
    }

    // ---------- member methods (start) ---------- //

    function joinAsMember() public {
        members[msg.sender] = Role.User;
    }

    function deleteMember(address member) public isRole(Role.Admin) {
        require(members[member] < Role.Admin, "cannot delete admin");
        delete members[member];
    }

    function updateMemberRole(address member, Role newRole) public isRole(Role.Admin) {
        members[member] = newRole;
    }

    // ---------- member methods (end) ---------- //

    // ---------- option methods (start) ---------- //

    function addOption() public isRole(Role.Admin) {}

    function expireOption() public isRole(Role.Admin) {
        // close for staking
        // settle balances
    }

    function deleteOption(uint256 id) public isRole(Role.Admin) {
        uint256 shortId = id << 1;
        delete options[shortId];
        // delete option_members[shortId]; // cannot delete mapping directly, commented out for now to avoid changing logic
        // delete member_options[];

        uint256 longId = shortId + 1;
        delete options[longId];
        // delete option_members[longId]; // cannot delete mapping directly, commented out for now to avoid changing logic
        // delete member_options[];
    }

    function stakeOption(uint256 id) public isRole(Role.User) {}

    function unstakeOption(uint256 id) public isRole(Role.User) {}

    function viewMemberBalance() public view isRole(Role.User) {
        mapping(uint256 => uint256) storage memberBalance = member_options[msg.sender];
        // for option in memberBalance, return
    }

    // ---------- option methods (end) ---------- //
}
