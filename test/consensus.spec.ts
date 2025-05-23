import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { Consensus } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Status } from "./helpers/consensus-lib/status";
import { Option } from "./helpers/consensus-lib/option";
import { Category } from "./helpers/consensus-lib/category";

describe("Consensus", () => {
  const MAX_GROUPS = 50;

  async function deployFixture() {
    const [manager, groupMember, ...otherAccounts] =
      await hre.ethers.getSigners();

    const Validator = await hre.ethers.getContractFactory("Validator");
    const validator = await Validator.deploy();

    const Consensus = await hre.ethers.getContractFactory("Consensus", {
      libraries: {
        Validator: await validator.getAddress(),
      },
    });
    const contract = await Consensus.deploy();

    return { contract, manager, groupMember, otherAccounts };
  }

  async function addLeaders(
    contract: Consensus,
    count: number,
    accounts: SignerWithAddress[],
  ) {
    for (let i = 0; i < count; i++) {
      await contract.addLeader(accounts[i].address, i + 1);
      const leader = await contract.getLeader(accounts[i].address);
      if (leader.nextPayment === 0n) {
        await contract.payQuota(i + 1, { value: ethers.parseEther("0.01") });
      }
    }
  }

  async function generateVotes(
    contract: Consensus,
    title: string,
    accounts: SignerWithAddress[],
    startIndex: number,
    numberOfVotes: number,
    option: number
  ) {
    for (let i = startIndex; i < startIndex + numberOfVotes; i++) {
      const groupId = i + 1;
      await contract.addLeader(accounts[i].address, groupId);
      const groupMemberContract = contract.connect(accounts[i]);
      await groupMemberContract.payQuota(groupId, { value: ethers.parseEther("0.01") });
      await groupMemberContract.vote(title, option);
    }
  }

  describe("Membership Management", () => {
    describe("addLeader", () => {
      it("should add a leader to a group", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.group).to.be.greaterThan(0);
      });

      it("should be not able to add a leader to a group if the address is null", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.addLeader(ethers.ZeroAddress, 1),
        ).to.be.revertedWith("Address can't be null");
      });

      it("should be not able to add a leader to a group that does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.addLeader(groupMember.address, MAX_GROUPS + 1),
        ).to.be.revertedWith("Group does not exists");
      });

      it("should be not able to add a leader to a group if is not a council member", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const groupMemberContract = contract.connect(groupMember);

        await expect(
          groupMemberContract.addLeader(groupMember.address, 1),
        ).to.be.revertedWith("Only the council members can call this function");
      });
    });

    describe("removeLeader", () => {
      it("should remove a leader from a group", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.group).to.be.greaterThan(0);

        await contract.removeLeader(groupMember.address, 1);

        const removedLeader = await contract.getLeader(groupMember.address);
        expect(removedLeader.group).to.equal(0);
      });

      it("should remove a leader from the middle of the list", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 3, [groupMember, otherAccounts[0], otherAccounts[1]]);

        await contract.removeLeader(otherAccounts[0].address, 2);

        const firstLeader = await contract.getLeader(groupMember.address);
        expect(firstLeader.group).to.be.greaterThan(0);

        const middleLeader = await contract.getLeader(otherAccounts[0].address);
        expect(middleLeader.group).to.equal(0);

        const lastLeader = await contract.getLeader(otherAccounts[1].address);
        expect(lastLeader.group).to.be.greaterThan(0);
      });

      it("should be not able to remove a leader from a group that does not exists", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.removeLeader(groupMember.address, MAX_GROUPS + 1),
        ).to.be.revertedWith("Group does not exists");
      });

      it("should be not able to remove a leader from a group if is not a manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.group).to.be.greaterThan(0);

        const groupMemberContract = contract.connect(groupMember);

        await expect(
          groupMemberContract.removeLeader(groupMember.address, 1),
        ).to.be.revertedWith("Only the manager can call this function");
      });
    });

    describe("setManager", () => {
      it("should set a new manager and update leader status", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        await contract.setManager(groupMember.address);

        expect(await contract.getManager()).to.equal(groupMember.address);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.isManager).to.equal(true);
      });

      it("should be not able to set a new manager if the address is null", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.setManager(ethers.ZeroAddress),
        ).to.be.revertedWith("Address can't be null");
      });

      it("should be not able to set a new manager if is not a manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const groupMemberContract = contract.connect(groupMember);

        await expect(
          groupMemberContract.setManager(groupMember.address),
        ).to.be.revertedWith("Only the manager can call this function");
      });

      it("should be not able to set a new manager if the new manager is the current manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(contract.setManager(manager.address)).to.be.revertedWith(
          "New manager can't be the current manager",
        );
      });
    });

    describe("getManager", () => {
      it("should return the manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        expect(await contract.getManager()).to.equal(manager.address);
      });
    });

    describe("setCounselor", () => {
      it("should add a counselor to the contract", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        await contract.setCounselor(groupMember.address, true);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.isCounselor).to.equal(true);
      });

      it("should be not able to set a counselor if the address is null", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.setCounselor(ethers.ZeroAddress, true),
        ).to.be.revertedWith("Address can't be null");
      });

      it("should be not able to add a counselor if the address is already a counselor", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        await contract.setCounselor(groupMember.address, true);

        await expect(
          contract.setCounselor(groupMember.address, true),
        ).to.be.revertedWith("Counselor already exists");
      });

      it("should be not able to add a counselor if is not a manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await expect(
          groupMemberContract.setCounselor(groupMember.address, true),
        ).to.be.revertedWith("Only the manager can call this function");
      });

      it("should be not able to add a counselor if the address is not a leader", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.setCounselor(groupMember.address, true),
        ).to.be.revertedWith("Counselor is not a leader");
      });

      it("should remove a counselor from the contract and update the array correctly", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 3, [groupMember, otherAccounts[0], otherAccounts[1]]);
        await contract.setCounselor(groupMember.address, true);
        await contract.setCounselor(otherAccounts[0].address, true);
        await contract.setCounselor(otherAccounts[1].address, true);

        await contract.setCounselor(otherAccounts[0].address, false);

        const leader1 = await contract.getLeader(groupMember.address);
        const leader2 = await contract.getLeader(otherAccounts[0].address);
        const leader3 = await contract.getLeader(otherAccounts[1].address);

        expect(leader1.isCounselor).to.equal(true);
        expect(leader2.isCounselor).to.equal(false);
        expect(leader3.isCounselor).to.equal(true);
      });

      it("should be not able to remove a counselor if the address is not a counselor", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.setCounselor(groupMember.address, false),
        ).to.be.revertedWith("Counselor does not exists");
      });

      it("should be not able to remove a counselor if is not a manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        await contract.setCounselor(groupMember.address, true);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.isCounselor).to.equal(true);

        const groupMemberContract = contract.connect(groupMember);

        await expect(
          groupMemberContract.setCounselor(groupMember.address, false),
        ).to.be.revertedWith("Only the manager can call this function");
      });
    });

    describe("isCounselor", () => {
      it("should return true if the address is a counselor", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        await contract.setCounselor(groupMember.address, true);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.isCounselor).to.equal(true);
      });

      it("should return false if the address is not a counselor", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.isCounselor).to.equal(false);
      });
    });

    describe("isLeader", () => {
      it("should return true if the address is a leader", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.group).to.be.greaterThan(0);
      });

      it("should return false if the address is not a leader", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const leader = await contract.getLeader(groupMember.address);
        expect(leader.group).to.equal(0);
      });
    });

    describe("groupExists", () => {
      it("should return true if the group exists", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);
      });

      it("should return false if the group does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.addLeader(groupMember.address, MAX_GROUPS + 1),
        ).to.be.revertedWith("Group does not exists");
      });
    });
  });

  describe("Topic Management", () => {
    describe("addTopic", () => {
      it("should add a topic", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        const topic = await contract.getTopic(title);

        expect(topic.title).to.equal(title);
      });

      it("should be not able to add a topic if the leader is defaulter", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addLeader(groupMember.address, 1);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        )).to.be.revertedWith("The leader must be defaulter")

      })

      it("should be not able to add a topic if the topic already exists", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await expect(
          contract.addTopic(
            title,
            "Test Description",
            Category.SPENT,
            100,
            ethers.ZeroAddress,
          ),
        ).to.be.revertedWith("Topic already exists");
      });

      it("should be not able to add a topic if is not at least a group leader", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const groupMemberContract = contract.connect(groupMember);

        await expect(
          groupMemberContract.addTopic(
            "Test Topic",
            "Test Description",
            Category.SPENT,
            100,
            ethers.ZeroAddress,
          ),
        ).to.be.revertedWith("Only the group leaders can call this function");
      });

      it("should be not able to add a topic if the amount is greater than 0 and the category is not DECISION", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        await expect(
          contract.addTopic(
            "Test Topic",
            "Test Description",
            Category.DECISION,
            1,
            ethers.ZeroAddress,
          ),
        ).to.be.revertedWith("No amount allowed for this category");
      });

      it("should be not able to add a topic if the amount is greater than 0 and the category is not CHANGE_MANAGER", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        await expect(
          contract.addTopic(
            "Test Topic",
            "Test Description",
            Category.CHANGE_MANAGER,
            1,
            ethers.ZeroAddress,
          ),
        ).to.be.revertedWith("No amount allowed for this category");
      });

      it("should define the responsible with the sender address if it is not defined", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.addTopic(
          "Test Topic",
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        const topic = await contract.getTopic("Test Topic");

        expect(topic.responsible).to.equal(manager.address);
      });

      it("should define the responsible with the provided address", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.addTopic(
          "Test Topic",
          "Test Description",
          Category.SPENT,
          100,
          groupMember.address,
        );

        const topic = await contract.getTopic("Test Topic");

        expect(topic.responsible).to.equal(groupMember.address);
      });
    });

    describe("editTopic", () => {
      it("should edit a topic", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const topicTitle = "Test Topic";

        await contract.addTopic(
          topicTitle,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        const newDescription = "New Description";
        const newAmount = 2;
        const newResponsible = groupMember.address;

        await contract.editTopic(
          topicTitle,
          newDescription,
          newAmount,
          newResponsible,
        );

        const topic = await contract.getTopic(topicTitle);

        expect(topic.description).to.equal(newDescription);
        expect(topic.amount).to.equal(newAmount);
        expect(topic.responsible).to.equal(newResponsible);
      });

      it("should be not able to edit a topic if the topic does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.editTopic(
            "Non Existent Topic",
            "New Description",
            Category.SPENT,
            groupMember.address,
          ),
        ).to.be.revertedWith("Topic does not exists");
      });

      it("should be not able to edit a topic if is not a manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.addTopic(
          "Test Topic",
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        const groupMemberContract = contract.connect(groupMember);

        await expect(
          groupMemberContract.editTopic(
            "Test Topic",
            "New Description",
            Category.SPENT,
            groupMember.address,
          ),
        ).to.be.revertedWith("Only the manager can call this function");
      });

      it("should be not able to edit a topic if the topic is not in IDLE status", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.addTopic(
          "Test Topic",
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting("Test Topic");

        await expect(
          contract.editTopic(
            "Test Topic",
            "New Description",
            Category.SPENT,
            groupMember.address,
          ),
        ).to.be.revertedWith("Only IDLE topics can be edited");
      });

      it("should be not able to edit the topic if the changes are the same as the current ones", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";
        const description = "New Description";
        const amount = 2;
        const responsible = groupMember.address;

        await contract.addTopic(title, description, 1, amount, responsible);

        await expect(
          contract.editTopic(title, description, amount, responsible),
        ).to.be.revertedWith("No changes");
      });

      it("should be able to edit the topic if the description is different from the current one", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";
        const description = "New Description";
        const amount = 2;
        const responsible = groupMember.address;

        await contract.addTopic(title, description, 1, amount, responsible);

        await contract.editTopic(
          title,
          `${description}-a`,
          amount,
          responsible,
        );

        const topic = await contract.getTopic(title);

        expect(topic.description).to.equal(`${description}-a`);
        expect(topic.amount).to.equal(amount);
        expect(topic.responsible).to.equal(responsible);
      });

      it("should be able to edit the topic if the amount is different from the current one", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";
        const description = "New Description";
        const amount = 2;
        const responsible = groupMember.address;

        await contract.addTopic(title, description, 1, amount, responsible);

        await contract.editTopic(title, description, amount + 1, responsible);

        const topic = await contract.getTopic(title);

        expect(topic.description).to.equal(description);
        expect(topic.amount).to.equal(amount + 1);
        expect(topic.responsible).to.equal(responsible);
      });

      it("should be able to edit the topic if the responsible is different from the current one", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";
        const description = "New Description";
        const amount = 2;
        const responsible = groupMember.address;

        await contract.addTopic(
          title,
          description,
          1,
          amount,
          ethers.ZeroAddress,
        );

        await contract.editTopic(
          title,
          description,
          amount,
          groupMember.address,
        );

        const topic = await contract.getTopic(title);

        expect(topic.description).to.equal(description);
        expect(topic.amount).to.equal(amount);
        expect(topic.responsible).to.equal(groupMember.address);
      });
    });

    describe("removeTopic", () => {
      it("should remove a topic from the contract", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.removeTopic(title);

        const topic = await contract.getTopic(title);
        expect(topic.title).to.equal("");
      });

      it("should be not able to remove a topic if the topic does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(
          contract.removeTopic("Non Existent Topic"),
        ).to.be.revertedWith("Topic does not exists");
      });

      it("should be not able to remove a topic if is not a manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.removeTopic(title)).to.be.revertedWith(
          "Only the manager can call this function",
        );
      });

      it("should remove a topic that is not the last in the list", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1);
        await contract.connect(groupMember).payQuota(1, { value: ethers.parseEther("0.01") });

        const groupMemberContract = contract.connect(groupMember);

        await groupMemberContract.addTopic(
          "First Topic",
          "Description of first topic",
          Category.DECISION,
          0,
          groupMember.address
        );

        await groupMemberContract.addTopic(
          "Second Topic",
          "Description of second topic",
          Category.DECISION,
          0,
          groupMember.address
        );

        await groupMemberContract.addTopic(
          "Third Topic",
          "Description of third topic",
          Category.DECISION,
          0,
          groupMember.address
        );

        await contract.removeTopic("Second Topic");

        const firstTopic = await contract.getTopic("First Topic");
        expect(firstTopic.title).to.equal("First Topic");

        const lastTopic = await contract.getTopic("Third Topic");
        expect(lastTopic.title).to.equal("Third Topic");

        const middleTopic = await contract.getTopic("Second Topic");
        expect(middleTopic.title).to.equal("");
      });

      it("should approve manager change when current manager is not a leader", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1);
        await contract.connect(groupMember).payQuota(1, { value: ethers.parseEther("0.01") });

        const groupMemberContract = contract.connect(groupMember);
        await groupMemberContract.addTopic(
          "Change Manager",
          "Change manager to new address",
          Category.CHANGE_MANAGER,
          0,
          otherAccounts[0].address
        );

        await contract.openVoting("Change Manager");

        for (let i = 0; i < 18; i++) {
          await contract.addLeader(otherAccounts[i].address, i + 2);
          await contract.connect(otherAccounts[i]).payQuota(i + 2, { value: ethers.parseEther("0.01") });
          await contract.connect(otherAccounts[i]).vote("Change Manager", Option.YES);
        }

        await contract.closeVoting("Change Manager");

        expect(await contract.getManager()).to.equal(otherAccounts[0].address);
      });
    });

    describe("getTopic", () => {
      it("should return the topic", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        const topic = await contract.getTopic(title);

        expect(topic.title).to.equal(title);
      });

      it("should return empty topic for non-existent topic", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const topic = await contract.getTopic("Non Existent Topic");

        expect(topic.title).to.equal("");
        expect(topic.createdAt).to.equal(0);
      });

      it("should handle topic lookup for first element correctly", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "First Topic";
        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        const topic = await contract.getTopic(title);
        expect(topic.title).to.equal(title);
        expect(topic.createdAt).to.be.greaterThan(0);
      });

      it("should handle topic lookup for non-first element correctly", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.addTopic("First Topic", "Description", 0, Category.DECISION, ethers.ZeroAddress);

        await contract.addTopic("Second Topic", "Description", 0, Category.DECISION, ethers.ZeroAddress);

        const topicPage = await contract.getTopics(1, 10);
        const secondTopic = topicPage.topics[1];

        const topic = await contract.getTopic("Second Topic");

        expect(topic.title).to.equal("Second Topic");
        expect(topic.createdAt).to.be.gt(0);
      });
    });

    describe("topicExists", () => {
      it("should return true if the topic exists", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        const topic = await contract.getTopic(title);
        expect(topic.title).to.equal(title);
      });

      it("should return false if the topic does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const topic = await contract.getTopic("Non Existent Topic");
        expect(topic.title).to.equal("");
      });
    });
  });

  describe("Voting Management", () => {
    describe("numberOfVotes", () => {
      it("should return the number of votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        const numberOfVotes = 3;

        await generateVotes(contract, title, otherAccounts, 0, 3, Option.YES);

        expect(await contract.numberOfVotes(title)).to.equal(numberOfVotes);
      });
    });

    describe("openVoting", () => {
      it("should open a voting", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(Status.VOTING);
      });

      it("should be not able to open a voting if the topic does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await expect(contract.openVoting(title)).to.be.revertedWith(
          "Topic does not exists",
        );
      });

      it("should be not able to open a voting if the topic is not in IDLE status", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await expect(contract.openVoting(title)).to.be.revertedWith(
          "Only IDLE topics can be open for voting",
        );
      });

      it("should be not able to open a voting if sender is not a manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.openVoting(title)).to.be.revertedWith(
          "Only the manager can call this function",
        );
      });
    });

    describe("vote", () => {
      it("should vote for a topic", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await groupMemberContract.vote(title, Option.YES);

        expect(await contract.numberOfVotes(title)).to.be.equal(1);
      });

      it("should be not able to vote if the leader is defaulter", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await contract.addLeader(groupMember.address, 1);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, Option.YES)).to.be.revertedWith(
          "The leader must be defaulter",
        );
      })

      it("should be not able to vote if the topic does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, Option.YES)).to.be.revertedWith(
          "Topic does not exists",
        );
      });

      it("should be not able to vote if the topic is not in VOTING status", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, Option.YES)).to.be.revertedWith(
          "Only VOTING topics can be voted",
        );
      });

      it("should be not able to vote if sender is not a leader", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, Option.YES)).to.be.revertedWith(
          "Only the group leaders can call this function",
        );
      });

      it("should be not able to vote if the option is blank", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, Option.EMPTY)).to.be.revertedWith(
          "Option can't be EMPTY",
        );
      });

      it("should be not able to vote if the leader already voted", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await groupMemberContract.vote(title, Option.YES);

        await expect(groupMemberContract.vote(title, Option.YES)).to.be.revertedWith(
          "Leader already voted",
        );
      });
    });

    describe("closeVoting", () => {
      it("should close a voting", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.DECISION,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 3, Option.YES);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(Status.APPROVED);
      });

      it("should be not able to close a voting if the topic does not exist", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await expect(contract.closeVoting(title)).to.be.revertedWith(
          "Topic does not exists",
        );
      });

      it("should be not able to close a voting if the topic is not in VOTING status", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.DECISION,
          0,
          ethers.ZeroAddress,
        );

        await expect(contract.closeVoting(title)).to.be.revertedWith(
          "Only VOTING topics can be closed",
        );
      });

      it("should be not able to close a voting if sender is not a manager", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.DECISION,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 3, Option.YES);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.closeVoting(title)).to.be.revertedWith(
          "Only the manager can call this function",
        );
      });

      it("should be not able to close a voting if there are not enough votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.DECISION,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await expect(contract.closeVoting(title)).to.be.revertedWith(
          "You cannot close the voting because there are not enough votes",
        );
      });

      it("should close a voting if the category is DECISION only if there are 5 votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.DECISION,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 5, Option.YES);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(Status.APPROVED);
      });

      it("should be not able to close a voting if the category is DECISION and there are not enough votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.DECISION,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await expect(contract.closeVoting(title)).to.be.revertedWith(
          "You cannot close the voting because there are not enough votes",
        );
      });

      it("should be not able to close a voting if the category is SPENT only if there are 10 votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 9, Option.YES);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(Status.APPROVED);
      });

      it("should be not able to close a voting if the category is SPENT and there are not enough votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await expect(contract.closeVoting(title)).to.be.revertedWith(
          "You cannot close the voting because there are not enough votes",
        );
      });

      it("should be not able to close a voting if the category is CHANGE_QUOTA only if there are 10 votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.CHANGE_QUOTA,
          1,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 12, Option.YES);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(Status.APPROVED);
      });

      it("should be not able to close a voting if the category is CHANGE_QUOTA and there are not enough votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.CHANGE_QUOTA,
          1,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await expect(contract.closeVoting(title)).to.be.revertedWith(
          "You cannot close the voting because there are not enough votes",
        );
      });

      it("should be not able to close a voting if the category is CHANGE_MANAGER only if there are 10 votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.CHANGE_MANAGER,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 18, Option.YES);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(Status.APPROVED);
      });

      it("should be not able to close a voting if the category is CHANGE_MANAGER and there are not enough votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.CHANGE_MANAGER,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await expect(contract.closeVoting(title)).to.be.revertedWith(
          "You cannot close the voting because there are not enough votes",
        );
      });

      it("should set the status to APPROVED if the approved votes are greater than the denied votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.DECISION,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 4, Option.YES);

        await generateVotes(contract, title, otherAccounts, 4, 3, Option.NO);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(Status.APPROVED);
      });

      it("should set the status to DENIED if the denied votes are greater than or equal to the approved votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.DECISION,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 3, Option.YES);

        await generateVotes(contract, title, otherAccounts, 3, 7, Option.NO);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(Status.DENIED);
      });

      it("should set the new manager if the category is CHANGE_MANAGER", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.CHANGE_MANAGER,
          0,
          groupMember.address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 18, Option.YES);

        await contract.closeVoting(title);

        expect(await contract.getManager()).to.equal(groupMember.address);
      });

      it("should set the new manager and update leader status when current manager is a leader", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        await contract.addLeader(manager.address, 1);
        await contract.connect(manager).payQuota(1, { value: ethers.parseEther("0.01") });

        await contract.addTopic(
          "Change Manager",
          "Change manager to new address",
          Category.CHANGE_MANAGER,
          0,
          groupMember.address
        );

        await contract.openVoting("Change Manager");

        for (let i = 0; i < 18; i++) {
          await contract.addLeader(otherAccounts[i].address, i + 2);
          await contract.connect(otherAccounts[i]).payQuota(i + 2, { value: ethers.parseEther("0.01") });
          await contract.connect(otherAccounts[i]).vote("Change Manager", Option.YES);
        }

        await contract.closeVoting("Change Manager");

        expect(await contract.getManager()).to.equal(groupMember.address);

        const oldManagerLeader = await contract.getLeader(manager.address);
        expect(oldManagerLeader.isManager).to.equal(false);
      });

      it("should set the new quota if the category is CHANGE_QUOTA", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.CHANGE_QUOTA,
          1,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 12, Option.YES);

        await contract.closeVoting(title);

        expect(await contract.getQuota()).to.equal(1);
      });

      it("should approve manager change when current manager is not a leader", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        await contract.addLeader(groupMember.address, 1);
        await contract.connect(groupMember).payQuota(1, { value: ethers.parseEther("0.01") });

        const groupMemberContract = contract.connect(groupMember);
        await groupMemberContract.addTopic(
          "Change Manager",
          "Change manager to new address",
          Category.CHANGE_MANAGER,
          0,
          otherAccounts[0].address
        );

        await contract.openVoting("Change Manager");

        for (let i = 0; i < 18; i++) {
          await contract.addLeader(otherAccounts[i].address, i + 2);
          await contract.connect(otherAccounts[i]).payQuota(i + 2, { value: ethers.parseEther("0.01") });
          await contract.connect(otherAccounts[i]).vote("Change Manager", Option.YES);
        }

        await contract.closeVoting("Change Manager");

        expect(await contract.getManager()).to.equal(otherAccounts[0].address);
      });
    });
  });

  describe("Payment Management", () => {
    describe("getQuota", () => {
      it("should return the monthly quota", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        expect(await contract.getQuota()).to.equal(
          ethers.parseEther("0.01"),
        );
      });
    });

    describe("payQuota", () => {
      it("should pay the quota", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.addLeader(manager.address, 1);
        await contract.payQuota(1, { value: ethers.parseEther("0.01") });

        const leader = await contract.getLeader(manager.address);
        expect(leader.nextPayment).to.be.greaterThan(0);
      });

      it("should not pay the quota if the group does not exists", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(contract.payQuota(MAX_GROUPS + 1, { value: ethers.parseEther("0.01") })).to.be.revertedWith(
          "Group does not exists",
        );
      });

      it("should not pay the quota if the amount is not the monthly quota", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(contract.payQuota(1, { value: ethers.parseEther("0.02") })).to.be.revertedWith(
          "Invalid amount",
        );
      });

      it("should not pay the quota if the payment was made in the last 30 days", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.payQuota(1, { value: ethers.parseEther("0.01") });

        await expect(contract.payQuota(1, { value: ethers.parseEther("0.01") })).to.be.revertedWith(
          "Payment already made",
        );
      });
    });

    describe("transfer", () => {
      it("should transfer the funds", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          otherAccounts[0].address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 9, Option.YES);

        await contract.closeVoting(title);

        const contractBalanceBefore = await ethers.provider.getBalance(contract.getAddress())
        const responsibleBalanceBefore = await ethers.provider.getBalance(otherAccounts[0].address)

        await contract.transfer(title, 10)

        const contractBalanceAfter = await ethers.provider.getBalance(contract.getAddress())
        const responsibleBalanceAfter = await ethers.provider.getBalance(otherAccounts[0].address)

        expect(contractBalanceAfter).to.be.equal(contractBalanceBefore - 10n)
        expect(responsibleBalanceAfter).to.be.equal(responsibleBalanceBefore + 10n)

        const topic = await contract.getTopic(title)

        expect(topic.status).to.equal(4)
      })

      it("should be not able to transfer the funds if is not the manager", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          otherAccounts[0].address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 9, Option.YES);

        await contract.closeVoting(title);

        const groupMemberContract = contract.connect(groupMember)


        await expect(groupMemberContract.transfer(title, 10)).to.be.revertedWith(
          "Only the manager can call this function",
        );

      })

      it("should not transfer the funds if the topic does not exists", async () => {
        const { contract, manager, groupMember, otherAccounts } = await loadFixture(deployFixture);

        await expect(contract.transfer("Non Existent Topic", 10)).to.be.revertedWith(
          "Topic does not exists",
        );
      })

      it("should be not able to transfer the funds if the contract balance is less than the amount to transfer", async () => {
        const { contract, manager, groupMember, otherAccounts } = await loadFixture(deployFixture);

        await contract.addTopic(
          "Test Topic",
          "Test Description",
          Category.SPENT,
          100,
          otherAccounts[0].address,
        );

        await expect(contract.transfer("Test Topic", 1000)).to.be.revertedWith(
          "Insufficient funds",
        );
      })


      it("should not transfer the funds if the topic is not approved", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          otherAccounts[0].address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 9, Option.YES);

        await expect(contract.transfer(title, 10)).to.be.revertedWith(
          "Only APPROVED SPENT topics can be used for transfers",
        );
      })

      it("should not transfer the funds if the topic is not SPENT", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.CHANGE_QUOTA,
          100,
          otherAccounts[0].address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 12, Option.YES);

        await contract.closeVoting(title);

        await expect(contract.transfer(title, 10)).to.be.revertedWith(
          "Only APPROVED SPENT topics can be used for transfers",
        );
      })

      it("should not transfer the funds if the topic amount is less than the amount to transfer", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          Category.SPENT,
          100,
          otherAccounts[0].address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 9, Option.YES);

        await contract.closeVoting(title);

        await expect(contract.transfer(title, 101)).to.be.revertedWith(
          "Insufficient funds",
        );
      })
    })
  })

  describe("getTopics", () => {
    it("should return topics with pagination", async () => {
      const { contract, manager, groupMember } =
        await loadFixture(deployFixture);

      await contract.addTopic("Topic 1", "Description 1", 0, Category.DECISION, ethers.ZeroAddress);
      await contract.addTopic("Topic 2", "Description 2", 0, Category.DECISION, ethers.ZeroAddress);
      await contract.addTopic("Topic 3", "Description 3", 0, Category.DECISION, ethers.ZeroAddress);

      const page1 = await contract.getTopics(1, 2);
      expect(page1.topics.length).to.equal(2);
      expect(page1.total).to.equal(3);
      expect(page1.topics[0].title).to.equal("Topic 1");
      expect(page1.topics[1].title).to.equal("Topic 2");

      const page2 = await contract.getTopics(2, 2);
      expect(page2.topics.length).to.equal(1);
      expect(page2.topics[0].title).to.equal("Topic 3");
    });

    it("should return empty array when page is beyond total topics", async () => {
      const { contract, manager, groupMember } =
        await loadFixture(deployFixture);

      await contract.addTopic("Topic 1", "Description 1", 0, Category.DECISION, ethers.ZeroAddress);

      const page2 = await contract.getTopics(2, 1);
      expect(page2.topics.length).to.equal(0);
      expect(page2.total).to.equal(1);
    });

    it("should return partial page when it's the last page", async () => {
      const { contract, manager, groupMember } =
        await loadFixture(deployFixture);

      await contract.addTopic("Topic 1", "Description 1", 0, Category.DECISION, ethers.ZeroAddress);
      await contract.addTopic("Topic 2", "Description 2", 0, Category.DECISION, ethers.ZeroAddress);

      const page = await contract.getTopics(1, 3);
      expect(page.topics.length).to.equal(2);
      expect(page.total).to.equal(2);
      expect(page.topics[0].title).to.equal("Topic 1");
      expect(page.topics[1].title).to.equal("Topic 2");
    });

    it("should revert if page is 0", async () => {
      const { contract, manager, groupMember } =
        await loadFixture(deployFixture);

      await expect(contract.getTopics(0, 10)).to.be.revertedWith(
        "Page must be greater than 0"
      );
    });

    it("should revert if pageSize is 0", async () => {
      const { contract, manager, groupMember } =
        await loadFixture(deployFixture);

      await expect(contract.getTopics(1, 0)).to.be.revertedWith(
        "Page size must be greater than 0"
      );
    });
  });

  describe("getVotes", () => {
    it("should return votes for a topic", async () => {
      const { contract, manager, groupMember, otherAccounts } =
        await loadFixture(deployFixture);

      const title = "Test Topic";

      await contract.addTopic(title, "Description", 0, Category.DECISION, ethers.ZeroAddress);
      await contract.openVoting(title);

      await addLeaders(contract, 2, [groupMember, otherAccounts[0]]);
      await contract.connect(groupMember).vote(title, Option.YES);
      await contract.connect(otherAccounts[0]).vote(title, Option.NO);

      const votes = await contract.getVotes(title);
      expect(votes.length).to.equal(2);
      expect(votes[0].option).to.equal(Option.YES);
      expect(votes[1].option).to.equal(Option.NO);
    });

    it("should return empty array for topic without votes", async () => {
      const { contract, manager, groupMember } =
        await loadFixture(deployFixture);

      const title = "Test Topic";
      await contract.addTopic(title, "Description", 0, Category.DECISION, ethers.ZeroAddress);

      const votes = await contract.getVotes(title);
      expect(votes.length).to.equal(0);
    });
  });

  describe("getCounselors", () => {
    it("should return all counselors", async () => {
      const { contract, manager, groupMember, otherAccounts } =
        await loadFixture(deployFixture);

      await addLeaders(contract, 3, [groupMember, otherAccounts[0], otherAccounts[1]]);

      await contract.setCounselor(groupMember.address, true);
      await contract.setCounselor(otherAccounts[0].address, true);

      const counselors = await contract.getCounselors();
      expect(counselors.length).to.equal(2);
      expect(counselors).to.include(groupMember.address);
      expect(counselors).to.include(otherAccounts[0].address);
      expect(counselors).to.not.include(otherAccounts[1].address);
    });

    it("should return empty array when there are no counselors", async () => {
      const { contract, manager, groupMember } =
        await loadFixture(deployFixture);

      const counselors = await contract.getCounselors();
      expect(counselors.length).to.equal(0);
    });
  });
});
