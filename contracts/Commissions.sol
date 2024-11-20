// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./GovernanceToken.sol";
import "./TimeCheck.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract Commissions is ReentrancyGuard {
    using Math for uint256;

    GovernanceToken immutable governanceToken;
    TimeCheck immutable timeCheck;
    mapping(uint256 => uint256) periodTotalCommissions;
    mapping(address => uint256) userLastClaimedPeriod;
    uint256 immutable startTime;
    uint256 immutable commissionPeriodDuration;

    event CommissionDeposited(uint256 amount);
    event CommissionClaimed(address indexed user, uint256 amount);

    constructor(address _timeCheck, address _governanceToken, uint256 _commissionPeriodDuration) {
        timeCheck = TimeCheck(_timeCheck);
        startTime = timeCheck.viewTimeStamp();
        governanceToken = GovernanceToken(_governanceToken);
        commissionPeriodDuration = _commissionPeriodDuration;
    }

    // Receive commission payments
    receive() external payable {
        _distributeCommission();
    }

    function getCurrentPeriodIndex() public view returns (uint256) {
        uint256 currTime = timeCheck.viewTimeStamp();
        (, uint256 timeDelta) = currTime.trySub(startTime);
        (, uint256 periodIndex) = timeDelta.tryDiv(commissionPeriodDuration);
        return periodIndex;
    }

    function _distributeCommission() private {
        require(msg.value > 0, "Must send ETH");

        uint256 totalTokenSupply = governanceToken.totalSupply();
        require(totalTokenSupply > 0, "No governance tokens exist");

        uint256 currentPeriodIndex = getCurrentPeriodIndex();
        uint256 periodCommissions = periodTotalCommissions[currentPeriodIndex];
        (, periodCommissions) = periodCommissions.tryAdd(msg.value);
        periodTotalCommissions[currentPeriodIndex] = periodCommissions;

        emit CommissionDeposited(msg.value);
    }

    function calculatePeriodCommission(address _user, uint256 _periodIndex) private view returns (uint256) {
        uint256 userTokenBalance = governanceToken.balanceOf(_user);
        if (userTokenBalance == 0) {
            return 0;
        }

        uint256 totalPeriodCommission = periodTotalCommissions[_periodIndex];
        if (totalPeriodCommission == 0) {
            return 0;
        }

        uint256 totalTokenSupply = governanceToken.totalSupply();

        (, uint256 userShare) = userTokenBalance.tryMul(1e18);
        (, userShare) = userShare.tryDiv(totalTokenSupply);

        (, uint256 userCommission) = totalPeriodCommission.tryMul(userShare);
        (, userCommission) = userCommission.tryDiv(1e18);

        return userCommission;
    }

    function calculateUnclaimedCommission(address _user, uint256 _latestPeriod) private view returns (uint256) {
        uint256 lastClaimedPeriod = userLastClaimedPeriod[_user];
        require(lastClaimedPeriod <= _latestPeriod, "Invalid last claimed period");
        if (lastClaimedPeriod == _latestPeriod) {
            return 0;
        }

        uint256 totalUnclaimedCommission = 0;
        for (uint256 i = lastClaimedPeriod; i < _latestPeriod; i++) {
            uint256 periodCommission = calculatePeriodCommission(_user, i);
            (, totalUnclaimedCommission) = totalUnclaimedCommission.tryAdd(periodCommission);
        }

        return totalUnclaimedCommission;
    }

    function claimCommission() public nonReentrant {
        uint256 latestCompletedPeriod = getCurrentPeriodIndex() - 1;
        uint256 unclaimedAmount = calculateUnclaimedCommission(msg.sender, latestCompletedPeriod);
        require(unclaimedAmount > 0, "No commission to claim");

        userLastClaimedPeriod[msg.sender] = latestCompletedPeriod;

        (bool success,) = msg.sender.call{value: unclaimedAmount}("");
        require(success, "Transfer failed");

        emit CommissionClaimed(msg.sender, unclaimedAmount);
    }
}
