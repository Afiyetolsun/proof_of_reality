import { expect } from "chai";
import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

const { viem } = await network.connect();

describe("DeviceRegistry", () => {
  async function deploy() {
    const [_deployer, org1, org2, deviceWallet] = await viem.getWalletClients();
    const registry = await viem.deployContract("DeviceRegistry", []);
    return { registry, org1, org2, deviceWallet };
  }

  it("registers a device", async () => {
    const { registry, org1, deviceWallet } = await deploy();
    const birthNonce = keccak256(toBytes("cosmic-nonce-1"));
    await registry.write.register(
      [deviceWallet.account.address, birthNonce, "Prague-WH-Cam01", "0x"],
      { account: org1.account },
    );
    const device = await registry.read.devices([deviceWallet.account.address]);
    expect(device[0].toLowerCase()).to.equal(org1.account.address.toLowerCase());
    expect(await registry.read.isActive([deviceWallet.account.address])).to.equal(true);
  });

  it("rejects duplicate registration", async () => {
    const { registry, org1, org2, deviceWallet } = await deploy();
    const birthNonce = keccak256(toBytes("nonce"));
    await registry.write.register(
      [deviceWallet.account.address, birthNonce, "label", "0x"],
      { account: org1.account },
    );
    let threw = false;
    try {
      await registry.write.register(
        [deviceWallet.account.address, birthNonce, "label", "0x"],
        { account: org2.account },
      );
    } catch (e) {
      threw = true;
    }
    expect(threw).to.equal(true);
  });

  it("only the registering org can revoke", async () => {
    const { registry, org1, org2, deviceWallet } = await deploy();
    const birthNonce = keccak256(toBytes("nonce"));
    await registry.write.register(
      [deviceWallet.account.address, birthNonce, "label", "0x"],
      { account: org1.account },
    );
    let threw = false;
    try {
      await registry.write.revoke([deviceWallet.account.address], { account: org2.account });
    } catch (e) {
      threw = true;
    }
    expect(threw).to.equal(true);

    await registry.write.revoke([deviceWallet.account.address], { account: org1.account });
    expect(await registry.read.isActive([deviceWallet.account.address])).to.equal(false);
  });
});
