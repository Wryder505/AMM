# Pre-Deployment Security & Functionality Review
**Date**: January 28, 2026  
**Project**: MeNSA Token AMM (Automated Market Maker)

---

## EXECUTIVE SUMMARY

Your AMM project is **structurally sound** and **functionally complete** for a learning/development project. However, there are **critical security issues** and **best practices concerns** that must be addressed before production deployment.

**Risk Level**: 🔴 **HIGH** (for mainnet) | 🟡 **MEDIUM** (for testnet/development)

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. **Missing Reentrancy Protection in Swaps & Liquidity Operations**
**Severity**: 🔴 CRITICAL  
**File**: `contracts/AMM.sol` (lines 94-120, 133-160)  
**Issue**: 
- `swapToken1()` and `swapToken2()` perform external transfers without using reentrancy guards
- An attacker could call these functions recursively before state updates complete
- The contract doesn't use `nonReentrant` modifier from OpenZeppelin's ReentrancyGuard

**Impact**: Critical on mainnet, could lead to fund theft

**Recommendation**:
```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract AMM is ReentrancyGuard {
    // Update state BEFORE external calls
    function swapToken1(uint256 _token1Amount)
        external
        nonReentrant  // Add this
        returns(uint256 token2Amount)
    {
        token2Amount = calculateToken1Swap(_token1Amount);
        // Update state first
        token1.transferFrom(msg.sender, address(this), _token1Amount);
        token1Balance += _token1Amount;
        token2Balance -= token2Amount;
        // External call last
        token2.transfer(msg.sender, token2Amount);
        // ... rest of code
    }
}
```

---

### 2. **Missing SafeTransfer Implementation**
**Severity**: 🔴 CRITICAL  
**File**: `contracts/AMM.sol` (lines 91, 116, 158, 175)  
**Issue**:
- Using `transfer()` and `transferFrom()` without checking return values
- Some tokens don't return booleans (non-standard ERC20), causing silent failures
- No protection against tokens that revert on transfer

**Impact**: Tokens could be locked or swaps could fail silently

**Recommendation**:
```solidity
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
using SafeERC20 for IERC20;

contract AMM {
    // Replace all token1.transfer() with:
    IERC20(token1).safeTransfer(msg.sender, amount);
    IERC20(token1).safeTransferFrom(msg.sender, address(this), amount);
}
```

---

### 3. **Integer Overflow/Underflow Risk (Solidity < 0.8.x)**
**Severity**: 🔴 HIGH  
**File**: `contracts/Token.sol`, `contracts/AMM.sol`  
**Issue**:
- While `pragma solidity ^0.8.0` includes overflow/underflow checks by default
- Modulo operations in AMM could cause unexpected behavior
- No checks for zero balances causing division by zero

**Example**:
```solidity
// In calculateToken2Swap()
uint256 token2After = K / token1After;  // If token1After is 0, this reverts
```

**Recommendation**:
```solidity
function calculateToken1Swap(uint256 _token1Amount)
    public
    view
    returns (uint256 token2Amount)
{
    require(_token1Amount > 0, "Amount must be greater than 0");
    require(token1Balance > 0, "Token1 balance is zero");
    
    uint256 token1After = token1Balance + _token1Amount;
    uint256 token2After = K / token1After;
    token2Amount = token2Balance - token2After;
    
    if (token2Amount == token2Balance) {
        token2Amount--;
    }
    require(token2Amount < token2Balance, "swap amount too large");
    require(token2Amount > 0, "Output amount is zero");
    return token2Amount;
}
```

---

### 4. **No Access Control / Permissionless Functions**
**Severity**: 🟡 HIGH  
**File**: `contracts/AMM.sol` (all public functions)  
**Issue**:
- Any address can call `swapToken1()`, `swapToken2()`, `addLiquidity()`, `removeLiquidity()`
- No owner/admin functions
- No ability to pause contract in case of emergency

**Impact**: 
- Unable to stop contract in case of exploit
- No recovery mechanism if vulnerability found
- Cannot blacklist malicious actors

