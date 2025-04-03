import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { expect } from "chai";

describe("Consensus", () => {
  async function deployFixture() {
    const [manager, groupMember] = await hre.ethers.getSigners();

    const Consensus = await hre.ethers.getContractFactory("Consensus");
    const contract = await Consensus.deploy();

    return { contract, manager, groupMember };
  }

  describe("Membership Management", () => {
    describe("addLeader", () => {
      it("should add a leader to a group", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        expect(await contract.isLeader(groupMember.address)).to.equal(true);
      })

      it("should be not able to add a leader to a group that does not exist", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await expect(contract.addLeader(groupMember.address, 11))
          .to.be.revertedWith("Group does not exists");
      })

      it("should be not able to add a leader to a group if is not a council member", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.addLeader(groupMember.address, 1))
          .to.be.revertedWith("Only the council members can call this function");
      })
    })

    describe("removeLeader", () => {
      it("should remove a leader from a group", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        expect(await contract.isLeader(groupMember.address)).to.be.equal(true);

        await contract.removeLeader(groupMember.address, 1)

        expect(await contract.isLeader(groupMember.address)).to.be.equal(false);
      })

      it("should be not able to remove a leader from a group that does not exists", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await expect(contract.removeLeader(groupMember.address, 11))
          .to.be.revertedWith("Group does not exists");
      })

      it("should be not able to remove a leader from a group if is not a manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        expect(await contract.isLeader(groupMember.address)).to.be.equal(true);

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.removeLeader(groupMember.address, 1))
          .to.be.revertedWith("Only the manager can call this function");
      })
    })


    describe("isLeader", () => {
      it("should return true if the address is a leader", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        expect(await contract.isLeader(groupMember.address)).to.equal(true);
      })

      it("should return false if the address is not a leader", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        expect(await contract.isLeader(groupMember.address)).to.be.equal(false);
      })
    })

    describe("groupExists", () => {
      it("should return true if the group exists", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        expect(await contract.groupExists(1)).to.equal(true);
      })

      it("should return false if the group does not exist", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        expect(await contract.groupExists(11)).to.equal(false);
      })
    })
  })
});
