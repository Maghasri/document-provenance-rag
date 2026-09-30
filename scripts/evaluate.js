// Phase 4 evaluation harness. Needs only DocumentRegistry.sol (no IPFS/RAG).
// Run: npx hardhat run scripts/evaluate.js
const hre = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const { performance } = require("perf_hooks");

const N = 100; // number of sample documents
const CID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"; // realistic CIDv0 length
const SRC = "https://www.who.int/publications/i/item/sample-report";

const sha256 = (buf) => "0x" + crypto.createHash("sha256").update(buf).digest("hex");
const makeDoc = (i) =>
  Buffer.from(`Sample document ${i}\n` + crypto.randomBytes(2000).toString("hex"));

// Simulated tamper attempts, each modifies a registered document
const TAMPERS = {
  flip_one_bit: (b) => { const c = Buffer.from(b); c[c.length >> 1] ^= 1; return c; },
  append_space: (b) => Buffer.concat([b, Buffer.from(" ")]),
  truncate_10_bytes: (b) => b.subarray(0, b.length - 10),
  overwrite_chunk: (b) => { const c = Buffer.from(b); c.fill(0x41, 100, 140); return c; },
};

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const p95 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];

// verifyDocument reverts with "Document not found" for unknown hashes
async function verify(registry, hash) {
  try {
    const d = await registry.verifyDocument(hash);
    return d.confirmed ? "VERIFIED" : "PENDING";
  } catch {
    return "NOT_FOUND";
  }
}

async function main() {
  const [r1, r2, r3] = await hre.ethers.getSigners();
  const Registry = await hre.ethers.getContractFactory("DocumentRegistry");
  const registry = await Registry.deploy(r1.address, r2.address, r3.address);
  await registry.waitForDeployment();
  const deployGas = Number((await registry.deploymentTransaction().wait()).gasUsed);

  // 1. Gas per registration (propose + confirming vote)
  const docs = Array.from({ length: N }, (_, i) => makeDoc(i));
  const proposeGas = [], voteGas = [];
  for (const d of docs) {
    const h = sha256(d);
    proposeGas.push(Number((await (await registry.connect(r1).proposeDocument(h, CID, SRC)).wait()).gasUsed));
    voteGas.push(Number((await (await registry.connect(r2).voteToConfirm(h)).wait()).gasUsed));
  }

  // 2. Verification latency (hash + on-chain lookup) on untouched docs
  const lat = [];
  let okCount = 0;
  for (const d of docs) {
    const t0 = performance.now();
    const status = await verify(registry, sha256(d));
    lat.push(performance.now() - t0);
    if (status === "VERIFIED") okCount++;
  }

  // 3. Tamper detection rate
  const perType = {};
  let detected = 0, total = 0;
  for (const [name, fn] of Object.entries(TAMPERS)) {
    let hit = 0;
    for (const d of docs) {
      if ((await verify(registry, sha256(fn(d)))) === "NOT_FOUND") hit++;
    }
    perType[name] = `${hit}/${N}`;
    detected += hit;
    total += N;
  }

  const results = {
    docs: N,
    gas: {
      deploy: deployGas,
      propose_mean: Math.round(mean(proposeGas)),
      vote_mean: Math.round(mean(voteGas)),
      total_per_confirmed_doc: Math.round(mean(proposeGas) + mean(voteGas)),
    },
    verify_latency_ms: { mean: +mean(lat).toFixed(2), p95: +p95(lat).toFixed(2), network: hre.network.name },
    false_positive_rate: `${N - okCount}/${N} originals wrongly rejected`,
    tamper_detection: { overall: `${detected}/${total}`, rate: detected / total, by_type: perType },
  };
  console.log(JSON.stringify(results, null, 2));
  fs.writeFileSync("eval_results.json", JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
