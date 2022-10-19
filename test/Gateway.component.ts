import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  claimNativeStep,
  claimStep,
  createSig,
  deployGatewayFixture,
  enableChain,
  getSignature,
  setTokens,
  transferErc20Step,
  transferStep,
  updateSignerStep,
} from "../steps/gateway.common";
import {
  EXTERNAL_SOURCE_CHAIN_ID,
  TRANSPORT_SOURCE_CHAIN_ID,
  ZERO_ADDRESS,
} from "./data/constants";

// INIT data
const tokenStartBalance = 13;
const amount = 3210000n;
const gasFee = 1230000n;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const data = require("./data/claim.data.json");

/**
 * MEMO:        1) check fee chain ID with transferFee
 */
describe("Gateway", function () {
  describe("[UNIT] should be initialized", function () {
    it("should set the right chainId", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      expect(await gateway.chainId()).to.equal(EXTERNAL_SOURCE_CHAIN_ID);
    });
  });

  describe("[UNIT] should be ownable", function () {
    it("should throw transferOwnershipRequest if not owner", async function () {
      // await step('should throw transferOwnershipRequest if not owner', async () => {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.connect(other).transferOwnershipRequest(other.address)
      ).to.be.revertedWith("only owner");
      // });
    });

    it("should throw transferOwnership if not owner", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.connect(other).transferOwnership()
      ).to.be.revertedWith("only owner");
    });

    it("should throw exception on transferOwnershipRequest(address(0))", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.transferOwnershipRequest(ZERO_ADDRESS)
      ).to.be.revertedWith("zero address");
    });

    it("should change candidate after transfer", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      expect(await gateway.candidate()).to.equal(ZERO_ADDRESS);
      await expect(await gateway.transferOwnershipRequest(other.address))
        .to.emit(gateway, "OwnershipRequest")
        .withArgs(owner.address, other.address);
      expect(await gateway.candidate()).to.equal(other.address);
      expect(await gateway.owner()).to.equal(owner.address);
    });

    it("should change owner after transferOwnership", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      expect(await gateway.owner()).to.equal(owner.address);
      expect(await gateway.candidate()).to.equal(ZERO_ADDRESS);
      const tx = await gateway.transferOwnershipRequest(other.address);
      await tx.wait();
      expect(await gateway.candidate()).to.equal(other.address);
      await expect(await gateway.transferOwnership())
        .to.emit(gateway, "OwnershipTransferred")
        .withArgs(owner.address, other.address);
      expect(await gateway.owner()).to.equal(other.address);
      expect(await gateway.candidate()).to.equal(ZERO_ADDRESS);
    });

    it("should throw exception on transferOwnership() for empty candidate", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(gateway.transferOwnership()).to.be.revertedWith(
        "zero address"
      );
    });
  });

  describe("[UNIT] should be pausable", function () {
    it("should throw pause if not owner", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(gateway.connect(other).pause()).to.be.revertedWith(
        "only owner"
      );
    });

    it("should throw unpause if not owner", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(gateway.connect(other).unpause()).to.be.revertedWith(
        "only owner"
      );
    });

    it("should pause", async function () {
      const { gateway, owner } = await loadFixture(deployGatewayFixture);
      expect(await gateway.paused()).to.equal(false);
      await expect(await gateway.pause())
        .to.emit(gateway, "Paused")
        .withArgs(owner.address);
      expect(await gateway.paused()).to.equal(true);
    });

    it("should throw if already paused", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await gateway.pause();
      await expect(gateway.pause()).to.be.revertedWith("paused");
    });

    it("should unpause", async function () {
      const { gateway, owner } = await loadFixture(deployGatewayFixture);
      expect(await gateway.paused()).to.equal(false);
      await gateway.pause();
      expect(await gateway.paused()).to.equal(true);
      await expect(await gateway.unpause())
        .to.emit(gateway, "Unpaused")
        .withArgs(owner.address);
      expect(await gateway.paused()).to.equal(false);
    });

    it("should throw if already unpaused", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(gateway.unpause()).to.be.revertedWith("not paused");
      await gateway.pause();
      await gateway.unpause();
      await expect(gateway.unpause()).to.be.revertedWith("not paused");
    });
  });

  describe("[UNIT] should be signable", function () {
    it("should throw updateSignerRequest if not owner", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.connect(other).updateSignerRequest(other.address)
      ).to.be.revertedWith("only owner");
    });

    it("should throw exception on updateSignerRequest(address(0))", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.updateSignerRequest(ZERO_ADDRESS)
      ).to.be.revertedWith("zero address");
    });

    it("should change signerCandidate after updateSignerRequest", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      expect(await gateway.signerCandidate()).to.equal(ZERO_ADDRESS);
      expect(await gateway.protocolSigner()).to.equal(ZERO_ADDRESS);
      await expect(await gateway.updateSignerRequest(other.address))
        .to.emit(gateway, "UpdateSignerRequest")
        .withArgs(owner.address, other.address);
      expect(await gateway.signerCandidate()).to.equal(other.address);
      expect(await gateway.protocolSigner()).to.equal(ZERO_ADDRESS);
    });

    it("should change owner after updateSigner", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      expect(await gateway.signerCandidate()).to.equal(ZERO_ADDRESS);
      expect(await gateway.protocolSigner()).to.equal(ZERO_ADDRESS);
      await gateway.updateSignerRequest(other.address);
      expect(await gateway.signerCandidate()).to.equal(other.address);
      expect(await gateway.protocolSigner()).to.equal(ZERO_ADDRESS);
      await gateway.pause();
      await expect(await gateway.updateSigner())
        .to.emit(gateway, "UpdateSigner")
        .withArgs(owner.address, ZERO_ADDRESS, other.address);
      expect(await gateway.protocolSigner()).to.equal(other.address);
      expect(await gateway.signerCandidate()).to.equal(ZERO_ADDRESS);
    });

    it("should throw exception on updateSigner() not paused", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(gateway.updateSigner()).to.be.revertedWith("not paused");
    });

    it("should throw exception on updateSigner() for empty candidate", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await gateway.pause();
      await expect(gateway.updateSigner()).to.be.revertedWith("zero address");
    });
  });

  describe("should be emergencible", function () {
    it("should throw emergencyRequest if not owner", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway
          .connect(other)
          .emergencyWithdrawRequest(ZERO_ADDRESS, other.address)
      ).to.be.revertedWith("only owner");
    });

    it("should throw emergency if not owner", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.connect(other).emergencyWithdraw(ZERO_ADDRESS)
      ).to.be.revertedWith("only owner");
    });

    it("should throw exception on emergencyRequest(_, address(0))", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.emergencyWithdrawRequest(ZERO_ADDRESS, ZERO_ADDRESS)
      ).to.be.revertedWith("zero address");
    });

    it("should add emergency request", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
        ZERO_ADDRESS
      );
      await expect(
        await gateway.emergencyWithdrawRequest(ZERO_ADDRESS, other.address)
      )
        .to.emit(gateway, "EmergencyWithdrawRequest")
        .withArgs(owner.address, ZERO_ADDRESS, other.address);
      expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
        other.address
      );
    });

    it("should emergency native", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
        ZERO_ADDRESS
      );
      await gateway.emergencyWithdrawRequest(ZERO_ADDRESS, other.address);
      expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
        other.address
      );
      await gateway.pause();
      await owner.sendTransaction({ to: gateway.address, value: 10n ** 18n });
      await expect(await gateway.emergencyWithdraw(ZERO_ADDRESS))
        .to.emit(gateway, "EmergencyWithdraw")
        .withArgs(owner.address, ZERO_ADDRESS, other.address)
        .to.changeEtherBalances(
          [gateway.address, other.address],
          [-(10n ** 18n), 10n ** 18n]
        );
      expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
        ZERO_ADDRESS
      );
    });

    it("should emergency ERC20", async function () {
      const { gateway, owner, other, token } = await loadFixture(
        deployGatewayFixture
      );
      expect(await gateway.emergencyWithdrawRequests(token.address)).to.equal(
        ZERO_ADDRESS
      );
      await gateway.emergencyWithdrawRequest(token.address, other.address);
      expect(await gateway.emergencyWithdrawRequests(token.address)).to.equal(
        other.address
      );
      await gateway.pause();
      await token.transfer(gateway.address, 10n ** 18n);
      await expect(await gateway.emergencyWithdraw(token.address))
        .to.emit(gateway, "EmergencyWithdraw")
        .withArgs(owner.address, token.address, other.address)
        .to.changeTokenBalances(
          token,
          [gateway.address, other.address],
          [-(10n ** 18n), 10n ** 18n]
        );
      expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
        ZERO_ADDRESS
      );
    });

    it("should throw exception on emergency() for native balance = 0", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await gateway.emergencyWithdrawRequest(ZERO_ADDRESS, other.address);
      await gateway.pause();
      await expect(gateway.emergencyWithdraw(ZERO_ADDRESS)).to.be.revertedWith(
        "insufficient funds"
      );
    });

    it("should throw exception on emergency() for ERC20 balance = 0", async function () {
      const { gateway, other, token } = await loadFixture(deployGatewayFixture);
      await gateway.emergencyWithdrawRequest(token.address, other.address);
      await gateway.pause();
      await expect(gateway.emergencyWithdraw(token.address)).to.be.revertedWith(
        "insufficient funds"
      );
    });

    it("should throw exception on emergency() not paused", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(gateway.emergencyWithdraw(ZERO_ADDRESS)).to.be.revertedWith(
        "not paused"
      );
    });

    it("should throw exception on emergency() for empty request", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await gateway.pause();
      await expect(gateway.emergencyWithdraw(ZERO_ADDRESS)).to.be.revertedWith(
        "zero address"
      );
    });
  });

  describe("should update target chain", function () {
    it("should throw updateTargetChain if not owner", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.connect(other).updateTargetChain(2, true)
      ).to.be.revertedWith("only owner");
    });

    it("should throw updateTargetChain if targetChainId == EXTERNAL_SOURCE_CHAIN_ID", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.updateTargetChain(EXTERNAL_SOURCE_CHAIN_ID, true)
      ).to.be.revertedWith("source chain ID");
    });

    it("should update target chain", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      expect(await gateway.chains(0)).to.equal(false);
      await gateway.updateTargetChain(0, true);
      expect(await gateway.chains(0)).to.equal(true);
    });
  });

  describe("should update token", function () {
    it("should throw updateToken if not owner", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway
          .connect(other)
          .updateToken(0, ZERO_ADDRESS, "", 10, 1, 100, 2000, 1000, true, false)
      ).to.be.revertedWith("only owner");
    });

    it("should throw updateTargetChain if targetChainId is disabled", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.updateToken(
          0,
          ZERO_ADDRESS,
          "",
          10,
          1,
          100,
          2000,
          1000,
          true,
          false
        )
      ).to.be.revertedWith("disabled");
    });

    it("should throw updateTargetChain if wrapped && native", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.updateToken(
          0,
          ZERO_ADDRESS,
          "",
          10,
          1,
          100,
          2000,
          1000,
          true,
          true
        )
      ).to.be.revertedWith("native");
    });

    it("should update on native token", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      expect(await gateway.tokens(0, ZERO_ADDRESS)).to.deep.equal([
        ethers.BigNumber.from("0"),
        ethers.BigNumber.from("0"),
        ethers.BigNumber.from("0"),
        ethers.BigNumber.from("0"),
        ethers.BigNumber.from("0"),
        "",
        0,
      ]);
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        ZERO_ADDRESS,
        "TEST",
        10,
        1,
        100,
        2000,
        1000,
        true,
        false
      );
      expect(await gateway.tokens(0, ZERO_ADDRESS)).to.deep.equal([
        ethers.BigNumber.from("10"),
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("100"),
        ethers.BigNumber.from("2000"),
        ethers.BigNumber.from("1000"),
        "TEST",
        1,
      ]);
      await gateway.updateToken(
        0,
        ZERO_ADDRESS,
        "TEST2",
        10,
        1,
        100,
        2000,
        1000,
        false,
        false
      );
      expect(await gateway.tokens(0, ZERO_ADDRESS)).to.deep.equal([
        ethers.BigNumber.from("10"),
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("100"),
        ethers.BigNumber.from("2000"),
        ethers.BigNumber.from("1000"),
        "TEST2",
        0,
      ]);
    });

    it("should update on ERC20 token", async function () {
      const { gateway, token } = await loadFixture(deployGatewayFixture);
      expect(await gateway.tokens(0, token.address)).to.deep.equal([
        ethers.BigNumber.from("0"),
        ethers.BigNumber.from("0"),
        ethers.BigNumber.from("0"),
        ethers.BigNumber.from("0"),
        ethers.BigNumber.from("0"),
        "",
        0,
      ]);
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        token.address,
        "TEST",
        10,
        1,
        100,
        2000,
        1000,
        true,
        false
      );
      expect(await gateway.tokens(0, token.address)).to.deep.equal([
        ethers.BigNumber.from("10"),
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("100"),
        ethers.BigNumber.from("2000"),
        ethers.BigNumber.from("1000"),
        "TEST",
        1,
      ]);
      await gateway.updateToken(
        0,
        token.address,
        "TEST2",
        10,
        1,
        100,
        2000,
        1000,
        false,
        false
      );
      expect(await gateway.tokens(0, token.address)).to.deep.equal([
        ethers.BigNumber.from("10"),
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("100"),
        ethers.BigNumber.from("2000"),
        ethers.BigNumber.from("1000"),
        "TEST2",
        0,
      ]);
      await gateway.updateToken(
        0,
        token.address,
        "TEST3",
        10,
        1,
        100,
        2000,
        1000,
        true,
        true
      );
      expect(await gateway.tokens(0, token.address)).to.deep.equal([
        ethers.BigNumber.from("10"),
        ethers.BigNumber.from("1"),
        ethers.BigNumber.from("100"),
        ethers.BigNumber.from("2000"),
        ethers.BigNumber.from("1000"),
        "TEST3",
        3,
      ]);
    });
  });

  describe("should chargeback untracked balance", function () {
    it("should throw chargebackUntracked if not owner", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway
          .connect(other)
          .chargebackUntracked(0, ZERO_ADDRESS, other.address)
      ).to.be.revertedWith("only owner");
    });

    it("should throw chargebackUntracked if chargebackAddress == address(0)", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.chargebackUntracked(0, ZERO_ADDRESS, ZERO_ADDRESS)
      ).to.be.revertedWith("zero address");
    });

    it("should chargebackUntracked native", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      const tx = await owner.sendTransaction({
        to: gateway.address,
        value: 10n ** 18n,
      });
      await tx.wait();
      await expect(
        await gateway.chargebackUntracked(0, ZERO_ADDRESS, other.address)
      ).to.changeEtherBalances(
        [gateway.address, other.address],
        [-(10n ** 18n), 10n ** 18n]
      );
    });

    it("should chargebackUntracked ERC20", async function () {
      const { gateway, other, token } = await loadFixture(deployGatewayFixture);
      await token.transfer(gateway.address, 10n ** 18n);
      await expect(
        await gateway.chargebackUntracked(0, token.address, other.address)
      ).to.changeTokenBalances(
        token,
        [gateway.address, other.address],
        [-(10n ** 18n), 10n ** 18n]
      );
    });

    it("should chargebackUntracked wrapped ERC20", async function () {
      const { gateway, other, wrappedToken } = await loadFixture(
        deployGatewayFixture
      );
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        wrappedToken.address,
        "WTEST",
        ethers.utils.parseEther("0.5"),
        ethers.utils.parseEther("0.1"),
        ethers.utils.parseEther("2"),
        1000,
        2000,
        true,
        true
      );
      await wrappedToken.mint(gateway.address, 10n ** 18n);
      await expect(
        await gateway.chargebackUntracked(
          0,
          wrappedToken.address,
          other.address
        )
      ).to.changeTokenBalances(
        wrappedToken,
        [gateway.address, other.address],
        [-(10n ** 18n), 10n ** 18n]
      );
    });

    it("should throw when native token balance = 0", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.chargebackUntracked(0, ZERO_ADDRESS, other.address)
      ).to.be.revertedWith("uncorrect amount");
    });

    it("should throw when ERC20 BALANCE = 0", async function () {
      const { gateway, other, token } = await loadFixture(deployGatewayFixture);
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        token.address,
        await token.symbol(),
        0,
        0,
        0,
        0,
        0,
        true,
        false
      );
      await expect(
        gateway.chargebackUntracked(0, token.address, other.address)
      ).to.be.revertedWith("uncorrect amount");
    });

    it("should throw when wrapped ERC20 balance = 0", async function () {
      const { gateway, other, wrappedToken } = await loadFixture(
        deployGatewayFixture
      );
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        wrappedToken.address,
        await wrappedToken.symbol(),
        0,
        0,
        0,
        0,
        0,
        true,
        false
      );
      await expect(
        gateway.chargebackUntracked(0, wrappedToken.address, other.address)
      ).to.be.revertedWith("uncorrect amount");
    });
  });

  describe("should transfer", function () {
    it("should throw transfer if target chain is disabled", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(gateway.transfer(33, ZERO_ADDRESS, 0)).to.be.revertedWith(
        "target chain is disable"
      );
    });

    it("should throw transfer if token is disable", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await gateway.updateTargetChain(0, true);
      await expect(gateway.transfer(0, other.address, 0)).to.be.revertedWith(
        "token is disable"
      );
    });

    it("should throw transfer if amount < minAmount", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        ZERO_ADDRESS,
        "TEST",
        10,
        1,
        100,
        2000,
        1000,
        true,
        false
      );
      await expect(gateway.transfer(0, other.address, 0)).to.be.revertedWith(
        "less than min amount"
      );
    });

    it("should throw transfer if fee > amount", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        ZERO_ADDRESS,
        "TEST",
        10,
        1,
        100,
        1000000,
        1000000,
        true,
        false
      );
      await expect(
        gateway.transfer(0, other.address, 0, { value: 1000 })
      ).to.be.revertedWith("fee more than amount");
    });

    it("should throw transfer if amount = 0", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        ZERO_ADDRESS,
        "TEST",
        0,
        1,
        100,
        1000000,
        1000000,
        true,
        false
      );
      await expect(
        gateway.transfer(0, other.address, 0, { value: 0 })
      ).to.be.revertedWith("zero amount");
    });

    it("should throw transfer if claim reward > amount", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        ZERO_ADDRESS,
        "TEST",
        0,
        ethers.utils.parseEther("1"),
        0,
        0,
        0,
        true,
        false
      );
      await expect(
        gateway.transfer(0, other.address, ethers.utils.parseEther("1"), {
          value: ethers.utils.parseEther("2"),
        })
      ).to.be.revertedWith("gassless claim reward more than amount");
    });

    it("should transfer", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        ZERO_ADDRESS,
        "TEST",
        ethers.utils.parseEther("0.5"),
        ethers.utils.parseEther("0.1"),
        ethers.utils.parseEther("2"),
        1000,
        2000,
        true,
        false
      );
      await transferStep(gateway, owner, other.address, "1", "0.1", "TEST", [
        899000n,
        100000n,
      ]);
      expect(await gateway.fees(ZERO_ADDRESS)).to.equal(
        ethers.utils.parseEther("0.101")
      );
      expect(await gateway.balances(ZERO_ADDRESS)).to.equal(
        ethers.utils.parseEther("0.899")
      );
      // 1-0.1-0.001
    });

    it("should transfer treshold", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        ZERO_ADDRESS,
        "TEST",
        ethers.utils.parseEther("0.5"),
        ethers.utils.parseEther("0.1"),
        ethers.utils.parseEther("2"),
        1000,
        2000,
        true,
        false
      );
      await transferStep(gateway, owner, other.address, "10", "0.1", "TEST", [
        9880000n,
        100000n,
      ]);
      expect(await gateway.fees(ZERO_ADDRESS)).to.equal(
        ethers.utils.parseEther("0.12")
      );
      expect(await gateway.balances(ZERO_ADDRESS)).to.equal(
        ethers.utils.parseEther("9.88")
      );
    });

    it("should throw transfer address(0) token", async function () {
      const { gateway, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.transferERC20(
          0,
          ZERO_ADDRESS,
          ethers.utils.parseEther("0.5"),
          other.address,
          ethers.utils.parseEther("0.1")
        )
      ).to.be.revertedWith("unavaliable token");
    });

    it("should transferERC20", async function () {
      const { gateway, token, owner, other } = await loadFixture(
        deployGatewayFixture
      );
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        token.address,
        "TEST",
        ethers.utils.parseEther("0.5"),
        ethers.utils.parseEther("0.1"),
        ethers.utils.parseEther("2"),
        1000,
        2000,
        true,
        false
      );
      await token.approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        other.address,
        "0.5",
        "0.1",
        [-500000000000000000n, 500000000000000000n],
        token,
        [399500n, 100000n]
      );
      expect(await gateway.fees(token.address)).to.equal(
        ethers.utils.parseEther("0.1005")
      );
      expect(await gateway.balances(token.address)).to.equal(
        ethers.utils.parseEther("0.3995")
      );
      // 1-0.1-0.001
    });

    it("should transferERC20 wrapped token", async function () {
      const { gateway, wrappedToken, owner, other } = await loadFixture(
        deployGatewayFixture
      );
      await gateway.updateTargetChain(0, true);
      await gateway.updateToken(
        0,
        wrappedToken.address,
        "WTEST",
        ethers.utils.parseEther("0.5"),
        ethers.utils.parseEther("0.1"),
        ethers.utils.parseEther("2"),
        1000,
        2000,
        true,
        true
      );
      await wrappedToken.approve(
        gateway.address,
        ethers.utils.parseEther("100")
      );
      await wrappedToken.mint(owner.address, ethers.utils.parseEther("10"));
      await transferErc20Step(
        gateway,
        owner,
        other.address,
        "0.5",
        "0.1",
        [-500000000000000000n, 0n],
        wrappedToken,
        [399500n, 100000n]
      );
      expect(await gateway.fees(wrappedToken.address)).to.equal(
        ethers.utils.parseEther("0.1005")
      );
      expect(await gateway.balances(wrappedToken.address)).to.equal(0);
      // 1-0.1-0.001
    });

    it("should throw with native token on transferERC20", async function () {
      const { gateway, owner, other } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway
          .connect(owner)
          .transferERC20(
            TRANSPORT_SOURCE_CHAIN_ID,
            ZERO_ADDRESS,
            ethers.utils.parseEther("1.23"),
            other.address,
            ethers.utils.parseEther("0.56")
          )
      ).to.be.revertedWith("unavaliable token");
    });
  });

  describe("should transfer fee", function () {
    it("simple positive test", async function () {
      const { gateway, owner, signer, third, token } = await loadFixture(
        deployGatewayFixture
      );
      const block = (await ethers.provider.getBlockNumber()) - 1;
      await updateSignerStep(gateway, signer.address);
      await enableChain(gateway, owner, TRANSPORT_SOURCE_CHAIN_ID);
      const signature = await createSig(
        ["uint", "uint128", "address"],
        [block, EXTERNAL_SOURCE_CHAIN_ID, token.address],
        signer
      );
      await gateway
        .connect(owner)
        .updateToken(
          0,
          token.address,
          await token.symbol(),
          0,
          ethers.utils.parseEther("1"),
          0,
          0,
          0,
          true,
          false
        );
      // create fee
      await token
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        third.address,
        "5",
        "2",
        [-5000000000000000000n, 5000000000000000000n],
        token,
        [4000000n, 2000000n]
      );
      expect(await gateway.fees(token.address)).to.be.equal(
        ethers.utils.parseEther("1")
      );
      // transfer fee
      const startBalance = await gateway.balances(token.address);
      await expect(
        gateway.connect(owner).transferFee(token.address, block, signature)
      )
        .to.emit(gateway, "TransferFee")
        .withArgs(
          EXTERNAL_SOURCE_CHAIN_ID,
          TRANSPORT_SOURCE_CHAIN_ID,
          1000000,
          await token.symbol(),
          owner.address
        );
      expect(
        await (await gateway.balances(token.address)).toBigInt()
      ).to.be.equal(startBalance.toBigInt() + 1000000000000000000n);
    });

    it("should throw transferFee if block in future", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      const block = await ethers.provider.getBlockNumber();
      await expect(
        gateway.transferFee(ZERO_ADDRESS, block + 1000000, [])
      ).to.be.revertedWith("invalid block");
    });

    xit("should throw transferFee if block in past", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      const block = await ethers.provider.getBlockNumber();
      await expect(
        gateway.transferFee(ZERO_ADDRESS, block - 10000, [])
      ).to.be.revertedWith("invalid block");
    });

    it("should throw transferFee if signature is invalid", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(gateway.transferFee(ZERO_ADDRESS, 1, [])).to.be.revertedWith(
        "standart signature only"
      );
    });

    it("should throw transferFee if signer is not valid", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.transferFee(
          ZERO_ADDRESS,
          1,
          "0x9242685bf161793cc25603c231bc2f568eb630ea16aa137d2664ac80388256084f8ae3bd7535248d0bd448298cc2e2071e56992d0774dc340c368ae950852ada1c"
        )
      ).to.be.revertedWith("only protocol signer");
    });

    it("should throw when signer is correct but wrong data", async function () {
      const { gateway, owner, signer, token } = await loadFixture(
        deployGatewayFixture
      );
      const block = (await ethers.provider.getBlockNumber()) - 1;
      await updateSignerStep(gateway, signer.address);
      const signature = await createSig(
        ["uint", "uint128", "address"],
        [
          block,
          TRANSPORT_SOURCE_CHAIN_ID, // error here - incorrect chain ID
          token.address,
        ],
        signer
      );
      await expect(
        gateway.connect(owner).transferFee(token.address, block, signature)
      ).to.be.revertedWith("only protocol signer");
    });

    it("should throw transferFee if WAVES is disabled", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.transferFee(
          ZERO_ADDRESS,
          1,
          "0x8ecd9d9f1ece5bd0ea1638d9a05bc194bb7536aed42fd6a09fbeb1a9479c316760ce3ff2dfbf73ad7a488e6d46988a443430a13153b26b99a83d1101d00e36bb00"
        )
      ).to.be.revertedWith("invalid signature 'v' value");
    });

    it("should throw transferFee if WAVES is disabled", async function () {
      const { gateway } = await loadFixture(deployGatewayFixture);
      await expect(
        gateway.transferFee(
          ZERO_ADDRESS,
          1,
          "0x8ecd9d9f1ece5bd0ea1638d9a05bc194bb7536aed42fd6a09fbeb1a9479c3167ffce3ff2dfbf73ad7a488e6d46988a443430a13153b26b99a83d1101d00e36bb00"
        )
      ).to.be.revertedWith("invalid signature 's' value");
    });

    it("should throw when fee chain disabled", async function () {
      const { gateway, owner, signer, token } = await loadFixture(
        deployGatewayFixture
      );
      const block = (await ethers.provider.getBlockNumber()) - 1;
      await updateSignerStep(gateway, signer.address);
      const signature = await createSig(
        ["uint", "uint128", "address"],
        [block, EXTERNAL_SOURCE_CHAIN_ID, token.address],
        signer
      );
      await expect(
        gateway.connect(owner).transferFee(token.address, block, signature)
      ).to.be.revertedWith("Fee chain is disable");
    });

    it("should throw when token is disabled", async function () {
      const { gateway, owner, signer, token } = await loadFixture(
        deployGatewayFixture
      );
      const block = (await ethers.provider.getBlockNumber()) - 1;
      await updateSignerStep(gateway, signer.address);
      await enableChain(gateway, owner, TRANSPORT_SOURCE_CHAIN_ID);
      const signature = await createSig(
        ["uint", "uint128", "address"],
        [block, EXTERNAL_SOURCE_CHAIN_ID, token.address],
        signer
      );
      await expect(
        gateway.connect(owner).transferFee(token.address, block, signature)
      ).to.be.revertedWith("token is disable");
    });

    it("have no balances[] change on transferFee from wrapped ERC20 token", async function () {
      const { gateway, owner, signer, third, wrappedToken } = await loadFixture(
        deployGatewayFixture
      );
      const block = (await ethers.provider.getBlockNumber()) - 1;
      await updateSignerStep(gateway, signer.address);
      await enableChain(gateway, owner, TRANSPORT_SOURCE_CHAIN_ID);
      const signature = await createSig(
        ["uint", "uint128", "address"],
        [block, EXTERNAL_SOURCE_CHAIN_ID, wrappedToken.address],
        signer
      );
      await gateway
        .connect(owner)
        .updateToken(
          0,
          wrappedToken.address,
          await wrappedToken.symbol(),
          0,
          ethers.utils.parseEther("1"),
          0,
          0,
          0,
          true,
          true
        );
      expect(
        await wrappedToken.mint(
          owner.address,
          ethers.utils.parseEther(tokenStartBalance.toString())
        )
      ).to.changeTokenBalance(
        wrappedToken,
        owner.address,
        ethers.utils.parseEther(tokenStartBalance.toString())
      );
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        third.address,
        "5",
        "2",
        [-5000000000000000000n, 0n],
        wrappedToken,
        [4000000n, 2000000n]
      );
      expect(await gateway.fees(wrappedToken.address)).to.be.equal(
        ethers.utils.parseEther("1")
      );
      // transfer fee
      const startBalance = await gateway.balances(wrappedToken.address);
      await expect(
        gateway
          .connect(owner)
          .transferFee(wrappedToken.address, block, signature)
      )
        .to.emit(gateway, "TransferFee")
        .withArgs(
          EXTERNAL_SOURCE_CHAIN_ID,
          TRANSPORT_SOURCE_CHAIN_ID,
          1000000,
          await wrappedToken.symbol(),
          owner.address
        );
      expect(await gateway.balances(wrappedToken.address)).to.be.equal(
        startBalance
      );
    });

    it("can transfer fee for native (ETH)", async function () {
      const { gateway, owner, signer, third } = await loadFixture(
        deployGatewayFixture
      );
      const block = (await ethers.provider.getBlockNumber()) - 1;
      await updateSignerStep(gateway, signer.address);
      await enableChain(gateway, owner, TRANSPORT_SOURCE_CHAIN_ID);
      const signature = await createSig(
        ["uint", "uint128", "address"],
        [block, EXTERNAL_SOURCE_CHAIN_ID, ZERO_ADDRESS],
        signer
      );
      // enable token
      await gateway
        .connect(owner)
        .updateToken(
          0,
          ZERO_ADDRESS,
          "ETH",
          0,
          ethers.utils.parseEther("1"),
          0,
          0,
          0,
          true,
          false
        );
      // create fee
      await transferStep(gateway, owner, third.address, "5", "2", "ETH", [
        4000000n,
        2000000n,
      ]);
      expect(await gateway.fees(ZERO_ADDRESS)).to.be.equal(
        ethers.utils.parseEther("1")
      );
      // transfer fee
      const startBalance = await gateway.balances(ZERO_ADDRESS);

      await expect(
        gateway.connect(owner).transferFee(ZERO_ADDRESS, block, signature)
      )
        .to.emit(gateway, "TransferFee")
        .withArgs(
          EXTERNAL_SOURCE_CHAIN_ID,
          TRANSPORT_SOURCE_CHAIN_ID,
          1000000,
          "ETH",
          owner.address
        );
      expect(
        await (await gateway.balances(ZERO_ADDRESS)).toBigInt()
      ).to.be.equal(startBalance.toBigInt() + 1000000000000000000n);
    });

    it("should throw when sent duplicate data", async function () {
      const { gateway, owner, signer, third } = await loadFixture(
        deployGatewayFixture
      );
      const block = (await ethers.provider.getBlockNumber()) - 1;
      await updateSignerStep(gateway, signer.address);
      await enableChain(gateway, owner, TRANSPORT_SOURCE_CHAIN_ID);
      const signature = await createSig(
        ["uint", "uint128", "address"],
        [block, EXTERNAL_SOURCE_CHAIN_ID, ZERO_ADDRESS],
        signer
      );
      // enable token
      await gateway
        .connect(owner)
        .updateToken(
          0,
          ZERO_ADDRESS,
          "ETH",
          0,
          ethers.utils.parseEther("1"),
          0,
          0,
          0,
          true,
          false
        );
      // create fee
      await transferStep(gateway, owner, third.address, "5", "2", "ETH", [
        4000000n,
        2000000n,
      ]);
      expect(await gateway.fees(ZERO_ADDRESS)).to.be.equal(
        ethers.utils.parseEther("1")
      );
      // transfer fee
      await expect(
        gateway.connect(owner).transferFee(ZERO_ADDRESS, block, signature)
      )
        .to.emit(gateway, "TransferFee")
        .withArgs(
          EXTERNAL_SOURCE_CHAIN_ID,
          TRANSPORT_SOURCE_CHAIN_ID,
          1000000,
          "ETH",
          owner.address
        );
      await expect(
        gateway.connect(owner).transferFee(ZERO_ADDRESS, block, signature)
      ).to.be.revertedWith("duplicate data");
    });

    it("can invoke trasferFee with empty fee", async function () {
      const { gateway, owner, signer } = await loadFixture(
        deployGatewayFixture
      );
      const block = (await ethers.provider.getBlockNumber()) - 1;
      await updateSignerStep(gateway, signer.address);
      await enableChain(gateway, owner, TRANSPORT_SOURCE_CHAIN_ID);
      const signature = await createSig(
        ["uint", "uint128", "address"],
        [block, EXTERNAL_SOURCE_CHAIN_ID, ZERO_ADDRESS],
        signer
      );
      // enable token
      await gateway
        .connect(owner)
        .updateToken(
          0,
          ZERO_ADDRESS,
          "ETH",
          0,
          ethers.utils.parseEther("1"),
          0,
          0,
          0,
          true,
          false
        );
      // check that fee is empty
      expect(await gateway.fees(ZERO_ADDRESS)).to.be.equal(0);
      // transfer fee

      // await contract.connect(owner).transferFee(token.address, block, signature);
      await expect(
        gateway.connect(owner).transferFee(ZERO_ADDRESS, block, signature)
      )
        .to.emit(gateway, "TransferFee")
        .withArgs(
          EXTERNAL_SOURCE_CHAIN_ID,
          TRANSPORT_SOURCE_CHAIN_ID,
          0,
          "ETH",
          owner.address
        );
    });
  });

  describe("should claim", function () {
    it("Simple test with claim ERC20 token to sender", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await setTokens(gateway, owner, token, wrappedToken);
      await token.transfer(
        owner.address,
        ethers.utils.parseEther(tokenStartBalance.toString())
      );
      await token
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 10000000000000000000n],
        token,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        token.address,
        other.address,
        currentTxHash
      );
      await claimStep(
        gateway,
        other,
        other.address,
        token,
        amount,
        gasFee,
        currentTxHash,
        sigData.signature,
        [ethers.utils.parseEther("-3.21"), ethers.utils.parseEther("3.21")]
      );
      expect(await token.balanceOf(other.address)).to.be.equal(
        ethers.utils.parseEther("3.21")
      );
    });

    it("can claim ERC20 wrapped token", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 0n],
        wrappedToken,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        wrappedToken.address,
        other.address,
        currentTxHash
      );
      await claimStep(
        gateway,
        other,
        other.address,
        wrappedToken,
        amount,
        gasFee,
        currentTxHash,
        sigData.signature,
        [ethers.utils.parseEther("0"), ethers.utils.parseEther("3.21")]
      );
    });

    it("can claim ETH", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await setTokens(gateway, owner, token, wrappedToken);
      await transferStep(
        gateway,
        owner,
        gateway.address,
        tokenStartBalance.toString(),
        "0",
        "ETH",
        [13000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        ZERO_ADDRESS,
        other.address,
        currentTxHash
      );
      await claimNativeStep(
        gateway,
        other,
        other.address,
        amount,
        gasFee,
        currentTxHash,
        sigData.signature,
        [ethers.utils.parseEther("-3.21"), ethers.utils.parseEther("3.21")]
      );
    });

    it("can claim ETH to third used", async function () {
      const { gateway, token, wrappedToken, owner, other, signer, third } =
        await loadFixture(deployGatewayFixture);
      await setTokens(gateway, owner, token, wrappedToken);
      await transferStep(
        gateway,
        owner,
        gateway.address,
        tokenStartBalance.toString(),
        "0",
        "ETH",
        [13000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        ZERO_ADDRESS,
        third.address,
        currentTxHash
      );
      await claimNativeStep(
        gateway,
        other,
        third.address,
        amount,
        gasFee,
        currentTxHash,
        sigData.signature,
        [
          ethers.utils.parseEther("-3.21"),
          ethers.utils.parseEther("1.23"),
          ethers.utils.parseEther("1.98"),
        ],
        [gateway.address, other.address, third.address]
      );
    });

    it("can claim ERC20 token to third", async function () {
      const { gateway, token, wrappedToken, owner, other, signer, third } =
        await loadFixture(deployGatewayFixture);
      await setTokens(gateway, owner, token, wrappedToken);
      await token.transfer(
        owner.address,
        ethers.utils.parseEther(tokenStartBalance.toString())
      );
      await token
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 10000000000000000000n],
        token,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        token.address,
        third.address,
        currentTxHash
      );
      await claimStep(
        gateway,
        other,
        third.address,
        token,
        amount,
        gasFee,
        currentTxHash,
        sigData.signature,
        [
          ethers.utils.parseEther("-3.21"),
          ethers.utils.parseEther("1.23"),
          ethers.utils.parseEther("1.98"),
        ],
        [gateway.address, other.address, third.address]
      );
      expect(await token.balanceOf(other.address)).to.be.equal(
        ethers.utils.parseEther("1.23")
      );
      expect(await token.balanceOf(third.address)).to.be.equal(
        ethers.utils.parseEther("1.98")
      );
    });

    it("can claim ERC20 wrapped token to third", async function () {
      const { gateway, token, wrappedToken, owner, other, signer, third } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 0n],
        wrappedToken,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        wrappedToken.address,
        third.address,
        currentTxHash
      );
      await claimStep(
        gateway,
        other,
        third.address,
        wrappedToken,
        amount,
        gasFee,
        currentTxHash,
        sigData.signature,
        [
          ethers.utils.parseEther("0"),
          ethers.utils.parseEther("1.23"),
          ethers.utils.parseEther("1.98"),
        ],
        [gateway.address, other.address, third.address]
      );
      expect(await wrappedToken.balanceOf(other.address)).to.be.equal(
        ethers.utils.parseEther("1.23")
      );
      expect(await wrappedToken.balanceOf(third.address)).to.be.equal(
        ethers.utils.parseEther("1.98")
      );
    });

    it("should throw when data duplicated", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 0n],
        wrappedToken,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        wrappedToken.address,
        other.address,
        currentTxHash
      );
      expect(
        await gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            wrappedToken.address,
            amount,
            gasFee,
            other.address,
            currentTxHash,
            sigData.signature
          )
      ).to.emit(gateway, "Claim");
      await expect(
        gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            wrappedToken.address,
            amount,
            gasFee,
            other.address,
            currentTxHash,
            sigData.signature
          )
      ).to.be.revertedWith("duplicate data");
    });

    it("should throw when source and destination chains the same", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 0n],
        wrappedToken,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        EXTERNAL_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        wrappedToken.address,
        other.address,
        currentTxHash
      );
      await expect(
        gateway
          .connect(other)
          .claim(
            EXTERNAL_SOURCE_CHAIN_ID,
            wrappedToken.address,
            amount,
            gasFee,
            other.address,
            currentTxHash,
            sigData.signature
          )
      ).to.be.revertedWith("uncompatible chains");
    });

    it("should throw when signer is not-approved", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 0n],
        wrappedToken,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        wrappedToken.address,
        other.address,
        currentTxHash
      );
      await expect(
        gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            wrappedToken.address,
            amount,
            gasFee,
            other.address,
            currentTxHash,
            sigData.signature
          )
      ).to.be.revertedWith("only protocol signer");
    });

    it("should throw when signer is correct but wrong data", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 0n],
        wrappedToken,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        TRANSPORT_SOURCE_CHAIN_ID, // incorrect there
        amount,
        gasFee,
        wrappedToken.address,
        other.address,
        currentTxHash
      );
      await expect(
        gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            wrappedToken.address,
            amount,
            gasFee,
            other.address,
            currentTxHash,
            sigData.signature
          )
      ).to.be.revertedWith("only protocol signer");
    });

    it("should throw with wrong token address", async function () {
      const { gateway, token, wrappedToken, owner, other, signer, third } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 0n],
        wrappedToken,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        third.address,
        other.address,
        currentTxHash
      );
      await expect(
        gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            third.address,
            amount,
            gasFee,
            other.address,
            currentTxHash,
            sigData.signature
          )
      ).to.be.reverted;
    });

    it("should throw with zero amount", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 0n],
        wrappedToken,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        0n,
        gasFee,
        wrappedToken.address,
        other.address,
        currentTxHash
      );
      await expect(
        gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            wrappedToken.address,
            0n,
            gasFee,
            other.address,
            currentTxHash,
            sigData.signature
          )
      ).to.be.revertedWith("zero amount");
    });

    data.claim_reward.forEach(function (i: any) {
      it(`should throw when uncorrect gaslessClaimReward value: ${i.name}`, async function () {
        const { gateway, token, wrappedToken, owner, other, signer, third } =
          await loadFixture(deployGatewayFixture);
        await wrappedToken
          .connect(owner)
          .mint(owner.address, ethers.utils.parseEther("134"));
        await setTokens(gateway, owner, token, wrappedToken);
        await wrappedToken
          .connect(owner)
          .approve(gateway.address, ethers.utils.parseEther("100"));
        await transferErc20Step(
          gateway,
          owner,
          gateway.address,
          "10",
          "0",
          [-10000000000000000000n, 0n],
          wrappedToken,
          [10000000n, 0n]
        );
        const currentTxHash = ethers.utils.randomBytes(32);
        await updateSignerStep(gateway, signer.address);
        const sigData = await getSignature(
          signer,
          TRANSPORT_SOURCE_CHAIN_ID,
          EXTERNAL_SOURCE_CHAIN_ID,
          i.data.amount,
          i.data.reward,
          wrappedToken.address,
          third.address,
          currentTxHash
        );
        await expect(
          gateway
            .connect(other)
            .claim(
              TRANSPORT_SOURCE_CHAIN_ID,
              wrappedToken.address,
              i.data.amount,
              i.data.reward,
              third.address,
              currentTxHash,
              sigData.signature
            )
        ).to.be.reverted;
      });
    });

    it("should throw when empty txHash", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 0n],
        wrappedToken,
        [10000000n, 0n]
      );
      const currentTxHash = Buffer.from("");
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        wrappedToken.address,
        other.address,
        currentTxHash
      );
      await expect(
        gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            wrappedToken.address,
            amount,
            gasFee,
            other.address,
            currentTxHash,
            sigData.signature
          )
      ).to.be.revertedWith("empty txHash");
    });

    it("should throw when try claim wrapped ERC20 with uncorrect chain ID", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferStep(
        gateway,
        owner,
        gateway.address,
        tokenStartBalance.toString(),
        "0",
        "ETH",
        [13000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        66138,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        wrappedToken.address,
        other.address,
        currentTxHash
      );
      await expect(
        gateway
          .connect(other)
          .claim(
            66138,
            wrappedToken.address,
            amount,
            gasFee,
            other.address,
            currentTxHash,
            sigData.signature
          )
      ).to.be.revertedWith("chain is not available");
    });

    it("should throw when claim wrapped ERC20 and recipient's address is zero", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await wrappedToken
        .connect(owner)
        .mint(owner.address, ethers.utils.parseEther("134"));
      await setTokens(gateway, owner, token, wrappedToken);
      await wrappedToken
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferStep(
        gateway,
        owner,
        gateway.address,
        tokenStartBalance.toString(),
        "0",
        "ETH",
        [13000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        wrappedToken.address,
        ZERO_ADDRESS,
        currentTxHash
      );
      const startBalance = await wrappedToken.balanceOf(other.address);
      await expect(
        gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            wrappedToken.address,
            amount,
            gasFee,
            ZERO_ADDRESS,
            currentTxHash,
            sigData.signature
          )
      ).to.be.reverted;
      expect(await wrappedToken.balanceOf(other.address)).to.be.equal(
        startBalance
      );
    });

    it("should throw when claim ERC20 and recipient's address is zero", async function () {
      const { gateway, token, wrappedToken, owner, other, signer } =
        await loadFixture(deployGatewayFixture);
      await setTokens(gateway, owner, token, wrappedToken);
      await token.transfer(
        owner.address,
        ethers.utils.parseEther(tokenStartBalance.toString())
      );
      await token
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 10000000000000000000n],
        token,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        gasFee,
        token.address,
        ZERO_ADDRESS,
        currentTxHash
      );
      const startBalance = await token.balanceOf(other.address);
      await expect(
        gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            token.address,
            amount,
            gasFee,
            ZERO_ADDRESS,
            currentTxHash,
            sigData.signature
          )
      ).to.be.reverted;
      expect(await token.balanceOf(other.address)).to.be.equal(startBalance);
    });

    it("should throw when zero claim reward with 3rd user claim", async function () {
      const { gateway, token, wrappedToken, owner, other, signer, third } =
        await loadFixture(deployGatewayFixture);
      await setTokens(gateway, owner, token, wrappedToken);
      await token.transfer(
        owner.address,
        ethers.utils.parseEther(tokenStartBalance.toString())
      );
      await token
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 10000000000000000000n],
        token,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        0n,
        token.address,
        third.address,
        currentTxHash
      );
      await expect(
        gateway
          .connect(other)
          .claim(
            TRANSPORT_SOURCE_CHAIN_ID,
            token.address,
            amount,
            0n,
            third.address,
            currentTxHash,
            sigData.signature
          )
      ).to.be.revertedWith("zero gasless claim reward");
    });

    it("can claim with zero claim reward for self", async function () {
      const { gateway, token, wrappedToken, owner, other, signer, third } =
        await loadFixture(deployGatewayFixture);
      await setTokens(gateway, owner, token, wrappedToken);
      await token.transfer(
        owner.address,
        ethers.utils.parseEther(tokenStartBalance.toString())
      );
      await token
        .connect(owner)
        .approve(gateway.address, ethers.utils.parseEther("100"));
      await transferErc20Step(
        gateway,
        owner,
        gateway.address,
        "10",
        "0",
        [-10000000000000000000n, 10000000000000000000n],
        token,
        [10000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      await updateSignerStep(gateway, signer.address);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        amount,
        0n,
        token.address,
        owner.address,
        currentTxHash
      );
      await claimStep(
        gateway,
        owner,
        owner.address,
        token,
        amount,
        0n,
        currentTxHash,
        sigData.signature,
        [ethers.utils.parseEther("3.21")],
        [owner.address]
      );
    });
  });

  describe("should change fee chain", function () {
    it("can change fee chain ID", async function () {
      const { gateway, owner } = await loadFixture(deployGatewayFixture);
      await gateway.pause();
      await expect(await gateway.connect(owner).updateFeeChain(6613))
        .to.emit(gateway, "FeeChainUpdated")
        .withArgs(6613, owner.address);
      await gateway.unpause();
      expect(await gateway.feeChainId()).to.be.equal(6613);
    });

    it("should throw when old and new fee chains equals", async function () {
      const { gateway, owner } = await loadFixture(deployGatewayFixture);
      await gateway.pause();
      await expect(gateway.connect(owner).updateFeeChain(0)).to.be.revertedWith(
        "equal chain ids"
      );
      await gateway.unpause();
    });
  });
});
