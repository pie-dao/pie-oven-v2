import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-typechain";
import "hardhat-watcher";
import "solidity-coverage"


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

};

export default config;