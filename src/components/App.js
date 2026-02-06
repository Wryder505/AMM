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

        // Only load contracts if an account is already connected
        const account = await loadAccount(dispatch)
        if (account) {
          const tokens = await loadTokens(provider, newChainId, dispatch)
          const amm = await loadAMM(provider, newChainId, dispatch)
          if (tokens && amm) {
            await loadBalances(amm, tokens, account, dispatch)
          }
        }
      })
      
      window.ethereum.on('accountsChanged', async () => {
        console.log('Account changed in MetaMask')
        const account = await loadAccount(dispatch)
        if (account) {
          const currentChainId = await loadNetwork(provider, dispatch)
          const tokens = await loadTokens(provider, currentChainId, dispatch)
          const amm = await loadAMM(provider, currentChainId, dispatch)
          if (tokens && amm) {
            await loadBalances(amm, tokens, account, dispatch)
          }
        }
      })
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
