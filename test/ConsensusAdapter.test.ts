import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { expect } from "chai";
import { ethers } from "hardhat";

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
        describe("Proxy", () => {
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
            it("getMonthlyQuota", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                expect(await adapter.getMonthlyQuota()).to.equal(ethers.parseEther("0.01"));
            })

            it("openVoting", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const title = "Test Topic"

                await adapter.addTopic(title, "Test Description", 1, 100, ethers.ZeroAddress)

                await adapter.openVoting(title)

                const topic = await contract.getTopic(title)

                expect(topic.status).to.equal(1)
            })

            it("closeVoting", async () => {
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
                    await groupMemberContract.vote(title, 1)
                }

                await adapter.closeVoting(title)

                const topic = await contract.getTopic(title)

                expect(topic.status).to.equal(2)
            })

            it("addTopic", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const title = "Test Topic"

                await adapter.addTopic(title, "Test Description", 1, 100, ethers.ZeroAddress)

                expect(await contract.topicExists(title)).to.equal(true)
            })

            it("vote", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const title = "Test Topic"

                await adapter.addTopic(title, "Test Description", 1, 100, ethers.ZeroAddress)

                await adapter.openVoting(title)

                await adapter.vote(title, 1)

                expect(await contract.numberOfVotes(title)).to.be.equal(1)
            })

            it("addLeader", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const groupMember = baseAccounts[0]

                await adapter.addLeader(groupMember.address, 1)

                expect(await contract.isLeader(groupMember.address)).to.equal(true);
            })

            it("removeLeader", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const groupMember = baseAccounts[0]

                await adapter.addLeader(groupMember.address, 1)

                expect(await contract.isLeader(groupMember.address)).to.equal(true);

                await adapter.removeLeader(groupMember.address, 1)

                expect(await contract.isLeader(groupMember.address)).to.equal(false);
            })

            it("payQuota", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                await adapter.payQuota(1, { value: ethers.parseEther("0.01") })

                expect(await contract.getPayment(1)).to.greaterThan(0);
            })

            it("getPayment", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                await adapter.payQuota(1, { value: ethers.parseEther("0.01") })

                expect(await adapter.getPayment(1)).to.greaterThan(0);
            })

            it("editTopic", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const title = "Test Topic"

                await adapter.addTopic(title, "Test Description", 1, 100, ethers.ZeroAddress)

                await adapter.editTopic(title, "Test Description 2", 100, ethers.ZeroAddress)

                const topic = await contract.getTopic(title)

                expect(topic.description).to.equal("Test Description 2");
            })

            it("setManager", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const groupMember = baseAccounts[0]

                await adapter.setManager(groupMember.address)

                expect(await adapter.getManager()).to.equal(groupMember.address);
            })

            it("getManager", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const groupMember = baseAccounts[0]

                await adapter.setManager(groupMember.address)

                expect(await adapter.getManager()).to.equal(groupMember.address);
            })

            it("setCounselor", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const groupMember = baseAccounts[0]

                await adapter.addLeader(groupMember.address, 1)

                await adapter.setCounselor(groupMember.address, true)

                expect(await contract.isCounselor(groupMember.address)).to.equal(true);
            })

            it("removeTopic", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const title = "Test Topic"

                await adapter.addTopic(title, "Test Description", 1, 100, ethers.ZeroAddress)

                await adapter.removeTopic(title)

                expect(await contract.topicExists(title)).to.equal(false)
            })

            it("numberOfVotes", async () => {
                const { adapter, manager, baseAccounts } = await loadFixture(deployAdapterFixture);

                const { contract } = await loadFixture(deployImplFixture);

                await adapter.upgrade(contract.getAddress());

                const title = "Test Topic"

                const groupMember = baseAccounts[0]

                await adapter.addTopic(title, "Test Description", 1, 100, ethers.ZeroAddress)

                await adapter.openVoting(title)

                await adapter.addLeader(groupMember.address, 1)

                const groupMemberContract = contract.connect(groupMember)

                await groupMemberContract.payQuota(1, { value: ethers.parseEther("0.01") })

                await groupMemberContract.vote(title, 1)

                expect(await adapter.numberOfVotes(title)).to.be.equal(1)
            })
        })
    });
});
