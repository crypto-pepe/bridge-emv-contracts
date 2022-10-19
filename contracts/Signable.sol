// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

abstract contract Signable {
    event UpdateSignerRequest(address sender, address newSigner);
    event UpdateSigner(address sender, address oldSigner, address newSigner);

    address public protocolSigner;
    address public signerCandidate;

    function _updateSignerRequest(address signer_) internal virtual {
        require(signer_ != address(0), "zero address");
        signerCandidate = signer_;
        emit UpdateSignerRequest(msg.sender, signer_);
    }

    function _updateSigner() internal virtual {
        address candidate = signerCandidate;
        require(candidate != address(0), "zero address");

        emit UpdateSigner(msg.sender, protocolSigner, candidate);
        protocolSigner = candidate;
        signerCandidate = address(0);
    }
}
