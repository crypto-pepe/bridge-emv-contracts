// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IERC20Burnable {
    function burn(uint256 amount) external;

    function burnFrom(address account, uint256 amount) external;
}
