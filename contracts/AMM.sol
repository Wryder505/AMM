// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import "./Token.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title AMM - Automated Market Maker implementing constant product formula (x*y=k)
/// @notice This contract implements a simple AMM with security protections including reentrancy guard and SafeERC20
contract AMM is ReentrancyGuard {
    using SafeERC20 for IERC20;

    Token public token1;
    Token public token2;

    uint256 public token1Balance;
    uint256 public token2Balance;
    uint256 public K;

    uint256 public totalShares;
    mapping(address => uint256) public shares;
    uint256 constant PRECISION = 10**18;

    event LiquidityAdded(
        address indexed user,
        uint256 token1Amount,
        uint256 token2Amount,
        uint256 shares
    );

    event LiquidityRemoved(
        address indexed user,
        uint256 shares,
        uint256 token1Amount,
        uint256 token2Amount
    );

    event Swap(
        address indexed user,
        address tokenGive,
        uint256 tokenGiveAmount,
        address tokenGet,
        uint256 tokenGetAmount,
        uint256 token1Balance,
        uint256 token2Balance,
        uint256 timestamp
    );

    /// @notice Initialize AMM with two tokens
    /// @param _token1 Address of the first token
    /// @param _token2 Address of the second token
    constructor(Token _token1, Token _token2) {
        require(address(_token1) != address(0), "Token1 address cannot be zero");
        require(address(_token2) != address(0), "Token2 address cannot be zero");
        require(address(_token1) != address(_token2), "Tokens cannot be the same");

        token1 = _token1;
        token2 = _token2;
    }

    /// @notice Add liquidity to the pool
    /// @param _token1Amount Amount of token1 to add
    /// @param _token2Amount Amount of token2 to add
    function addLiquidity(uint256 _token1Amount, uint256 _token2Amount) 
        external 
        nonReentrant 
    {
        // Input validation
        require(_token1Amount > 0, "Token1 amount must be greater than 0");
        require(_token2Amount > 0, "Token2 amount must be greater than 0");

        // Deposit Tokens using SafeERC20
        IERC20(address(token1)).safeTransferFrom(msg.sender, address(this), _token1Amount);
        IERC20(address(token2)).safeTransferFrom(msg.sender, address(this), _token2Amount);

        // Issue Shares
        uint256 share;
        
        // If first time adding liquidity, make share 100
        if (totalShares == 0) {
            share = 100 * PRECISION;
        } else {
            // Validate pool has liquidity
            require(token1Balance > 0, "Token1 balance is zero");
            require(token2Balance > 0, "Token2 balance is zero");

            uint256 share1 = (totalShares * _token1Amount) / token1Balance;
            uint256 share2 = (totalShares * _token2Amount) / token2Balance;
            
            require(
                (share1 / 10**3) == (share2 / 10**3),
                "must provide equal token amounts"
            );
            share = share1;
        }

        require(share > 0, "Share amount must be greater than 0");

        // Manage Pool
        token1Balance += _token1Amount;
        token2Balance += _token2Amount;
        K = token1Balance * token2Balance;

        // Updates shares
        totalShares += share;
        shares[msg.sender] += share;

        emit LiquidityAdded(msg.sender, _token1Amount, _token2Amount, share);
    }

    /// @notice Calculate how many token2 tokens must be deposited when depositing liquidity for token1
    /// @param _token1Amount Amount of token1 being deposited
    /// @return token2Amount Amount of token2 required
    function calculateToken2Deposit(uint256 _token1Amount)
        public
        view
        returns (uint256 token2Amount)
    {
        require(_token1Amount > 0, "Token1 amount must be greater than 0");
        require(token1Balance > 0, "Token1 balance is zero");

        token2Amount = (token2Balance * _token1Amount) / token1Balance;
    }

    /// @notice Calculate how many token1 tokens must be deposited when depositing liquidity for token2
    /// @param _token2Amount Amount of token2 being deposited
    /// @return token1Amount Amount of token1 required
    function calculateToken1Deposit(uint256 _token2Amount)
        public
        view
        returns (uint256 token1Amount)
    {
        require(_token2Amount > 0, "Token2 amount must be greater than 0");
        require(token2Balance > 0, "Token2 balance is zero");

        token1Amount = (token1Balance * _token2Amount) / token2Balance;
    }

    /// @notice Calculate how many token2 tokens will be received when swapping token1
    /// @param _token1Amount Amount of token1 to swap
    /// @return token2Amount Amount of token2 to receive
    function calculateToken1Swap(uint256 _token1Amount)
        public
        view
        returns (uint256 token2Amount)
    {
        require(_token1Amount > 0, "Token1 amount must be greater than 0");
        require(token1Balance > 0, "Token1 balance is zero");
        require(token2Balance > 0, "Token2 balance is zero");

        uint256 token1After = token1Balance + _token1Amount;
        uint256 token2After = K / token1After;
        token2Amount = token2Balance - token2After;

        // Don't let the pool go to 0
        if (token2Amount == token2Balance) {
            token2Amount--;
        }

        require(token2Amount > 0, "Output amount is zero");
        require(token2Amount < token2Balance, "swap amount too large");
    }

    /// @notice Swap token1 for token2
    /// @param _token1Amount Amount of token1 to swap
    /// @return token2Amount Amount of token2 received
    function swapToken1(uint256 _token1Amount)
        external
        nonReentrant
        returns(uint256 token2Amount)
    {
        require(_token1Amount > 0, "Swap amount must be greater than 0");

        // Calculate Token 2 Amount
        token2Amount = calculateToken1Swap(_token1Amount);

        // Update state first (Checks-Effects-Interactions pattern)
        token1Balance += _token1Amount;
        token2Balance -= token2Amount;
        K = token1Balance * token2Balance;

        // Do transfers using SafeERC20
        IERC20(address(token1)).safeTransferFrom(msg.sender, address(this), _token1Amount);
        IERC20(address(token2)).safeTransfer(msg.sender, token2Amount);

        // Emit an event
        emit Swap(
            msg.sender,
            address(token1),
            _token1Amount,
            address(token2),
            token2Amount,
            token1Balance,
            token2Balance,
            block.timestamp
        );
    }

    /// @notice Calculate how many token1 tokens will be received when swapping token2
    /// @param _token2Amount Amount of token2 to swap
    /// @return token1Amount Amount of token1 to receive
    function calculateToken2Swap(uint256 _token2Amount)
        public
        view
        returns (uint256 token1Amount)
    {
        require(_token2Amount > 0, "Token2 amount must be greater than 0");
        require(token1Balance > 0, "Token1 balance is zero");
        require(token2Balance > 0, "Token2 balance is zero");

        uint256 token2After = token2Balance + _token2Amount;
        uint256 token1After = K / token2After;
        token1Amount = token1Balance - token1After;

        // Don't let the pool go to 0
        if (token1Amount == token1Balance) {
            token1Amount--;
        }

        require(token1Amount > 0, "Output amount is zero");
        require(token1Amount < token1Balance, "swap amount too large");
    }

    /// @notice Swap token2 for token1
    /// @param _token2Amount Amount of token2 to swap
    /// @return token1Amount Amount of token1 received
    function swapToken2(uint256 _token2Amount)
        external
        nonReentrant
        returns(uint256 token1Amount)
    {
        require(_token2Amount > 0, "Swap amount must be greater than 0");

        // Calculate Token 1 Amount
        token1Amount = calculateToken2Swap(_token2Amount);

        // Update state first (Checks-Effects-Interactions pattern)
        token2Balance += _token2Amount;
        token1Balance -= token1Amount;
        K = token1Balance * token2Balance;

        // Do transfers using SafeERC20
        IERC20(address(token2)).safeTransferFrom(msg.sender, address(this), _token2Amount);
        IERC20(address(token1)).safeTransfer(msg.sender, token1Amount);

        // Emit an event
        emit Swap(
            msg.sender,
            address(token2),
            _token2Amount,
            address(token1),
            token1Amount,
            token1Balance,
            token2Balance,
            block.timestamp
        );
    }

    /// @notice Calculate how many tokens will be withdrawn
    /// @param _share Amount of shares to withdraw
    /// @return token1Amount Amount of token1 to receive
    /// @return token2Amount Amount of token2 to receive
    function calculateWithdrawAmount(uint256 _share)
        public
        view
        returns (uint256 token1Amount, uint256 token2Amount)
    {
        require(_share > 0, "Share amount must be greater than 0");
        require(_share <= totalShares, "Shares exceed total shares");

        token1Amount = (_share * token1Balance) / totalShares;
        token2Amount = (_share * token2Balance) / totalShares;

        require(token1Amount > 0, "Token1 withdrawal amount is zero");
        require(token2Amount > 0, "Token2 withdrawal amount is zero");
    }

    /// @notice Remove liquidity from the pool
    /// @param _share Amount of shares to remove
    /// @return token1Amount Amount of token1 received
    /// @return token2Amount Amount of token2 received
    function removeLiquidity(uint256 _share)
        external
        nonReentrant
        returns(uint256 token1Amount, uint256 token2Amount)
    {
        require(_share > 0, "Share amount must be greater than 0");
        require(
            _share <= shares[msg.sender],
            "cannot withdraw more shares than you have"
        );

        (token1Amount, token2Amount) = calculateWithdrawAmount(_share);

        // Update state first
        shares[msg.sender] -= _share;
        totalShares -= _share;
        token1Balance -= token1Amount;
        token2Balance -= token2Amount;
        K = token1Balance * token2Balance;

        // Do transfers using SafeERC20
        IERC20(address(token1)).safeTransfer(msg.sender, token1Amount);
        IERC20(address(token2)).safeTransfer(msg.sender, token2Amount);

        emit LiquidityRemoved(msg.sender, _share, token1Amount, token2Amount);
    }
}
