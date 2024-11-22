import {
    loadFixture,
    time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Market", function () {
    async function deployMarketFixture() {
        const NAME = "CommissionToken";
        const SYMBOL = "CT";
        const CAP = BigInt(100e18);
        const COMMISSION_PERIOD_DURATION = BigInt(10); // 10 seconds
        const MINIMUM_OPTION_DURATION = BigInt(1200); // 20 minutes
        const COMMISSIONS = BigInt(10e10);

        const [marketAccount, owner, user1, user2, user3, chainlinkKeeper] =
            await hre.ethers.getSigners();

        const commissionToken = await hre.ethers.deployContract(
            "CommissionToken",
            [NAME, SYMBOL, CAP, COMMISSION_PERIOD_DURATION],
            owner,
        );
        const commissionTokenAddress = await commissionToken.getAddress();

        await commissionToken
            .connect(owner)
            .transfer(user1.address, BigInt(50e18));

        await commissionToken
            .connect(marketAccount)
            .distributeCommission({ value: COMMISSIONS });

        const storage = await hre.ethers.deployContract("Storage", owner);
        const storageAddress = await storage.getAddress();

        const market = await hre.ethers.deployContract(
            "Market",
            [commissionTokenAddress, storageAddress, MINIMUM_OPTION_DURATION],
            owner,
        );
        const marketAddress = await market.getAddress();

        await market.connect(owner).updateAdmin(user1, true);
        await market.connect(owner).updateAdmin(user2, true);

        await commissionToken.connect(owner).setMarket(marketAddress);
        await storage.connect(owner).setMarket(marketAddress);

        return {
            commissionToken,
            market,
            owner,
            user1,
            user2,
            user3,
            chainlinkKeeper,
            MINIMUM_OPTION_DURATION,
        };
    }

    it("Should not allow non-owners to add admins", async function () {
        const { market, user1, user2 } = await loadFixture(deployMarketFixture);
        await expect(
            market.connect(user1).updateAdmin(user2.address, true),
        ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should allow owner to add admins", async function () {
        const { market, owner, user1 } = await loadFixture(deployMarketFixture);
        await expect(market.connect(owner).updateAdmin(user1.address, true)).to
            .not.be.reverted;
    });

    it("Should set admin status correctly", async function () {
        const { market, owner, user1 } = await loadFixture(deployMarketFixture);

        await market.connect(owner).updateAdmin(user1.address, false);
        expect(await market.isAdmin(user1.address)).to.be.false;

        await market.connect(owner).updateAdmin(user1.address, true);
        expect(await market.isAdmin(user1.address)).to.be.true;
    });

    it("Should not allow non-owners to transfer ownership", async function () {
        const { market, user1, user2 } = await loadFixture(deployMarketFixture);
        await expect(
            market.connect(user1).transferOwnership(user2.address),
        ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should allow owner to transfer ownership", async function () {
        const { market, owner, user1 } = await loadFixture(deployMarketFixture);
        await expect(market.connect(owner).transferOwnership(user1.address)).to
            .not.be.reverted;
    });

    it("Should transfer ownership correctly", async function () {
        const { market, owner, user1 } = await loadFixture(deployMarketFixture);
        await market.connect(owner).transferOwnership(user1.address);
        expect(await market.getOwner()).to.equal(user1.address);
    });

    it("Should not allow non-owners to update the minimum duration", async function () {
        const { market, user1 } = await loadFixture(deployMarketFixture);
        await expect(
            market.connect(user1).setMinimumDuration(1),
        ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should allow owner to update the minimum duration", async function () {
        const { market, owner } = await loadFixture(deployMarketFixture);
        await expect(market.connect(owner).setMinimumDuration(1)).to.not.be
            .reverted;
    });

    it("Should update the minimum duration correctly", async function () {
        const { market, owner } = await loadFixture(deployMarketFixture);
        await market.connect(owner).setMinimumDuration(1);
        expect(await market.getMinimumDuration()).to.equal(1);
    });

    it("Should retrieve binary options details correctly", async function () {
        const { market, owner, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        let binaryOption = await market.getBinaryOption(BigInt(0));
        expect(binaryOption.id).to.equal(BigInt(0));
        expect(binaryOption.title).to.equal(TITLE);
        expect(binaryOption.start).to.equal(START);
        expect(binaryOption.duration).to.equal(MINIMUM_OPTION_DURATION);
        expect(binaryOption.commissionRate).to.equal(COMMISSION_RATE);
        expect(binaryOption.commissionCollected).to.equal(BigInt(0));
        expect(binaryOption.outcome).to.equal(BigInt(0));
        expect(binaryOption.totalLongs).to.equal(BigInt(0));
        expect(binaryOption.longStakers).to.be.empty;
        expect(binaryOption.totalShorts).to.equal(BigInt(0));
        expect(binaryOption.shortStakers).to.be.empty;
    });

    it("Should retrieve the correct list of binary options a user has participated in", async function () {
        const { market, owner, user1, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(20);
        await market.connect(user1).addPosition(BigInt(0), true, {
            value: BigInt(1e18),
        });
        await market.connect(user1).addPosition(BigInt(1), true, {
            value: BigInt(1e18),
        });
        let userParticipatedOptions = await market
            .connect(user1)
            .getUserParticipatedOptions();
        expect(userParticipatedOptions).to.have.lengthOf(2);
        expect(userParticipatedOptions[0]).to.equal(BigInt(0));
        expect(userParticipatedOptions[1]).to.equal(BigInt(1));
    });

    it("Should retrieve the correct list of active binary options", async function () {
        const { market, owner, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        let activeOptions = await market.getActiveBinaryOptions();
        expect(activeOptions).to.have.lengthOf(2);
        expect(activeOptions[0]).to.equal(BigInt(0));
        expect(activeOptions[1]).to.equal(BigInt(1));
    });

    it("Should retrieve the correct list of concluded binary options", async function () {
        const { market, owner, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(1220);
        await market.performUpkeep(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256[]"],
                [[BigInt(0), BigInt(1)]],
            ),
        );
        let concludedBinaryOptions = await market.getConcludedBinaryOptions();
        expect(concludedBinaryOptions).to.have.lengthOf(2);
        expect(concludedBinaryOptions[0]).to.equal(BigInt(0));
        expect(concludedBinaryOptions[1]).to.equal(BigInt(1));
    });

    it("Should retrieve the correct details of a user's long position", async function () {
        const { market, owner, user1, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(20);
        await market.connect(user1).addPosition(BigInt(0), true, {
            value: BigInt(1e18),
        });
        let longPosition = await market.getUserLongPosition(
            BigInt(0),
            user1.address,
        );
        expect(longPosition).to.equal(
            BigInt(1e18 * (1 - Number(COMMISSION_RATE) / 10000)),
        );
    });

    it("Should retrieve the correct details of a user's short position", async function () {
        const { market, owner, user1, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(20);
        await market.connect(user1).addPosition(BigInt(0), false, {
            value: BigInt(1e18),
        });
        let shortPosition = await market.getUserShortPosition(
            BigInt(0),
            user1.address,
        );
        expect(shortPosition).to.equal(
            BigInt(1e18 * (1 - Number(COMMISSION_RATE) / 10000)),
        );
    });

    it("Should not allow non-owner and non-admins to add binary options", async function () {
        const { market, user1, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await expect(
            market
                .connect(user1)
                .addBinaryOption(
                    TITLE,
                    START,
                    MINIMUM_OPTION_DURATION,
                    COMMISSION_RATE,
                ),
        ).to.be.revertedWith("Only owner and admins can call this function");
    });

    it("Should allow owner to add binary options", async function () {
        const { market, owner, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await expect(
            market
                .connect(owner)
                .addBinaryOption(
                    TITLE,
                    START,
                    MINIMUM_OPTION_DURATION,
                    COMMISSION_RATE,
                ),
        ).to.not.be.reverted;
    });

    it("Should allow admins to add binary options", async function () {
        const { market, user1, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await expect(
            market
                .connect(user1)
                .addBinaryOption(
                    TITLE,
                    START,
                    MINIMUM_OPTION_DURATION,
                    COMMISSION_RATE,
                ),
        ).to.not.be.reverted;
    });

    // Creating the binary option correctly has been tested as part of checking that the getter function can retrieve the correct details of a binary option

    // Adding positions correctly has been tested as part of checking that the getter functions can retrieve the correct details of a user's long or short position

    it("Should return false when chainlink keeper calls checkUpkeep and there are no options past their expiry", async function () {
        const { market, owner, chainlinkKeeper, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );

        // Before option starts, checkUpkeep should return false
        let checkUpkeepFirstResponse = await market
            .connect(chainlinkKeeper)
            .checkUpkeep(hre.ethers.AbiCoder.defaultAbiCoder().encode([], []));
        expect(checkUpkeepFirstResponse[0]).to.be.false;
        expect(checkUpkeepFirstResponse[1]).to.equal(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]"], [[]]),
        );

        await time.increase(20);

        // After option starts, checkUpkeep should also return false
        let checkUpkeepSecondResponse = await market
            .connect(chainlinkKeeper)
            .checkUpkeep(hre.ethers.AbiCoder.defaultAbiCoder().encode([], []));
        expect(checkUpkeepSecondResponse[0]).to.be.false;
        expect(checkUpkeepSecondResponse[1]).to.equal(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]"], [[]]),
        );
    });

    it("Should return true when chainlink keeper calls checkUpkeep and there are options past their expiry", async function () {
        const { market, owner, chainlinkKeeper, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION + BigInt(500),
                COMMISSION_RATE,
            );

        await time.increase(1220);

        // checkUpkeep should return True, but identify that only the first option needs to be concluded
        let checkUpkeepFirstResponse = await market
            .connect(chainlinkKeeper)
            .checkUpkeep(hre.ethers.AbiCoder.defaultAbiCoder().encode([], []));
        expect(checkUpkeepFirstResponse[0]).to.be.true;
        expect(checkUpkeepFirstResponse[1]).to.equal(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256[]"],
                [[BigInt(0)]],
            ),
        );

        await time.increase(520);

        // checkUpkeep should return True and now identify that both options need to be concluded
        let checkUpkeepSecondResponse = await market
            .connect(chainlinkKeeper)
            .checkUpkeep(hre.ethers.AbiCoder.defaultAbiCoder().encode([], []));
        expect(checkUpkeepSecondResponse[0]).to.be.true;
        expect(checkUpkeepSecondResponse[1]).to.equal(
            hre.ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256[]"],
                [[BigInt(0), BigInt(1)]],
            ),
        );
    });

    it("Should not allow performUpkeep to conclude options prematurely", async function () {
        const { market, owner, user1, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(20);
        // Even if performUpkeep is called by a malicious party with the correct parameters, it should not be able to conclude the option prematurely
        await expect(
            market
                .connect(user1)
                .performUpkeep(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.be.revertedWith("Duration for binary option has not passed");
    });

    it("Should not throw any errors if binary option concludes without any stakers", async function () {
        const { market, owner, chainlinkKeeper, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION + BigInt(500),
                COMMISSION_RATE,
            );
        await time.increase(1220);
        await expect(
            market
                .connect(chainlinkKeeper)
                .performUpkeep(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.not.be.reverted;
    });

    it("Should not throw any errors if binary option concludes without any winners", async function () {
        const {
            market,
            owner,
            user1,
            chainlinkKeeper,
            MINIMUM_OPTION_DURATION,
        } = await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION + BigInt(500),
                COMMISSION_RATE,
            );
        await time.increase(20);
        await market
            .connect(user1)
            .addPosition(BigInt(0), false, { value: BigInt(1e18) }); // addr1 goes short with 1 ether
        await time.increase(1200);
        await expect(
            market
                .connect(chainlinkKeeper)
                .performUpkeep(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.not.be.reverted;
    });

    it("Should not allow performUpkeep to conclude an option multiple times", async function () {
        const {
            market,
            owner,
            user1,
            chainlinkKeeper,
            MINIMUM_OPTION_DURATION,
        } = await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(1220);
        await market
            .connect(chainlinkKeeper)
            .performUpkeep(
                hre.ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256[]"],
                    [[BigInt(0)]],
                ),
            );
        // Even if performUpkeep is called by a malicious party with the correct parameters, it should not be able to conclude the option multiple times
        await expect(
            market
                .connect(user1)
                .performUpkeep(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.be.revertedWith("Binary option has already been concluded");
    });

    it("Should pay out commissions correctly when an option is concluded and there are winners", async function () {
        const {
            commissionToken,
            market,
            owner,
            user3,
            chainlinkKeeper,
            MINIMUM_OPTION_DURATION,
        } = await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(20);
        await market
            .connect(user3)
            .addPosition(BigInt(0), true, { value: BigInt(3e18) }); // addr3 goes long with 3 ether, total commission = 0.003 ether
        await time.increase(1220);
        await expect(
            market
                .connect(chainlinkKeeper)
                .performUpkeep(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.changeEtherBalance(commissionToken, BigInt(0.003 * 1e18));
    });

    it("Should pay out commissions correctly when an option is concluded and there are no winners", async function () {
        const {
            commissionToken,
            market,
            owner,
            user3,
            chainlinkKeeper,
            MINIMUM_OPTION_DURATION,
        } = await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(20);
        await market
            .connect(user3)
            .addPosition(BigInt(0), false, { value: BigInt(3e18) }); // addr3 goes long with 3 ether, total commission = 0.003 ether
        await time.increase(1220);
        await expect(
            market
                .connect(chainlinkKeeper)
                .performUpkeep(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.changeEtherBalance(commissionToken, BigInt(0.003 * 1e18));
    });

    it("Should pay out winnings correctly when an option is concluded (multiple winners, single loser)", async function () {
        const {
            market,
            owner,
            user1,
            user2,
            user3,
            chainlinkKeeper,
            MINIMUM_OPTION_DURATION,
        } = await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(20);
        await market
            .connect(user1)
            .addPosition(BigInt(0), true, { value: BigInt(1e18) }); // user1 goes long with 1 ether
        await market
            .connect(user2)
            .addPosition(BigInt(0), true, { value: BigInt(2e18) }); // user2 goes long with 2 ether
        await market
            .connect(user3)
            .addPosition(BigInt(0), false, { value: BigInt(3e18) }); // user3 goes short with 3 ether
        await time.increase(1220);
        expect(
            await market
                .connect(chainlinkKeeper)
                .performUpkeep(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.changeEtherBalances(
            [owner, user1, user2, user3],
            [
                0, // Owner should not have received any winnings since they did not participate
                (((BigInt(1e18 + 2e18 + 3e18) *
                    (BigInt(10000) - COMMISSION_RATE)) /
                    BigInt(10000)) *
                    BigInt(1)) /
                    BigInt(3), // Longs won so addr1 should receive 1/3 of the total longs and shorts (less commission)
                (((BigInt(1e18 + 2e18 + 3e18) *
                    (BigInt(10000) - COMMISSION_RATE)) /
                    BigInt(10000)) *
                    BigInt(2)) /
                    BigInt(3), // Longs won so addr2 should receive 2/3 of the total longs and shorts (less commission)
                0, // Shorts lost so addr3 should not receive anything
            ],
        );
    });

    it("Should pay out winnings correctly when an option is concluded (single winner, multiple losers)", async function () {
        const {
            market,
            owner,
            user1,
            user2,
            user3,
            chainlinkKeeper,
            MINIMUM_OPTION_DURATION,
        } = await loadFixture(deployMarketFixture);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await market
            .connect(owner)
            .addBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await time.increase(20);
        await market
            .connect(user1)
            .addPosition(BigInt(0), false, { value: BigInt(1e18) }); // user1 goes long with 1 ether
        await market
            .connect(user2)
            .addPosition(BigInt(0), false, { value: BigInt(2e18) }); // user2 goes long with 2 ether
        await market
            .connect(user3)
            .addPosition(BigInt(0), true, { value: BigInt(3e18) }); // user3 goes short with 3 ether
        await time.increase(1220);
        expect(
            await market
                .connect(chainlinkKeeper)
                .performUpkeep(
                    hre.ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.changeEtherBalances(
            [owner, user1, user2, user3],
            [
                0, // Owner should not have received any winnings since they did not participate
                0, // Longs lost so addr1 should not receive anything
                0, // Longs lost so addr2 should not receive anything
                (BigInt(1e18 + 2e18 + 3e18) *
                    (BigInt(10000) - COMMISSION_RATE)) /
                    BigInt(10000), // Longs won so addr3 will receive the full amount (less commission) since only addr3 won
            ],
        );
    });

    // Not possible to write unit tests for shorts winning since the outcome retrieved in the script is currently hardcoded to true
    // - The following tests have been commented out since they are not possible to test
    // - However, if the OneZero.sol is amended to always set outcome to false, the tests will pass

    //     it("Should pay out winnings correctly when an option is concluded (no oz token holders, shorts win, multiple winners, single loser)", async function () {
    //         const TITLE: string = "test binary option";
    //         const DURATION: bigint = MINIMUM_DURATION;
    //         let latestBlock = await ethers.provider.getBlock("latest");
    //         if (latestBlock === null) {
    //             throw new Error("Failed to fetch the latest block.");
    //         }
    //         const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
    //         const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
    //         await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
    //         await network.provider.send("evm_increaseTime", [20]);
    //         await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
    //         await oneZero.connect(addr1).addPosition(BigInt(0), false, {value: BigInt(1e18)}); // addr1 goes short with 1 ether
    //         await oneZero.connect(addr2).addPosition(BigInt(0), false, {value: BigInt(2e18)}); // addr2 goes short with 2 ether
    //         await oneZero.connect(addr3).addPosition(BigInt(0), true, {value: BigInt(3e18)}); // addr3 goes long with 3 ether
    //         await network.provider.send("evm_increaseTime", [1220]);
    //         await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
    //         let ownerBalanceBeforeWinnings = await ethers.provider.getBalance(owner.address);
    //         let addr1BalanceBeforeWinnings = await ethers.provider.getBalance(addr1.address);
    //         let addr2BalanceBeforeWinnings = await ethers.provider.getBalance(addr2.address);
    //         let addr3BalanceBeforeWinnings = await ethers.provider.getBalance(addr3.address);
    //         await oneZero.connect(dummyChainlinkKeeper).performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]"], [[BigInt(0)]]));
    //         expect (await ethers.provider.getBalance(owner.address)).to.equal(ownerBalanceBeforeWinnings); // Owner should not have received any winnings since they did not participate
    //         expect (await ethers.provider.getBalance(addr1.address)).to.equal(addr1BalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * (BigInt(10000) - COMMISSION_RATE) / BigInt(10000) * BigInt(1) / BigInt(3)); // Shorts won so addr1 should receive 1/3 of the total longs and shorts (less commission)
    //         expect (await ethers.provider.getBalance(addr2.address)).to.equal(addr2BalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * (BigInt(10000) - COMMISSION_RATE) / BigInt(10000) * BigInt(2) / BigInt(3)); // Shorts won so addr2 should receive 2/3 of the total longs and shorts (less commission)
    //         expect (await ethers.provider.getBalance(addr3.address)).to.equal(addr3BalanceBeforeWinnings); // Longs lost so addr3 should not receive anything
    //     });

    //     it("Should pay out winnings correctly when an option is concluded (no oz token holders, shorts win, single winner, multiple losers)", async function () {
    //         const TITLE: string = "test binary option";
    //         const DURATION: bigint = MINIMUM_DURATION;
    //         let latestBlock = await ethers.provider.getBlock("latest");
    //         if (latestBlock === null) {
    //             throw new Error("Failed to fetch the latest block.");
    //         }
    //         const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
    //         const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
    //         await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
    //         await network.provider.send("evm_increaseTime", [20]);
    //         await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
    //         await oneZero.connect(addr1).addPosition(BigInt(0), true, {value: BigInt(1e18)}); // addr1 goes long with 1 ether
    //         await oneZero.connect(addr2).addPosition(BigInt(0), true, {value: BigInt(2e18)}); // addr2 goes long with 2 ether
    //         await oneZero.connect(addr3).addPosition(BigInt(0), false, {value: BigInt(3e18)}); // addr3 goes short with 3 ether
    //         await network.provider.send("evm_increaseTime", [1220]);
    //         await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
    //         let ownerBalanceBeforeWinnings = await ethers.provider.getBalance(owner.address);
    //         let addr1BalanceBeforeWinnings = await ethers.provider.getBalance(addr1.address);
    //         let addr2BalanceBeforeWinnings = await ethers.provider.getBalance(addr2.address);
    //         let addr3BalanceBeforeWinnings = await ethers.provider.getBalance(addr3.address);
    //         await oneZero.connect(dummyChainlinkKeeper).performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]"], [[BigInt(0)]]));
    //         expect (await ethers.provider.getBalance(owner.address)).to.equal(ownerBalanceBeforeWinnings); // Owner should not have received any winnings since they did not participate
    //         expect (await ethers.provider.getBalance(addr1.address)).to.equal(addr1BalanceBeforeWinnings); // Longs lost so addr1 should not receive anything
    //         expect (await ethers.provider.getBalance(addr2.address)).to.equal(addr2BalanceBeforeWinnings); // Longs lost so addr2 should not receive anything
    //         expect (await ethers.provider.getBalance(addr3.address)).to.equal(addr3BalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * (BigInt(10000) - COMMISSION_RATE) / BigInt(10000)); // Shorts won so addr3 will receive the full amount (less commission) since only addr3 won
    //     });

    //     it("Should pay out winnings correctly when an option is concluded (multiple oz token holders, shorts win, multiple winners, single loser)", async function () {
    //         await oz.connect(owner).mint({
    //             value: BigInt(2e18)
    //         }); // mint 2,000 OZ tokens for owner
    //         await oz.connect(addr1).mint({
    //             value: BigInt(1e18)
    //         }); // mint 1,000 OZ tokens for addr1
    //         await oz.connect(addr3).mint({
    //             value: BigInt(1e18)
    //         }) // mint 1,000 OZ tokens for addr3
    //         const TITLE: string = "test binary option";
    //         const DURATION: bigint = MINIMUM_DURATION;
    //         let latestBlock = await ethers.provider.getBlock("latest");
    //         if (latestBlock === null) {
    //             throw new Error("Failed to fetch the latest block.");
    //         }
    //         const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
    //         const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
    //         await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
    //         await network.provider.send("evm_increaseTime", [20]);
    //         await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
    //         await oneZero.connect(addr1).addPosition(BigInt(0), false, {value: BigInt(1e18)}); // addr1 goes short with 1 ether
    //         await oneZero.connect(addr2).addPosition(BigInt(0), false, {value: BigInt(2e18)}); // addr2 goes short with 2 ether
    //         await oneZero.connect(addr3).addPosition(BigInt(0), true, {value: BigInt(3e18)}); // addr3 goes long with 3 ether
    //         await network.provider.send("evm_increaseTime", [1220]);
    //         await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
    //         let ownerBalanceBeforeWinnings = await ethers.provider.getBalance(owner.address);
    //         let addr1BalanceBeforeWinnings = await ethers.provider.getBalance(addr1.address);
    //         let addr2BalanceBeforeWinnings = await ethers.provider.getBalance(addr2.address);
    //         let addr3BalanceBeforeWinnings = await ethers.provider.getBalance(addr3.address);
    //         await oneZero.connect(dummyChainlinkKeeper).performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]"], [[BigInt(0)]]));
    //         expect (await ethers.provider.getBalance(owner.address)).to.equal(ownerBalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE / BigInt(10000) * BigInt(2000) / BigInt(4000)); // Owner does not receive any winnings but will receive commission of 1/2 of 0.006 ether commission
    //         expect (await ethers.provider.getBalance(addr1.address)).to.equal(addr1BalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * (BigInt(10000) - COMMISSION_RATE) / BigInt(10000) * BigInt(1) / BigInt(3) + BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE / BigInt(10000) * BigInt(1000) / BigInt(4000)); // Shorts won so addr1 should receive 1/3 of the total longs and shorts (less commission) and 1/4 of 0.006 ether commission
    //         expect (await ethers.provider.getBalance(addr2.address)).to.equal(addr2BalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * (BigInt(10000) - COMMISSION_RATE) / BigInt(10000) * BigInt(2) / BigInt(3)); // Shorts won so addr2 should receive 2/3 of the total longs and shorts (less commission) but no commission since addr2 does not hold any oz tokens
    //         expect (await ethers.provider.getBalance(addr3.address)).to.equal(addr3BalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE / BigInt(10000) * BigInt(1000) / BigInt(4000)); // Longs lost so addr3 should not receive winnings but will receive 1/4 of 0.006 ether commission
    //     });

    //     it("Should pay out winnings correctly when an option is concluded (multiple oz token holders, shorts win, single winner, multiple losers)", async function () {
    //         await oz.connect(owner).mint({
    //             value: BigInt(2e18)
    //         }); // mint 2,000 OZ tokens for owner
    //         await oz.connect(addr1).mint({
    //             value: BigInt(1e18)
    //         }); // mint 1,000 OZ tokens for addr1
    //         await oz.connect(addr3).mint({
    //             value: BigInt(1e18)
    //         }) // mint 1,000 OZ tokens for addr3
    //         const TITLE: string = "test binary option";
    //         const DURATION: bigint = MINIMUM_DURATION;
    //         let latestBlock = await ethers.provider.getBlock("latest");
    //         if (latestBlock === null) {
    //             throw new Error("Failed to fetch the latest block.");
    //         }
    //         const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
    //         const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
    //         await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
    //         await network.provider.send("evm_increaseTime", [20]);
    //         await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
    //         await oneZero.connect(addr1).addPosition(BigInt(0), true, {value: BigInt(1e18)}); // addr1 goes long with 1 ether
    //         await oneZero.connect(addr2).addPosition(BigInt(0), true, {value: BigInt(2e18)}); // addr2 goes long with 2 ether
    //         await oneZero.connect(addr3).addPosition(BigInt(0), false, {value: BigInt(3e18)}); // addr3 goes short with 3 ether
    //         await network.provider.send("evm_increaseTime", [1220]);
    //         await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
    //         let ownerBalanceBeforeWinnings = await ethers.provider.getBalance(owner.address);
    //         let addr1BalanceBeforeWinnings = await ethers.provider.getBalance(addr1.address);
    //         let addr2BalanceBeforeWinnings = await ethers.provider.getBalance(addr2.address);
    //         let addr3BalanceBeforeWinnings = await ethers.provider.getBalance(addr3.address);
    //         await oneZero.connect(dummyChainlinkKeeper).performUpkeep(ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]"], [[BigInt(0)]]));
    //         expect (await ethers.provider.getBalance(owner.address)).to.equal(ownerBalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE / BigInt(10000) * BigInt(2000) / BigInt(4000)); // Owner does not receive any winnings but will receive commission of 1/2 of 0.006 ether commission
    //         expect (await ethers.provider.getBalance(addr1.address)).to.equal(addr1BalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE / BigInt(10000) * BigInt(1000) / BigInt(4000)); // Longs lost so addr1 should not receive winnings but will receive 1/4 of 0.006 ether commission
    //         expect (await ethers.provider.getBalance(addr2.address)).to.equal(addr2BalanceBeforeWinnings); // Longs lost so addr2 should not receive winnings and will also not receive any commissions since addr2 does not hold any oz tokens
    //         expect (await ethers.provider.getBalance(addr3.address)).to.equal(addr3BalanceBeforeWinnings + BigInt(1e18 + 2e18 + 3e18) * (BigInt(10000) - COMMISSION_RATE) / BigInt(10000) + BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE / BigInt(10000) * BigInt(1000) / BigInt(4000)); // Shorts won so addr3 will receive the full amount (less commission) since only addr3 won and will also receive 1/4 of 0.006 ether commission
    //     });
});
