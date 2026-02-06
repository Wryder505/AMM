import { createSelector } from 'reselect'
import { ethers } from 'ethers'

const tokens = state => state.tokens.contracts
const swaps = state => state.amm.swaps

export const chartSelector = createSelector(swaps, tokens, (swaps, tokens) => {
	if (!tokens || !Array.isArray(tokens) || tokens.length < 2 || !tokens[0] || !tokens[1]) { 
		return null
	}

	try {
		swaps = swaps.filter((s) => s.args.tokenGet === tokens[0].address || s.args.tokenGet === tokens[1].address)
		swaps = swaps.filter((s) => s.args.tokenGive === tokens[0].address || s.args.tokenGive === tokens[1].address)

		swaps = swaps.sort((a, b) => a.args.timestamp - b.args.timestamp)

		swaps = swaps.map((s) => decorateSwap(s))

		const prices = swaps.map(s => s.rate)

		swaps = swaps.sort((a, b) => b.args.timestamp - a.args.timestamp)

		return({
			swaps: swaps,
			series: [{
			name: "Rate",
			  data: prices 
			}]
		})
	} catch (error) {
		console.error('Error in chartSelector:', error)
		return null
	}
})

const decorateSwap = (swap) => {

	const precision = 100000

	const token1Balance = Number(ethers.utils.formatUnits(swap.args.token1Balance.toString(), 'ether'))
	const token2Balance = Number(ethers.utils.formatUnits(swap.args.token2Balance.toString(), 'ether'))

	let rate = token1Balance > 0 ? (token2Balance / token1Balance) : 0

	rate = Math.round(rate * precision) / precision

	return ({
		...swap,
		rate
	})
}
