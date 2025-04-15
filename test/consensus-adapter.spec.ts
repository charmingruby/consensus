import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Status } from "./helpers/consensus-lib/status";
import { Option } from "./helpers/consensus-lib/option";
import { Category } from "./helpers/consensus-lib/category";

describe("Consensus", () => {
    async function deployAdapterFixture() {
        const accounts = await hre.ethers.getSigners();

        const manager = accounts[0];
        const baseAccounts = accounts.slice(1);

        const ConsensusAdapter = await hre.ethers.getContractFactory("ConsensusAdapter");
        const adapter = await ConsensusAdapter.deploy();

        return { adapter, manager, baseAccounts };
    }

    async function deployImplFixture() {
        const Consensus = await hre.ethers.getContractFactory("Consensus");
        const contract = await Consensus.deploy();

        return { contract };
    }

    describe("ConsensusAdapter", () => {
        describe("Versioning", () => {
            describe("upgrade", () => {
                it("should upgrade", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    expect(await adapter.getImplAddress()).to.equal(await contract.getAddress());
                });

                it("should not upgrade if not owner", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    const adapterWithNotManagerAccount = adapter.connect(baseAccounts[0])

                    await expect(adapterWithNotManagerAccount.upgrade(contract.getAddress()))
                        .to.be.revertedWith("Only owner can upgrade");
                });

                it("should be not able to call impl functions if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await expect(adapter.getMonthlyQuota())
                        .to.be.revertedWith("Contract not upgraded");
                });
            });
        })

        describe("Implementation", () => {
            describe("getMonthlyQuota", () => {
                it("it should return the monthly quota", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    expect(await adapter.getMonthlyQuota()).to.equal(ethers.parseEther("0.01"));
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.getMonthlyQuota()).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("openVoting", () => {
                it("should open the voting", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic"

                    await adapter.addTopic(title, "Test Description", Category.SPENT, 100, ethers.ZeroAddress)

                    await adapter.openVoting(title)

                    const topic = await contract.getTopic(title)

                    expect(topic.status).to.equal(Status.VOTING)
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.openVoting("Test Topic")).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("closeVoting", () => {
                it("should close the voting", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic"

                    await adapter.addTopic(title, "Test Description", 0, 0, ethers.ZeroAddress)

                    await adapter.openVoting(title)

                    for (let i = 0; i < 5; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1)
                        const groupMemberContract = contract.connect(baseAccounts[i])
                        await groupMemberContract.payQuota(i + 1, { value: ethers.parseEther("0.01") })
                        await groupMemberContract.vote(title, Option.YES)
                    }

                    await adapter.closeVoting(title)

                    const topic = await contract.getTopic(title)

                    expect(topic.status).to.equal(Status.APPROVED)
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.closeVoting("Test Topic")).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("addTopic", () => {
                it("should add the topic", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic"

                    await adapter.addTopic(title, "Test Description", Category.SPENT, 100, ethers.ZeroAddress)

                    expect(await contract.topicExists(title)).to.equal(true)
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.addTopic("Test Topic", "Test Description", 1, 100, ethers.ZeroAddress)).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("vote", () => {
                it("should vote", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic"

                    await adapter.addTopic(title, "Test Description", Category.SPENT, 100, ethers.ZeroAddress)

                    await adapter.openVoting(title)

                    await adapter.vote(title, Option.YES)

                    expect(await contract.numberOfVotes(title)).to.be.equal(1)
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.vote("Test Topic", 1)).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("addLeader", () => {
                it("should add the leader", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0]

                    await adapter.addLeader(groupMember.address, 1)

                    expect(await contract.isLeader(groupMember.address)).to.equal(true);
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.addLeader(baseAccounts[0].address, 1)).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("removeLeader", () => {
                it("should remove the leader", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0]

                    await adapter.addLeader(groupMember.address, 1)

                    expect(await contract.isLeader(groupMember.address)).to.equal(true);

                    await adapter.removeLeader(groupMember.address, 1)

                    expect(await contract.isLeader(groupMember.address)).to.equal(false);
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.removeLeader(baseAccounts[0].address, 1)).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("payQuota", () => {
                it("should pay the quota", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    await adapter.payQuota(1, { value: ethers.parseEther("0.01") })

                    expect(await contract.getPayment(1)).to.greaterThan(0);
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.payQuota(1, { value: ethers.parseEther("0.01") })).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("getPayment", () => {
                it("should get the payment", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    await adapter.payQuota(1, { value: ethers.parseEther("0.01") })

                    expect(await adapter.getPayment(1)).to.greaterThan(0);
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.getPayment(1)).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("editTopic", () => {
                it("should edit the topic", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic"

                    await adapter.addTopic(title, "Test Description", Category.SPENT, 100, ethers.ZeroAddress)

                    await adapter.editTopic(title, "Test Description 2", 100, ethers.ZeroAddress)

                    const topic = await contract.getTopic(title)

                    expect(topic.description).to.equal("Test Description 2");
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.editTopic("Test Topic", "Test Description 2", 100, ethers.ZeroAddress)).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("setManager", () => {
                it("should set the manager", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0]

                    await adapter.setManager(groupMember.address)

                    expect(await adapter.getManager()).to.equal(groupMember.address);
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.setManager(baseAccounts[0].address)).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("getManager", () => {
                it("should get the manager", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0]

                    await adapter.setManager(groupMember.address)

                    expect(await adapter.getManager()).to.equal(groupMember.address);
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.getManager()).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("setCounselor", () => {
                it("should set the counselor", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const groupMember = baseAccounts[0]

                    await adapter.addLeader(groupMember.address, 1)

                    await adapter.setCounselor(groupMember.address, true)

                    expect(await contract.isCounselor(groupMember.address)).to.equal(true);
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.setCounselor(baseAccounts[0].address, true)).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("removeTopic", () => {
                it("should remove the topic", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic"

                    await adapter.addTopic(title, "Test Description", Category.SPENT, 100, ethers.ZeroAddress)

                    await adapter.removeTopic(title)

                    expect(await contract.topicExists(title)).to.equal(false)
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.removeTopic("Test Topic")).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("numberOfVotes", () => {
                it("should get the number of votes", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic"

                    const groupMember = baseAccounts[0]

                    await adapter.addTopic(title, "Test Description", Category.SPENT, 100, ethers.ZeroAddress)

                    await adapter.openVoting(title)

                    await adapter.addLeader(groupMember.address, 1)

                    const groupMemberContract = contract.connect(groupMember)

                    await groupMemberContract.payQuota(1, { value: ethers.parseEther("0.01") })

                    await groupMemberContract.vote(title, Option.YES)

                    expect(await adapter.numberOfVotes(title)).to.be.equal(1)
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.numberOfVotes("Test Topic")).to.be.revertedWith("Contract not upgraded");
                })
            })

            describe("transfer", () => {
                it("should transfer the topic", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    const { contract } = await loadFixture(deployImplFixture);

                    await adapter.upgrade(contract.getAddress());

                    const title = "Test Topic"


                    await adapter.addLeader(baseAccounts[0].address, 1)
                    const groupMemberContract = adapter.connect(baseAccounts[0])
                    await groupMemberContract.payQuota(1, { value: ethers.parseEther("0.01") })

                    await adapter.addTopic(title, "Test Description", 1, 100, baseAccounts[0].address)

                    await adapter.openVoting(title)

                    for (let i = 1; i < 10; i++) {
                        await adapter.addLeader(baseAccounts[i].address, 1)
                        const groupMemberContract = adapter.connect(baseAccounts[i])
                        await groupMemberContract.payQuota(i + 1, { value: ethers.parseEther("0.01") })
                        await groupMemberContract.vote(title, Option.YES)
                    }

                    await adapter.closeVoting(title)

                    const contractBalanceBefore = await ethers.provider.getBalance(contract.getAddress())
                    const responsibleBalanceBefore = await ethers.provider.getBalance(baseAccounts[0].address)

                    await adapter.transfer(title, 10)

                    const contractBalanceAfter = await ethers.provider.getBalance(contract.getAddress())
                    const responsibleBalanceAfter = await ethers.provider.getBalance(baseAccounts[0].address)

                    expect(contractBalanceAfter).to.be.equal(contractBalanceBefore - 10n)
                    expect(responsibleBalanceAfter).to.be.equal(responsibleBalanceBefore + 10n)

                    const topic = await contract.getTopic(title)

                    expect(topic.status).to.equal(Status.SPENT)
                })

                it("should not be able to call if not upgraded", async () => {
                    const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                    await expect(adapter.transfer("Test Topic", 10)).to.be.revertedWith("Contract not upgraded");
                })
            })
        })
    });
});
