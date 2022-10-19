import { ethers } from "hardhat";
import { MULTISIG_TTL_DEFAULT } from "../test/data/constants";

export const deployMultisigFixtureOneOwner = async () => {
  const [owner] = await ethers.getSigners();
  return await deployMultisig([owner.address]);
};

export const deployMultisigFixtureManyOwners = async () => {
  const [owner, other] = await ethers.getSigners();
  return await deployMultisig([owner.address, other.address]);
};

export const deployMultisig = async (addresses: any[]) => {
  const [owner, other, third] = await ethers.getSigners();
  const Multisig = await ethers.getContractFactory("Multisig");
  const multisig = await Multisig.deploy(
    addresses,
    addresses.length,
    MULTISIG_TTL_DEFAULT
  );

  return {
    multisig,
    owner,
    other,
    third,
    Multisig,
  };
};
