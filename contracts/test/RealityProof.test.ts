import { expect } from "chai";
import { network } from "hardhat";
import { keccak256, toBytes, type Address } from "viem";

const { viem } = await network.connect();

describe("RealityProof", () => {
  async function deploy() {
    const [deployer, minter, recipient, other] = await viem.getWalletClients();
    const realityProof = await viem.deployContract("RealityProof", [deployer.account.address]);
    const MINTER_ROLE = keccak256(toBytes("MINTER_ROLE"));
    await realityProof.write.grantRole([MINTER_ROLE, minter.account.address]);
    return { realityProof, deployer, minter, recipient, other, MINTER_ROLE };
  }

  function fixtureMintArgs(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      to: "0x0000000000000000000000000000000000000001" as Address,
      bundleHash: keccak256(toBytes("test-bundle-1")),
      swarmRef: "bah5acgza0000000000000000000000000000000000000000000000000000000000",
      bundleRef: "bah5acgzb0000000000000000000000000000000000000000000000000000000000",
      satSig: "0x3046022100" as `0x${string}`,
      cosmoSig: "0x3046022200" as `0x${string}`,
      attestation: "0xdeadbeef" as `0x${string}`,
      attestationType: 0,
      attestor: "0x0000000000000000000000000000000000000000" as Address,
      capturedAt: 1746567619n,
      mode: 0,
      ...overrides,
    };
  }

  it("mints a token with full proof", async () => {
    const { realityProof, minter, recipient } = await deploy();
    const args = fixtureMintArgs({ to: recipient.account.address });
    const hash = await realityProof.write.mint(
      [
        args.to,
        args.bundleHash,
        args.swarmRef,
        args.bundleRef,
        args.satSig,
        args.cosmoSig,
        args.attestation,
        args.attestationType,
        args.attestor,
        args.capturedAt,
        args.mode,
      ],
      { account: minter.account },
    );
    expect(hash).to.be.a("string");

    const tokenId = await realityProof.read.nextTokenId();
    expect(tokenId).to.equal(1n);
    expect(await realityProof.read.ownerOf([1n])).to.equal(
      recipient.account.address.toLowerCase(),
    );
  });

  it("reverts on duplicate bundleHash", async () => {
    const { realityProof, minter, recipient } = await deploy();
    const args = fixtureMintArgs({ to: recipient.account.address });
    await realityProof.write.mint(
      [
        args.to,
        args.bundleHash,
        args.swarmRef,
        args.bundleRef,
        args.satSig,
        args.cosmoSig,
        args.attestation,
        args.attestationType,
        args.attestor,
        args.capturedAt,
        args.mode,
      ],
      { account: minter.account },
    );

    let threw = false;
    try {
      await realityProof.write.mint(
        [
          args.to,
          args.bundleHash,
          args.swarmRef,
          args.bundleRef,
          args.satSig,
          args.cosmoSig,
          args.attestation,
          args.attestationType,
          args.attestor,
          args.capturedAt,
          args.mode,
        ],
        { account: minter.account },
      );
    } catch (e) {
      threw = true;
    }
    expect(threw, "second mint must revert with DuplicateBundle").to.equal(true);
  });

  it("rejects mint from non-MINTER", async () => {
    const { realityProof, other, recipient } = await deploy();
    const args = fixtureMintArgs({ to: recipient.account.address });
    let threw = false;
    try {
      await realityProof.write.mint(
        [
          args.to,
          args.bundleHash,
          args.swarmRef,
          args.bundleRef,
          args.satSig,
          args.cosmoSig,
          args.attestation,
          args.attestationType,
          args.attestor,
          args.capturedAt,
          args.mode,
        ],
        { account: other.account },
      );
    } catch (e) {
      threw = true;
    }
    expect(threw).to.equal(true);
  });
});
