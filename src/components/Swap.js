import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import { ethers } from 'ethers'

import Alert from './Alert'

import {
	swap,
	loadBalances
} from '../store/interactions'

// List of popular tokens (placeholder data - would need real token contracts)
const POPULAR_TOKENS = [
	{ symbol: 'USDC', name: 'USD Coin', logo: '💵' },
	{ symbol: 'USDT', name: 'Tether', logo: '₮' },
	{ symbol: 'DAI', name: 'Dai', logo: 'Ⓓ' },
	{ symbol: 'WETH', name: 'Wrapped Ether', logo: 'Ξ' },
	{ symbol: 'WBTC', name: 'Wrapped Bitcoin', logo: '₿' },
	{ symbol: 'LINK', name: 'Chainlink', logo: '🔗' },
	{ symbol: 'AAVE', name: 'Aave', logo: 'A' },
	{ symbol: 'UNI', name: 'Uniswap', logo: 'U' },
	{ symbol: 'MATIC', name: 'Polygon', logo: 'M' },
	{ symbol: 'CRV', name: 'Curve', logo: 'C' },
]

const Swap = () => {
	const [inputToken, setInputToken] = useState(null)
	const [outputToken, setOutputToken] =useState(null)
	const [inputAmount, setInputAmount] = useState(0)
	const [outputAmount, setOutputAmount] = useState(0)

	const [price, setPrice] = useState(0)

	const [showAlert, setShowAlert] = useState(false)

	const provider = useSelector(state => state.provider.connection)
	const account = useSelector(state => state.provider.account)

	const tokens = useSelector(state => state.tokens.contracts)
	const symbols = useSelector(state => state.tokens.symbols)
	const balances = useSelector(state => state.tokens.balances)

	const amm = useSelector(state => state.amm.contract)
	const isSwapping = useSelector(state => state.amm.swapping.isSwapping)
	const isSuccess = useSelector(state => state.amm.swapping.isSuccess)
	const transactionHash = useSelector(state => state.amm.swapping.transactionHash)

	const dispatch = useDispatch()

	// Get balance for selected token
	const getTokenBalance = (tokenSymbol) => {
		if (!symbols || !balances) return '0'
		if (balances.length < 2) return '0'
		if (tokenSymbol === symbols[0]) return balances[0] || '0'
		if (tokenSymbol === symbols[1]) return balances[1] || '0'
		return '0' // Popular tokens don't have balances yet
	}

	const inputHandler = async (e) => {
		if (!inputToken || !outputToken) {
			window.alert('Please select token')
			return
		}
		if (inputToken === outputToken) {
			window.alert('Invalid token pair')
			return
		}
		if (!amm) {
			window.alert('AMM contract not loaded yet')
			return
		}

		try {
			if (inputToken === symbols[0]) {
				setInputAmount(e.target.value)

				const _token1Amount = ethers.utils.parseUnits(e.target.value, 'ether')
				const result = await amm.calculateToken1Swap(_token1Amount)
				const _token2Amount = ethers.utils.formatUnits(result.toString(), 'ether')

				setOutputAmount(_token2Amount.toString())
			} else if (inputToken === symbols[1]) {
				setInputAmount(e.target.value)

				const _token2Amount = ethers.utils.parseUnits(e.target.value, 'ether')
				const result = await amm.calculateToken2Swap(_token2Amount)
				const _token1Amount = ethers.utils.formatUnits(result.toString(), 'ether')

				setOutputAmount(_token1Amount.toString())
			} else {
				// Popular tokens - just show placeholder
				setInputAmount(e.target.value)
				setOutputAmount('0')
			}
		} catch (error) {
			console.error('Error calculating swap output:', error)
			setOutputAmount(0)
		}
	}

	const swapHandler = async (e) => {
		e.preventDefault()

		setShowAlert(false)

		if (inputToken === outputToken) {
			window.alert('Invalid Token Pair')
			return
		}

		// Only allow swaps with deployed tokens
		if (!symbols || (!symbols.includes(inputToken) || !symbols.includes(outputToken))) {
			window.alert('Can only swap between MNSA and USD tokens currently')
			return
		}

		const _inputAmount = ethers.utils.parseUnits(inputAmount, 'ether')

		if (inputToken === symbols[0]) {
			await swap(provider, amm, tokens[0], inputToken, _inputAmount, dispatch)
		} else {
			await swap(provider, amm, tokens[1], inputToken, _inputAmount, dispatch)
		}

		await loadBalances(amm, tokens, account, dispatch)
		await getPrice()

		setShowAlert(true)
	}

	const getPrice = async () => {
		if (inputToken === outputToken) {
			setPrice(0)
			return
		}

		if (!amm) {
			console.warn('AMM contract not loaded')
			return
		}

		try {
			if(inputToken === symbols[0]) {
				const token2Balance = await amm.token2Balance()
				const token1Balance = await amm.token1Balance()
				setPrice(token2Balance / token1Balance)
			} else if (inputToken === symbols[1]) {
				const token1Balance = await amm.token1Balance()
				const token2Balance = await amm.token2Balance()
				setPrice(token1Balance / token2Balance)
			} else {
				setPrice(0)
			}
		} catch (error) {
			console.error('Error getting price:', error)
		}
	}

	// Auto-load balances when amm and tokens are available
	useEffect(() => {
		if (amm && tokens && tokens.length >= 2 && account) {
			console.log('Loading balances...')
			loadBalances(amm, tokens, account, dispatch)
		}
	}, [amm, tokens, account])

	useEffect(() => {
		if(inputToken && outputToken && amm) {	
			getPrice()
		}	
	}, [inputToken, outputToken, amm]);

	return (
		<div>
			<Card style={{ maxWidth: '450px' }} className='mx-auto px-4'>
				{account ? (
					<Form onSubmit={swapHandler} style={{ maxWidth: '450px', margin: '50px auto' }}>
						
						<Row className='my-3'>
							<div className='d-flex justify-content-between'>
								<Form.Label><strong>Input:</strong></Form.Label>
								<Form.Text muted>
									Balance: {getTokenBalance(inputToken)}
								</Form.Text>
							</div>
							<InputGroup>
								<Form.Control
									type="number"
									placeholder="0.0"
									min="0.0"
									step="any"
									onChange={(e) => inputHandler(e) }
									disabled={!inputToken}
								/>
									<DropdownButton
										variant="outline-secondary"
										title={inputToken ? `${inputToken} (${getTokenBalance(inputToken)})` : "Select Token"}
									>
										<Dropdown.Header>Your Tokens</Dropdown.Header>
										{symbols && symbols[0] && (
											<Dropdown.Item onClick={() => setInputToken(symbols[0])}>
												{symbols[0]} - Balance: {balances[0]}
											</Dropdown.Item>
										)}
										{symbols && symbols[1] && (
											<Dropdown.Item onClick={() => setInputToken(symbols[1])}>
												{symbols[1]} - Balance: {balances[1]}
											</Dropdown.Item>
										)}
										<Dropdown.Divider />
										<Dropdown.Header>Popular Tokens</Dropdown.Header>
										{POPULAR_TOKENS.map((token) => (
											<Dropdown.Item key={token.symbol} onClick={() => setInputToken(token.symbol)}>
												{token.logo} {token.symbol} - {token.name}
											</Dropdown.Item>
										))}
									</DropdownButton>
							</InputGroup>
						</Row>

						<Row className='my-4'>
							<div className='d-flex justify-content-between'>
								<Form.Label><strong>Output:</strong></Form.Label>
								<Form.Text muted>
									Balance: {getTokenBalance(outputToken)}
								</Form.Text>
							</div>
							<InputGroup>
								<Form.Control
									type="number"
									placeholder="0.0"
									value={outputAmount === 0 ? "" : outputAmount }
									disabled
								/>
									<DropdownButton
										variant="outline-secondary"
										title={outputToken ? `${outputToken} (${getTokenBalance(outputToken)})` : "Select Token"}
									>
										<Dropdown.Header>Your Tokens</Dropdown.Header>
										{symbols && symbols[0] && (
											<Dropdown.Item onClick={() => setOutputToken(symbols[0])}>
												{symbols[0]} - Balance: {balances[0]}
											</Dropdown.Item>
										)}
										{symbols && symbols[1] && (
											<Dropdown.Item onClick={() => setOutputToken(symbols[1])}>
												{symbols[1]} - Balance: {balances[1]}
											</Dropdown.Item>
										)}
										<Dropdown.Divider />
										<Dropdown.Header>Popular Tokens</Dropdown.Header>
										{POPULAR_TOKENS.map((token) => (
											<Dropdown.Item key={token.symbol} onClick={() => setOutputToken(token.symbol)}>
												{token.logo} {token.symbol} - {token.name}
											</Dropdown.Item>
										))}
									</DropdownButton>
							</InputGroup>
						</Row>

						<Row className='my-3'>
							{isSwapping ? (
								<Spinner animation="border" style={{ display: 'block', margin: '0 auto' }} />
							) : (
								<Button type='submit'>Swap</Button>
							)}
							<Form.Text muted>
								Exchange Rate: {price}
							</Form.Text>
						</Row>

					</Form>

				) : (
					<p
						className='d-flex justify-content-center align-items-center'
						style={{ height: '300px'}}
					>
						Please connect wallet.
					</p>
				)}
			</Card>

			{isSwapping ? (
				<Alert
					message={'Swap Pending...'}
					transactionHash={null}
					variant={'info'}
					setShowAlert={setShowAlert}
				/>
			) : isSuccess && showAlert ? (
				<Alert
					message={'Swap Successful'}
					transactionHash={transactionHash}
					variant={'success'}
					setShowAlert={setShowAlert}
				/>
			) : !isSuccess && showAlert ? (
				<Alert
					message={'Swap Failed'}
					transactionHash={null}
					variant={'danger'}
					setShowAlert={setShowAlert}
				/>
			) : (
				<></>
			)}

		</div>
	); 
}

export default Swap;
