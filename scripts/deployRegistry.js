const hre = require("hardhat");

async function main() {
  // Replace these with your 3 actual registrar addresses
  const registrar1 = "0x7BE061b14a8939000946b72B1ef4C7855Ff31C42";
  const registrar2 = "0x7CCd5B19ABDD8B5f52D3B0F05aBaDb43d961C7df";
  const registrar3 = "0x1E58BDA34916D886872775BbcBCA78d886782670";

  const DocumentRegistry = await hre.ethers.getContractFactory("DocumentRegistry");
  const registry = await DocumentRegistry.deploy(registrar1, registrar2, registrar3);
  await registry.waitForDeployment();

  console.log("DocumentRegistry deployed to:", await registry.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
