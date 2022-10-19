// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./ERC20.sol";
import "./IERC20Mintable.sol";
import "./IERC20Burnable.sol";
import "./Ownable.sol";

contract ERC20Wrapped is IERC20, IERC20Burnable, IERC20Mintable, Ownable {
    address public minter;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    uint256 public override totalSupply;
    uint8 public constant override decimals = 18;
    string public override name;
    string public override symbol;

    constructor(string memory name_, string memory symbol_)
        Ownable(msg.sender)
    {
        name = name_;
        symbol = symbol_;
        minter = msg.sender;
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

    function burn(uint256 amount) external override {
        uint256 accountBalance = balanceOf[msg.sender];
        require(accountBalance >= amount, "burn amount exceeds balance");
        require(amount > 0, "zero amount");
        unchecked {
            balanceOf[msg.sender] = accountBalance - amount;
        }
        totalSupply -= amount;

        emit Transfer(msg.sender, address(0), amount);
    }

    function burnFrom(address from, uint256 amount) external override {
        require(from != address(0), "approve from zero address");
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
        require(fromBalance >= amount, "burn amount exceeds balance");
        unchecked {
            balanceOf[from] = fromBalance - amount;
        }
        totalSupply -= amount;

        emit Transfer(from, address(0), amount);
    }

    function mint(address to, uint256 amount) external override {
        require(minter == msg.sender, "only minter");
        require(to != address(0), "zero address");
        require(amount > 0, "zero amount");

        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transferMintship(address newMinter_) external override onlyOwner {
        require(newMinter_ != address(0), "zero address");
        emit MintshipTransferred(minter, newMinter_);
        minter = newMinter_;
    }
}
