// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

abstract contract Mutex {
    bool lock;

    modifier mutex() {
        require(!lock, "mutex lock");
        lock = true;
        _;
        lock = false;
    }
}
