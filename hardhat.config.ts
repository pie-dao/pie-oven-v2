require("dotenv").config();

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-typechain";
import "hardhat-watcher";
import "solidity-coverage";
import "hardhat-gas-reporter";

// TODO fix fresh compilation inssue without commenting this line
import "./tasks/deploy";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, {ethers}) => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
const config:HardhatUserConfig = {
  solidity: "0.8.1",
  networks: {
    fork: {
      url: `http://127.0.0.1:8545/`,
      timeout: 200000
    },
    bsc: {
      url: `https://bsc-dataseed.binance.org/`,
      accounts: [process.env.PRIVATE_KEY || ""],
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/ffa6c1dc83e44e6c9971d4706311d5ab`,
      accounts: [process.env.PRIVATE_KEY || ""],
      blockGasLimit: 6000000,
      gasPrice: 10000000000,
      gas: 6000000
    },
    mainnet: { 
      url: `https://mainnet.infura.io/v3/ffa6c1dc83e44e6c9971d4706311d5ab`,
      accounts: [process.env.PRIVATE_KEY || ""],
      gas: 6000000,
      gasPrice: 150000000000
    }
  },
  typechain: {
    target: "ethers-v5",
  },
  watcher: {
    compilation: {
      tasks: ["compile"],
    }
  },
  etherscan: { apiKey: process.env.ETHERSCAN_KEY }
};

export default config;