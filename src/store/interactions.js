import { ethers } from 'ethers'

import {
   setProvider,
   setNetwork,
   setAccount
} from './reducers/provider'

import {
   setContracts,
   setSymbols,
   balancesLoaded
} from './reducers/tokens'

import {
   setContract,
   sharesLoaded,
   swapsLoaded,
   depositRequest,
   depositSuccess,
   depositFail,
   withdrawRequest,
   withdrawSuccess,
   withdrawFail,
   swapRequest,
   swapSuccess,
   swapFail
} from './reducers/amm'

import TOKEN_ABI from '../abis/Token.json';
import AMM_ABI from '../abis/AMM.json';
import config from '../config.json';

// Prefer Trust Wallet when multiple injected providers exist
const getPreferredProvider = () => {
   const { ethereum } = window
   if (!ethereum) return null

   if (Array.isArray(ethereum.providers)) {
      const trust = ethereum.providers.find(p => p.isTrust || p.isTrustWallet)
      if (trust) return trust
      return ethereum.providers[0]
   }

   return ethereum
}

// Wait for an injected provider to be available
const waitForProvider = async () => {
   for (let i = 0; i < 20; i++) {
      const provider = getPreferredProvider()
      if (provider) return provider
      await new Promise(resolve => setTimeout(resolve, 100))
   }
   throw new Error('Wallet provider not detected. Please install a wallet extension.')
}

export const loadProvider = async (dispatch) => {
   try {
      // Wait for injected provider (prefer Trust Wallet)
      const ethereum = await waitForProvider()
      const provider = new ethers.providers.Web3Provider(ethereum)
      dispatch(setProvider(provider))
      return provider
   } catch (error) {
      console.error('Error loading provider:', error)
      throw error
   }
}

export const loadNetwork = async (provider, dispatch) => {
   const { chainId } = await provider.getNetwork()
   dispatch(setNetwork(chainId))

   return chainId
}

// Flag to prevent duplicate account requests
let accountRequestPending = false

export const loadAccount = async (dispatch, options = { request: false }) => {
   try {
      const method = options?.request ? 'eth_requestAccounts' : 'eth_accounts'
      const ethereum = getPreferredProvider() || window.ethereum
      if (!ethereum) {
         console.warn('No injected provider available')
         return null
      }
      const accounts = await ethereum.request({ method })
      if (accounts && accounts.length > 0) {
         const account = accounts[0]
         dispatch(setAccount(account))
         return account
      } else {
         console.warn('No accounts found')
         return null
      }
   } catch (error) {
      console.error('Error loading account:', error)
      if (options?.request) {
         throw error
      }
      return null
   }
}


/////////////////////////////////////// LOAD CONTRACTS //////////////////////////////////////

export const loadTokens = async (provider, chainId, dispatch) => {
   try {
      if (!config[chainId]) {
         console.warn(`No contract configuration found for network ${chainId}. Please deploy contracts to this network.`)
         return null
      }
      
      const mensaAddress = config[chainId].mensa.address
      const usdAddress = config[chainId].usd.address

      try {
         const [mensaCode, usdCode] = await Promise.all([
            provider.getCode(mensaAddress),
            provider.getCode(usdAddress)
         ])

         if (mensaCode === '0x' || usdCode === '0x') {
            console.warn('Token contracts not found at configured addresses. Check your RPC/network and redeploy if needed.')
            return null
         }
      } catch (codeError) {
         if (String(codeError?.message || '').includes('eth_getCode')) {
            console.warn('Provider does not support eth_getCode; skipping contract code check.')
         } else {
            throw codeError
         }
      }

      const mensa = new ethers.Contract(mensaAddress, TOKEN_ABI, provider)
      const usd = new ethers.Contract(usdAddress, TOKEN_ABI, provider)

      dispatch(setContracts([mensa, usd]))
      dispatch(setSymbols([await mensa.symbol(), await usd.symbol()]))
      
      return [mensa, usd]
   } catch (error) {
      console.error('Error loading tokens:', error)
      return null
   }
}
export const loadAMM = async (provider, chainId, dispatch) => {
   try {
      if (!config[chainId]) {
         console.warn(`No contract configuration found for network ${chainId}`)
         return null
      }
      
      const ammAddress = config[chainId].amm.address
      try {
         const ammCode = await provider.getCode(ammAddress)
         if (ammCode === '0x') {
            console.warn('AMM contract not found at configured address. Check your RPC/network and redeploy if needed.')
            return null
         }
      } catch (codeError) {
         if (String(codeError?.message || '').includes('eth_getCode')) {
            console.warn('Provider does not support eth_getCode; skipping contract code check.')
         } else {
            throw codeError
         }
      }

      const amm = new ethers.Contract(ammAddress, AMM_ABI, provider)
      
      dispatch(setContract(amm))

      return amm
   } catch (error) {
      console.error('Error loading AMM:', error)
      return null
   }
}

