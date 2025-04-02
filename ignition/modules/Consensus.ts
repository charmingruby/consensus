// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ConsensusModule = buildModule("ConsensusModule", (m) => {
  const consensus = m.contract("Consensus");

  return { consensus };
});

export default ConsensusModule;
