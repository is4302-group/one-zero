import {
    loadFixture,
    time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Storage Contract", function () {
    async function deployStorage() {
        const [owner, user, market] = await hre.ethers.getSigners();

        const storage = await hre.ethers.deployContract("Storage", owner);

        return {
            storage,
            owner,
            user,
            market,
            MINIMUM_OPTION_DURATION: BigInt(1200), // 20 minutes
        };
    }

    it("Should initialise the owner correctly", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        expect(await storage.getOwner()).equal(owner.address);
    });

    it("Should not allow non-owners to set the market address", async function () {
        const { storage, user, market } = await loadFixture(deployStorage);
        await expect(
            storage.connect(user).setMarket(market.address),
        ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should allow owner to set the market address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        expect(await storage.getMarket()).to.equal(market.address);
    });

    it("Should not allow non-owners to read the details of a binary option directly from storage", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage.connect(user).readBinaryOption(BigInt(0)),
        ).to.be.revertedWith("Only market and owner can call this function");
    });

    it("Should allow owner to read the details of a binary option directly from storage", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        await expect(storage.connect(owner).readBinaryOption(BigInt(0))).to.not
            .be.reverted;
    });

    it("Should allow market to read the details of a binary option directly from storage after setting the address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        await expect(storage.connect(market).readBinaryOption(BigInt(0))).to.not
            .be.reverted;
    });

    it("Should retrieve the correct details of a binary option directly from storage", async function () {
        const { storage, owner, market, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployStorage);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        let binaryOption = await storage.readBinaryOption(BigInt(0));
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

    it("Should not allow non-owners to read the list of binary options a user has participated in directly from storage", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage.connect(user).readUserParticipatedOptions(user.address),
        ).to.be.revertedWith("Only market and owner can call this function");
    });

    it("Should allow owner to read the list of binary options a user has participated in directly from storage", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        await expect(
            storage.connect(owner).readUserParticipatedOptions(owner.address),
        ).to.not.be.reverted;
    });

    it("Should allow market to read the list of binary options a user has participated in directly from storage after setting the address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        await expect(
            storage.connect(market).readUserParticipatedOptions(owner.address),
        ).to.not.be.reverted;
    });

    it("Should retrieve the correct list of binary options a user has participated in directly from storage", async function () {
        const { storage, owner, market, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployStorage);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await storage
            .connect(market)
            .createPosition(BigInt(0), owner.address, BigInt(1e18), true); // Owner opens a long position with 1 ether
        let participatedOptions: bigint[] =
            await storage.readUserParticipatedOptions(owner.address);
        expect(participatedOptions).to.have.lengthOf(1);
        expect(participatedOptions[0]).to.equal(BigInt(0));
    });

    it("Should not allow non-owners to read the list of active binary options directly from storage", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage.connect(user).readActiveBinaryOptions(),
        ).to.be.revertedWith("Only market and owner can call this function");
    });

    it("Should allow owner to read the list of active binary options directly from storage", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        await expect(storage.connect(owner).readActiveBinaryOptions()).to.not.be
            .reverted;
    });

    it("Should allow market to read the list of active binary options directly from storage after setting the address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        await expect(storage.connect(market).readActiveBinaryOptions()).to.not
            .be.reverted;
    });

    it("Should retrieve the correct list of active binary options directly from storage", async function () {
        const { storage, owner, market, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployStorage);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            ); // Creation of binary option with id 0
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            ); // Creation of binary option with id 1
        let activeOptions: bigint[] = await storage.readActiveBinaryOptions();
        expect(activeOptions).to.have.lengthOf(2);
        expect(activeOptions[0]).to.equal(BigInt(0));
        expect(activeOptions[1]).to.equal(BigInt(1));
    });

    it("Should not allow non-owners to read the list of concluded binary options directly from storage", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage.connect(user).readConcludedBinaryOptions(),
        ).to.be.revertedWith("Only market and owner can call this function");
    });

    it("Should allow owner to read the list of concluded binary options directly from storage", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        await expect(storage.connect(owner).readConcludedBinaryOptions()).to.not
            .be.reverted;
    });

    it("Should allow market to read the list of concluded binary options directly from storage after setting the address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        await expect(storage.connect(market).readConcludedBinaryOptions()).to
            .not.be.reverted;
    });

    it("Should retrieve the correct list of concluded binary options directly from storage", async function () {
        const { storage, owner, market, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployStorage);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await storage.connect(market).endBinaryOption(BigInt(0), true);
        let concludedOptions: bigint[] =
            await storage.readConcludedBinaryOptions();
        expect(concludedOptions).to.have.lengthOf(1);
        expect(concludedOptions[0]).to.equal(BigInt(0));
    });

    it("Should not allow non-owners to read a user's long position directly from storage", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage.connect(user).readUserLongPosition(BigInt(0), user.address),
        ).to.be.revertedWith("Only market and owner can call this function");
    });

    it("Should allow owner to read a user's long position directly from storage", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        await expect(
            storage
                .connect(owner)
                .readUserLongPosition(BigInt(0), owner.address),
        ).to.not.be.reverted;
    });

    it("Should allow market to read a user's long position directly from storage after setting the address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        await expect(
            storage
                .connect(market)
                .readUserLongPosition(BigInt(0), owner.address),
        ).to.not.be.reverted;
    });

    it("Should retrieve the correct details of a user's long position directly from storage", async function () {
        const { storage, owner, market, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployStorage);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await storage
            .connect(market)
            .createPosition(BigInt(0), owner.address, BigInt(1e18), true); // Owner opens a long position with 1 ether
        let userLongPosition = await storage.readUserLongPosition(
            BigInt(0),
            owner.address,
        );
        expect(userLongPosition).to.equal(
            (BigInt(1e18) * (BigInt(1e4) - COMMISSION_RATE)) / BigInt(1e4),
        );
    });

    it("Should not allow non-owners to read a user's short position directly from storage", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage
                .connect(user)
                .readUserShortPosition(BigInt(0), user.address),
        ).to.be.revertedWith("Only market and owner can call this function");
    });

    it("Should allow owner to read a user's short position directly from storage", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        await expect(
            storage
                .connect(owner)
                .readUserShortPosition(BigInt(0), owner.address),
        ).to.not.be.reverted;
    });

    it("Should allow market to read a user's short position directly from storage after setting the address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        await expect(
            storage
                .connect(market)
                .readUserShortPosition(BigInt(0), owner.address),
        ).to.not.be.reverted;
    });

    it("Should retrieve the correct details of a user's short position directly from storage", async function () {
        const { storage, owner, market, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployStorage);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await storage
            .connect(market)
            .createPosition(BigInt(0), owner.address, BigInt(1e18), false); // Owner opens a short position with 1 ether
        let userLongPosition: bigint = await storage.readUserShortPosition(
            BigInt(0),
            owner.address,
        );
        expect(userLongPosition).to.equal(
            (BigInt(1e18) * (BigInt(1e4) - COMMISSION_RATE)) / BigInt(1e4),
        );
    });

    it("Should not allow non-owners to read the binary option counter", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage.connect(user).readBinaryOptionCounter(),
        ).to.be.revertedWith("Only market and owner can call this function");
    });

    it("Should allow owner to read the binary option counter", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        await expect(storage.connect(owner).readBinaryOptionCounter()).to.not.be
            .reverted;
    });

    it("Should allow market to read the binary option counter after setting the address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        await expect(storage.connect(market).readBinaryOptionCounter()).to.not
            .be.reverted;
    });

    it("Should update the binary option counter correctly", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        expect(await storage.readBinaryOptionCounter()).to.equal(BigInt(0));
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption("test binary option", 0, 120, 100);
        expect(await storage.readBinaryOptionCounter()).to.equal(BigInt(1));
    });

    it("Should not allow non-owners to create a binary option directly to storage", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage
                .connect(user)
                .createBinaryOption("test binary option", 0, 120, 100),
        ).to.be.revertedWith("Only market contract can call this function");
    });

    it("Should not allow owner to create a binary option directly to storage", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        await expect(
            storage
                .connect(owner)
                .createBinaryOption("test binary option", 0, 120, 100),
        ).to.be.revertedWith("Only market contract can call this function");
    });

    it("Should allow market to create a binary option after setting the address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        await expect(
            storage
                .connect(market)
                .createBinaryOption("test binary option", 0, 120, 100),
        ).to.not.be.reverted;
    });

    // Creating the binary option correctly has been tested as part of checking that the getter function can retrieve the correct details of a binary option

    it("Should not allow non-owners to create a position directly to storage", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage
                .connect(user)
                .createPosition(BigInt(0), user.address, 100, true),
        ).to.be.revertedWith("Only market contract can call this function");
    });

    it("Should not allow owner to create a position directly to storage", async function () {
        const { storage, owner } = await loadFixture(deployStorage);
        await expect(
            storage
                .connect(owner)
                .createPosition(BigInt(0), owner.address, 100, true),
        ).to.be.revertedWith("Only market contract can call this function");
    });

    it("Should allow market to create a position after setting the address", async function () {
        const { storage, owner, market } = await loadFixture(deployStorage);
        await storage.connect(owner).setMarket(market.address);
        await expect(
            storage
                .connect(market)
                .createPosition(BigInt(0), owner.address, 100, true),
        ).to.not.be.reverted;
    });

    // Creating a position correctly has been tested as part of checking that the getter function can retrieve the correct details of a user's short or long position

    it("Should not allow non-owners to conclude a binary option directly from storage", async function () {
        const { storage, user } = await loadFixture(deployStorage);
        await expect(
            storage.connect(user).endBinaryOption(BigInt(0), true),
        ).to.be.revertedWith("Only market contract can call this function");
    });

    it("Should not allow owner to conclude a binary option directly from storage", async function () {
        const { storage, owner, market, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployStorage);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await expect(
            storage.connect(owner).endBinaryOption(BigInt(0), true),
        ).to.be.revertedWith("Only market contract can call this function");
    });

    it("Should allow market to conclude a binary option after setting the address", async function () {
        const { storage, owner, market, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployStorage);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await expect(storage.connect(market).endBinaryOption(BigInt(0), true))
            .to.not.be.reverted;
    });

    it("Should conclude a binary option correctly", async function () {
        const { storage, owner, market, MINIMUM_OPTION_DURATION } =
            await loadFixture(deployStorage);
        const TITLE: string = "test binary option";
        const START = BigInt(await time.latest()) + BigInt(10);
        const COMMISSION_RATE = BigInt(10);
        await storage.connect(owner).setMarket(market.address);
        await storage
            .connect(market)
            .createBinaryOption(
                TITLE,
                START,
                MINIMUM_OPTION_DURATION,
                COMMISSION_RATE,
            );
        await storage.connect(market).endBinaryOption(BigInt(0), true);
        let binaryOption = await storage.readBinaryOption(BigInt(0));
        expect(binaryOption.outcome).to.equal(BigInt(1));
    });
});
