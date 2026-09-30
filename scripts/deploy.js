const hre = require("hardhat");

async function main() {
  const Warmup = await hre.ethers.getContractFactory("Warmup");
  const warmup = await Warmup.deploy();
  await warmup.waitForDeployment();
  console.log("Warmup deployed to:", await warmup.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
