import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployGatewayFixture, getSignature } from "../steps/gateway.common";
import {
  EXTERNAL_SOURCE_CHAIN_ID,
  TRANSPORT_SOURCE_CHAIN_ID,
  ZERO_ADDRESS,
} from "./data/constants";

describe("Gateway stress tests", function () {
  xit("should transfer stress test", async function () {
    const { gateway, other } = await loadFixture(deployGatewayFixture);
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

    await Promise.all(
      Array.from({ length: 1000 }).map(
        async () =>
          await expect(
            await gateway.transfer(
              0,
              other.address,
              ethers.utils.parseEther("0.001"),
              {
                value: ethers.utils.parseEther("0.01"),
              }
            )
          ).to.emit(gateway, "Transfer")
      )
    );

    expect(await gateway.fees(ZERO_ADDRESS)).to.equal(
      ethers.utils.parseEther("1.01")
    );
    expect(await gateway.balances(ZERO_ADDRESS)).to.equal(
      ethers.utils.parseEther("8.99")
    );
  });

  xit("should transferERC20 stress test", async function () {
    const { gateway, token, other } = await loadFixture(deployGatewayFixture);
    await gateway.updateTargetChain(0, true);
    await gateway.updateToken(
      0,
      token.address,
      "TEST",
      ethers.utils.parseEther("0.005"),
      ethers.utils.parseEther("0.001"),
      ethers.utils.parseEther("0.02"),
      1000,
      2000,
      true,
      false
    );
    await token.approve(gateway.address, ethers.utils.parseEther("100"));
    await Promise.all(
      Array.from({ length: 1000 }).map(
        async () =>
          await expect(
            await gateway.transferERC20(
              0,
              token.address,
              ethers.utils.parseEther("0.005"),
              other.address,
              ethers.utils.parseEther("0.001")
            )
          ).to.emit(gateway, "Transfer")
      )
    );

    expect(await gateway.fees(token.address)).to.equal(
      ethers.utils.parseEther("1.005")
    );
    expect(await gateway.balances(token.address)).to.equal(
      ethers.utils.parseEther("3.995")
    );
  });

  xit("should transferERC20 wrapped token stress test", async function () {
    const { gateway, wrappedToken, owner, other } = await loadFixture(
      deployGatewayFixture
    );
    await gateway.updateTargetChain(0, true);
    await gateway.updateToken(
      0,
      wrappedToken.address,
      "WTEST",
      ethers.utils.parseEther("0.005"),
      ethers.utils.parseEther("0.001"),
      ethers.utils.parseEther("0.02"),
      1000,
      2000,
      true,
      true
    );
    await wrappedToken.approve(gateway.address, ethers.utils.parseEther("100"));
    await wrappedToken.mint(owner.address, ethers.utils.parseEther("100"));
    await Promise.all(
      Array.from({ length: 1000 }).map(
        async () =>
          await expect(
            await gateway.transferERC20(
              0,
              wrappedToken.address,
              ethers.utils.parseEther("0.005"),
              other.address,
              ethers.utils.parseEther("0.001")
            )
          ).to.emit(gateway, "Transfer")
      )
    );

    expect(await gateway.fees(wrappedToken.address)).to.equal(
      ethers.utils.parseEther("1.005")
    );
    expect(await gateway.balances(wrappedToken.address)).to.equal(0);
  });

  xit("should transfer and claim native token", async function () {
    const { gateway, other, signer } = await loadFixture(deployGatewayFixture);
    await gateway.updateTargetChain(0, true);
    await gateway.updateToken(
      0,
      ZERO_ADDRESS,
      "TEST",
      ethers.utils.parseEther("0.005"),
      ethers.utils.parseEther("0.001"),
      0,
      0,
      0,
      true,
      false
    );
    await gateway.updateSignerRequest(signer.address);
    await gateway.pause();
    await gateway.updateSigner();
    await gateway.unpause();

    await Promise.all(
      Array.from({ length: 1000 }).map(async () => {
        await expect(
          await gateway.transfer(
            0,
            other.address,
            ethers.utils.parseEther("0.001"),
            {
              value: ethers.utils.parseEther("0.9"),
            }
          )
        ).to.emit(gateway, "Transfer");
        const currentTxHash = ethers.utils.randomBytes(32);
        const sigData = await getSignature(
          signer,
          TRANSPORT_SOURCE_CHAIN_ID,
          EXTERNAL_SOURCE_CHAIN_ID,
          899000n,
          0n,
          ZERO_ADDRESS,
          other.address,
          currentTxHash
        );
        await expect(
          gateway
            .connect(other)
            .claim(
              TRANSPORT_SOURCE_CHAIN_ID,
              ZERO_ADDRESS,
              899000n,
              0n,
              other.address,
              currentTxHash,
              sigData.signature
            )
        ).to.emit(gateway, "Claim");
      })
    );

    expect(await gateway.fees(ZERO_ADDRESS)).to.equal(
      ethers.utils.parseEther("1.0")
    );
    expect(await gateway.balances(ZERO_ADDRESS)).to.equal(0); //897200000000000000000
  });
});
