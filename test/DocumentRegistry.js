const { expect } = require("chai");

describe("DocumentRegistry", function () {
  let registry, owner, r1, r2, r3, outsider;
  const hash = ethers.encodeBytes32String("doc1");

  beforeEach(async function () {
    [owner, r1, r2, r3, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DocumentRegistry");
    registry = await Factory.deploy(r1.address, r2.address, r3.address);
    await registry.waitForDeployment();
  });

  it("owner proposes a document with 0 votes", async function () {
    await registry.connect(owner).proposeDocument(hash, "CID1", "who.int");
    const doc = await registry.verifyDocument(hash);
    expect(doc.voteCount).to.equal(0);
    expect(doc.confirmed).to.equal(false);
  });

  it("stays unconfirmed after 1 registrar vote", async function () {
    await registry.connect(owner).proposeDocument(hash, "CID1", "who.int");
    await registry.connect(r1).voteToConfirm(hash);
    const doc = await registry.verifyDocument(hash);
    expect(doc.voteCount).to.equal(1);
    expect(doc.confirmed).to.equal(false);
  });

  it("confirms after 2 of 3 registrars vote", async function () {
    await registry.connect(owner).proposeDocument(hash, "CID1", "who.int");
    await registry.connect(r1).voteToConfirm(hash);
    await registry.connect(r3).voteToConfirm(hash);
    const doc = await registry.verifyDocument(hash);
    expect(doc.voteCount).to.equal(2);
    expect(doc.confirmed).to.equal(true);
  });

  it("rejects a third vote once confirmed", async function () {
    await registry.connect(owner).proposeDocument(hash, "CID1", "who.int");
    await registry.connect(r1).voteToConfirm(hash);
    await registry.connect(r2).voteToConfirm(hash);
    await expect(registry.connect(r3).voteToConfirm(hash)).to.be.revertedWith("Already confirmed");
  });

  it("rejects a duplicate vote from the same registrar", async function () {
    await registry.connect(owner).proposeDocument(hash, "CID1", "who.int");
    await registry.connect(r1).voteToConfirm(hash);
    await expect(registry.connect(r1).voteToConfirm(hash)).to.be.revertedWith("Already voted");
  });

  it("rejects proposals from a registrar or an outsider", async function () {
    await expect(registry.connect(r1).proposeDocument(hash, "CID1", "who.int")).to.be.revertedWith("Not the owner");
    await expect(registry.connect(outsider).proposeDocument(hash, "CID1", "who.int")).to.be.revertedWith("Not the owner");
  });

  it("rejects votes from the owner or an outsider", async function () {
    await registry.connect(owner).proposeDocument(hash, "CID1", "who.int");
    await expect(registry.connect(owner).voteToConfirm(hash)).to.be.revertedWith("Not an authorized registrar");
    await expect(registry.connect(outsider).voteToConfirm(hash)).to.be.revertedWith("Not an authorized registrar");
  });

  it("rejects proposing the same document twice", async function () {
    await registry.connect(owner).proposeDocument(hash, "CID1", "who.int");
    await expect(registry.connect(owner).proposeDocument(hash, "CID1", "who.int")).to.be.revertedWith("Document already proposed");
  });
});
