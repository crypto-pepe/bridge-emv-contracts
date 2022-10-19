import { ethers } from "hardhat";
import { expect } from "chai";
import {
  EXTERNAL_SOURCE_CHAIN_ID,
  TRANSPORT_SOURCE_CHAIN_ID,
  ZERO_ADDRESS,
} from "../test/data/constants";
import { Gateway, IERC20 } from "../typechain-types";

export const getSignature = async function (
  signer: any,
  sourceChain: number,
  targetChain: number,
  srcAmount: bigint,
  gaslessClaimReward: bigint,
  targetToken: string,
  recipient: string,
  txHash: any
) {
  const data = ethers.utils.solidityKeccak256(
    ["uint128", "uint128", "uint256", "uint256", "address", "address", "bytes"],
    [
      sourceChain,
      targetChain,
      srcAmount,
      gaslessClaimReward,
      targetToken,
      recipient,
      txHash,
    ]
  );
  const signature = await signer.signMessage(ethers.utils.arrayify(data));
  return {
    signature: signature,
    data: data,
  };
};

export const deployGatewayFixture = async function () {
  const [owner, other, signer, third] = await ethers.getSigners();
  const ERC20 = await ethers.getContractFactory("ERC20");
  const token = await ERC20.deploy(
    "Test ERC20 token",
    "TEST",
    10n ** 6n * 10n ** 18n
  );
  const ERC20Wrapped = await ethers.getContractFactory("ERC20Wrapped");
  const wrappedToken = await ERC20Wrapped.deploy(
    "Test wrappedERC20 token",
    "WTEST"
  );
  const Gateway = await ethers.getContractFactory("Gateway");
  const gateway = await Gateway.deploy(
    EXTERNAL_SOURCE_CHAIN_ID,
    owner.address,
    TRANSPORT_SOURCE_CHAIN_ID
  );

  await token.deployed();
  await wrappedToken.deployed();
  await gateway.deployed();

  return {
    gateway,
    token,
    wrappedToken,
    owner,
    other,
    signer,
    third,
  };
};

export const setTokens = async function (
  gateway: any,
  owner: any,
  token: IERC20,
  wrappedToken: IERC20
) {
  await gateway.connect(owner).updateTargetChain(0, true);
  await gateway
    .connect(owner)
    .updateToken(0, ZERO_ADDRESS, "ETH", 0, 0, 0, 0, 0, true, false);
  await gateway
    .connect(owner)
    .updateToken(
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
  await gateway
    .connect(owner)
    .updateToken(
      0,
      wrappedToken.address,
      await wrappedToken.symbol(),
      0,
      0,
      0,
      0,
      0,
      true,
      true
    );
  await wrappedToken.connect(owner).transferMintship(gateway.address);
};

export const transferStep = async function (
  contract: any,
  sender: any,
  recpAddress: string,
  amount: string,
  claimFee: string,
  tokenName: string,
  balanceToContract: bigint[]
) {
  await expect(
    await contract
      .connect(sender)
      .transfer(
        TRANSPORT_SOURCE_CHAIN_ID,
        recpAddress,
        ethers.utils.parseEther(claimFee),
        {
          value: ethers.utils.parseEther(amount),
        }
      )
  )
    .to.changeEtherBalances(
      [sender.address, contract.address],
      [ethers.utils.parseEther("-" + amount), ethers.utils.parseEther(amount)]
    )
    .to.emit(contract, "Transfer")
    .withArgs(
      EXTERNAL_SOURCE_CHAIN_ID,
      TRANSPORT_SOURCE_CHAIN_ID,
      balanceToContract[0],
      balanceToContract[1],
      tokenName,
      sender.address,
      recpAddress
    );
};

export const transferErc20Step = async function (
  contract: Gateway,
  sender: any,
  recpAddress: string,
  amount: string,
  claimFee: string,
  changedBalances: bigint[],
  token: IERC20,
  balanceToContract: bigint[]
) {
  await expect(
    contract
      .connect(sender)
      .transferERC20(
        TRANSPORT_SOURCE_CHAIN_ID,
        token.address,
        ethers.utils.parseEther(amount),
        recpAddress,
        ethers.utils.parseEther(claimFee)
      )
  )
    .to.changeTokenBalances(
      token,
      [sender.address, contract.address],
      changedBalances
    )
    .to.emit(contract, "Transfer")
    .withArgs(
      EXTERNAL_SOURCE_CHAIN_ID,
      TRANSPORT_SOURCE_CHAIN_ID,
      balanceToContract[0],
      balanceToContract[1],
      await token.symbol(),
      sender.address,
      recpAddress
    )
    .to.emit(token, "Transfer");
};

export const createSig = async function (
  types: string[],
  datas: any[],
  signer: any
) {
  const data = ethers.utils.solidityKeccak256(types, datas);
  return await signer.signMessage(ethers.utils.arrayify(data));
};

export const updateSignerStep = async function (
  contract: any,
  signerAddress: string
) {
  await contract.updateSignerRequest(signerAddress);
  await contract.pause();
  await contract.updateSigner();
  await contract.unpause();
};

export const enableChain = async function (
  contract: any,
  owner: any,
  chain: number
) {
  await contract.connect(owner).updateTargetChain(chain, true);
  expect(await contract.chains(chain)).is.true;
};

export const claimStep = async function (
  gateway: any,
  sender: any,
  recpAddress: string,
  token: any,
  amount: bigint,
  gasFee: bigint,
  txHash: Uint8Array,
  signature: any,
  changedBalances: any[],
  changedAccounts?: any[]
) {
  const accs =
    changedAccounts != undefined
      ? changedAccounts
      : [gateway.address, sender.address];
  await expect(
    gateway
      .connect(sender)
      .claim(
        TRANSPORT_SOURCE_CHAIN_ID,
        token.address,
        amount,
        gasFee,
        recpAddress,
        txHash,
        signature
      )
  )
    .to.changeTokenBalances(token, accs, changedBalances)
    .to.emit(gateway, "Claim")
    .withArgs(
      TRANSPORT_SOURCE_CHAIN_ID,
      sender.address,
      recpAddress,
      token.address,
      amount,
      gasFee
    );
};

export const claimNativeStep = async function (
  gateway: any,
  sender: any,
  recpAddress: string,
  amount: bigint,
  gasFee: bigint,
  txHash: Uint8Array,
  signature: any,
  changedBalances: any[],
  changedAccounts?: any[]
) {
  const accs =
    changedAccounts != undefined
      ? changedAccounts
      : [gateway.address, sender.address];
  await expect(
    gateway
      .connect(sender)
      .claim(
        TRANSPORT_SOURCE_CHAIN_ID,
        ZERO_ADDRESS,
        amount,
        gasFee,
        recpAddress,
        txHash,
        signature
      )
  )
    .to.changeEtherBalances(accs, changedBalances)
    .to.emit(gateway, "Claim")
    .withArgs(
      TRANSPORT_SOURCE_CHAIN_ID,
      sender.address,
      recpAddress,
      ZERO_ADDRESS,
      amount,
      gasFee
    );
};
