// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

abstract contract Ownable {
    address public owner;
    address public candidate;

    event OwnershipRequest(address owner, address candidate);
    event OwnershipTransferred(
        address indexed oldOwner,
        address indexed newOwner
    );

    constructor(address owner_) {
        owner = owner_;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "only owner");
        _;
    }

    function transferOwnershipRequest(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnershipRequest(owner, newOwner);
        candidate = newOwner;
    }

    function transferOwnership() external onlyOwner {
        require(candidate != address(0), "zero address");
        emit OwnershipTransferred(owner, candidate);
        owner = candidate;
        candidate = address(0);
    }
}
