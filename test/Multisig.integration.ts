import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  expectConfirmTransaction,
  expectExecuteTransaction,
  expectRevokeConfirmation,
  expectSubmitTransaction,
  setQuorumEncode,
} from "../steps/multisig";
import { BigNumber } from "ethers";
import { deployMultisigFixtureManyOwners } from '../steps/multisig.fixtures'

describe("Multisig integration tests", () => {
  it("should throw when try execute method without confirmation", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, other, startTxId);
    await expect(
      multisig.connect(owner).executeTransaction(startTxId)
    ).to.be.revertedWith("is not confirmed");
  });

  it("isCompleted should be true when 3 owners and 2 confirmations", async () => {
    const { multisig, owner, other, third } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      multisig.interface.encodeFunctionData("addOwner", [third.address]),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);

    expect(await multisig.isOwner(third.address)).is.false;
    await expectExecuteTransaction(multisig, owner, startTxId);
    expect(await multisig.isOwner(third.address)).is.true;

    const nextTx = startTxId.add(BigNumber.from(1n));
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      nextTx
    );
    await expectConfirmTransaction(multisig, other, nextTx);
    await expectConfirmTransaction(multisig, third, nextTx);
    expect(await multisig.connect(owner).isConfirmed(startTxId)).is.true;
  });

  it("should be true when 3 confirmations with 2 quorum", async () => {
    const { multisig, owner, other, third } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      multisig.interface.encodeFunctionData("addOwner", [third.address]),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    expect(await multisig.isOwner(third.address)).is.false;
    await expectExecuteTransaction(multisig, owner, startTxId);
    expect(await multisig.isOwner(third.address)).is.true;

    const nextTx = startTxId.add(BigNumber.from(1n));
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      nextTx
    );
    await expectConfirmTransaction(multisig, owner, nextTx);
    await expectConfirmTransaction(multisig, other, nextTx);
    await expectConfirmTransaction(multisig, third, nextTx);
    expect(await multisig.connect(owner).isConfirmed(startTxId)).is.true;
  });

  it("can get confirmations count on confirmation and revoke too", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      startTxId
    );

    expect(
      await multisig.connect(owner).getConfirmationsCount(startTxId)
    ).to.be.equal(0);
    await expectConfirmTransaction(multisig, owner, startTxId);
    expect(
      await multisig.connect(owner).getConfirmationsCount(startTxId)
    ).to.be.equal(1);

    await expectConfirmTransaction(multisig, other, startTxId);
    expect(
      await multisig.connect(owner).getConfirmationsCount(startTxId)
    ).to.be.equal(2);

    await expectRevokeConfirmation(multisig, owner, startTxId);
    expect(
      await multisig.connect(owner).getConfirmationsCount(startTxId)
    ).to.be.equal(1);

    await expectRevokeConfirmation(multisig, other, startTxId);
    expect(
      await multisig.connect(owner).getConfirmationsCount(startTxId)
    ).to.be.equal(0);

    await expectConfirmTransaction(multisig, other, startTxId);
    expect(
      await multisig.connect(owner).getConfirmationsCount(startTxId)
    ).to.be.equal(1);
  });

  it("can get confirmations after confirms and revokes too", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    let confirmations = await multisig
      .connect(owner)
      .getConfirmations(startTxId);
    expect(confirmations.length).to.be.equal(0);
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      startTxId
    );
    confirmations = await multisig.connect(owner).getConfirmations(startTxId);
    expect(confirmations).to.be.deep.equal([]);

    await expectConfirmTransaction(multisig, owner, startTxId);
    confirmations = await multisig.connect(owner).getConfirmations(startTxId);
    expect(confirmations).to.be.deep.equal([owner.address]);

    await expectConfirmTransaction(multisig, other, startTxId);
    confirmations = await multisig.connect(owner).getConfirmations(startTxId);
    expect(confirmations).to.be.deep.equal([owner.address, other.address]);

    await expectRevokeConfirmation(multisig, owner, startTxId);
    confirmations = await multisig.connect(owner).getConfirmations(startTxId);
    expect(confirmations).to.be.deep.equal([other.address]);

    await expectRevokeConfirmation(multisig, other, startTxId);
    confirmations = await multisig.connect(owner).getConfirmations(startTxId);
    expect(confirmations).to.be.deep.equal([]);

    await expectConfirmTransaction(multisig, other, startTxId);
    confirmations = await multisig.connect(owner).getConfirmations(startTxId);
    expect(confirmations).to.be.deep.equal([other.address]);
  });

  it("should throw when try to remowe last owner", async () => {
    const { multisig, owner, other, third } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      multisig.interface.encodeFunctionData("removeOwner", [other.address]),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    expect(await multisig.quorum()).to.be.equal(1);

    const nextTx = startTxId.add(BigNumber.from(1n));
    await expectSubmitTransaction(
      multisig,
      owner,
      multisig.interface.encodeFunctionData("removeOwner", [owner.address]),
      BigNumber.from(0n),
      nextTx
    );
    await expectConfirmTransaction(multisig, owner, nextTx);
    await expect(
      multisig.connect(owner).executeTransaction(nextTx)
    ).to.be.revertedWith("execution failure");
    expect(await multisig.quorum()).to.be.equal(1);
    expect(await multisig.isOwner(owner.address)).is.true;
    expect(await multisig.owners.length).to.be.equal(0);

    // indirect check owners[]
    const trashTx = nextTx.add(BigNumber.from(1n));
    await expect(
      expectSubmitTransaction(
        multisig,
        third,
        multisig.interface.encodeFunctionData("addOwner", [third.address]),
        BigNumber.from(0n),
        trashTx
      )  
    ).to.be.revertedWith("only owner");
  });

  it("should successful execute when confirmation complete after revokation", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    expect(await multisig.connect(owner).isConfirmed(startTxId)).is.true;

    await expectRevokeConfirmation(multisig, owner, startTxId);
    expect(await multisig.connect(owner).isConfirmed(startTxId)).is.false;

    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    const tx = await multisig.txs(startTxId);
    expect(tx.isExecuted).is.true;
  });

  it("should successful execute when previous execution failed on uncompleted confirmation", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expect(
      multisig.connect(owner).executeTransaction(startTxId)
    ).to.be.revertedWith("is not confirmed");
    await expectConfirmTransaction(multisig, other, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    const tx = await multisig.txs(startTxId);
    expect(tx.isExecuted).is.true;
  });

  it("should throw when reinvoke execute", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    const tx = await multisig.txs(startTxId);
    expect(tx.isExecuted).is.true;
    await expect(
      multisig.connect(owner).executeTransaction(startTxId)
    ).to.be.revertedWith("tx is executed");
  });

  it("can check confirms when execution done", async () => {
    const { multisig, owner, other, third } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    const tx = await multisig.txs(startTxId);
    expect(tx.isExecuted).is.true;
    expect(await multisig.connect(third).isConfirmed(startTxId)).is.true;
    expect(
      await multisig.connect(owner).getConfirmationsCount(startTxId)
    ).to.be.equal(2);
    const confirmations = await multisig
      .connect(other)
      .getConfirmations(startTxId);
    expect(confirmations).to.be.deep.equal([owner.address, other.address]);
  });

  it("can increase quorum on confirmation", async () => {
    const { multisig, owner, other, third } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const mainTx = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      mainTx
    );
    await expectConfirmTransaction(multisig, owner, mainTx);
    await expectConfirmTransaction(multisig, other, mainTx);
    expect(await multisig.connect(owner).isConfirmed(mainTx)).is.true;

    const startTxId = mainTx.add(BigNumber.from(1n));
    await expectSubmitTransaction(
      multisig,
      owner,
      multisig.interface.encodeFunctionData("addOwner", [third.address]),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    expect(await multisig.isOwner(third.address)).is.false;

    await expectExecuteTransaction(multisig, owner, startTxId);
    expect(await multisig.isOwner(third.address)).is.true;
    expect(await multisig.connect(owner).isConfirmed(mainTx)).is.true;

    const quorumTxId = startTxId.add(BigNumber.from(1n));
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig, 3),
      BigNumber.from(0n),
      quorumTxId
    );
    await expectConfirmTransaction(multisig, third, quorumTxId);
    await expectConfirmTransaction(multisig, other, quorumTxId);
    await expectExecuteTransaction(multisig, owner, quorumTxId);
    expect(await multisig.quorum()).to.be.equal(3);
    expect(await multisig.connect(owner).isConfirmed(mainTx)).is.false;
  });

  it("can decrease quorum on confirmation", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const mainTx = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      mainTx
    );
    await expectConfirmTransaction(multisig, other, mainTx);
    expect(await multisig.connect(owner).isConfirmed(mainTx)).is.false;

    const quorumTxId = mainTx.add(BigNumber.from(1n));
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      quorumTxId
    );
    await expectConfirmTransaction(multisig, owner, quorumTxId);
    await expectConfirmTransaction(multisig, other, quorumTxId);
    await expectExecuteTransaction(multisig, owner, quorumTxId);
    expect(await multisig.quorum()).to.be.equal(1);
    expect(await multisig.connect(owner).isConfirmed(mainTx)).is.true;
  });

  it("should throw when revoke executed transaction", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const startTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    const tx = await multisig.txs(startTxId);
    expect(tx.isExecuted).is.true;
    await expect(
      multisig.connect(owner).revokeConfirmation(startTxId)
    ).to.be.revertedWith("tx is executed");
  });

  xit("can execute Gateways updateTargetChain method", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const Gateway = await ethers.getContractFactory("Gateway");
    const gateway = await Gateway.deploy(2, multisig.address, 0);
    const startTxId = await multisig.txsCount();
    await expect(
      await multisig
        .connect(owner)
        .submitTransaction(
          gateway.address,
          0,
          gateway.interface.encodeFunctionData("updateTargetChain", [13, true])
        )
    )
      .to.emit(multisig, "Submission")
      .withArgs(startTxId);

    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    const tx = await multisig.txs(startTxId);
    expect(tx.isExecuted).is.true;
  });

  it("remove owner with quorum less than owner's count", async () => {
    const { multisig, owner, other } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    const quorumTxId = await multisig.txsCount();
    await expectSubmitTransaction(
      multisig,
      owner,
      setQuorumEncode(multisig),
      BigNumber.from(0n),
      quorumTxId
    );
    await expectConfirmTransaction(multisig, owner, quorumTxId);
    await expectConfirmTransaction(multisig, other, quorumTxId);
    await expectExecuteTransaction(multisig, owner, quorumTxId);
    expect(await multisig.quorum()).to.be.equal(1);

    const startTxId = quorumTxId.add(BigNumber.from(1n));
    expect(await multisig.isOwner(other.address)).is.true;
    await expectSubmitTransaction(
      multisig,
      owner,
      multisig.interface.encodeFunctionData("removeOwner", [owner.address]),
      BigNumber.from(0n),
      startTxId
    );
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    expect(await multisig.isOwner(owner.address)).is.false;
    expect(await multisig.isOwner(other.address)).is.true;
  });

  xit("multisig can transfer ERC20 through multisig to other address", async function () {
    const { multisig, owner, other, third } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    expect(await multisig.provider.getBalance(multisig.address)).to.be.equal(
      "0"
    );
    const ERC20 = await ethers.getContractFactory("ERC20");
    const token = await ERC20.deploy(
      "Test ERC20 token",
      "TEST",
      10n ** 6n * 10n ** 18n
    );
    await expect(
      await token.transfer(multisig.address, ethers.utils.parseEther("12.34"))
    ).to.emit(token, "Transfer");
    expect(await token.balanceOf(multisig.address)).to.be.equal(
      ethers.utils.parseEther("12.34")
    );
    expect(await token.balanceOf(third.address)).to.be.equal(0);
    // TRANSFER ERC20
    const startTxId = await multisig.txsCount();
    await expect(
      await multisig.submitTransaction(
        token.address,
        0,
        token.interface.encodeFunctionData("transfer", [
          third.address,
          9000000n,
        ])
      )
    )
      .to.emit(multisig, "Submission")
      .withArgs(startTxId);
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    const tx = await multisig.txs(startTxId);
    expect(tx.isExecuted).is.true;
    expect(await token.balanceOf(third.address)).to.be.equal(9000000n);
  });

  xit("multisig can transfer native token to other address", async function () {
    const { multisig, owner, other, third } = await loadFixture(
      deployMultisigFixtureManyOwners
    );
    expect(await other.getBalance()).to.be.equal(
      ethers.utils.parseEther("1000")
    );
    expect(await multisig.provider.getBalance(multisig.address)).to.be.equal(0);
    const moveTx = await other.sendTransaction({
      to: multisig.address,
      value: ethers.utils.parseEther("12.345"),
    });
    await moveTx.wait();
    expect(await multisig.provider.getBalance(multisig.address)).to.be.equal(
      ethers.utils.parseEther("12.345")
    );
    // TRANSFER ETH
    const startTxId = await multisig.txsCount();
    await expect(
      await multisig.submitTransaction(
        third.address,
        ethers.utils.parseEther("7"),
        ethers.utils.defaultAbiCoder.encode(["string"], [""])
      )
    )
      .to.emit(multisig, "Submission")
      .withArgs(startTxId);
    await expectConfirmTransaction(multisig, owner, startTxId);
    await expectConfirmTransaction(multisig, other, startTxId);
    await expectExecuteTransaction(multisig, owner, startTxId);
    const tx = await multisig.txs(startTxId);
    expect(tx.isExecuted).is.true;
    expect(await third.getBalance()).to.be.equal(
      ethers.utils.parseEther("1007")
    );
  });
});