**Recommendation**:
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract AMM is Ownable, Pausable {
    function swapToken1(uint256 _token1Amount)
        external
        whenNotPaused  // Add pause capability
        returns(uint256 token2Amount)
    {
        // ... implementation
    }
    
    // Emergency pause function (owner only)
    function emergencyPause() external onlyOwner {
        _pause();
    }
}
```

---

### 5. **Missing Input Validation**
**Severity**: 🟡 MEDIUM  
**Files**: `contracts/Token.sol`, `contracts/AMM.sol`  
**Issues**:
- No zero-address checks in Token.approve()
- Missing minimum amount checks for swaps
- No slippage protection in frontend

**Recommendation**:
```solidity
// In Token.sol
function approve(address _spender, uint256 _value)
    public
    returns(bool success)
{
    require(_spender != address(0), "Invalid spender address");
    require(_value > 0, "Approval amount must be greater than 0");
    // ... rest
}

// In AMM.sol
function addLiquidity(uint256 _token1Amount, uint256 _token2Amount) external {
    require(_token1Amount > 0, "Token1 amount must be greater than 0");
    require(_token2Amount > 0, "Token2 amount must be greater than 0");
    // ... rest
}
```

---

### 6. **No Whitelist/Emergency Token Recovery**
**Severity**: 🟡 MEDIUM  
**Issue**: 
- If someone mistakenly sends ERC20 tokens directly to contract, they're permanently locked
- No function to recover accidentally sent tokens

**Recommendation**:
```solidity
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

function emergencyTokenRecovery(address _token, uint256 _amount) 
    external 
    onlyOwner 
{
    require(_token != address(token1) && _token != address(token2), 
            "Cannot recover pool tokens");
    IERC20(_token).transfer(owner(), _amount);
}
```

---

### 7. **Frontend Security Issues**

#### A. **No CSRF Token Validation**
**Severity**: 🟡 MEDIUM  
**File**: Frontend components (Swap.js, Deposit.js, etc.)  
**Issue**: No meta-transaction or signature verification for critical operations

**Recommendation**: Implement EIP-712 signed approvals for production

#### B. **Hardcoded Config with Old Addresses**
**Severity**: 🟡 MEDIUM  
**File**: `src/config.json`  
**Issue**: Config contains old hardcoded addresses that may not match live contracts

**Recommendation**: Auto-populate from deploy script (✅ Already fixed!)

#### C. **No Transaction Deadline in Swap**
**Severity**: 🟡 MEDIUM  
**Files**: `src/components/Swap.js`  
**Issue**: Swaps have no time limit, vulnerable to sandwich attacks

**Recommendation**:
```javascript
// In swap handler
const deadline = Math.floor(Date.now() / 1000) + 60 * 5; // 5 minutes
await amm.swapToken1(_token1Amount, deadline);
```

#### D. **No Slippage Protection in Frontend**
**Severity**: 🟡 HIGH  
**Files**: `src/components/Swap.js`, `src/components/Deposit.js`  
**Issue**: 
- No minimum amount received validation
- User could lose tokens due to price changes between estimation and execution
- Vulnerable to MEV (Maximal Extractable Value) attacks

**Recommendation**:
```javascript
// In Swap.js - add min output amount
const [slippageTolerance, setSlippageTolerance] = useState(0.5); // 0.5%
const minOutputAmount = outputAmount * (1 - slippageTolerance / 100);

// Pass to contract function with deadline
await amm.swapToken1(_inputAmount, ethers.utils.parseUnits(minOutputAmount.toString(), 'ether'), deadline);
```

#### E. **Missing Input Sanitization**
**Severity**: 🟡 MEDIUM  
**Issue**: Numeric inputs not validated before parsing

```javascript
const amountHandler = async (e) => {
    // Add validation
    const value = parseFloat(e.target.value);
    
    if (isNaN(value) || value < 0) {
        console.error('Invalid input');
        return;
    }
    
    // ... rest of code
}
```

---

### 8. **Smart Contract Audit Issues**

#### A. **Lack of Event Emissions**
**Severity**: 🟡 LOW  
**Files**: `Token.sol` (approval reduction not emitted), `AMM.sol` (addLiquidity event missing)

#### B. **No LiquidityAdded Event**
**Severity**: 🟡 LOW  
**Issue**: `addLiquidity()` doesn't emit an event, making it hard to track liquidity provision

**Recommendation**:
```solidity
event LiquidityAdded(address indexed user, uint256 token1Amount, uint256 token2Amount, uint256 shares);

