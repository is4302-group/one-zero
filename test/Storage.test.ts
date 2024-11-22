import { ethers } from "hardhat";
import { expect } from "chai";

describe("Storage Contract", function () {
    let Storage: any;
    let storage: any;
    let owner: any;
    let nonOwner: any;
    let dummyOneZero: any;
    const ZERO_ADDRESS: string = "0x0000000000000000000000000000000000000000";

    beforeEach(async function () {
        Storage = await ethers.getContractFactory("Storage");
        [owner, nonOwner, dummyOneZero] = await ethers.getSigners();
        storage = await Storage.deploy();
        await storage.waitForDeployment();
    });

    it("Should deploy the contract correctly", async function () {
        expect(await storage.getAddress()).to.properAddress;
    });

    it("Should initialise the owner correctly", async function () {
        expect(await storage.getOwner()).equal(owner.address);
    });

    it("Should initialise OneZero as an empty address", async function () {
        expect(await storage.getOneZeroAddress()).to.equal(ZERO_ADDRESS);
    });

    it("Should set the OneZero address correctly", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        expect(await storage.getOneZeroAddress()).to.equal(
            dummyOneZero.address,
        );
    });

    it("Should not allow non-owners to set the OneZero address", async function () {
        await expect(
            storage.connect(nonOwner).setOneZeroAddress(dummyOneZero.address),
        ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should allow owner to set the OneZero address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        expect(await storage.getOneZeroAddress()).to.equal(
            dummyOneZero.address,
        );
    });

    it("Should not allow non-owners to read the details of a binary option directly from storage", async function () {
        await expect(
            storage.connect(nonOwner).readBinaryOption(BigInt(0)),
        ).to.be.revertedWith("Only OneZero and owner can call this function");
    });

    it("Should allow owner to read the details of a binary option directly from storage", async function () {
        await expect(storage.connect(owner).readBinaryOption(BigInt(0))).to.not
            .be.reverted;
    });

    it("Should allow OneZero to read the details of a binary option directly from storage after setting the address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await expect(storage.connect(dummyOneZero).readBinaryOption(BigInt(0)))
            .to.not.be.reverted;
    });

    it("Should retrieve the correct details of a binary option directly from storage", async function () {
        const TITLE: string = "test binary option";
        const START: bigint = BigInt(100);
        const DURATION: bigint = BigInt(120);
        const COMMISSION_RATE: bigint = BigInt(10);
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        let binaryOption = await storage.readBinaryOption(BigInt(0));
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

    it("Should not allow non-owners to read the list of binary options a user has participated in directly from storage", async function () {
        await expect(
            storage
                .connect(nonOwner)
                .readUserParticipatedOptions(nonOwner.address),
        ).to.be.revertedWith("Only OneZero and owner can call this function");
    });

    it("Should allow owner to read the list of binary options a user has participated in directly from storage", async function () {
        await expect(
            storage.connect(owner).readUserParticipatedOptions(owner.address),
        ).to.not.be.reverted;
    });

    it("Should allow OneZero to read the list of binary options a user has participated in directly from storage after setting the address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await expect(
            storage
                .connect(dummyOneZero)
                .readUserParticipatedOptions(owner.address),
        ).to.not.be.reverted;
    });

    it("Should retrieve the correct list of binary options a user has participated in directly from storage", async function () {
        const TITLE: string = "test binary option";
        const START: bigint = BigInt(100);
        const DURATION: bigint = BigInt(120);
        const COMMISSION_RATE: bigint = BigInt(10);
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await storage
            .connect(dummyOneZero)
            .createPosition(BigInt(0), owner.address, BigInt(1e18), true); // Owner opens a long position with 1 ether
        let participatedOptions: bigint[] =
            await storage.readUserParticipatedOptions(owner.address);
        expect(participatedOptions).to.have.lengthOf(1);
        expect(participatedOptions[0]).to.equal(BigInt(0));
    });

    it("Should not allow non-owners to read the list of active binary options directly from storage", async function () {
        await expect(
            storage.connect(nonOwner).readActiveBinaryOptions(),
        ).to.be.revertedWith("Only OneZero and owner can call this function");
    });

    it("Should allow owner to read the list of active binary options directly from storage", async function () {
        await expect(storage.connect(owner).readActiveBinaryOptions()).to.not.be
            .reverted;
    });

    it("Should allow OneZero to read the list of active binary options directly from storage after setting the address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await expect(storage.connect(dummyOneZero).readActiveBinaryOptions()).to
            .not.be.reverted;
    });

    it("Should retrieve the correct list of active binary options directly from storage", async function () {
        const TITLE: string = "test binary option";
        const START: bigint = BigInt(100);
        const DURATION: bigint = BigInt(1200);
        const COMMISSION_RATE: bigint = BigInt(10);
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE); // Creation of binary option with id 0
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE); // Creation of binary option with id 1
        let activeOptions: bigint[] = await storage.readActiveBinaryOptions();
        expect(activeOptions).to.have.lengthOf(2);
        expect(activeOptions[0]).to.equal(BigInt(0));
        expect(activeOptions[1]).to.equal(BigInt(1));
    });

    it("Should not allow non-owners to read the list of concluded binary options directly from storage", async function () {
        await expect(
            storage.connect(nonOwner).readConcludedBinaryOptions(),
        ).to.be.revertedWith("Only OneZero and owner can call this function");
    });

    it("Should allow owner to read the list of concluded binary options directly from storage", async function () {
        await expect(storage.connect(owner).readConcludedBinaryOptions()).to.not
            .be.reverted;
    });

    it("Should allow OneZero to read the list of concluded binary options directly from storage after setting the address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await expect(storage.connect(dummyOneZero).readConcludedBinaryOptions())
            .to.not.be.reverted;
    });

    it("Should retrieve the correct list of concluded binary options directly from storage", async function () {
        const TITLE: string = "test binary option";
        const START: bigint = BigInt(100);
        const DURATION: bigint = BigInt(1200);
        const COMMISSION_RATE: bigint = BigInt(10);
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE); // Creation of binary option
        await storage.connect(dummyOneZero).endBinaryOption(BigInt(0), true); // Concluding the binary option
        let concludedOptions: bigint[] =
            await storage.readConcludedBinaryOptions();
        expect(concludedOptions).to.have.lengthOf(1);
        expect(concludedOptions[0]).to.equal(BigInt(0));
    });

    it("Should not allow non-owners to read a user's long position directly from storage", async function () {
        await expect(
            storage
                .connect(nonOwner)
                .readUserLongPosition(BigInt(0), nonOwner.address),
        ).to.be.revertedWith("Only OneZero and owner can call this function");
    });

    it("Should allow owner to read a user's long position directly from storage", async function () {
        await expect(
            storage
                .connect(owner)
                .readUserLongPosition(BigInt(0), owner.address),
        ).to.not.be.reverted;
    });

    it("Should allow OneZero to read a user's long position directly from storage after setting the address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await expect(
            storage
                .connect(dummyOneZero)
                .readUserLongPosition(BigInt(0), owner.address),
        ).to.not.be.reverted;
    });

    it("Should retrieve the correct details of a user's long position directly from storage", async function () {
        const TITLE: string = "test binary option";
        const START: bigint = BigInt(100);
        const DURATION: bigint = BigInt(1200);
        const COMMISSION_RATE: bigint = BigInt(10);
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE); // Creation of binary option
        await storage
            .connect(dummyOneZero)
            .createPosition(BigInt(0), owner.address, BigInt(1e18), true); // Owner opens a long position with 1 ether
        let userLongPosition: bigint = await storage.readUserLongPosition(
            BigInt(0),
            owner.address,
        );
        expect(userLongPosition).to.equal(
            (BigInt(1e18) * (BigInt(1e4) - COMMISSION_RATE)) / BigInt(1e4),
        );
    });

    it("Should not allow non-owners to read a user's short position directly from storage", async function () {
        await expect(
            storage
                .connect(nonOwner)
                .readUserShortPosition(BigInt(0), nonOwner.address),
        ).to.be.revertedWith("Only OneZero and owner can call this function");
    });

    it("Should allow owner to read a user's short position directly from storage", async function () {
        await expect(
            storage
                .connect(owner)
                .readUserShortPosition(BigInt(0), owner.address),
        ).to.not.be.reverted;
    });

    it("Should allow OneZero to read a user's short position directly from storage after setting the address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await expect(
            storage
                .connect(dummyOneZero)
                .readUserShortPosition(BigInt(0), owner.address),
        ).to.not.be.reverted;
    });

    it("Should retrieve the correct details of a user's short position directly from storage", async function () {
        const TITLE: string = "test binary option";
        const START: bigint = BigInt(100);
        const DURATION: bigint = BigInt(1200);
        const COMMISSION_RATE: bigint = BigInt(1200);
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE); // Creation of binary option
        await storage
            .connect(dummyOneZero)
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
        await expect(
            storage.connect(nonOwner).readBinaryOptionCounter(),
        ).to.be.revertedWith("Only OneZero and owner can call this function");
    });

    it("Should allow owner to read the binary option counter", async function () {
        await expect(storage.connect(owner).readBinaryOptionCounter()).to.not.be
            .reverted;
    });

    it("Should allow OneZero to read the binary option counter after setting the address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await expect(storage.connect(dummyOneZero).readBinaryOptionCounter()).to
            .not.be.reverted;
    });

    it("Should update the binary option counter correctly", async function () {
        expect(await storage.readBinaryOptionCounter()).to.equal(BigInt(0));
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption("test binary option", 0, 120, 100);
        expect(await storage.readBinaryOptionCounter()).to.equal(BigInt(1));
    });

    it("Should not allow non-owners to create a binary option directly to storage", async function () {
        await expect(
            storage
                .connect(nonOwner)
                .createBinaryOption("test binary option", 0, 120, 100),
        ).to.be.revertedWith("Only OneZero contract can call this function");
    });

    it("Should not allow owner to create a binary option directly to storage", async function () {
        await expect(
            storage
                .connect(owner)
                .createBinaryOption("test binary option", 0, 120, 100),
        ).to.be.revertedWith("Only OneZero contract can call this function");
    });

    it("Should allow OneZero to create a binary option after setting the address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await expect(
            storage
                .connect(dummyOneZero)
                .createBinaryOption("test binary option", 0, 120, 100),
        ).to.not.be.reverted;
    });

    // Creating the binary option correctly has been tested as part of checking that the getter function can retrieve the correct details of a binary option

    it("Should not allow non-owners to create a position directly to storage", async function () {
        await expect(
            storage
                .connect(nonOwner)
                .createPosition(BigInt(0), nonOwner.address, 100, true),
        ).to.be.revertedWith("Only OneZero contract can call this function");
    });

    it("Should not allow owner to create a position directly to storage", async function () {
        await expect(
            storage
                .connect(owner)
                .createPosition(BigInt(0), owner.address, 100, true),
        ).to.be.revertedWith("Only OneZero contract can call this function");
    });

    it("Should allow OneZero to create a position after setting the address", async function () {
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await expect(
            storage
                .connect(dummyOneZero)
                .createPosition(BigInt(0), owner.address, 100, true),
        ).to.not.be.reverted;
    });

    // Creating a position correctly has been tested as part of checking that the getter function can retrieve the correct details of a user's short or long position

    it("Should not allow non-owners to conclude a binary option directly from storage", async function () {
        await expect(
            storage.connect(nonOwner).endBinaryOption(BigInt(0), true),
        ).to.be.revertedWith("Only OneZero contract can call this function");
    });

    it("Should not allow owner to conclude a binary option directly from storage", async function () {
        const TITLE: string = "test binary option";
        const START: bigint = BigInt(100);
        const DURATION: bigint = BigInt(1200);
        const COMMISSION_RATE: bigint = BigInt(1200);
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await expect(
            storage.connect(owner).endBinaryOption(BigInt(0), true),
        ).to.be.revertedWith("Only OneZero contract can call this function");
    });

    it("Should allow OneZero to conclude a binary option after setting the address", async function () {
        const TITLE: string = "test binary option";
        const START: bigint = BigInt(100);
        const DURATION: bigint = BigInt(1200);
        const COMMISSION_RATE: bigint = BigInt(1200);
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await expect(
            storage.connect(dummyOneZero).endBinaryOption(BigInt(0), true),
        ).to.not.be.reverted;
    });

    it("Should conclude a binary option correctly", async function () {
        const TITLE: string = "test binary option";
        const START: bigint = BigInt(100);
        const DURATION: bigint = BigInt(1200);
        const COMMISSION_RATE: bigint = BigInt(1200);
        await storage.connect(owner).setOneZeroAddress(dummyOneZero.address);
        await storage
            .connect(dummyOneZero)
            .createBinaryOption(TITLE, START, DURATION, COMMISSION_RATE);
        await storage.connect(dummyOneZero).endBinaryOption(BigInt(0), true);
        let binaryOption = await storage.readBinaryOption(BigInt(0));
        expect(binaryOption.outcome).to.equal(BigInt(1));
    });
});
