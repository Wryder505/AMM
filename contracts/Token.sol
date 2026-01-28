//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.20;

import "hardhat/console.sol";

/// @title Token - A simple ERC20 token implementation
/// @notice This contract implements basic ERC20 functionality with security considerations
contract Token {
    string public name;
    string public symbol;
    uint256 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 value
    );

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    /// @notice Initialize the token with name, symbol, and total supply
    /// @param _name The name of the token
    /// @param _symbol The symbol of the token
    /// @param _totalSupply The total supply (will be multiplied by 10^18)
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply
    ) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_symbol).length > 0, "Symbol cannot be empty");
        require(_totalSupply > 0, "Total supply must be greater than 0");

        name = _name;
        symbol = _symbol;
        totalSupply = _totalSupply * (10**decimals);
        balanceOf[msg.sender] = totalSupply;
    }

    /// @notice Transfer tokens from sender to recipient
    /// @param _to Recipient address
    /// @param _value Amount to transfer
    /// @return success True if transfer succeeds
    function transfer(address _to, uint256 _value)
        public
        returns (bool success)
    {
        require(_to != address(0), "Invalid recipient address");
        require(_value > 0, "Transfer amount must be greater than 0");
        require(balanceOf[msg.sender] >= _value, "Insufficient balance");

        _transfer(msg.sender, _to, _value);

        return true;
    }

    /// @notice Internal transfer logic
    /// @param _from Sender address
    /// @param _to Recipient address
    /// @param _value Amount to transfer
    function _transfer(
        address _from,
        address _to,
        uint256 _value
    ) internal {
        require(_to != address(0), "Cannot transfer to zero address");
        require(balanceOf[_from] >= _value, "Insufficient balance");

        balanceOf[_from] = balanceOf[_from] - _value;
        balanceOf[_to] = balanceOf[_to] + _value;

        emit Transfer(_from, _to, _value);
    }

    /// @notice Approve spender to use tokens on behalf of sender
    /// @param _spender Address that can spend the tokens
    /// @param _value Amount to approve
    /// @return success True if approval succeeds
    function approve(address _spender, uint256 _value)
        public
        returns(bool success)
    {
        require(_spender != address(0), "Invalid spender address");
        require(_value > 0, "Approval amount must be greater than 0");

        allowance[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /// @notice Transfer tokens from one address to another on behalf of owner
    /// @param _from Address to transfer from
    /// @param _to Address to transfer to
    /// @param _value Amount to transfer
    /// @return success True if transfer succeeds
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    )
        public
        returns (bool success)
    {
        require(_from != address(0), "Invalid sender address");
        require(_to != address(0), "Invalid recipient address");
        require(_value > 0, "Transfer amount must be greater than 0");
        require(_value <= balanceOf[_from], "Insufficient balance");
        require(_value <= allowance[_from][msg.sender], "Insufficient allowance");

        allowance[_from][msg.sender] = allowance[_from][msg.sender] - _value;

        _transfer(_from, _to, _value);

        return true;
    }

    /// @notice Increase allowance for spender
    /// @param _spender Address that can spend the tokens
    /// @param _addedValue Amount to add to allowance
    /// @return success True if operation succeeds
    function increaseAllowance(address _spender, uint256 _addedValue)
        public
        returns (bool success)
    {
        require(_spender != address(0), "Invalid spender address");
        require(_addedValue > 0, "Added value must be greater than 0");

        allowance[msg.sender][_spender] = allowance[msg.sender][_spender] + _addedValue;

        emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
        return true;
    }

    /// @notice Decrease allowance for spender
    /// @param _spender Address that can spend the tokens
    /// @param _subtractedValue Amount to subtract from allowance
    /// @return success True if operation succeeds
    function decreaseAllowance(address _spender, uint256 _subtractedValue)
        public
        returns (bool success)
    {
        require(_spender != address(0), "Invalid spender address");
        require(_subtractedValue > 0, "Subtracted value must be greater than 0");
        require(allowance[msg.sender][_spender] >= _subtractedValue, "Decreased allowance below zero");

        allowance[msg.sender][_spender] = allowance[msg.sender][_spender] - _subtractedValue;

        emit Approval(msg.sender, _spender, allowance[msg.sender][_spender]);
        return true;
    }

}