function addLiquidity(uint256 _token1Amount, uint256 _token2Amount) external {
    // ... existing code ...
    emit LiquidityAdded(msg.sender, _token1Amount, _token2Amount, share);
}
```

#### C. **No LiquidityRemoved Event**
**Severity**: 🟡 LOW  
**Issue**: `removeLiquidity()` should emit event

```solidity
event LiquidityRemoved(address indexed user, uint256 shares, uint256 token1Amount, uint256 token2Amount);
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 9. **Missing Hardhat Configuration for Production**
**Severity**: 🟡 MEDIUM  
**File**: `hardhat.config.js`  
**Issue**: 
- No mainnet configuration
- No gas reporter setup
- No API key for block explorers

**Recommendation**:
```javascript
require('dotenv').config();

module.exports = {
  solidity: "0.8.9",
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};
```

---

### 10. **No Environment Variable Management**
**Severity**: 🟡 MEDIUM  
**Issue**: 
- Private keys and RPC URLs are hardcoded or missing
- No `.env.example` file for team members
- Secrets could be exposed in Git

**Recommendation**:
```bash
# .env.example (commit this to Git)
PRIVATE_KEY=your_private_key_here
MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key
GOERLI_RPC_URL=https://eth-goerli.alchemyapi.io/v2/your-api-key
REPORT_GAS=true

# .env (add to .gitignore - never commit)
PRIVATE_KEY=actual_key_here
```

Update `.gitignore`:
```
.env
.env.local
.env.*.local
```

---

### 11. **Missing Error Boundaries in React**
**Severity**: 🟡 MEDIUM  
**Issue**: No error boundary component to catch React errors gracefully

**Recommendation**: Create `ErrorBoundary.js`:
```javascript
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="alert alert-danger">
        Something went wrong: {this.state.error?.message}
      </div>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
```

Wrap your App:
```javascript
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

### 12. **No Approval Reset for Token Changes**
**Severity**: 🟡 MEDIUM  
**Files**: `contracts/Token.sol`  
**Issue**: ERC20 approval vulnerability where changing approval can be exploited

**Recommendation**:
```solidity
function increaseAllowance(address _spender, uint256 _addedValue) 
    public 
    returns (bool) 
{
    require(_spender != address(0));
    allowance[msg.sender][_spender] += _addedValue;
    emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
    return true;
}

function decreaseAllowance(address _spender, uint256 _subtractedValue) 
    public 
    returns (bool) 
{
    require(_spender != address(0));
    require(allowance[msg.sender][_spender] >= _subtractedValue);
    allowance[msg.sender][_spender] -= _subtractedValue;
    emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
    return true;
}
```

---

## 🟢 LOW PRIORITY / BEST PRACTICES

### 13. **Missing Test Coverage**
**Severity**: 🟢 LOW  
**Status**: Tests exist but coverage likely incomplete

**Recommendation**:
```bash
npm install --save-dev solidity-coverage
```

Then in `hardhat.config.js`:
```javascript
require('solidity-coverage');
```

Run: `npx hardhat coverage`

---

### 14. **No Natspec Comments**
**Severity**: 🟢 LOW  
**Issue**: Smart contracts lack documentation comments

**Recommendation**:
```solidity
/**
 * @notice Swaps token1 for token2
 * @param _token1Amount Amount of token1 to swap
 * @return token2Amount Amount of token2 received
 * @dev Uses constant product AMM formula: x * y = k
 */
