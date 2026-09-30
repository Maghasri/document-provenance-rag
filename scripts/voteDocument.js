const hre = require("hardhat");
require("dotenv").config();

const REGISTRY_ADDRESS = "0x9CF40A7DF7F3607d9f957FD7319448778Fb1f367";

async function main() {
  const hash = process.argv[2];
  const which = process.argv[3] || "1";

  if (!hash) throw new Error("Usage: node scripts/voteDocument.js <docHash> <registrarNumber>");

  const key = process.env[`REGISTRAR${which}_PRIVATE_KEY`];
  if (!key) throw new Error(`No REGISTRAR${which}_PRIVATE_KEY found in .env`);

  const wallet = new hre.ethers.Wallet(key, hre.ethers.provider);
  const registry = await hre.ethers.getContractAt("DocumentRegistry", REGISTRY_ADDRESS, wallet);

  const tx = await registry.voteToConfirm(hash);
  await tx.wait();
  console.log(`✓ Registrar ${which} voted. Tx:`, tx.hash);

  const doc = await registry.verifyDocument(hash);
  console.log("Votes:", doc.voteCount.toString(), "| Confirmed:", doc.confirmed);
}

main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
