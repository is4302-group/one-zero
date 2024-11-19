// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// Import statements
// import "hardhat/console.sol"; // Uncomment this line to use console.log

// Storage contract stores the data for each of the binary options
// Storage contract also contains logic required for CRUD operations on binary options data

contract Storage {
    // State variables
    // - Consider setting to public as required for automatically generated getter functions
    uint256 BASIS_POINTS_DIVISOR = 10000;
    address oneZeroContractAddress;
    address owner;
    mapping(uint256 => binaryOption) binaryOptions;
    mapping(address => uint256[]) userParticipatedOptions;
    uint256 binaryOptionCounter;
    uint256[] activeBinaryOptions;
    mapping(uint256 => uint256) activeBinaryOptionsToIndex;
    uint256[] concludedBinaryOptions;

    // Enums
    enum Outcome {
        notConcluded,
        long,
        short
    }

    // Structs
    struct binaryOption {
        uint256 id;
        string title;
        uint256 start;
        uint256 period; // Duration of binary option in seconds
        uint256 commissionRate; // Percentage of bet in basis points
        uint256 commissionCollected; // Total commission collected in wei
        Outcome outcome;
        uint256 totalLongs; // Total amount of longs in USDC (i.e., 1e6)
        mapping(address => uint256) longs; // Mapping of addresses to longs in USDC (i.e., 1e6)
        address[] longStakers; // Array of addresses which have staked in a long position
        uint256 totalShorts; // Total amount of shorts in USDC (i.e., 1e6)
        mapping(address => uint256) shorts; // Mapping of addresses to shorts in USDC (i.e., 1e6)
        address[] shortStakers; // Array of addresses which have staked in a short position
    }

    struct sanitisedBinaryOption {
        uint256 id;
        string title;
        uint256 start;
        uint256 period; // Duration of binary option in seconds
        uint256 commissionRate; // Percentage of bet in basis points
        uint256 commissionCollected; // Total commission collected in USDC (i.e., 1e6)
        Outcome outcome;
        uint256 totalLongs; // Total amount of longs in USDC (i.e., 1e6)
        address[] longStakers; // Array of addresses which have staked in a long position
        uint256 totalShorts; // Total amount of shorts in USDC (i.e., 1e6)
        address[] shortStakers; // Array of addresses which have staked in a short position
    }

    // Events

    // Modifiers
    modifier onlyOneZero() {
        require(msg.sender == oneZeroContractAddress, "Only OneZero contract can call this function");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyOneZeroOrOwner() {
        require(msg.sender == oneZeroContractAddress || msg.sender == owner, "Only OneZero and owner can call this function");
        _;
    }

    // Constructor
    // - Store address of owner to state for access control
    constructor() {
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

    // Function to add OneZero contract address
    // - OneZero contract needs the address of this contract to call functions, therefore this contract is deployed first
    // - Function therefore required to specify the address of the OneZero contract for access control
    function setOneZeroAddress(address _oneZeroContractAddress) public onlyOwner() {
        oneZeroContractAddress = _oneZeroContractAddress;
    }

    // Function to retrieve all details for a binary option
    // - This can be broken down into multiple functions to retrieve specific details if required
    function readBinaryOption(uint256 _id) public onlyOneZeroOrOwner() view returns (sanitisedBinaryOption memory) {
        binaryOption storage option = binaryOptions[_id];

        return sanitisedBinaryOption({
            id: option.id,
            title: option.title,
            start: option.start,
            period: option.period,
            commissionRate: option.commissionRate,
            commissionCollected: option.commissionCollected,
            outcome: option.outcome,
            totalLongs: option.totalLongs,
            longStakers: option.longStakers,
            totalShorts: option.totalShorts,
            shortStakers: option.shortStakers
        });
    }

    // Function to retrieve all binary options that a user has participated in
    function readUserParticipatedOptions(address _user) public onlyOneZeroOrOwner() view returns (uint256[] memory) {
        return userParticipatedOptions[_user];
    }

    // Function to retrieve all active binary options
    // - Sorting may exceed gas limit if array is too large, hence sorting will be done off-chain by backend/frontend
    function readActiveBinaryOptions() public onlyOneZeroOrOwner() view returns (uint256[] memory) {
        return activeBinaryOptions; // not sorted
    }

    // Function to retrieve all concluded binary options
    // - Sorting may exceed gas limit if array is too large, hence sorting will be done off-chain by backend/frontend
    function readConcludedBinaryOptions() public onlyOneZeroOrOwner() view returns (uint256[] memory) {
        return concludedBinaryOptions; // not sorted
    }

    // Function to retrieve user's long position in a binary option
    function readUserLongPosition(uint256 _id, address _user) public onlyOneZeroOrOwner() view returns (uint256) {
        binaryOption storage option = binaryOptions[_id];
        return (option.longs[_user]);
    }

    // Function to retrieve user's long position in a binary option
    function readUserShortPosition(uint256 _id, address _user) public onlyOneZeroOrOwner() view returns (uint256) {
        binaryOption storage option = binaryOptions[_id];
        return (option.shorts[_user]);
    }

    // Function to retrieve current value of binaryOptionCounter
    function readBinaryOptionCounter() public onlyOneZeroOrOwner() view returns (uint256) {
        return binaryOptionCounter;
    }

    // Internal and private functions

    // Function to add a binary option
    function createBinaryOption(string memory _title, uint256 _start, uint256 _period, uint256 _commissionRate) public onlyOneZeroOrOwner() returns (bool) {
        // Instantiate binary option
        binaryOptions[binaryOptionCounter].id = binaryOptionCounter;
        binaryOptions[binaryOptionCounter].title = _title;
        binaryOptions[binaryOptionCounter].start = _start;
        binaryOptions[binaryOptionCounter].period = _period;
        binaryOptions[binaryOptionCounter].commissionRate = _commissionRate;
        binaryOptions[binaryOptionCounter].outcome = Outcome.notConcluded;

        activeBinaryOptions.push(binaryOptionCounter); // Add binary option to activeBinaryOptions array
        activeBinaryOptionsToIndex[binaryOptionCounter] = activeBinaryOptions.length - 1; // Record index of binary option in activeBinaryOptions array
        binaryOptionCounter++; // Increment binary option counter
        return true;
    }

    // Function contains logic that could potentially cost alot of gas
    // - Specifically, adding the id of the binary option to the userParticipatedOptions array could cost alot of gas if it gets too large
    // - Potential workaround: limit the history of binary options that a user has participated in
    function createPosition(uint256 _id, address _user, uint256 _amount, bool _predictedOutcome) public onlyOneZero() returns (bool) {
        binaryOption storage option = binaryOptions[_id]; // Retrieve binary option
        uint256 commission = _amount * option.commissionRate / BASIS_POINTS_DIVISOR;
        option.commissionCollected +=  commission; // Record commission

        bool previousLongPosition = option.longs[_user] != 0;
        bool previousShortPosition = option.shorts[_user] != 0;

        if (!previousLongPosition && !previousShortPosition) { // user's first time particiting in this particular binary option
            userParticipatedOptions[_user].push(_id); // Add binary option to user's participated options
        }

        if (_predictedOutcome) { // Opening long position
            if (!previousLongPosition) { // New long position
                option.longStakers.push(_user); // Record address of new long staker
            }
            option.longs[_user] += (_amount - commission); // Add long to user
            option.totalLongs += (_amount - commission); // Add long to total longs
        } else { // Opening short position
            if (!previousShortPosition) { // New short position
                option.shortStakers.push(_user);
            }
            option.shorts[_user] += (_amount - commission); // Add short to user
            option.totalShorts += (_amount - commission); // Add short to total short
        }

        return true;
    }

    // Function contains logic that could potentially cost alot of gas
    // - Specifically, removing the id of the concluded binary option from the activeBinaryOptions and adding it to the concludedBinaryOptions array could cost alot of gas if the arrays get too large
    // - Potential workaround: none on-chain but will be resolved if data storage is shifted off-chain
    function endBinaryOption(uint256 _id, bool _outcome) public onlyOneZeroOrOwner() returns (bool) {
        binaryOption storage option = binaryOptions[_id]; // Retrieve binary option
        if (_outcome) { // Outcome is true
            option.outcome = Outcome.long; // Set outcome to long
        } else { // Outcome is false
            option.outcome = Outcome.short; // Set outcome to short
        }
        // Remove concluded binary option from activeBinaryOptions array (specific steps taken to perform removal in O(1) time)
        uint256 index = activeBinaryOptionsToIndex[_id]; // Retrieve index of concluded binary option in activeBinaryOptions array
        uint256 lastElementId = activeBinaryOptions[activeBinaryOptions.length - 1]; // Retrieve id of last element in activeBinaryOptions array
        activeBinaryOptions[index] = lastElementId; // Replace concluded binary option with last element in activeBinaryOptions array
        activeBinaryOptionsToIndex[lastElementId] = index; // Update index of last element in activeBinaryOptions array
        activeBinaryOptions.pop(); // Remove last element in activeBinaryOptions array

        // Add concluded binary option to concludedBinaryOptions array
        concludedBinaryOptions.push(_id);

        return true;
    }
}