function swapToken1(uint256 _token1Amount)
    external
    returns(uint256 token2Amount)
{
    // ...
}
```

---

### 15. **Missing Logger/Telemetry**
**Severity**: 🟢 LOW  
**Issue**: No way to monitor contract usage in production

**Recommendation**: Add event logging to frontend:
```javascript
// In interactions.js
export const logEvent = (eventName, data) => {
  if (process.env.NODE_ENV === 'production') {
    // Send to analytics service
    console.log(`[${eventName}]`, data);
  }
};
```

---

### 16. **No Rate Limiting on Frontend**
**Severity**: 🟢 LOW  
**Issue**: Users could spam transactions

**Recommendation**:
```javascript
const [lastSwapTime, setLastSwapTime] = useState(0);
const SWAP_COOLDOWN = 1000; // 1 second

const swapHandler = async (e) => {
  const now = Date.now();
  if (now - lastSwapTime < SWAP_COOLDOWN) {
    window.alert('Please wait before making another transaction');
    return;
  }
  setLastSwapTime(now);
  // ... rest of swap logic
}
```

---

### 17. **Missing Dependency Updates**
**Severity**: 🟢 LOW  
**Issue**: Some packages may have security vulnerabilities

**Recommendation**:
```bash
npm audit
npm audit fix
npm outdated
```

Check for any vulnerabilities in:
- `react-scripts` 5.0.1
- `@nomicfoundation/hardhat-toolbox`
- All dependencies

---

### 18. **No Loading Skeleton for Better UX**
**Severity**: 🟢 LOW  
**Issue**: Loading state could show skeleton components instead of spinner

**Recommendation**: Add skeleton loaders for better perceived performance

---

## ✅ WHAT'S WORKING WELL

1. ✅ **Smart contract logic is sound** - AMM formula (x*y=k) is correctly implemented
2. ✅ **React + Redux architecture is clean** - Good separation of concerns
3. ✅ **Deploy script auto-updates config** - Great fix for the initial issue
4. ✅ **Comprehensive test suite** - Tests cover major functionality
5. ✅ **Good UI/UX with Bootstrap** - Professional appearance
6. ✅ **Event emissions for tracking** - Swaps emit events properly
7. ✅ **Graceful error handling added** - Network switch errors now caught

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] **CRITICAL**: Add reentrancy guard to all external functions
- [ ] **CRITICAL**: Implement SafeERC20 for token transfers
- [ ] **CRITICAL**: Add input validation for all public functions
- [ ] **HIGH**: Implement pause/emergency functionality
- [ ] **HIGH**: Add slippage protection to swaps
- [ ] **HIGH**: Implement transaction deadlines
- [ ] **MEDIUM**: Add Natspec comments
- [ ] **MEDIUM**: Complete security audit with professional firm
- [ ] **MEDIUM**: Set up `.env` variables properly
- [ ] **MEDIUM**: Add error boundary in React
- [ ] **LOW**: Improve test coverage to 100%
- [ ] **LOW**: Set up gas optimization

---

## 📋 NEXT STEPS

### Phase 1: Critical Fixes (This Week)
1. Add ReentrancyGuard to AMM.sol
2. Implement SafeERC20
3. Add input validation
4. Add slippage protection to frontend
5. Add transaction deadlines

### Phase 2: Important Improvements (Next Week)
1. Set up environment variables
2. Add pause/admin functions
3. Add event emissions
4. Error boundary in React
5. Improve test coverage

### Phase 3: Audits (Before Production)
1. Internal security audit
2. Professional smart contract audit (OpenZeppelin, Trail of Bits, etc.)
3. Load testing
4. Penetration testing

### Phase 4: Production Preparation
1. Mainnet configuration
2. Upgrade contract to upgradeable pattern (optional)
3. Monitoring and analytics setup
4. Incident response plan

---

## 📚 RESOURCES

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [Consensys Smart Contract Security Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [OWASP Smart Contract Top 10](https://owasp.org/www-project-smart-contract-top-10/)
- [Solidity Security Documentation](https://docs.soliditylang.org/en/latest/security-considerations.html)
- [Hardhat Documentation](https://hardhat.org/docs)

---

## 🎓 CONCLUSION

Your project demonstrates **solid fundamentals** and is **appropriate for a learning/development environment**. For production mainnet deployment, implement the critical security fixes listed above. Consider hiring professional auditors before handling real user funds.

**Estimated effort for critical fixes**: 3-5 days  
**Estimated effort for full production readiness**: 2-3 weeks
