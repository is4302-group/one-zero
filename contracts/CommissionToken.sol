// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./TimeCheck.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract CommissionToken is ReentrancyGuard, ERC20Capped {
    using Math for uint256;

    TimeCheck immutable timeCheck;
    mapping(uint256 => uint256) periodTotalCommissions;
    mapping(address => uint256) userLastClaimedPeriod;
    uint256 immutable startTime;
    uint256 immutable commissionPeriodDuration;
    address market;

    event CommissionDeposited(uint256 amount);
    event CommissionClaimed(address indexed user, uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _cap,
        uint256 _commissionPeriodDuration,
        address _timeCheck,
        address _market
    ) ERC20(_name, _symbol) ERC20Capped(_cap) {
        commissionPeriodDuration = _commissionPeriodDuration;
        market = _market;
        timeCheck = TimeCheck(_timeCheck);
        startTime = timeCheck.viewTimeStamp();
        _mint(msg.sender, _cap);
    }

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
        for (uint256 i = lastClaimedPeriod; i < latestCompletedPeriod; i++) {
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
        userLastClaimedPeriod[to] = getCurrentPeriodIndex();
        super._update(from, to, value);
    }

    function getCurrentPeriodIndex() public view returns (uint256) {
        uint256 currTime = timeCheck.viewTimeStamp();
        (, uint256 timeDelta) = currTime.trySub(startTime);
        (, uint256 periodIndex) = timeDelta.tryDiv(commissionPeriodDuration);
        return periodIndex;
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
}
