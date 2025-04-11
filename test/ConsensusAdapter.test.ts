import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { expect } from "chai";

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
        });
    });
});
