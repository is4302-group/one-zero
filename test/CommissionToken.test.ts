import {
    loadFixture,
    time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("CommissionToken", function () {
    async function deployCommissionTokenFixture() {
        const NAME = "CommissionToken";
        const SYMBOL = "CT";
        const CAP = BigInt(100e18);
        const COMMISSION_PERIOD_DURATION = 10; // 10 seconds
        const COMMISSIONS = BigInt(10e10);

        const [marketAccount, owner, user1, user2] =
            await hre.ethers.getSigners();

        const commissionToken = await hre.ethers.deployContract(
            "CommissionToken",
            [NAME, SYMBOL, CAP, COMMISSION_PERIOD_DURATION],
            owner,
        );

        await commissionToken.connect(owner).setMarket(marketAccount.address);

        await commissionToken
            .connect(owner)
            .transfer(user1.address, BigInt(50e18));

        await commissionToken
            .connect(marketAccount)
            .distributeCommission({ value: COMMISSIONS });

        return {
            commissionToken,
            marketAccount,
            owner,
            user1,
            user2,
        };
    }

    it("Should distribute commissions among existing token holders correctly", async function () {
        const { commissionToken, owner, user1 } = await loadFixture(
            deployCommissionTokenFixture,
        );

        await time.increase(60);

        await expect(commissionToken.connect(owner).claimCommission())
            .to.emit(commissionToken, "CommissionClaimed")
            .withArgs(owner.address, BigInt(5e10));

        await expect(commissionToken.connect(user1).claimCommission())
            .to.emit(commissionToken, "CommissionClaimed")
            .withArgs(user1.address, BigInt(5e10));
    });

    it("Should distribute commissions among new token holders correctly", async function () {
        const { commissionToken, marketAccount, owner, user2 } =
            await loadFixture(deployCommissionTokenFixture);

        await time.increase(60);

        await commissionToken
            .connect(owner)
            .transfer(user2.address, BigInt(20e18));

        await time.increase(60);

        await expect(
            commissionToken.connect(user2).claimCommission(),
        ).to.be.revertedWith("No commission to claim");

        await time.increase(60);

        await commissionToken
            .connect(marketAccount)
            .distributeCommission({ value: 10e10 });

        await time.increase(60);

        await expect(commissionToken.connect(user2).claimCommission())
            .to.emit(commissionToken, "CommissionClaimed")
            .withArgs(user2.address, BigInt(2e10));
    });
});
