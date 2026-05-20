import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AegisFactoryModule = buildModule("AegisFactoryModule", (m) => {
  const deployer = m.getAccount(0);
  const govToken = m.contract("AegisToken", [deployer]);
  const factory = m.contract("AegisCrowdfundFactory", [govToken]);
  return { govToken, factory };
});

export default AegisFactoryModule;
