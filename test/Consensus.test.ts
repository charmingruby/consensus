import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import type { Consensus } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Consensus", () => {
  const MAX_GROUPS = 50;

  async function deployFixture() {
    const [manager, groupMember, ...otherAccounts] =
      await hre.ethers.getSigners();

    const Consensus = await hre.ethers.getContractFactory("Consensus");
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
      await contract.payQuota(i + 1, { value: ethers.parseEther("0.01") });
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
    for (let i = startIndex; i < numberOfVotes; i++) {
      await contract.addLeader(accounts[i].address, i + 1);
      const groupMemberContract = contract.connect(accounts[i]);
      await groupMemberContract.payQuota(i + 1, { value: ethers.parseEther("0.01") });
      await groupMemberContract.vote(title, option);
    }
  }

  describe("Membership Management", () => {
    describe("addLeader", () => {
      it("should add a leader to a group", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        expect(await contract.isLeader(groupMember.address)).to.equal(true);
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

        expect(await contract.isLeader(groupMember.address)).to.be.equal(true);

        await contract.removeLeader(groupMember.address, 1);

        expect(await contract.isLeader(groupMember.address)).to.be.equal(false);
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

        expect(await contract.isLeader(groupMember.address)).to.be.equal(true);

        const groupMemberContract = contract.connect(groupMember);

        await expect(
          groupMemberContract.removeLeader(groupMember.address, 1),
        ).to.be.revertedWith("Only the manager can call this function");
      });
    });

    describe("setManager", () => {
      it("should set a new manager", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.setManager(groupMember.address);

        expect(await contract.getManager()).to.equal(groupMember.address);
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

        expect(await contract.isCounselor(groupMember.address)).to.equal(true);
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

      it("should remove a counselor from the contract", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        await contract.setCounselor(groupMember.address, true);

        expect(await contract.isCounselor(groupMember.address)).to.be.equal(
          true,
        );

        await contract.setCounselor(groupMember.address, false);

        expect(await contract.isCounselor(groupMember.address)).to.be.equal(
          false,
        );
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

        expect(await contract.isCounselor(groupMember.address)).to.be.equal(
          true,
        );

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

        expect(await contract.isCounselor(groupMember.address)).to.equal(true);
      });

      it("should return false if the address is not a counselor", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        expect(await contract.isCounselor(groupMember.address)).to.equal(false);
      });
    });

    describe("isLeader", () => {
      it("should return true if the address is a leader", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await addLeaders(contract, 1, [groupMember]);

        expect(await contract.isLeader(groupMember.address)).to.equal(true);
      });

      it("should return false if the address is not a leader", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        expect(await contract.isLeader(groupMember.address)).to.be.equal(false);
      });
    });

    describe("groupExists", () => {
      it("should return true if the group exists", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        expect(await contract.groupExists(1)).to.equal(true);
      });

      it("should return false if the group does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        expect(await contract.groupExists(MAX_GROUPS + 1)).to.equal(false);
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
          1,
          100,
          ethers.ZeroAddress,
        );

        const topic = await contract.getTopic("Test Topic");

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
          1,
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
          1,
          100,
          ethers.ZeroAddress,
        );

        await expect(
          contract.addTopic(
            title,
            "Test Description",
            1,
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
            1,
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
            0,
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
            3,
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
          1,
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
          1,
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
          1,
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
            1,
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
          1,
          100,
          ethers.ZeroAddress,
        );

        const groupMemberContract = contract.connect(groupMember);

        await expect(
          groupMemberContract.editTopic(
            "Test Topic",
            "New Description",
            1,
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
          1,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting("Test Topic");

        await expect(
          contract.editTopic(
            "Test Topic",
            "New Description",
            1,
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
          1,
          100,
          ethers.ZeroAddress,
        );

        await contract.removeTopic(title);

        expect(await contract.topicExists(title)).to.equal(false);
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
          1,
          100,
          ethers.ZeroAddress,
        );

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.removeTopic(title)).to.be.revertedWith(
          "Only the manager can call this function",
        );
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
          1,
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
    });

    describe("topicExists", () => {
      it("should return true if the topic exists", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          1,
          100,
          ethers.ZeroAddress,
        );

        expect(await contract.topicExists(title)).to.equal(true);
      });

      it("should return false if the topic does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        expect(await contract.topicExists("Non Existent Topic")).to.equal(
          false,
        );
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
          1,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        const numberOfVotes = 3;

        await generateVotes(contract, title, otherAccounts, 0, 3, 1);

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
          1,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(1);
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
          1,
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
          1,
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
          1,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await groupMemberContract.vote(title, 1);

        expect(await contract.numberOfVotes(title)).to.be.equal(1);
      });

      it("should be not able to vote if the leader is defaulter", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          1,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await contract.addLeader(groupMember.address, 1);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, 1)).to.be.revertedWith(
          "The leader must be defaulter",
        );
      })

      it("should be not able to vote if the topic does not exist", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, 1)).to.be.revertedWith(
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
          1,
          100,
          ethers.ZeroAddress,
        );

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, 1)).to.be.revertedWith(
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
          1,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, 1)).to.be.revertedWith(
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
          1,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await expect(groupMemberContract.vote(title, 0)).to.be.revertedWith(
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
          1,
          100,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await addLeaders(contract, 1, [groupMember]);

        const groupMemberContract = contract.connect(groupMember);

        await groupMemberContract.vote(title, 1);

        await expect(groupMemberContract.vote(title, 1)).to.be.revertedWith(
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
          0,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 3, 1);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(2);
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
          0,
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
          0,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 3, 1);

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
          0,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await expect(contract.closeVoting(title)).to.be.revertedWith(
          "You cannot close the voting because there are not enough votes",
        );
      });

      it("should to close a voting if the category is DECISION only if there are 5 votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          0,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 5, 1);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(2);
      });

      it("should be not able to close a voting if the category is DECISION and there are not enough votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          0,
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
          1,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 9, 1);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(2);
      });

      it("should be not able to close a voting if the category is SPENT and there are not enough votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          1,
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
          2,
          1,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 12, 1);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(2);
      });

      it("should be not able to close a voting if the category is CHANGE_QUOTA and there are not enough votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          2,
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
          3,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 18, 1);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(2);
      });

      it("should be not able to close a voting if the category is CHANGE_MANAGER and there are not enough votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          3,
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
          0,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 4, 1);

        await generateVotes(contract, title, otherAccounts, 4, 3, 2);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(2);
      });

      it("should set the status to DENIED if the denied votes are greater than or equal to the approved votes", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          0,
          0,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 3, 1);

        await generateVotes(contract, title, otherAccounts, 3, 7, 2);

        await contract.closeVoting(title);

        const topic = await contract.getTopic(title);

        expect(topic.status).to.equal(3);
      });

      it("should set the new manager if the category is CHANGE_MANAGER", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          3,
          0,
          groupMember.address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 18, 1);

        await contract.closeVoting(title);

        expect(await contract.getManager()).to.equal(groupMember.address);
      });

      it("should set the new quota if the category is CHANGE_QUOTA", async () => {
        const { contract, manager, groupMember, otherAccounts } =
          await loadFixture(deployFixture);

        const title = "Test Topic";

        await contract.addTopic(
          title,
          "Test Description",
          2,
          1,
          ethers.ZeroAddress,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 12, 1);

        await contract.closeVoting(title);

        expect(await contract.getMonthlyQuota()).to.equal(1);
      });
    });
  });

  describe("Payment Management", () => {
    describe("getMonthlyQuota", () => {
      it("should return the monthly quota", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        expect(await contract.getMonthlyQuota()).to.equal(
          ethers.parseEther("0.01"),
        );
      });
    });

    describe("payQuota", () => {
      it("should pay the quota", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.payQuota(1, { value: ethers.parseEther("0.01") });

        expect(await contract.getPayment(1)).to.greaterThan(0);
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

    describe("getPayment", () => {
      it("should return the payment", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await contract.payQuota(1, { value: ethers.parseEther("0.01") });

        expect(await contract.getPayment(1)).to.greaterThan(0);
      });

      it("should not return the payment if the group does not exists", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(contract.getPayment(MAX_GROUPS + 1)).to.be.revertedWith(
          "Group does not exists",
        );
      });

      it("should not return the payment if the payment was not made", async () => {
        const { contract, manager, groupMember } =
          await loadFixture(deployFixture);

        await expect(contract.getPayment(1)).to.be.revertedWith(
          "Payment not made",
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
          1,
          100,
          otherAccounts[0].address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 9, 1);

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
          1,
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
          1,
          100,
          otherAccounts[0].address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 9, 1);

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
          2,
          100,
          otherAccounts[0].address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 12, 1);

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
          1,
          100,
          otherAccounts[0].address,
        );

        await contract.openVoting(title);

        await generateVotes(contract, title, otherAccounts, 0, 9, 1);

        await contract.closeVoting(title);

        await expect(contract.transfer(title, 101)).to.be.revertedWith(
          "Insufficient funds",
        );
      })
    })
  })
});
