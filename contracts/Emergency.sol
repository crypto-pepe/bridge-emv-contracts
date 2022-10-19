// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./IERC20.sol";

abstract contract Emergencible {
    event EmergencyWithdrawRequest(
        address sender,
        address token,
        address recipient
    );
    event EmergencyWithdraw(address sender, address token, address recipient);

    mapping(address => address) public emergencyWithdrawRequests;

    function _emergencyWithdrawRequest(address token_, address recipient_)
        internal
        virtual
    {
        require(recipient_ != address(0), "zero address");
        emergencyWithdrawRequests[token_] = recipient_;
        emit EmergencyWithdrawRequest(msg.sender, token_, recipient_);
    }

    function _emergencyWithdraw(address token_) internal virtual {
        address recipient = emergencyWithdrawRequests[token_];
        require(recipient != address(0), "zero address");
        emergencyWithdrawRequests[token_] = address(0);
        emit EmergencyWithdraw(msg.sender, token_, recipient);

        if (token_ == address(0)) {
            uint256 balance = address(this).balance;
            require(balance > 0, "insufficient funds");
            payable(recipient).transfer(balance);
        } else {
            IERC20 token = IERC20(token_);
            uint256 balance = token.balanceOf(address(this));
            require(balance > 0, "insufficient funds");
            assert(token.transfer(recipient, balance));
        }
    }
}
