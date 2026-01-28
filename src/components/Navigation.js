import { useSelector, useDispatch } from 'react-redux'
import { useRef } from 'react'
import Navbar from 'react-bootstrap/Navbar'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Blockies from 'react-blockies'

import logo from '../logo.png';

import { loadAccount, loadBalances } from '../store/interactions'

import config from '../config.json'

// Network configurations for adding chains to MetaMask
const NETWORKS = {
  '0x1': {
    name: 'Ethereum Mainnet',
    rpc: 'https://eth-mainnet.g.alchemy.com/v2/demo',
  },
  '0x89': {
    name: 'Polygon',
    rpc: 'https://polygon-rpc.com/',
  },
  '0xa4b1': {
    name: 'Arbitrum One',
    rpc: 'https://arb1.arbitrum.io/rpc',
  },
  '0xa': {
    name: 'Optimism',
    rpc: 'https://mainnet.optimism.io',
  },
  '0x8453': {
    name: 'Base',
    rpc: 'https://mainnet.base.org',
  },
  '0x5': {
    name: 'Goerli Testnet',
    rpc: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  },
  '0x7A69': {
    name: 'Hardhat Localhost',
    rpc: 'http://127.0.0.1:8545',
  },
}

const Navigation = () => {
  const chainId = useSelector(state => state.provider.chainId)
  const account = useSelector(state => state.provider.account)
  const tokens = useSelector(state => state.tokens.contracts)
  const amm = useSelector(state => state.amm.contract)

  const dispatch = useDispatch()
  const selectRef = useRef(null)

  const connectHandler = async () => {
    const account = await loadAccount(dispatch)
    if (tokens && tokens.length >= 2 && amm) {
      await loadBalances(amm, tokens, account, dispatch)
    }
  }

  const networkHandler = async (e) => {
    const selectedChainId = e.target.value
    
    if (selectedChainId === '0') {
      return // Don't switch if "Select Network" is clicked
    }

    try {
      console.log(`Attempting to switch to network: ${selectedChainId}`)
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: selectedChainId }],
      })
      console.log('Successfully switched network')
    } catch (error) {
      console.error('Error switching network:', error)
      
      // If network doesn't exist in MetaMask, try adding it
      if (error.code === 4902) {
        console.log('Network not found in MetaMask, attempting to add it')
        try {
          const networkConfig = NETWORKS[selectedChainId]
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: selectedChainId,
              chainName: networkConfig.name,
              rpcUrls: [networkConfig.rpc],
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
            }],
          })
          console.log('Network added successfully')
          // Try switching again after adding
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: selectedChainId }],
          })
        } catch (addError) {
          console.error('Error adding network:', addError)
          // Reset the selector to the current chain
          if (selectRef.current && chainId) {
            selectRef.current.value = `0x${chainId.toString(16)}`
          }
        }
      } else {
        // Reset the selector to the current chain on other errors
        if (selectRef.current && chainId) {
          selectRef.current.value = `0x${chainId.toString(16)}`
        }
      }
    }
  }

  return (
    <Navbar className='my-3' expand="lg">
      <img
        alt="logo"
        src={logo}
        width="40"
        height="40"
        className="d-inline-block align-top mx-3"
      />
      <Navbar.Brand href="#">MeNSA Token AMM</Navbar.Brand>
      <Navbar.Toggle aria-controls="nav" />
      <Navbar.Collapse id="nav" className="justify-content-end">

        <div className="d-flex justify-content-end mt-3">

          <Form.Select
              ref={selectRef}
              aria-label="Network Selector"
              value={chainId ? `0x${chainId.toString(16)}` : `0`}
              onChange={networkHandler}
              style={{ maxWidth: '200px', marginRight: '20px' }}
          >
              <option value="0" disabled>Select Network</option>
              <optgroup label="Mainnet">
                <option value="0x1">Ethereum Mainnet</option>
                <option value="0x89">Polygon</option>
                <option value="0xa4b1">Arbitrum One</option>
                <option value="0xa">Optimism</option>
                <option value="0x8453">Base</option>
              </optgroup>
              <optgroup label="Testnet">
                <option value="0x5">Goerli Testnet</option>
              </optgroup>
              <optgroup label="Local">
                <option value="0x7A69">Hardhat Localhost</option>
              </optgroup>
          </Form.Select>
        
          {account ? (
            <Navbar.Text className='d-flex align-items-center'>
              {account.slice(0, 5) + '...' + account.slice(38, 42)}
              <Blockies
                seed={account}
                size={10}
                scale={3}
                color="#BF0016"
                bgColor="#F7EDEE"
                spotColor="#967277"
                className="identicon mx-2"
              />
          </Navbar.Text>
        ) : (
          <Button onClick={connectHandler}>Connect</Button>
        )}

        </div>

      </Navbar.Collapse>
    </Navbar>
  );
}

export default Navigation;
