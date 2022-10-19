import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const TRANSPORT_CHAIN_ID = 0;
const ETHEREUM_CHAIN_ID = 1;

const main: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  const multisig = await get("Multisig");

  await deploy("Gateway", {
    from: deployer,
    args: [ETHEREUM_CHAIN_ID, multisig.address, TRANSPORT_CHAIN_ID],
    log: true,
    proxy: {
      proxyContract: "OptimizedTransparentProxy",
      owner: multisig.address,
    },
  });
};

main.id = "deploy_ethereum_gateway";
main.tags = ["Gateway"];

export default main;
