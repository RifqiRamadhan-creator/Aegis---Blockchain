import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const compilerSettings = {
  optimizer: {
    enabled: true,
    runs: 200,
  },
  viaIR: true,
};

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: compilerSettings,
      },
      production: {
        version: "0.8.28",
        settings: compilerSettings,
      },
    },
    splitTestsCompilation: false,
  },
  paths: {
    tests: {
      mocha: "./test",
    },
  },
  test: {
    mocha: {
      timeout: 40000,
    },
  },
});