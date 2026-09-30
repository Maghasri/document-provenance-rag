const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const REGISTRY_ADDRESS = "0x9CF40A7DF7F3607d9f957FD7319448778Fb1f367";

async function uploadToPinata(filePath) {
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([buffer]), path.basename(filePath));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Pinata upload failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.IpfsHash;
}

async function main() {
  const [filePath, source] = process.argv.slice(2);
  if (!filePath || !source) {
    console.error("Usage: node scripts/registerDocument.js <file> <source-domain>");
    process.exit(1);
  }

  // 1. Trusted source check
  const { trusted } = JSON.parse(fs.readFileSync("config/trustedSources.json", "utf8"));
  if (!trusted.includes(source)) {
    throw new Error(`Rejected: "${source}" is not in the trusted source list`);
  }
  console.log("✓ Source approved:", source);

  // 2. SHA-256 hash
  const buffer = fs.readFileSync(filePath);
  const hash = "0x" + crypto.createHash("sha256").update(buffer).digest("hex");
  console.log("✓ SHA-256:", hash);

  // 3. Upload to IPFS
  const cid = await uploadToPinata(filePath);
  console.log("✓ IPFS CID:", cid);

  // 4. Register on-chain
  const registry = await hre.ethers.getContractAt("DocumentRegistry", REGISTRY_ADDRESS);
  const existing = await registry.documents(hash);
  if (existing.timestamp !== 0n) {
    throw new Error("This document hash is already registered on-chain");
  }
  const tx = await registry.proposeDocument(hash, cid, source);
  await tx.wait();
  console.log("✓ Proposed on-chain. Tx:", tx.hash);
  console.log("  0 of 2 votes so far; two registrars must call voteToConfirm().");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exitCode = 1;
});
