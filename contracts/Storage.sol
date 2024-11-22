// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract Storage {
    uint256 private BASIS_POINTS_DIVISOR = 10000;
    address private market;
    address private owner;
    mapping(uint256 => binaryOption) private binaryOptions;
    mapping(address => uint256[]) private userParticipatedOptions;
    uint256 private binaryOptionCounter;
    uint256[] private activeBinaryOptions;
    mapping(uint256 => uint256) private activeBinaryOptionsToIndex;
    uint256[] private concludedBinaryOptions;

    enum Outcome {
        notConcluded,
        long,
        short
    }

    struct binaryOption {
        uint256 id;
        string title;
        uint256 start;
        uint256 duration; // Duration of binary option in seconds
        uint256 commissionRate; // Percentage of bet in basis points
        uint256 commissionCollected; // Total commission collected in wei
        Outcome outcome;
        uint256 totalLongs; // Total amount of long stake
        mapping(address => uint256) longs; // Mapping of addresses to long stakes
        address[] longStakers; // Array of addresses which have staked in a long position
        uint256 totalShorts; // Total amount of short stake
        mapping(address => uint256) shorts; // Mapping of addresses to short stakes
        address[] shortStakers; // Array of addresses which have staked in a short position
    }

    struct sanitisedBinaryOption {
        uint256 id;
        string title;
        uint256 start;
        uint256 duration; // Duration of binary option in seconds
        uint256 commissionRate; // Percentage of bet in basis points
        uint256 commissionCollected; // Total commission collected in USDC (i.e., 1e6)
        Outcome outcome;
        uint256 totalLongs; // Total amount of long stake
        address[] longStakers; // Array of addresses which have staked in a long position
        uint256 totalShorts; // Total amount of short stake
        address[] shortStakers; // Array of addresses which have staked in a short position
    }

    modifier onlyMarket() {
        require(msg.sender == market, "Only market contract can call this function");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyMarketOrOwner() {
        require(msg.sender == market || msg.sender == owner, "Only market and owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    receive() external payable {
        revert("Contract does not accept Ether");
    }

    fallback() external payable {
        revert("Function does not exist");
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function getMarket() public view returns (address) {
        return market;
    }

    // - market contract needs the address of this contract to call functions, therefore this contract is deployed first
    // - Function therefore required to specify the address of the market contract for access control
    function setMarket(address _market) public onlyOwner {
        market = _market;
    }

    // - We decided to return the entire sanitised struct in a single getter function to reduce the number of calls required
    // - Currently, market only requires individual components at a specific time
    // - However, the front end will require all the information at once to display the binary option and its details
    // - Therefore it is more gas efficient to make a single call to retrieve all the information
    function readBinaryOption(uint256 _id) public view onlyMarketOrOwner returns (sanitisedBinaryOption memory) {
        binaryOption storage option = binaryOptions[_id];

        return sanitisedBinaryOption({
            id: option.id,
            title: option.title,
            start: option.start,
            duration: option.duration,
            commissionRate: option.commissionRate,
            commissionCollected: option.commissionCollected,
            outcome: option.outcome,
            totalLongs: option.totalLongs,
            longStakers: option.longStakers,
            totalShorts: option.totalShorts,
            shortStakers: option.shortStakers
        });
    }

    function readUserParticipatedOptions(address _user) public view onlyMarketOrOwner returns (uint256[] memory) {
        return userParticipatedOptions[_user];
    }

    // - Sorting may exceed gas limit if array is too large, hence sorting will be done off-chain by backend/frontend
    function readActiveBinaryOptions() public view onlyMarketOrOwner returns (uint256[] memory) {
        return activeBinaryOptions; // not sorted
    }

    // - Sorting may exceed gas limit if array is too large, hence sorting will be done off-chain by backend/frontend
    function readConcludedBinaryOptions() public view onlyMarketOrOwner returns (uint256[] memory) {
        return concludedBinaryOptions; // not sorted
    }

    function readUserLongPosition(uint256 _id, address _user) public view onlyMarketOrOwner returns (uint256) {
        binaryOption storage option = binaryOptions[_id];
        return (option.longs[_user]);
    }

    function readUserShortPosition(uint256 _id, address _user) public view onlyMarketOrOwner returns (uint256) {
        binaryOption storage option = binaryOptions[_id];
        return (option.shorts[_user]);
    }

    function readBinaryOptionCounter() public view onlyMarketOrOwner returns (uint256) {
        return binaryOptionCounter;
    }

    function createBinaryOption(string memory _title, uint256 _start, uint256 _duration, uint256 _commissionRate)
        public
        onlyMarket
        returns (bool)
    {
        // Instantiate binary option
        binaryOptions[binaryOptionCounter].id = binaryOptionCounter;
        binaryOptions[binaryOptionCounter].title = _title;
        binaryOptions[binaryOptionCounter].start = _start;
        binaryOptions[binaryOptionCounter].duration = _duration;
        binaryOptions[binaryOptionCounter].commissionRate = _commissionRate;
        binaryOptions[binaryOptionCounter].outcome = Outcome.notConcluded;

        activeBinaryOptions.push(binaryOptionCounter); // Add binary option to activeBinaryOptions array
        activeBinaryOptionsToIndex[binaryOptionCounter] = activeBinaryOptions.length - 1; // Record index of binary option in activeBinaryOptions array
        binaryOptionCounter++; // Increment binary option counter
        return true;
    }

    // - adding the id of the binary option to the userParticipatedOptions array could cost alot of gas if it gets too large
    // - Potential workaround: limit the history of binary options that a user has participated in
    function createPosition(uint256 _id, address _user, uint256 _amount, bool _predictedOutcome)
        public
        onlyMarket
        returns (bool)
    {
        binaryOption storage option = binaryOptions[_id]; // Retrieve binary option
        uint256 commission = _amount * option.commissionRate / BASIS_POINTS_DIVISOR;
        option.commissionCollected += commission; // Record commission

        bool previousLongPosition = option.longs[_user] != 0;
        bool previousShortPosition = option.shorts[_user] != 0;

        if (!previousLongPosition && !previousShortPosition) {
            // User's first time particiting in this particular binary option
            userParticipatedOptions[_user].push(_id); // Add binary option to user's participated options
        }

        if (_predictedOutcome) {
            // Opening long position
            if (!previousLongPosition) {
                // New long position
                option.longStakers.push(_user); // Record address of new long staker
            }
            option.longs[_user] += (_amount - commission); // Add long to user
            option.totalLongs += (_amount - commission); // Add long to total longs
        } else {
            // Opening short position
            if (!previousShortPosition) {
                // New short position
                option.shortStakers.push(_user);
            }
            option.shorts[_user] += (_amount - commission); // Add short to user
            option.totalShorts += (_amount - commission); // Add short to total short
        }

        return true;
    }

    // - removing the id of the concluded binary option from the activeBinaryOptions and adding it to the concludedBinaryOptions array could cost alot of gas if the arrays get too large
    // - Potential workaround: none on-chain but will be resolved if data storage is shifted off-chain
    function endBinaryOption(uint256 _id, bool _outcome) public onlyMarket returns (bool) {
        binaryOption storage option = binaryOptions[_id]; // Retrieve binary option
        if (_outcome) {
            // Outcome is true
            option.outcome = Outcome.long; // Set outcome to long
        } else {
            // Outcome is false
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
