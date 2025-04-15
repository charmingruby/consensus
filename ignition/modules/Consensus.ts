// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ConsensusModule = buildModule("ConsensusModule", (m) => {
  const consensus = m.contract("Consensus");

  const adapter = m.contract("ConsensusAdapter", [], {
    after: [consensus],
  });

  m.call(adapter, "upgrade", [consensus]);

  return { consensus, adapter };
});

export default ConsensusModule;
