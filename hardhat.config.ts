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
    diff: true,
    fullTrace: true,
    slow: 50000,
    timeout: 60000,
    reporter:
      process.env.JUNIT === "true"
        ? "mocha-junit-reporter"
        : "mocha-multi-reporters",
    reporterOptions: {
      reporterEnabled: "allure-mocha, list",
      allureMochaReporterOptions: {
        resultsDir: "./allure-results",
      },
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
      5: "ledger://m/44'/60'/6'/0/0:0x36e4e7C398d65879da35a10aE2b82db53dE50251",
    },
  },
  networks: {
    hardhat: {
      accounts: {
        accountsBalance: "1000000000000000000000",
      },
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL || "",
      saveDeployments: true,
      chainId: 5,
    },
  },
};

export default config;
