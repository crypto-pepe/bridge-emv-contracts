// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IERC20.sol";

contract ERC20 is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    uint256 public override totalSupply;
    uint8 public constant override decimals = 18;
    string public override name;
    string public override symbol;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_
    ) {
        name = name_;
        symbol = symbol_;
        totalSupply += initialSupply_;
        balanceOf[msg.sender] += initialSupply_;
        emit Transfer(address(0), msg.sender, initialSupply_);
    }

    function transfer(address to, uint256 amount)
        external
        override
        returns (bool)
    {
        require(to != address(0), "to zero address");
        require(amount > 0, "zero amount");

        uint256 fromBalance = balanceOf[msg.sender];
        require(fromBalance >= amount, "transfer amount exceeds balance");
        unchecked {
            balanceOf[msg.sender] = fromBalance - amount;
        }
        balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount)
        external
        override
        returns (bool)
    {
        require(msg.sender != address(0), "from zero address");
        require(spender != address(0), "to zero address");

        allowance[msg.sender][spender] = amount;

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external override returns (bool) {
        require(from != address(0), "approve from zero address");
        require(to != address(0), "to zero address");
        require(amount > 0, "zero amount");

        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "insufficient allowance");
            unchecked {
                allowance[from][msg.sender] = currentAllowance - amount;
                emit Approval(from, msg.sender, currentAllowance - amount);
            }
        }

        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= amount, "transfer amount exceeds balance");
        unchecked {
            balanceOf[from] = fromBalance - amount;
        }
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
        return true;
    }
}
