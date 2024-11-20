import { ethers } from "hardhat";
import { expect } from "chai";

describe("OZ Contract", function () {
    let OZ: any;
    let oz: any;
    let owner: any;
    let addr1: any;
    let addr2: any;

    beforeEach(async function () {
        OZ = await ethers.getContractFactory("OZ");
        [owner, addr1, addr2] = await ethers.getSigners();
        const NAME: string = "One Zero";
        const SYMBOL: string = "OZ";
        const CAP: bigint = BigInt(1e24);
        const EXCHANGE_RATE: bigint = BigInt(1e15); // 1 ETH = 1,000 OZ
        const OWNER_INITIAL_ALLOCATION: bigint = BigInt(0); // 0 OZ for testing purposes
        oz = await OZ.deploy(NAME, SYMBOL, CAP, EXCHANGE_RATE, OWNER_INITIAL_ALLOCATION);
        await oz.waitForDeployment();
    });

    it("Should deploy the contract correctly", async function () {
        expect(await oz.getAddress()).to.properAddress;
    });

    it("Should initialise the name correctly", async function () {
        expect(await oz.name()).equal("One Zero");
    });

    it("Should initialise the symbol correctly", async function () {
        expect(await oz.symbol()).equal("OZ");
    });

    it("Should initialise the max supply correctly", async function () {
        expect(await oz.getCap()).equal(BigInt(1e24));
    });

    it("Should initialise the exchange rate correctly", async function () {
        expect(await oz.getExchangeRate()).equal(BigInt(1e15));
    });

    it("Should initialise the initial numnber of OZ tokens allocated to owner correctly", async function () {
        expect(await oz.balanceOf(owner.address)).equal(BigInt(0));
    });

    it("Should initialise the owner correctly", async function () {
        expect(await oz.owner()).equal(owner.address);
    });

    it("Should initialise holders as an array with a single element (owner)", async function () {
        expect(await oz.getHolders()).to.have.lengthOf(1); // Owner can be allocated OZ tokens as part of constructor so holders will be pre-populated with 1 holder (owner) even if 0 OZ tokens are allocated to owner
    });

    it("Should not allow non-owners to update the cap", async function () {
        await expect(oz.connect(addr1).updateCap(BigInt(1e22))).to.be.revertedWithCustomError(oz, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update the cap, and cap is updated correctly", async function () {
        await expect(oz.connect(owner).updateCap(BigInt(1e22))).to.not.be.reverted;
    });

    it("Should not allow setting cap to 0", async function () {
        await expect(oz.connect(owner).updateCap(0)).to.be.revertedWith("Cap must be greater than 0");
    });

    it("Should not allow setting cap to a value smaller than the current supply", async function () {
        let tx = await oz.connect(owner).mint({
            value: BigInt(1e18)
        }); // Mint 1,000 OZ tokens to owner
        await tx.wait();
        await expect(oz.connect(owner).updateCap(BigInt(1))).to.be.revertedWith("Cap must be greater than the current number of circulating tokens");
    });

    it("Should update the cap correctly", async function () {
        await oz.connect(owner).updateCap(BigInt(1e22));
        expect(await oz.getCap()).equal(BigInt(1e22));
    });

    it("Should not allow non-owners to update the exchange rate", async function () {
        await expect(oz.connect(addr1).updateExchangeRate(BigInt(1e16))).to.be.revertedWithCustomError(oz, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to update the exchange rate", async function () {
        await expect(oz.connect(owner).updateExchangeRate(BigInt(1e16))).to.not.be.reverted;
    });

    it("Should not allow setting exchange rate to 0", async function () {
        await expect(oz.connect(owner).updateExchangeRate(0)).to.be.revertedWith("Price per token (in wei) must be greater than 0");
    });

    it("Should update exchange rate correctly", async function () {
        await oz.connect(owner).updateExchangeRate(BigInt(1e16));
        expect(await oz.getExchangeRate()).equal(BigInt(1e16));
    });

    it("Should allow owner to mint tokens", async function () {
        await oz.connect(owner).mint({
            value: BigInt(1e18)
        }); // Mint 1,000 OZ tokens to owner
        expect(await oz.balanceOf(owner.address)).to.equal(BigInt(1e21));
    });

    it("Should also allow non-owners to mint tokens", async function () {
        await oz.connect(addr1).mint({
            value: BigInt(1e18)
        }); // Mint 1,000 OZ tokens to addr1
        expect(await oz.balanceOf(addr1.address)).to.equal(BigInt(1e21));
    });

    it("Should not allow minting tokens if no value is sent", async function () {
        await expect(oz.connect(owner).mint()).to.be.revertedWith("No ETH transferred, unable to mint token");
    });

    it("Should not allow minting tokens if the cap is reached", async function () {
        await expect(oz.connect(owner).mint({
            value: BigInt(1001e18)
        })).to.be.revertedWith("Cap exceeded");
    });

    it("Should correctly track current token holders", async function () {
        await oz.connect(owner).mint({
            value: BigInt(1e18)
        }); // Mint 1,000 OZ tokens to owner
        await oz.connect(addr1).mint({
            value: BigInt(1e18)
        }); // Mint 1,000 OZ tokens to addr1
        let holders: string[] = await oz.getHolders();
        let holderAddresses: string[] = holders.map(holder => holder.toLowerCase());
        expect(holderAddresses).to.have.members([owner.address.toLowerCase(), addr1.address.toLowerCase()]);
    });

    it("Should correctly remove token holder once they no longer hold any tokens", async function () {
        await oz.connect(owner).mint({
            value: BigInt(1e18)
        }); // Mint 1,000 OZ tokens to owner
        await oz.connect(addr1).mint({
            value: BigInt(1e18)
        }); // Mint 1,000 OZ tokens to addr1
        await oz.connect(addr1).transfer(addr2.address, BigInt(1e21)); // Transfer 1,000 OZ tokens from addr1 to addr2
        let holders: string[] = await oz.getHolders();
        let holderAddresses: string[] = holders.map(holder => holder.toLowerCase());
        expect(holderAddresses).to.have.members([owner.address.toLowerCase(), addr2.address.toLowerCase()]);
        expect(holderAddresses).to.not.include(addr1.address.toLowerCase());
    });
});
