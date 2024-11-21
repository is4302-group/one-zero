import { ethers, network } from "hardhat";
import { expect } from "chai";

describe("Market", function () {
    let OneZero: any;
    let oneZero: any;
    let OZ: any;
    let oz: any;
    let Storage: any;
    let storage: any;
    let owner: any;
    let addr1: any;
    let addr2: any;
    let addr3: any;
    let dummyChainlinkKeeper: any;
    const MINIMUM_DURATION: bigint = BigInt(1200);

    beforeEach(async function () {
        OneZero = await ethers.getContractFactory("OneZero");
        OZ = await ethers.getContractFactory("OZ");
        Storage = await ethers.getContractFactory("Storage");
        [owner, addr1, addr2, addr3, dummyChainlinkKeeper] =
            await ethers.getSigners();
        const NAME = "One Zero";
        const SYMBOL = "OZ";
        const CAP = ethers.parseUnits("1.0", 24);
        const EXCHANGE_RATE = ethers.parseUnits("1.0", 15);
        const OWNER_INITIAL_ALLOCATION: bigint = BigInt(0); // 0 OZ for testing purposes
        oz = await OZ.deploy(
            NAME,
            SYMBOL,
            CAP,
            EXCHANGE_RATE,
            OWNER_INITIAL_ALLOCATION,
        );
        await oz.waitForDeployment();
        storage = await Storage.deploy();
        await storage.waitForDeployment();
        oneZero = await OneZero.deploy(
            oz.getAddress(),
            storage.getAddress(),
            MINIMUM_DURATION,
        );
        await oneZero.waitForDeployment();
        await storage.setOneZeroAddress(oneZero.getAddress());
    });

    it("Should deploy the contract correctly", async function () {
        expect(await oneZero.getAddress()).to.properAddress;
    });

    it("Should initialise the OZ address correctly", async function () {
        expect(await oneZero.getOZAddress()).to.equal(await oz.getAddress());
    });

    it("Should initialise the storage address correctly", async function () {
        expect(await oneZero.getStorageAddress()).to.equal(
            await storage.getAddress(),
        );
    });

    it("Should initialise the owner correctly", async function () {
        expect(await oneZero.getOwner()).to.equal(owner.address);
    });

    it("Should initialise the minimum duration correctly", async function () {
        expect(await oneZero.getMinimumDuration()).to.equal(MINIMUM_DURATION);
    });

    it("Should initialise the admin mapping correctly", async function () {
        expect(await oneZero.isAdmin(addr1.address)).to.be.false;
        expect(await oneZero.isAdmin(addr2.address)).to.be.false;
        expect(await oneZero.isAdmin(addr3.address)).to.be.false;
    });

    it("Should not allow non-owners to add admins", async function () {
        await expect(
            oneZero.connect(addr1).updateAdmin(addr2.address, true),
        ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should allow owner to add admins", async function () {
        await expect(oneZero.connect(owner).updateAdmin(addr1.address, true)).to
            .not.be.reverted;
    });

    it("Should set admin status correctly", async function () {
        await oneZero.connect(owner).updateAdmin(addr1.address, true);
        expect(await oneZero.isAdmin(addr1.address)).to.be.true;
        await oneZero.connect(owner).updateAdmin(addr1.address, false);
        expect(await oneZero.isAdmin(addr1.address)).to.be.false;
    });

    it("Should not allow non-owners to transfer ownership", async function () {
        await expect(
            oneZero.connect(addr1).transferOwnership(addr2.address),
        ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should allow owner to transfer ownership", async function () {
        await expect(oneZero.connect(owner).transferOwnership(addr1.address)).to
            .not.be.reverted;
    });

    it("Should transfer ownership correctly", async function () {
        await oneZero.connect(owner).transferOwnership(addr1.address);
        expect(await oneZero.getOwner()).to.equal(addr1.address);
    });

    // Storing and retrieving the minimum duration accurately has been tested as part of checking if the minimum duration has been initialised correctly

    it("Should not allow non-owners to update the minimum duration", async function () {
        await expect(
            oneZero.connect(addr1).setMinimumDuration(MINIMUM_DURATION),
        ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should allow owner to update the minimum duration", async function () {
        await expect(
            oneZero.connect(owner).setMinimumDuration(MINIMUM_DURATION),
        ).to.not.be.reverted;
    });

    it("Should update the minimum duration correctly", async function () {
        await oneZero.connect(owner).setMinimumDuration(MINIMUM_DURATION);
        expect(await oneZero.getMinimumDuration()).to.equal(MINIMUM_DURATION);
    });

    it("Should retrieve binary options details correctly", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        let binaryOption = await oneZero.getBinaryOption(BigInt(0));
        expect(binaryOption.id).to.equal(BigInt(0));
        expect(binaryOption.title).to.equal(TITLE);
        expect(binaryOption.start).to.equal(START);
        expect(binaryOption.duration).to.equal(DURATION);
        expect(binaryOption.commissionRate).to.equal(COMMISSION_RATE);
        expect(binaryOption.commissionCollected).to.equal(BigInt(0));
        expect(binaryOption.outcome).to.equal(BigInt(0));
        expect(binaryOption.totalLongs).to.equal(BigInt(0));
        expect(binaryOption.longStakers).to.be.empty;
        expect(binaryOption.totalShorts).to.equal(BigInt(0));
        expect(binaryOption.shortStakers).to.be.empty;
    });

    it("Should retrieve the correct list of binary options a user has participated in", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero.connect(addr1).addPosition(BigInt(0), true, {
            value: BigInt(1e18),
        });
        await oneZero.connect(addr1).addPosition(BigInt(1), true, {
            value: BigInt(1e18),
        });
        let userParticipatedOptions = await oneZero.getUserParticipatedOptions(
            addr1.address,
        );
        expect(userParticipatedOptions).to.have.lengthOf(2);
        expect(userParticipatedOptions[0]).to.equal(BigInt(0));
        expect(userParticipatedOptions[1]).to.equal(BigInt(1));
    });

    it("Should retrieve the correct list of active binary options", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        let activeOptions = await oneZero.getActiveBinaryOptions();
        expect(activeOptions).to.have.lengthOf(2);
        expect(activeOptions[0]).to.equal(BigInt(0));
        expect(activeOptions[1]).to.equal(BigInt(1));
    });

    it("Should retrieve the correct list of concluded binary options", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        await oneZero.performUpkeep(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256[]"],
                [[BigInt(0), BigInt(1)]],
            ),
        );
        let concludedBinaryOptions = await oneZero.getConcludedBinaryOptions();
        expect(concludedBinaryOptions).to.have.lengthOf(2);
        expect(concludedBinaryOptions[0]).to.equal(BigInt(0));
        expect(concludedBinaryOptions[1]).to.equal(BigInt(1));
    });

    it("Should retrieve the correct details of a user's long position", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero.connect(addr1).addPosition(BigInt(0), true, {
            value: BigInt(1e18),
        });
        let longPosition = await oneZero.getUserLongPosition(
            BigInt(0),
            addr1.address,
        );
        expect(longPosition).to.equal(
            BigInt(1e18 * (1 - Number(COMMISSION_RATE) / 10000)),
        );
    });

    it("Should retrieve the correct details of a user's short position", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero.connect(addr1).addPosition(BigInt(0), false, {
            value: BigInt(1e18),
        });
        let shortPosition = await oneZero.getUserShortPosition(
            BigInt(0),
            addr1.address,
        );
        expect(shortPosition).to.equal(
            BigInt(1e18 * (1 - Number(COMMISSION_RATE) / 10000)),
        );
    });

    it("Should not allow non-owner and non-admins to add binary options", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await expect(
            oneZero
                .connect(addr1)
                .addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE),
        ).to.be.revertedWith("Only owner and admins can call this function");
    });

    it("Should allow owner to add binary options", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await expect(
            oneZero
                .connect(owner)
                .addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE),
        ).to.not.be.reverted;
    });

    it("Should allow admins to add binary options", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.connect(owner).updateAdmin(addr1.address, true);
        await expect(
            oneZero
                .connect(addr1)
                .addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE),
        ).to.not.be.reverted;
    });

    // Creating the binary option correctly has been tested as part of checking that the getter function can retrieve the correct details of a binary option

    // Adding positions correctly has been tested as part of checking that the getter functions can retrieve the correct details of a user's long or short position

    it("Should return false when chainlink keeper calls checkUpkeep and there are no options past their expiry", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        // Before option starts, checkUpkeep should return false
        let checkUpkeepFirstResponse = await oneZero
            .connect(dummyChainlinkKeeper)
            .checkUpkeep(ethers.AbiCoder.defaultAbiCoder().encode([], []));
        expect(checkUpkeepFirstResponse[0]).to.be.false;
        expect(checkUpkeepFirstResponse[1]).to.equal(
            ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]"], [[]]),
        );
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        // After option starts, checkUpkeep should also return false
        let checkUpkeepSecondResponse = await oneZero
            .connect(dummyChainlinkKeeper)
            .checkUpkeep(ethers.AbiCoder.defaultAbiCoder().encode([], []));
        expect(checkUpkeepSecondResponse[0]).to.be.false;
        expect(checkUpkeepSecondResponse[1]).to.equal(
            ethers.AbiCoder.defaultAbiCoder().encode(["uint256[]"], [[]]),
        );
    });

    it("Should return true when chainlink keeper calls checkUpkeep and there are options past their expiry", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await oneZero.addBinaryOption(
            TITLE,
            START,
            DURATION + BigInt(500),
            COMMISSION_RATE,
        );
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for first option to expire
        // checkUpkeep should return True, but identify that only the first option needs to be concluded
        let checkUpkeepFirstResponse = await oneZero
            .connect(dummyChainlinkKeeper)
            .checkUpkeep(ethers.AbiCoder.defaultAbiCoder().encode([], []));
        expect(checkUpkeepFirstResponse[0]).to.be.true;
        expect(checkUpkeepFirstResponse[1]).to.equal(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256[]"],
                [[BigInt(0)]],
            ),
        );
        await network.provider.send("evm_increaseTime", [520]);
        await network.provider.send("evm_mine"); // Mine another new block to skip ahead for second option to expire
        // checkUpkeep should return True and now identify that both options need to be concluded
        let checkUpkeepSecondResponse = await oneZero
            .connect(dummyChainlinkKeeper)
            .checkUpkeep(ethers.AbiCoder.defaultAbiCoder().encode([], []));
        expect(checkUpkeepSecondResponse[0]).to.be.true;
        expect(checkUpkeepSecondResponse[1]).to.equal(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256[]"],
                [[BigInt(0), BigInt(1)]],
            ),
        );
    });

    it("Should not allow performUpkeep to conclude options prematurely", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        // Even if performUpkeep is called by a malicious party with the correct parameters, it should not be able to conclude the option prematurely
        await expect(
            oneZero
                .connect(addr1)
                .performUpkeep(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.be.revertedWith("Duration for binary option has not passed");
    });

    it("Should not throw any errors if binary option concludes without any stakers", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await oneZero.addBinaryOption(
            TITLE,
            START,
            DURATION + BigInt(500),
            COMMISSION_RATE,
        );
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for first option to expire
        await expect(
            oneZero
                .connect(dummyChainlinkKeeper)
                .performUpkeep(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.not.be.reverted;
    });

    it("Should not throw any errors if binary option concludes without any winners", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await oneZero.addBinaryOption(
            TITLE,
            START,
            DURATION + BigInt(500),
            COMMISSION_RATE,
        );
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for first option to start
        await oneZero
            .connect(addr1)
            .addPosition(BigInt(0), false, { value: BigInt(1e18) }); // addr1 goes short with 1 ether
        await network.provider.send("evm_increaseTime", [1200]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for first option to expire
        await expect(
            oneZero
                .connect(dummyChainlinkKeeper)
                .performUpkeep(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.not.be.reverted;
    });

    it("Should not allow performUpkeep to conclude an option multiple times", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10);
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        await oneZero.performUpkeep(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256[]"],
                [[BigInt(0)]],
            ),
        );
        // Even if performUpkeep is called by a malicious party with the correct parameters, it should not be able to conclude the option multiple times
        await expect(
            oneZero
                .connect(addr1)
                .performUpkeep(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256[]"],
                        [[BigInt(0)]],
                    ),
                ),
        ).to.be.revertedWith("Binary option has already been concluded");
    });

    it("Should pay out commissions correctly when an option is concluded and there are winners (single token holder)", async function () {
        await oz.connect(owner).mint({
            value: BigInt(2e18),
        }); // mint 2,000 OZ tokens for owner
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero
            .connect(addr3)
            .addPosition(BigInt(0), true, { value: BigInt(3e18) }); // addr3 goes long with 3 ether, total commission = 0.003 ether
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        let ownerBalanceBeforeCommission = await ethers.provider.getBalance(
            owner.address,
        );
        let addr1BalanceBeforeCommission = await ethers.provider.getBalance(
            addr1.address,
        );
        await oneZero
            .connect(dummyChainlinkKeeper)
            .performUpkeep(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256[]"],
                    [[BigInt(0)]],
                ),
            );
        expect(await ethers.provider.getBalance(owner.address)).to.equal(
            ownerBalanceBeforeCommission + BigInt(0.003 * 1e18),
        ); // owner should receive 0.003 ether commission
        expect(await ethers.provider.getBalance(addr1.address)).to.equal(
            addr1BalanceBeforeCommission,
        ); // addr1 should not have received any ether commission
    });

    it("Should pay out commissions correctly when an option is concluded and there are no winners (single token holder)", async function () {
        await oz.connect(owner).mint({
            value: BigInt(2e18),
        }); // mint 2,000 OZ tokens for owner
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero
            .connect(addr3)
            .addPosition(BigInt(0), false, { value: BigInt(3e18) }); // addr3 goes long with 3 ether, total commission = 0.003 ether
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        let ownerBalanceBeforeCommission = await ethers.provider.getBalance(
            owner.address,
        );
        let addr1BalanceBeforeCommission = await ethers.provider.getBalance(
            addr1.address,
        );
        await oneZero
            .connect(dummyChainlinkKeeper)
            .performUpkeep(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256[]"],
                    [[BigInt(0)]],
                ),
            );
        expect(await ethers.provider.getBalance(owner.address)).to.equal(
            ownerBalanceBeforeCommission + BigInt(0.003 * 1e18),
        ); // owner should receive 0.003 ether commission
        expect(await ethers.provider.getBalance(addr1.address)).to.equal(
            addr1BalanceBeforeCommission,
        ); // addr1 should not have received any ether commission
    });

    it("Should pay out commissions correctly when an option is concluded and there are winners (multiple token holders)", async function () {
        await oz.connect(owner).mint({
            value: BigInt(2e18),
        }); // mint 2,000 OZ tokens for owner
        await oz.connect(addr1).mint({
            value: BigInt(1e18),
        }); // mint 1,000 OZ tokens for addr1
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero
            .connect(addr3)
            .addPosition(BigInt(0), true, { value: BigInt(3e18) }); // addr3 goes long with 3 ether, total commission = 0.003 ether
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        let ownerBalanceBeforeCommission = await ethers.provider.getBalance(
            owner.address,
        );
        let addr1BalanceBeforeCommission = await ethers.provider.getBalance(
            addr1.address,
        );
        let addr2BalanceBeforeCommission = await ethers.provider.getBalance(
            addr2.address,
        );
        await oneZero
            .connect(dummyChainlinkKeeper)
            .performUpkeep(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256[]"],
                    [[BigInt(0)]],
                ),
            );
        expect(await ethers.provider.getBalance(owner.address)).to.equal(
            ownerBalanceBeforeCommission + BigInt(0.002 * 1e18),
        ); // owner should receive 0.002 ether commission
        expect(await ethers.provider.getBalance(addr1.address)).to.equal(
            addr1BalanceBeforeCommission + BigInt(0.001 * 1e18),
        ); // addr1 should receive 0.001 ether commission
        expect(await ethers.provider.getBalance(addr2.address)).to.equal(
            addr2BalanceBeforeCommission,
        ); // addr2 should not have received any ether commission
    });

    it("Should pay out commissions correctly when an option is concluded and there are no winners (multiple token holders)", async function () {
        await oz.connect(owner).mint({
            value: BigInt(2e18),
        }); // mint 2,000 OZ tokens for owner
        await oz.connect(addr1).mint({
            value: BigInt(1e18),
        }); // mint 1,000 OZ tokens for addr1
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero
            .connect(addr3)
            .addPosition(BigInt(0), false, { value: BigInt(3e18) }); // addr3 goes long with 3 ether, total commission = 0.003 ether
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        let ownerBalanceBeforeCommission = await ethers.provider.getBalance(
            owner.address,
        );
        let addr1BalanceBeforeCommission = await ethers.provider.getBalance(
            addr1.address,
        );
        let addr2BalanceBeforeCommission = await ethers.provider.getBalance(
            addr2.address,
        );
        await oneZero
            .connect(dummyChainlinkKeeper)
            .performUpkeep(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256[]"],
                    [[BigInt(0)]],
                ),
            );
        expect(await ethers.provider.getBalance(owner.address)).to.equal(
            ownerBalanceBeforeCommission + BigInt(0.002 * 1e18),
        ); // owner should receive 0.002 ether commission
        expect(await ethers.provider.getBalance(addr1.address)).to.equal(
            addr1BalanceBeforeCommission + BigInt(0.001 * 1e18),
        ); // addr1 should receive 0.001 ether commission
        expect(await ethers.provider.getBalance(addr2.address)).to.equal(
            addr2BalanceBeforeCommission,
        ); // addr2 should not have received any ether commission
    });

    it("Should pay out winnings correctly when an option is concluded (no oz token holders, longs win, multiple winners, single loser)", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero
            .connect(addr1)
            .addPosition(BigInt(0), true, { value: BigInt(1e18) }); // addr1 goes long with 1 ether
        await oneZero
            .connect(addr2)
            .addPosition(BigInt(0), true, { value: BigInt(2e18) }); // addr2 goes long with 2 ether
        await oneZero
            .connect(addr3)
            .addPosition(BigInt(0), false, { value: BigInt(3e18) }); // addr3 goes short with 3 ether
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        let ownerBalanceBeforeWinnings = await ethers.provider.getBalance(
            owner.address,
        );
        let addr1BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr1.address,
        );
        let addr2BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr2.address,
        );
        let addr3BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr3.address,
        );
        await oneZero
            .connect(dummyChainlinkKeeper)
            .performUpkeep(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256[]"],
                    [[BigInt(0)]],
                ),
            );
        expect(await ethers.provider.getBalance(owner.address)).to.equal(
            ownerBalanceBeforeWinnings,
        ); // Owner should not have received any winnings since they did not participate
        expect(await ethers.provider.getBalance(addr1.address)).to.equal(
            addr1BalanceBeforeWinnings +
                (((BigInt(1e18 + 2e18 + 3e18) *
                    (BigInt(10000) - COMMISSION_RATE)) /
                    BigInt(10000)) *
                    BigInt(1)) /
                    BigInt(3),
        ); // Longs won so addr1 should receive 1/3 of the total longs and shorts (less commission)
        expect(await ethers.provider.getBalance(addr2.address)).to.equal(
            addr2BalanceBeforeWinnings +
                (((BigInt(1e18 + 2e18 + 3e18) *
                    (BigInt(10000) - COMMISSION_RATE)) /
                    BigInt(10000)) *
                    BigInt(2)) /
                    BigInt(3),
        ); // Longs won so addr2 should receive 2/3 of the total longs and shorts (less commission)
        expect(await ethers.provider.getBalance(addr3.address)).to.equal(
            addr3BalanceBeforeWinnings,
        ); // Shorts lost so addr3 should not receive anything
    });

    it("Should pay out winnings correctly when an option is concluded (no oz token holders, longs win, single winner, multiple losers)", async function () {
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero
            .connect(addr1)
            .addPosition(BigInt(0), false, { value: BigInt(1e18) }); // addr1 goes short with 1 ether
        await oneZero
            .connect(addr2)
            .addPosition(BigInt(0), false, { value: BigInt(2e18) }); // addr2 goes short with 2 ether
        await oneZero
            .connect(addr3)
            .addPosition(BigInt(0), true, { value: BigInt(3e18) }); // addr3 goes long with 3 ether
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        let ownerBalanceBeforeWinnings = await ethers.provider.getBalance(
            owner.address,
        );
        let addr1BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr1.address,
        );
        let addr2BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr2.address,
        );
        let addr3BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr3.address,
        );
        await oneZero
            .connect(dummyChainlinkKeeper)
            .performUpkeep(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256[]"],
                    [[BigInt(0)]],
                ),
            );
        expect(await ethers.provider.getBalance(owner.address)).to.equal(
            ownerBalanceBeforeWinnings,
        ); // Owner should not have received any winnings since they did not participate
        expect(await ethers.provider.getBalance(addr1.address)).to.equal(
            addr1BalanceBeforeWinnings,
        ); // Longs lost so addr1 should not receive anything
        expect(await ethers.provider.getBalance(addr2.address)).to.equal(
            addr2BalanceBeforeWinnings,
        ); // Longs lost so addr2 should not receive anything
        expect(await ethers.provider.getBalance(addr3.address)).to.equal(
            addr3BalanceBeforeWinnings +
                (BigInt(1e18 + 2e18 + 3e18) *
                    (BigInt(10000) - COMMISSION_RATE)) /
                    BigInt(10000),
        ); // Longs won so addr3 will receive the full amount (less commission) since only addr3 won
    });

    it("Should pay out winnings correctly when an option is concluded (multiple oz token holders, longs win, multiple winners, single loser)", async function () {
        await oz.connect(owner).mint({
            value: BigInt(2e18),
        }); // mint 2,000 OZ tokens for owner
        await oz.connect(addr1).mint({
            value: BigInt(1e18),
        }); // mint 1,000 OZ tokens for addr1
        await oz.connect(addr3).mint({
            value: BigInt(1e18),
        }); // mint 1,000 OZ tokens for addr3
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero
            .connect(addr1)
            .addPosition(BigInt(0), true, { value: BigInt(1e18) }); // addr1 goes long with 1 ether
        await oneZero
            .connect(addr2)
            .addPosition(BigInt(0), true, { value: BigInt(2e18) }); // addr2 goes long with 2 ether
        await oneZero
            .connect(addr3)
            .addPosition(BigInt(0), false, { value: BigInt(3e18) }); // addr3 goes short with 3 ether
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        let ownerBalanceBeforeWinnings = await ethers.provider.getBalance(
            owner.address,
        );
        let addr1BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr1.address,
        );
        let addr2BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr2.address,
        );
        let addr3BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr3.address,
        );
        await oneZero
            .connect(dummyChainlinkKeeper)
            .performUpkeep(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256[]"],
                    [[BigInt(0)]],
                ),
            );
        expect(await ethers.provider.getBalance(owner.address)).to.equal(
            ownerBalanceBeforeWinnings +
                (((BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE) /
                    BigInt(10000)) *
                    BigInt(2000)) /
                    BigInt(4000),
        ); // Owner does not receive any winnings but will receive commission of 1/2 of 0.006 ether commission
        expect(await ethers.provider.getBalance(addr1.address)).to.equal(
            addr1BalanceBeforeWinnings +
                (((BigInt(1e18 + 2e18 + 3e18) *
                    (BigInt(10000) - COMMISSION_RATE)) /
                    BigInt(10000)) *
                    BigInt(1)) /
                    BigInt(3) +
                (((BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE) /
                    BigInt(10000)) *
                    BigInt(1000)) /
                    BigInt(4000),
        ); // Longs won so addr1 should receive 1/3 of the total longs and shorts (less commission) and 1/4 of 0.006 ether commission
        expect(await ethers.provider.getBalance(addr2.address)).to.equal(
            addr2BalanceBeforeWinnings +
                (((BigInt(1e18 + 2e18 + 3e18) *
                    (BigInt(10000) - COMMISSION_RATE)) /
                    BigInt(10000)) *
                    BigInt(2)) /
                    BigInt(3),
        ); // Longs won so addr2 should receive 2/3 of the total longs and shorts (less commission) but no commission since addr2 does not hold any oz tokens
        expect(await ethers.provider.getBalance(addr3.address)).to.equal(
            addr3BalanceBeforeWinnings +
                (((BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE) /
                    BigInt(10000)) *
                    BigInt(1000)) /
                    BigInt(4000),
        ); // Shorts lost so addr3 should not receive winnings but will receive 1/4 of 0.006 ether commission
    });

    it("Should pay out winnings correctly when an option is concluded (multiple oz token holders, longs win, single winner, multiple losers)", async function () {
        await oz.connect(owner).mint({
            value: BigInt(2e18),
        }); // mint 2,000 OZ tokens for owner
        await oz.connect(addr1).mint({
            value: BigInt(1e18),
        }); // mint 1,000 OZ tokens for addr1
        await oz.connect(addr3).mint({
            value: BigInt(1e18),
        }); // mint 1,000 OZ tokens for addr3
        const TITLE: string = "test binary option";
        const DURATION: bigint = MINIMUM_DURATION;
        let latestBlock = await ethers.provider.getBlock("latest");
        if (latestBlock === null) {
            throw new Error("Failed to fetch the latest block.");
        }
        const START: bigint = BigInt(latestBlock.timestamp) + BigInt(10);
        const COMMISSION_RATE: bigint = BigInt(10); // commission is in basis points, therefore 10 = 10/10000% = 0.1%
        await oneZero.addBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await network.provider.send("evm_increaseTime", [20]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to start
        await oneZero
            .connect(addr1)
            .addPosition(BigInt(0), false, { value: BigInt(1e18) }); // addr1 goes short with 1 ether
        await oneZero
            .connect(addr2)
            .addPosition(BigInt(0), false, { value: BigInt(2e18) }); // addr2 goes short with 2 ether
        await oneZero
            .connect(addr3)
            .addPosition(BigInt(0), true, { value: BigInt(3e18) }); // addr3 goes long with 3 ether
        await network.provider.send("evm_increaseTime", [1220]);
        await network.provider.send("evm_mine"); // Mine a new block to skip ahead for option to expire
        let ownerBalanceBeforeWinnings = await ethers.provider.getBalance(
            owner.address,
        );
        let addr1BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr1.address,
        );
        let addr2BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr2.address,
        );
        let addr3BalanceBeforeWinnings = await ethers.provider.getBalance(
            addr3.address,
        );
        await oneZero
            .connect(dummyChainlinkKeeper)
            .performUpkeep(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["uint256[]"],
                    [[BigInt(0)]],
                ),
            );
        expect(await ethers.provider.getBalance(owner.address)).to.equal(
            ownerBalanceBeforeWinnings +
                (((BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE) /
                    BigInt(10000)) *
                    BigInt(2000)) /
                    BigInt(4000),
        ); // Owner does not receive any winnings but will receive commission of 1/2 of 0.006 ether commission
        expect(await ethers.provider.getBalance(addr1.address)).to.equal(
            addr1BalanceBeforeWinnings +
                (((BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE) /
                    BigInt(10000)) *
                    BigInt(1000)) /
                    BigInt(4000),
        ); // Shorts lost so addr1 should not receive winnings but will receive 1/4 of 0.006 ether commission
        expect(await ethers.provider.getBalance(addr2.address)).to.equal(
            addr2BalanceBeforeWinnings,
        ); // Shorts lost so addr2 should not receive winnings and will also not receive any commissions since addr2 does not hold any oz tokens
        expect(await ethers.provider.getBalance(addr3.address)).to.equal(
            addr3BalanceBeforeWinnings +
                (BigInt(1e18 + 2e18 + 3e18) *
                    (BigInt(10000) - COMMISSION_RATE)) /
                    BigInt(10000) +
                (((BigInt(1e18 + 2e18 + 3e18) * COMMISSION_RATE) /
                    BigInt(10000)) *
                    BigInt(1000)) /
                    BigInt(4000),
        ); // Longs won so addr3 will receive the full amount (less commission) since only addr3 won and will also receive 1/4 of 0.006 ether commission
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

