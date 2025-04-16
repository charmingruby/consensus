import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Status } from "./helpers/consensus-lib/status";
import { Option } from "./helpers/consensus-lib/option";
import { Category } from "./helpers/consensus-lib/category";
import type { ConsensusAdapter } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Consensus", () => {
    async function deployAdapterFixture() {
        const accounts = await hre.ethers.getSigners();

        const manager = accounts[0];
        const baseAccounts = accounts.slice(1);

        const ConsensusAdapter =
            await hre.ethers.getContractFactory("ConsensusAdapter");
        const adapter = await ConsensusAdapter.deploy();

        return { adapter, manager, baseAccounts };
    }

    async function deployImplFixture() {
        const Validator = await hre.ethers.getContractFactory("Validator");
        const validator = await Validator.deploy();

        const Consensus = await hre.ethers.getContractFactory("Consensus", {
            libraries: {
                Validator: await validator.getAddress(),
            },
        });
        const contract = await Consensus.deploy();

        return { contract };
    }

    async function addLeaders(
        contract: ConsensusAdapter,
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

    describe("ConsensusAdapter", () => {
        describe("Versioning", () => {
            describe("upgrade", () => {
                it("should upgrade", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    expect(await adapter.getImplAddress()).to.equal(
                        await contract.getAddress(),
                    );
                });

                it("should not upgrade if not owner", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    const adapterWithNotManagerAccount = adapter.connect(baseAccounts[0]);

                    await expect(
                        adapterWithNotManagerAccount.upgrade(contract.getAddress()),
                    ).to.be.revertedWith("Only owner can upgrade");
                });

                it("should be not able to call impl functions if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await expect(adapter.getQuota()).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });
        });

        describe("Implementation", () => {
            describe("getManager", () => {
                it("it should return the manager", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    expect(await adapter.getManager()).to.equal(manager.address);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.getManager()).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("getQuota", () => {
                it("it should return the monthly quota", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    expect(await adapter.getQuota()).to.equal(ethers.parseEther("0.01"));
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.getQuota()).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("openVoting", () => {
                it("should open the voting", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    await adapter.openVoting(title);

                    const topic = await contract.getTopic(title);

                    expect(topic.status).to.equal(Status.VOTING);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.openVoting("Test Topic")).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("closeVoting", () => {
                it("should close the voting", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.DECISION,
                        0,
                        ethers.ZeroAddress,
                    );

                    await adapter.openVoting(title);

                    for (let i = 0; i < 5; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1);
                        const groupMemberContract = contract.connect(baseAccounts[i]);
                        await groupMemberContract.payQuota(i + 1, {
                            value: ethers.parseEther("0.01"),
                        });
                        await groupMemberContract.vote(title, Option.YES);
                    }

                    const topicId = ethers.keccak256(ethers.toUtf8Bytes(title));

                    await expect(adapter.closeVoting(title))
                        .to.emit(adapter, "TopicChanged")
                        .withArgs(topicId, title, Status.APPROVED);

                    const topic = await contract.getTopic(title);

                    expect(topic.status).to.equal(Status.APPROVED);
                });

                it("should emit ManagerChanged event", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    const newManager = baseAccounts[0];

                    await adapter.addLeader(newManager.address, 1);
                    const groupMemberContract = contract.connect(newManager);
                    await groupMemberContract.payQuota(1, {
                        value: ethers.parseEther("0.01"),
                    });

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.CHANGE_MANAGER,
                        0,
                        newManager.address,
                    );

                    await adapter.openVoting(title);

                    for (let i = 1; i < 19; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1);
                        const groupMemberContract = contract.connect(baseAccounts[i]);
                        await groupMemberContract.payQuota(i + 1, {
                            value: ethers.parseEther("0.01"),
                        });
                        await groupMemberContract.vote(title, Option.YES);
                    }

                    await expect(adapter.closeVoting(title))
                        .to.emit(adapter, "ManagerChanged")
                        .withArgs(newManager.address);
                });

                it("should emit QuotaChanged event", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.CHANGE_QUOTA,
                        100,
                        ethers.ZeroAddress,
                    );

                    await adapter.openVoting(title);

                    for (let i = 0; i < 12; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1);
                        const groupMemberContract = contract.connect(baseAccounts[i]);
                        await groupMemberContract.payQuota(i + 1, {
                            value: ethers.parseEther("0.01"),
                        });
                        await groupMemberContract.vote(title, Option.YES);
                    }

                    await expect(adapter.closeVoting(title))
                        .to.emit(adapter, "QuotaChanged")
                        .withArgs(100);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.closeVoting("Test Topic")).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });

                it("should not emit additional events when topic is not approved", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";
                    const newQuota = ethers.parseEther("0.02");

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.CHANGE_QUOTA,
                        newQuota,
                        ethers.ZeroAddress,
                    );

                    await adapter.openVoting(title);

                    for (let i = 0; i < 12; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1);
                        const groupMemberContract = contract.connect(baseAccounts[i]);
                        await groupMemberContract.payQuota(i + 1, {
                            value: ethers.parseEther("0.01"),
                        });
                        await groupMemberContract.vote(title, Option.NO);
                    }

                    const topicId = ethers.keccak256(ethers.toUtf8Bytes(title));

                    await expect(adapter.closeVoting(title))
                        .to.emit(adapter, "TopicChanged")
                        .withArgs(topicId, title, Status.DENIED)
                        .to.not.emit(adapter, "QuotaChanged");
                });

                it("should not emit additional events when topic is approved but category is not CHANGE_MANAGER or CHANGE_QUOTA", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    await adapter.openVoting(title);

                    for (let i = 0; i < 12; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1);
                        const groupMemberContract = contract.connect(baseAccounts[i]);
                        await groupMemberContract.payQuota(i + 1, {
                            value: ethers.parseEther("0.01"),
                        });
                        await groupMemberContract.vote(title, Option.YES);
                    }

                    const topicId = ethers.keccak256(ethers.toUtf8Bytes(title));

                    await expect(adapter.closeVoting(title))
                        .to.emit(adapter, "TopicChanged")
                        .withArgs(topicId, title, Status.APPROVED)
                        .to.not.emit(adapter, "QuotaChanged")
                        .to.not.emit(adapter, "ManagerChanged");
                });

                it("should emit only TopicChanged when topic is approved with DECISION category", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.DECISION,
                        0,
                        ethers.ZeroAddress,
                    );

                    await adapter.openVoting(title);

                    for (let i = 0; i < 5; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1);
                        const groupMemberContract = contract.connect(baseAccounts[i]);
                        await groupMemberContract.payQuota(i + 1, {
                            value: ethers.parseEther("0.01"),
                        });
                        await groupMemberContract.vote(title, Option.YES);
                    }

                    const topicId = ethers.keccak256(ethers.toUtf8Bytes(title));

                    await expect(adapter.closeVoting(title))
                        .to.emit(adapter, "TopicChanged")
                        .withArgs(topicId, title, Status.APPROVED)
                        .to.not.emit(adapter, "QuotaChanged")
                        .to.not.emit(adapter, "ManagerChanged");
                });
            });

            describe("addTopic", () => {
                it("should add the topic", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    const topic = await contract.getTopic(title);
                    expect(topic.title).to.equal(title);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.addTopic(
                            "Test Topic",
                            "Test Description",
                            1,
                            100,
                            ethers.ZeroAddress,
                        ),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("vote", () => {
                it("should vote", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";
                    const voter = baseAccounts[0];

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    await adapter.openVoting(title);

                    await adapter.addLeader(voter.address, 1);
                    const voterContract = adapter.connect(voter);
                    await voterContract.payQuota(1, { value: ethers.parseEther("0.01") });
                    await voterContract.vote(title, Option.YES);

                    expect(await contract.numberOfVotes(title)).to.be.equal(1);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.vote("Test Topic", 1)).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("addLeader", () => {
                it("should add the leader", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0];

                    await adapter.addLeader(groupMember.address, 1);

                    const leader = await contract.getLeader(groupMember.address);
                    expect(leader.group).to.be.greaterThan(0);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.addLeader(baseAccounts[0].address, 1),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("removeLeader", () => {
                it("should remove the leader", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0];

                    await adapter.addLeader(groupMember.address, 1);

                    let leader = await contract.getLeader(groupMember.address);
                    expect(leader.group).to.be.greaterThan(0);

                    await adapter.removeLeader(groupMember.address, 1);

                    leader = await contract.getLeader(groupMember.address);
                    expect(leader.group).to.equal(0);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.removeLeader(baseAccounts[0].address, 1),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("payQuota", () => {
                it("should pay the quota", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    await adapter.payQuota(1, { value: ethers.parseEther("0.01") });

                    const contractBalance = await ethers.provider.getBalance(
                        contract.getAddress(),
                    );
                    expect(contractBalance).to.equal(ethers.parseEther("0.01"));
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.payQuota(1, { value: ethers.parseEther("0.01") }),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("editTopic", () => {
                it("should be able to call if upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";
                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    await expect(
                        adapter.editTopic(
                            title,
                            "New Description",
                            200,
                            ethers.ZeroAddress,
                        ),
                    ).to.not.be.reverted;
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.editTopic(
                            "Test Topic",
                            "New Description",
                            200,
                            ethers.ZeroAddress,
                        ),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("setManager", () => {
                it("should set the manager", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0];

                    await adapter.setManager(groupMember.address);

                    expect(await adapter.getManager()).to.equal(groupMember.address);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.setManager(baseAccounts[0].address),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("getManager", () => {
                it("should get the manager", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0];

                    await adapter.setManager(groupMember.address);

                    expect(await adapter.getManager()).to.equal(groupMember.address);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.getManager()).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("setCounselor", () => {
                it("should set the counselor", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0];

                    await adapter.addLeader(groupMember.address, 1);

                    await adapter.setCounselor(groupMember.address, true);

                    const counselors = await contract.getLeaders(1, 1);
                    const leader = counselors.leaders[0];
                    expect(leader.isCounselor).to.equal(true);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.setCounselor(baseAccounts[0].address, true),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("removeTopic", () => {
                it("should remove the topic", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    const topicId = ethers.keccak256(ethers.toUtf8Bytes(title));

                    await expect(adapter.removeTopic(title))
                        .to.emit(adapter, "TopicChanged")
                        .withArgs(topicId, title, Status.DELETED);

                    const topic = await contract.getTopic(title);
                    expect(topic.status).to.equal(Status.DELETED);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.removeTopic("Test Topic")).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });

                it("should emit TopicChanged event with DELETED status", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    const topicId = ethers.keccak256(ethers.toUtf8Bytes(title));

                    await expect(adapter.removeTopic(title))
                        .to.emit(adapter, "TopicChanged")
                        .withArgs(topicId, title, Status.DELETED);
                });
            });

            describe("numberOfVotes", () => {
                it("should get the number of votes", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    const groupMember = baseAccounts[0];

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    await adapter.openVoting(title);

                    await adapter.addLeader(groupMember.address, 1);

                    const groupMemberContract = contract.connect(groupMember);

                    await groupMemberContract.payQuota(1, {
                        value: ethers.parseEther("0.01"),
                    });

                    await groupMemberContract.vote(title, Option.YES);

                    expect(await adapter.numberOfVotes(title)).to.be.equal(1);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.numberOfVotes("Test Topic")).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("transfer", () => {
                it("should be able to call if upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);
                    const { contract } = await loadFixture(deployImplFixture);
                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";
                    const responsible = baseAccounts[0];
                    await adapter.addLeader(responsible.address, 1);
                    const responsibleContract = adapter.connect(responsible);
                    await responsibleContract.payQuota(1, {
                        value: ethers.parseEther("0.01"),
                    });

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        responsible.address,
                    );
                    await adapter.openVoting(title);

                    for (let i = 1; i < 10; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1);
                        const groupMemberContract = adapter.connect(baseAccounts[i]);
                        await groupMemberContract.payQuota(i + 1, {
                            value: ethers.parseEther("0.01"),
                        });
                        await groupMemberContract.vote(title, Option.YES);
                    }

                    await adapter.closeVoting(title);

                    await expect(adapter.transfer(title, 100)).to.not.be.reverted;
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.transfer("Test Topic", 100)).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("getImplAddress", () => {
                it("should get the implementation address", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    expect(await adapter.getImplAddress()).to.equal(
                        await contract.getAddress(),
                    );
                });
            });

            describe("getLeader", () => {
                it("should get the leader", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0];

                    await adapter.addLeader(groupMember.address, 1);

                    const leader = await adapter.getLeader(groupMember.address);
                    expect(leader.group).to.be.greaterThan(0);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.getLeader(baseAccounts[0].address),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("getLeaders", () => {
                it("should get the leaders", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0];

                    await adapter.addLeader(groupMember.address, 1);

                    const leaders = await adapter.getLeaders(1, 1);
                    expect(leaders.leaders[0].wallet).to.equal(groupMember.address);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.getLeaders(1, 1)).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("getTopic", () => {
                it("should get topic information", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";
                    const description = "Test Description";
                    const amount = 100;

                    await adapter.addTopic(
                        title,
                        description,
                        Category.SPENT,
                        amount,
                        ethers.ZeroAddress,
                    );

                    const topic = await adapter.getTopic(title);
                    expect(topic.title).to.equal(title);
                    expect(topic.description).to.equal(description);
                    expect(topic.amount).to.equal(amount);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.getTopic("Test Topic")).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("getVotes", () => {
                it("should be able to call if upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);
                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";
                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );
                    await adapter.openVoting(title);

                    await addLeaders(adapter, 2, [baseAccounts[0], baseAccounts[1]]);
                    await adapter.connect(baseAccounts[0]).vote(title, Option.YES);
                    await adapter.connect(baseAccounts[1]).vote(title, Option.NO);

                    const votes = await adapter.getVotes(title);
                    expect(votes.length).to.equal(2);
                    expect(votes[0].option).to.equal(Option.YES);
                    expect(votes[1].option).to.equal(Option.NO);

                    await expect(adapter.getVotes(title)).to.not.be.reverted;
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.getVotes("Test Topic")).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("getTopics", () => {
                it("should get the topics", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    const topics = await adapter.getTopics(1, 1);
                    expect(topics.topics[0].title).to.equal(title);
                    expect(topics.total).to.equal(1);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.getTopics(1, 1)).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("upgrade", () => {
                it("should not upgrade with zero address", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.upgrade(ethers.ZeroAddress)).to.be.revertedWith(
                        "New contract address cannot be 0",
                    );
                });
            });

            describe("getLeader", () => {
                it("should get leader information", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const leader = baseAccounts[0];

                    await adapter.addLeader(leader.address, 1);

                    const leaderInfo = await adapter.getLeader(leader.address);
                    expect(leaderInfo.wallet).to.equal(leader.address);
                    expect(leaderInfo.group).to.equal(1);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.getLeader(baseAccounts[0].address),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("getLeaders", () => {
                it("should get paginated leaders", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    for (let i = 0; i < 3; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1);
                    }

                    const leadersPage = await adapter.getLeaders(1, 2);
                    expect(leadersPage.leaders.length).to.equal(2);
                    expect(leadersPage.total).to.equal(3);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.getLeaders(1, 10)).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("getTopics", () => {
                it("should get paginated topics", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    await adapter.addTopic(
                        "Topic 1",
                        "Description 1",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );
                    await adapter.addTopic(
                        "Topic 2",
                        "Description 2",
                        Category.SPENT,
                        200,
                        ethers.ZeroAddress,
                    );
                    await adapter.addTopic(
                        "Topic 3",
                        "Description 3",
                        Category.SPENT,
                        300,
                        ethers.ZeroAddress,
                    );

                    const topicsPage = await adapter.getTopics(1, 2);
                    expect(topicsPage.topics.length).to.equal(2);
                    expect(topicsPage.total).to.equal(3);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.getTopics(1, 10)).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("openVoting", () => {
                it("should open voting for a topic", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic";

                    await adapter.addTopic(
                        title,
                        "Test Description",
                        Category.SPENT,
                        100,
                        ethers.ZeroAddress,
                    );

                    await adapter.openVoting(title);

                    const topic = await adapter.getTopic(title);
                    expect(topic.status).to.equal(Status.VOTING);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(adapter.openVoting("Test Topic")).to.be.revertedWith(
                        "Contract not upgraded",
                    );
                });
            });

            describe("payQuota", () => {
                it("should pay quota with correct amount", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const leader = baseAccounts[0];
                    const amount = ethers.parseEther("0.01");

                    await adapter.addLeader(leader.address, 1);
                    const leaderContract = adapter.connect(leader);

                    await expect(
                        leaderContract.payQuota(1, { value: amount }),
                    ).to.changeEtherBalances([leader, contract], [-amount, amount]);
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.payQuota(1, { value: ethers.parseEther("0.01") }),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });

            describe("setCounselor", () => {
                it("should set counselor status", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const counselor = baseAccounts[0];

                    await adapter.addLeader(counselor.address, 1);
                    await adapter.setCounselor(counselor.address, true);

                    const leaderInfo = await adapter.getLeader(counselor.address);
                    expect(leaderInfo.isCounselor).to.be.true;
                });

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } =
                        await loadFixture(deployAdapterFixture);

                    await expect(
                        adapter.setCounselor(baseAccounts[0].address, true),
                    ).to.be.revertedWith("Contract not upgraded");
                });
            });
        });
    });
});
