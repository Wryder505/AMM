import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { ethers } from 'ethers'

// Components
import Navigation from './Navigation';
import Tabs from './Tabs';
import Swap from './Swap';
import Deposit from './Deposit';
import Withdraw from './Withdraw';
import Charts from './Charts';

import {
  loadProvider,
  loadNetwork,
  loadAccount,
  loadTokens,
  loadAMM,
  loadBalances
} from '../store/interactions'

function App() {


  const dispatch = useDispatch()

  const loadBlockchainData = async () => {
    // Initiate provider
    const provider = await loadProvider(dispatch)
    // Fetch current network's chainId (e.g. hardhat: 31337, kovan: 42)
    const chainId = await loadNetwork(provider, dispatch)
    
    // Setup event listeners for network and account changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', async () => {
        // Reload blockchain data when network changes
        const newChainId = await loadNetwork(provider, dispatch)
        await loadTokens(provider, newChainId, dispatch)
        const amm = await loadAMM(provider, newChainId, dispatch)
        
        // Load account and balances for new network
        const account = await loadAccount(dispatch)
        if (amm && account) {
          await loadTokens(provider, newChainId, dispatch)
        }
      })
      
      window.ethereum.on('accountsChanged', async () => {
        await loadAccount(dispatch)
      })
    }
    
    // Initiate contracts
    await loadTokens(provider, chainId, dispatch)
    const amm = await loadAMM(provider, chainId, dispatch)
    
    // Auto-load account and balances on startup
    try {
      const account = await loadAccount(dispatch)
      if (amm && account && account !== ethers.constants.AddressZero) {
        console.log('Auto-loading balances for account:', account)
        // Re-fetch tokens to ensure we have the token contracts
        const tokensLoaded = await loadTokens(provider, chainId, dispatch)
        if (tokensLoaded) {
          await loadBalances(amm, tokensLoaded, account, dispatch)
        }
      }
    } catch (error) {
      console.log('User has not connected wallet yet:', error.message)
    }
  }

  useEffect(() => {
      loadBlockchainData()
    }, []);

  return(
    <Container>
      <HashRouter>
        
        <Navigation />

        <hr />
        <Tabs />

        <Routes>
          <Route exact path="/" element={<Swap />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/charts" element={<Charts />} />
        </Routes>
      </HashRouter> 
    </Container>
  )
}

export default App;
