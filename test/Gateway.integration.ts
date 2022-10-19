import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  claimNativeStep,
  claimStep,
  deployGatewayFixture,
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

/**
 * MEMO:    1) can send wrapped tokens on contract when you lose in token settings (wrapped = false, eg.)
 */
describe("Gateway integration tests", function () {
  it("should throw when try chargeback after emergencyWithdraw", async function () {
    const { gateway, owner, other, third } = await loadFixture(
      deployGatewayFixture
    );
    expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
      ZERO_ADDRESS
    );
    await gateway.emergencyWithdrawRequest(ZERO_ADDRESS, other.address);
    expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
      other.address
    );
    // send transaction
    await owner.sendTransaction({
      to: gateway.address,
      value: ethers.utils.parseEther("10"),
    });
    // transfer funds
    await gateway.updateTargetChain(0, true);
    await gateway.updateToken(
      0,
      ZERO_ADDRESS,
      "ETH",
      0,
      0,
      0,
      0,
      0,
      true,
      false
    );
    await transferStep(gateway, owner, other.address, "10", "0", "ETH", [
      10000000n,
      0n,
    ]);
    // emergency withdraw
    await gateway.pause();
    await expect(await gateway.emergencyWithdraw(ZERO_ADDRESS))
      .to.emit(gateway, "EmergencyWithdraw")
      .withArgs(owner.address, ZERO_ADDRESS, other.address);
    expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
      ZERO_ADDRESS
    );
    await gateway.unpause();
    expect(await gateway.provider.getBalance(gateway.address)).to.be.equal(0);
    // try to withdraw funds
    await expect(
      gateway
        .connect(owner)
        .chargebackUntracked(
          TRANSPORT_SOURCE_CHAIN_ID,
          ZERO_ADDRESS,
          third.address
        )
    ).to.be.revertedWith("uncorrect amount");
  });

  it("can emergency withdraw after transfers and claims", async function () {
    const { gateway, owner, other, signer } = await loadFixture(
      deployGatewayFixture
    );
    // transfers and claims
    await gateway.updateTargetChain(0, true);
    await gateway.updateToken(
      0,
      ZERO_ADDRESS,
      "TEST",
      ethers.utils.parseEther("0.005"),
      ethers.utils.parseEther("0.001"),
      ethers.utils.parseEther("0.02"),
      1000,
      2000,
      true,
      false
    );
    await updateSignerStep(gateway, signer.address);
    for (let i = 0; i < 10; i++) {
      await transferStep(
        gateway,
        owner,
        other.address,
        "0.9",
        "0.001",
        "TEST",
        [897200n, 1000n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        800000n,
        0n,
        ZERO_ADDRESS,
        other.address,
        currentTxHash
      );
      await claimNativeStep(
        gateway,
        other,
        other.address,
        800000n,
        0n,
        currentTxHash,
        sigData.signature,
        [ethers.utils.parseEther("-0.8"), ethers.utils.parseEther("0.8")]
      );
    }
    // emergency withdraw
    await gateway.pause();
    await gateway.emergencyWithdrawRequest(ZERO_ADDRESS, other.address);
    expect(await gateway.emergencyWithdrawRequests(ZERO_ADDRESS)).to.equal(
      other.address
    );
    await expect(await gateway.emergencyWithdraw(ZERO_ADDRESS))
      .to.emit(gateway, "EmergencyWithdraw")
      .withArgs(owner.address, ZERO_ADDRESS, other.address)
      .to.changeEtherBalance(other.address, ethers.utils.parseEther("1.0"));
  });

  it("can chargeback after transfers and claims with native token", async function () {
    const { gateway, owner, other, signer, third } = await loadFixture(
      deployGatewayFixture
    );
    // transfers and claims
    await updateSignerStep(gateway, signer.address);
    await gateway.updateTargetChain(0, true);
    await gateway.updateToken(
      0,
      ZERO_ADDRESS,
      "TEST",
      ethers.utils.parseEther("0.5"),
      0,
      0,
      0,
      0,
      true,
      false
    );
    for (let i = 0n; i < 10n; i++) {
      await transferStep(gateway, owner, other.address, "0.9", "0.1", "TEST", [
        900000n,
        100000n,
      ]);
      const currentTxHash = ethers.utils.randomBytes(32);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        900000n,
        0n,
        ZERO_ADDRESS,
        other.address,
        currentTxHash
      );
      await claimNativeStep(
        gateway,
        other,
        other.address,
        900000n,
        0n,
        currentTxHash,
        sigData.signature,
        [ethers.utils.parseEther("-0.9"), ethers.utils.parseEther("0.9")]
      );
    }
    // send transaction
    await owner.sendTransaction({ to: gateway.address, value: 10n ** 18n });
    // try to withdraw funds
    await expect(
      gateway
        .connect(owner)
        .chargebackUntracked(
          TRANSPORT_SOURCE_CHAIN_ID,
          ZERO_ADDRESS,
          third.address
        )
    ).to.changeEtherBalance(third.address, 10n ** 18n);
  });

  it("can chargeback after transfers and claims with ERC20 wrapped token", async function () {
    const { gateway, owner, other, signer, third, wrappedToken, token } =
      await loadFixture(deployGatewayFixture);
    await updateSignerStep(gateway, signer.address);
    await wrappedToken
      .connect(owner)
      .mint(other.address, ethers.utils.parseEther("134"));
    await setTokens(gateway, owner, token, wrappedToken);
    await wrappedToken
      .connect(other)
      .approve(gateway.address, ethers.utils.parseEther("90"));
    // transfers n claims
    for (let i = 0; i < 10; i++) {
      await transferErc20Step(
        gateway,
        other,
        gateway.address,
        "9",
        "0",
        [-9000000000000000000n, 0n],
        wrappedToken,
        [9000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        9000000n,
        0n,
        wrappedToken.address,
        other.address,
        currentTxHash
      );
      await claimStep(
        gateway,
        other,
        other.address,
        wrappedToken,
        9000000n,
        0n,
        currentTxHash,
        sigData.signature,
        [ethers.utils.parseEther("0"), ethers.utils.parseEther("9")]
      );
    }
    // send transaction
    await wrappedToken
      .connect(other)
      .transfer(gateway.address, ethers.utils.parseEther("13"));
    // try to withdraw funds
    await expect(
      gateway
        .connect(owner)
        .chargebackUntracked(
          TRANSPORT_SOURCE_CHAIN_ID,
          wrappedToken.address,
          third.address
        )
    ).to.changeTokenBalance(
      wrappedToken,
      third.address,
      ethers.utils.parseEther("13")
    );
  });

  it("can chargeback after transfers and claims with ERC20 token", async function () {
    const { gateway, owner, other, signer, third, wrappedToken, token } =
      await loadFixture(deployGatewayFixture);
    await updateSignerStep(gateway, signer.address);
    await setTokens(gateway, owner, token, wrappedToken);
    await token.transfer(
      other.address,
      ethers.utils.parseEther(tokenStartBalance.toString())
    );
    await token
      .connect(other)
      .approve(gateway.address, ethers.utils.parseEther("90"));
    // transfers n claims
    for (let i = 0; i < 10; i++) {
      await transferErc20Step(
        gateway,
        other,
        gateway.address,
        "9",
        "0",
        [-9000000000000000000n, 9000000000000000000n],
        token,
        [9000000n, 0n]
      );
      const currentTxHash = ethers.utils.randomBytes(32);
      const sigData = await getSignature(
        signer,
        TRANSPORT_SOURCE_CHAIN_ID,
        EXTERNAL_SOURCE_CHAIN_ID,
        9000000n,
        0n,
        token.address,
        other.address,
        currentTxHash
      );
      await claimStep(
        gateway,
        other,
        other.address,
        token,
        9000000n,
        0n,
        currentTxHash,
        sigData.signature,
        [ethers.utils.parseEther("-9"), ethers.utils.parseEther("9")]
      );
    }
    // send transaction
    await token
      .connect(other)
      .transfer(gateway.address, ethers.utils.parseEther("13"));
    // try to withdraw funds
    await expect(
      gateway
        .connect(owner)
        .chargebackUntracked(
          TRANSPORT_SOURCE_CHAIN_ID,
          token.address,
          third.address
        )
    ).to.changeTokenBalance(
      token,
      third.address,
      ethers.utils.parseEther("13")
    );
  });
});
