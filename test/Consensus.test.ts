import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("Consensus", () => {
  async function deployFixture() {
    const [owner, otherAccount] = await hre.ethers.getSigners();

    const Consensus = await hre.ethers.getContractFactory("Consensus");
    const consensus = await Consensus.deploy();

    return { consensus, owner, otherAccount };
  }

  it("should ping", async () => {
    const { consensus, otherAccount, owner } = await loadFixture(deployFixture);

    expect(await consensus.ping()).to.equal("pong");
  })
});
