import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AegisFactoryModule = buildModule("AegisFactoryModule", (m) => {
  const factory = m.contract("AegisCrowdfundFactory");
  return { factory };
});

export default AegisFactoryModule;
