import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ERC20Wrapped", function () {
  async function deployGatewayFixture() {
    const [owner, other] = await ethers.getSigners();
    const ERC20Wrapped = await ethers.getContractFactory("ERC20Wrapped");
    const wrappedToken = await ERC20Wrapped.deploy(
      "Test wrappedERC20 token",
      "WTEST"
    );
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    return {
      wrappedToken,
      owner,
      other,
      ZERO_ADDRESS,
    };
  }

  describe("should be mintable", function () {
    it("should throw transferMintship if not owner", async function () {
      const { wrappedToken, other } = await loadFixture(deployGatewayFixture);
      await expect(
        wrappedToken.connect(other).transferMintship(other.address)
      ).to.be.revertedWith("only owner");
    });

    it("should change minter", async function () {
      const { wrappedToken, owner, other } = await loadFixture(
        deployGatewayFixture
      );
      expect(await wrappedToken.minter()).to.equal(owner.address);
      await expect(wrappedToken.transferMintship(other.address))
        .to.emit(wrappedToken, "MintshipTransferred")
        .withArgs(owner.address, other.address);
      expect(await wrappedToken.minter()).to.equal(other.address);
    });

    it("should throw exception on transferMintship(address(0))", async function () {
      const { wrappedToken, ZERO_ADDRESS } = await loadFixture(
        deployGatewayFixture
      );
      await expect(
        wrappedToken.transferMintship(ZERO_ADDRESS)
      ).to.be.revertedWith("zero address");
    });
  });
});
