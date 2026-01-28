import { useSelector, useDispatch } from 'react-redux'
import Navbar from 'react-bootstrap/Navbar'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Blockies from 'react-blockies'

import logo from '../logo.png';

import { loadAccount, loadBalances } from '../store/interactions'

import config from '../config.json'

const Navigation = () => {
  const chainId = useSelector(state => state.provider.chainId)
  const account = useSelector(state => state.provider.account)
  const tokens = useSelector(state => state.tokens.contracts)
  const amm = useSelector(state => state.amm.contract)

  const dispatch = useDispatch()

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
    } catch (error) {
      console.error('Error switching network:', error)
      
      // If network doesn't exist in MetaMask, try adding it
      if (error.code === 4902) {
        console.log('Network not found in MetaMask, attempting to add it')
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: selectedChainId,
              chainName: selectedChainId === '0x7A69' ? 'Hardhat' : 'Goerli',
              rpcUrls: [selectedChainId === '0x7A69' ? 'http://127.0.0.1:8545' : 'https://goerli.infura.io/v3/YOUR_INFURA_KEY'],
            }],
          })
        } catch (addError) {
          console.error('Error adding network:', addError)
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
              aria-label="Network Selector"
              value={config[chainId] ? `0x${chainId.toString(16)}` : `0`}
              onChange={networkHandler}
              style={{ maxWidth: '200px', marginRight: '20px' }}
          >
              <option value="0" disabled>Select Network</option>
              <option value="0x7A69">Localhost</option>
              <option value="0x5">Goerli</option>
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