/////////////////////////////// LOAD BALANCES & SHARES ///////////////////////////////////

export const loadBalances = async (amm, tokens, account, dispatch) => {
   try {
      const balance1 = await tokens[0].balanceOf(account)
      const balance2 = await tokens[1].balanceOf(account)

      dispatch(balancesLoaded([
         ethers.utils.formatUnits(balance1.toString(), 'ether'),
         ethers.utils.formatUnits(balance2.toString(), 'ether')
      ]))
      
      const shares = await amm.shares(account)
      dispatch(sharesLoaded(ethers.utils.formatUnits(shares.toString(), 'ether')))
   } catch (error) {
      console.error('Error loading balances:', error)
   }
} 

//////////////////////////////////// ADD LIQUIDITY ////////////////////////////////////////

export const addLiquidity = async (provider, amm, tokens, amounts, dispatch) => {
   try {
      dispatch(depositRequest())

      const signer = await provider.getSigner()

      let transaction

      transaction = await tokens[0].connect(signer).approve(amm.address, amounts[0])
      await transaction.wait()

      transaction = await tokens[1].connect(signer).approve(amm.address, amounts[1])
      await transaction.wait()

      transaction = await amm.connect(signer).addLiquidity(amounts[0], amounts[1])
      await transaction.wait()
   
      dispatch(depositSuccess(transaction.hash))
   } catch (error) {
      dispatch(depositFail())
   }
}

//////////////////////////////////// REMOVE LIQUIDITY ////////////////////////////////////////

export const removeLiquidity = async (provider, amm, shares, dispatch) => {
   try {
      dispatch(withdrawRequest())

      const signer = await provider.getSigner()

      let transaction = await amm.connect(signer).removeLiquidity(shares)
      await transaction.wait()

      dispatch(withdrawSuccess(transaction.hash))
   } catch (error) {
      dispatch(withdrawFail())
   }
}

////////////////////////////////////////// SWAP //////////////////////////////////////////////

export const swap = async (provider, amm, token, symbol, amount, dispatch) => {
   try {
      dispatch(swapRequest())

      let transaction

      const signer = await provider.getSigner()

      transaction = await token.connect(signer).approve(amm.address, amount)
      await transaction.wait()

      if (symbol === "MNSA") {
         transaction = await amm.connect(signer).swapToken1(amount)
      } else {
         transaction = await amm.connect(signer).swapToken2(amount)
      }
      await transaction.wait()

      dispatch(swapSuccess(transaction.hash))

   } catch (error) {
      dispatch(swapFail())
   }
  
}

////////////////////////////////////// LOAD ALL SWAPS ///////////////////////////////////////////

export const loadAllSwaps = async (provider, amm, dispatch) => {
   try {
      const block = await provider.getBlockNumber()
      console.log(`Current block: ${block}`)

      const swapStream = await amm.queryFilter('Swap', 0, block)
      console.log(`Found ${swapStream.length} swap events`)
      
      const swaps = swapStream.map(event => {
         return { hash: event.transactionHash, args: event.args }
      })

      dispatch(swapsLoaded(swaps))
   } catch (error) {
      console.error('Error loading swaps:', error)
      dispatch(swapsLoaded([]))
   }}