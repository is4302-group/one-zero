// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CommissionToken is ReentrancyGuard, ERC20Capped, Ownable {
    using Math for uint256;

    mapping(uint256 => uint256) periodTotalCommissions;
    mapping(address => uint256) userLastClaimedPeriod;
    uint256 immutable startTime;
    uint256 immutable commissionPeriodDuration;
    address market;

    event CommissionDeposited(uint256 amount);
    event CommissionClaimed(address indexed user, uint256 amount);

    constructor(string memory _name, string memory _symbol, uint256 _cap, uint256 _commissionPeriodDuration)
        ERC20(_name, _symbol)
        ERC20Capped(_cap)
        Ownable(msg.sender)
    {
        commissionPeriodDuration = _commissionPeriodDuration;
        startTime = block.timestamp;
        _mint(msg.sender, _cap);
    }

    // called when option is closed and market contract sends commissions to this contract
    function distributeCommission() public payable {
        require(msg.sender == market, "Only market contract can deposit commissions");

        uint256 currentPeriodIndex = getCurrentPeriodIndex();
        uint256 periodCommissions = periodTotalCommissions[currentPeriodIndex];
        (, periodCommissions) = periodCommissions.tryAdd(msg.value);
        periodTotalCommissions[currentPeriodIndex] = periodCommissions;

        emit CommissionDeposited(msg.value);
    }

    function claimCommission() public nonReentrant {
        uint256 userTokenBalance = balanceOf(msg.sender);
        require(userTokenBalance > 0, "No shares of commission owned");

        uint256 latestCompletedPeriod = getCurrentPeriodIndex() - 1;
        require(latestCompletedPeriod >= 0, "No completed periods");

        uint256 lastClaimedPeriod = userLastClaimedPeriod[msg.sender];
        require(lastClaimedPeriod <= latestCompletedPeriod, "Invalid last claimed period");

        uint256 totalUnclaimedCommission = 0;
        for (uint256 i = lastClaimedPeriod; i <= latestCompletedPeriod; i++) {
            uint256 periodCommission = calculatePeriodCommission(userTokenBalance, i);
            (, totalUnclaimedCommission) = totalUnclaimedCommission.tryAdd(periodCommission);
        }
        require(totalUnclaimedCommission > 0, "No commission to claim");

        userLastClaimedPeriod[msg.sender] = latestCompletedPeriod;

        (bool success,) = msg.sender.call{value: totalUnclaimedCommission}("");
        require(success, "Transfer failed");

        emit CommissionClaimed(msg.sender, totalUnclaimedCommission);
    }

    function _update(address from, address to, uint256 value) internal override {
        // initialise last claimed period of new holders to current period to prevent new holders from claiming legacy commissions
        if (userLastClaimedPeriod[to] == 0) {
            userLastClaimedPeriod[to] = getCurrentPeriodIndex();
        }
        super._update(from, to, value);
    }

    function getCurrentPeriodIndex() public view returns (uint256) {
        uint256 currTime = block.timestamp;
        (, uint256 timeDelta) = currTime.trySub(startTime);
        (, uint256 periodIndex) = timeDelta.tryDiv(commissionPeriodDuration);
        return periodIndex + 1; // deconflict with default value of mapping
    }

    function calculatePeriodCommission(uint256 _userTokenBalance, uint256 _periodIndex)
        private
        view
        returns (uint256)
    {
        uint256 totalPeriodCommission = periodTotalCommissions[_periodIndex];
        if (totalPeriodCommission == 0) {
            return 0;
        }

        (, uint256 userShare) = _userTokenBalance.tryMul(1e18);
        (, userShare) = userShare.tryDiv(totalSupply());

        (, uint256 userCommission) = totalPeriodCommission.tryMul(userShare);
        (, userCommission) = userCommission.tryDiv(1e18);

        return userCommission;
    }

    // - market contract needs the address of this contract to call functions, therefore this contract is deployed first
    // - Function therefore required to specify the address of the market contract for access control
    function setMarket(address _market) public onlyOwner {
        market = _market;
    }
}
