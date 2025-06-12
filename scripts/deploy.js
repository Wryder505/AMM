// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
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
  console.log(`AMM contract deployed to: ${amm.address}\n`)
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
