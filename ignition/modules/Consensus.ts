// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ConsensusModule = buildModule("ConsensusModule", (m) => {
  const validator = m.library("Validator");

  const consensus = m.contract("Consensus", [], {
    libraries: {
      "Validator": validator,
    },
    after: [validator],
  });

  const adapter = m.contract("ConsensusAdapter", [], {
    after: [consensus],
  });

  m.call(adapter, "upgrade", [consensus]);

  return { consensus, adapter };
});

export default ConsensusModule;
