// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IERC20Mintable {
    event MintshipTransferred(
        address indexed oldMinter,
        address indexed newMinter
    );

    function mint(address to, uint256 amount) external;

    function transferMintship(address newMinter_) external;
}
