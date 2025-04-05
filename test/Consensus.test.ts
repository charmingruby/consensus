import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";

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

    describe("setManager", () => {
      it("should set a new manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.setManager(groupMember.address)

        expect(await contract.getManager()).to.equal(groupMember.address);
      })

      it("should be not able to set a new manager if the address is null", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await expect(contract.setManager(ethers.ZeroAddress))
          .to.be.revertedWith("Address can't be null");
      })

      it("should be not able to set a new manager if is not a manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.setManager(groupMember.address))
          .to.be.revertedWith("Only the manager can call this function");
      })

      it("should be not able to set a new manager if the new manager is the current manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await expect(contract.setManager(manager.address))
          .to.be.revertedWith("New manager can't be the current manager");
      })
    })

    describe("getManager", () => {
      it("should return the manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        expect(await contract.getManager()).to.equal(manager.address);
      })
    })

    describe("setCounselor", () => {
      it("should add a counselor to the contract", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        await contract.setCounselor(groupMember.address, true)

        expect(await contract.isCounselor(groupMember.address)).to.equal(true);
      })

      it("should be not able to add a counselor if the address is already a counselor", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        await contract.setCounselor(groupMember.address, true)

        await expect(contract.setCounselor(groupMember.address, true))
          .to.be.revertedWith("Counselor already exists");
      })

      it("should be not able to add a counselor if is not a manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.setCounselor(groupMember.address, true))
          .to.be.revertedWith("Only the manager can call this function");
      })

      it("should be not able to add a counselor if the address is not a leader", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await expect(contract.setCounselor(groupMember.address, true))
          .to.be.revertedWith("Counselor is not a leader");
      })

      it("should remove a counselor from the contract", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        await contract.setCounselor(groupMember.address, true)

        expect(await contract.isCounselor(groupMember.address)).to.be.equal(true);

        await contract.setCounselor(groupMember.address, false)

        expect(await contract.isCounselor(groupMember.address)).to.be.equal(false);
      })

      it("should be not able to remove a counselor if the address is not a counselor", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await expect(contract.setCounselor(groupMember.address, false))
          .to.be.revertedWith("Counselor does not exists");
      })

      it("should be not able to remove a counselor if is not a manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        await contract.setCounselor(groupMember.address, true)

        expect(await contract.isCounselor(groupMember.address)).to.be.equal(true);

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.setCounselor(groupMember.address, false))
          .to.be.revertedWith("Only the manager can call this function");
      })
    })

    describe("isCounselor", () => {
      it("should return true if the address is a counselor", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1)

        await contract.setCounselor(groupMember.address, true)

        expect(await contract.isCounselor(groupMember.address)).to.equal(true);
      })

      it("should return false if the address is not a counselor", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        expect(await contract.isCounselor(groupMember.address)).to.equal(false);
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

  describe("Topic Management", () => {
    describe("addTopic", () => {
      it("should add a topic", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        const topic = await contract.getTopic("Test Topic")

        expect(topic.title).to.equal(title)
      })

      it("should be not able to add a topic if the topic already exists", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await expect(contract.addTopic(title, "Test Description"))
          .to.be.revertedWith("Topic already exists");
      })

      it("should be not able to add a topic if is not at least a group leader", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.addTopic("Test Topic", "Test Description"))
          .to.be.revertedWith("Only the group leaders can call this function");
      })
    })

    describe("removeTopic", () => {
      it("should remove a topic from the contract", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.removeTopic(title)

        expect(await contract.topicExists(title)).to.equal(false)
      })

      it("should be not able to remove a topic if the topic does not exist", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        await expect(contract.removeTopic("Non Existent Topic"))
          .to.be.revertedWith("Topic does not exists");
      })

      it("should be not able to remove a topic if is not a manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.removeTopic(title))
          .to.be.revertedWith("Only the manager can call this function");
      })
    })

    describe("getTopic", () => {
      it("should return the topic", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        const topic = await contract.getTopic(title)

        expect(topic.title).to.equal(title)
      })

      it("should return empty topic for non-existent topic", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const topic = await contract.getTopic("Non Existent Topic")

        expect(topic.title).to.equal("")
        expect(topic.createdAt).to.equal(0)
      })
    })

    describe("topicExists", () => {
      it("should return true if the topic exists", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        expect(await contract.topicExists(title)).to.equal(true)
      })

      it("should return false if the topic does not exist", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        expect(await contract.topicExists("Non Existent Topic")).to.equal(false)
      })
    })
  })

  describe("Voting Management", () => {
    describe("openVoting", () => {
      it("should open a voting", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        const topic = await contract.getTopic(title)

        expect(topic.status).to.equal(1)
      })

      it("should be not able to open a voting if the topic does not exist", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await expect(contract.openVoting(title)).
          to.be.revertedWith("Topic does not exists");
      })

      it("should be not able to open a voting if the topic is not in IDLE status", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        await expect(contract.openVoting(title))
          .to.be.revertedWith("Only IDLE topics can be open for voting");
      })

      it("should be not able to open a voting if sender is not a manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.openVoting(title)).
          to.be.revertedWith("Only the manager can call this function");
      })
    })

    describe("vote", () => {
      it("should vote for a topic", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        await contract.addLeader(groupMember.address, 1)

        const groupMemberContract = contract.connect(groupMember)

        await groupMemberContract.vote(title, 1)

        expect(await contract.numberOfVotes(title)).to.be.equal(1)
      })

      it("should be not able to vote if the topic does not exist", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addLeader(groupMember.address, 1)

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.vote(title, 1))
          .to.be.revertedWith("Topic does not exists");
      })

      it("should be not able to vote if the topic is not in VOTING status", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.addLeader(groupMember.address, 1)

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.vote(title, 1))
          .to.be.revertedWith("Only VOTING topics can be voted");
      })

      it("should be not able to vote if sender is not a leader", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.vote(title, 1))
          .to.be.revertedWith("Only the group leaders can call this function");
      })

      it("should be not able to vote if the option is blank", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        await contract.addLeader(groupMember.address, 1)

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.vote(title, 0))
          .to.be.revertedWith("Option can't be EMPTY");
      })

      it("should be not able to vote if the leader already voted", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        await contract.addLeader(groupMember.address, 1)

        const groupMemberContract = contract.connect(groupMember)

        await groupMemberContract.vote(title, 1)

        await expect(groupMemberContract.vote(title, 1))
          .to.be.revertedWith("Leader already voted");
      })
    })

    describe("closeVoting", () => {
      it("should close a voting", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        await contract.closeVoting(title)

        const topic = await contract.getTopic(title)

        expect(topic.status).to.equal(3)
      })

      it("should close a voting with APPROVED status if the APPROVED votes are greater than the DENIED votes", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        await contract.addLeader(groupMember.address, 1)

        const groupMemberContract = contract.connect(groupMember)

        await groupMemberContract.vote(title, 1)

        await contract.closeVoting(title)

        const topic = await contract.getTopic(title)

        expect(topic.status).to.equal(2)
      })

      it("should close a voting with DENIED status if the DENIED votes are greater than the APPROVED votes", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        await contract.addLeader(groupMember.address, 1)

        const groupMemberContract = contract.connect(groupMember)

        await groupMemberContract.vote(title, 3)

        await contract.closeVoting(title)

        const topic = await contract.getTopic(title)

        expect(topic.status).to.equal(3)
      })

      it("should close a voting with DENIED status if DENIED votes are equal to the APPROVED votes", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        await contract.addLeader(groupMember.address, 1)

        const groupMemberContract = contract.connect(groupMember)

        await groupMemberContract.vote(title, 3)
        await contract.vote(title, 2)

        await contract.closeVoting(title)

        const topic = await contract.getTopic(title)

        expect(topic.status).to.equal(3)
      })

      it("should be not able to close a voting if the topic is not in VOTING status", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await expect(contract.closeVoting(title))
          .to.be.revertedWith("Only VOTING topics can be closed");
      })

      it("should be not able to close a voting if sender is not a manager", async () => {
        const { contract, manager, groupMember } = await loadFixture(deployFixture);

        const title = "Test Topic"

        await contract.addTopic(title, "Test Description")

        await contract.openVoting(title)

        const groupMemberContract = contract.connect(groupMember)

        await expect(groupMemberContract.closeVoting(title))
          .to.be.revertedWith("Only the manager can call this function");
      })
    })
  })
});
