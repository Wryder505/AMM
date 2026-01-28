// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const Token = await hre.ethers.getContractFactory('Token')
  // Deploy Token 1
  let mensa = await Token.deploy('Mensa Token', 'MNSA', '1000000') // 1 Million Tokens
  await mensa.deployed()
  console.log(`Mensa Token deployed to: ${mensa.address}\n`)
  // Deploy Token 2
  const usd = await Token.deploy('USD Token', 'USD', '1000000') // 1 Million Tokens
  await usd.deployed()
  console.log(`USD Token deployed to: ${usd.address}\n`)
  // Deploy AMM
  const AMM = await hre.ethers.getContractFactory('AMM')
  const amm = await AMM.deploy(mensa.address, usd.address)
  await amm.deployed()
  console.log(`AMM contract deployed to: ${amm.address}\n`)

  // Get the network ID
  const { chainId } = await hre.ethers.provider.getNetwork()
  console.log(`Network ID: ${chainId}\n`)

  // Save addresses to config.json
  const configPath = path.join(__dirname, '../src/config.json')
  let config = {}

  // Load existing config if it exists
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  }

  // Update or create the network entry
  if (!config[chainId]) {
    config[chainId] = {}
  }

  config[chainId].mensa = { address: mensa.address }
  config[chainId].usd = { address: usd.address }
  config[chainId].amm = { address: amm.address }

  // Write back to config.json
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  console.log(`Config updated at ${configPath}`)
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
