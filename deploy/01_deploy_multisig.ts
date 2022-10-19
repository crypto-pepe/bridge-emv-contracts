import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("Multisig", {
    from: deployer,
    args: [
      [
        "0x20D1e919B0d5D7A3a24159559202359C1E130495",
        "0x6DF7F61fE3f8A034BCadF58A9Cb998f828fAdf7F",
        "0xBCDb8BC5D4E8FEbe014999Ee7Ec32fb03C60b6Ce",
        "0x66a42E8Db672bbC1573be0B3Ea8f6FD48d4d7A4e",
        "0x36e4e7C398d65879da35a10aE2b82db53dE50251",
      ],
      2,
      40320, // 1 week
    ],
    log: true,
  });
};

main.id = "deploy_multisig";
main.tags = ["Multisig"];

export default main;
