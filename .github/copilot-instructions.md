# Copilot Instructions for AMM Project

## Security Considerations
- **Smart Contracts**
  - All contracts are in `contracts/` and use Solidity ^0.8.0 (with built-in overflow checks).
  - The AMM contract manages token balances and shares. Always validate user input and check for reentrancy vulnerabilities when updating or adding contract logic.
  - Use events for all state-changing actions (e.g., swaps, liquidity changes) to ensure traceability.
  - Only interact with tokens that follow the ERC-20 standard. Avoid using untrusted contracts.
  - When adding new functions, ensure access control is explicit (e.g., only owner, only liquidity provider).
  - Always test for edge cases: zero amounts, repeated deposits/withdrawals, and failed swaps.

- **Frontend**
  - All blockchain interactions are handled via `ethers.js` in `src/store/interactions.js`.
  - Validate user input before sending transactions (e.g., amounts > 0, sufficient balances).
  - Handle transaction failures gracefully in the UI (show alerts, avoid silent errors).
  - Never expose private keys or sensitive data in the frontend code.
  - Always check for network and account changes (see `App.js` for event listeners).

## Architecture Overview
- **Contracts**: `AMM.sol` (core logic), `Token.sol` (ERC-20 tokens).
- **Frontend**: React + Redux, entry point is `src/index.js`, main app in `src/components/App.js`.
- **State Management**: Redux slices in `src/store/reducers/` for provider, tokens, and AMM state.
- **Integration**: Frontend loads contracts and interacts via `src/store/interactions.js`.
- **Testing**: Smart contract tests in `test/` using Hardhat and Chai.

## Developer Workflows
- **Build Contracts**: `npx hardhat compile`
- **Run Tests**: `npx hardhat test`
- **Deploy Contracts**: `npx hardhat run scripts/deploy.js`
- **Start Frontend**: (missing, recommend adding `npm start` for React app)

## Project-Specific Patterns
- Use Redux for all blockchain state and UI state.
- All contract ABIs are in `src/abis/`.
- UI components are in `src/components/` and use React Bootstrap.
- Charts use static config from `Charts.config.js` and data from Redux selectors.

## Integration Points
- Contracts are deployed via Hardhat and connected in the frontend using addresses from `src/config.json`.
- All contract calls are wrapped in async functions in `src/store/interactions.js`.

## Recommendations
- Add frontend tests and linting.
- Document environment setup and add CI/CD for automated security checks.
- Add contribution guidelines and expand error handling in the UI.

---

**Update this file as project conventions evolve.**
