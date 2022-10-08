import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "hardhat-deploy";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  mocha: {
    reporter: process.env.JUNIT === "true" ? "mocha-junit-reporter" : "spec",
    reporterOptions: {
      mochaFile: "testresult.xml",
      toConsole: true,
    },
  },
  gasReporter: {
    enabled: process.env.JUNIT !== "true",
    src: "./src",
    fast: true,
  },
  namedAccounts: {
    deployer: {
      default: 0,
      5: "ledger://m/44'/60'/1'/0/0",
    },
  },
  networks: {
    goerli: {
      url: process.env.GOERLI_RPC_URL || "",
      saveDeployments: true,
      chainId: 5,
    },
  },
};

export default config;
