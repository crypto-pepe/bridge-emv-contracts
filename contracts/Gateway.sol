// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./ECDSA.sol";
import "./IERC20.sol";
import "./IERC20Burnable.sol";
import "./IERC20Mintable.sol";
import "./Ownable.sol";
import "./Pausable.sol";
import "./Mutex.sol";
import "./Emergency.sol";
import "./Signable.sol";

contract Gateway is Ownable, Pausable, Mutex, Emergencible, Signable {
    struct TokenMeta {
        uint256 minAmount;
        uint256 minFee;
        uint256 thresholdFee;
        uint128 beforePercentFee;
        uint128 afterPercentFee;
        string targetToken;
        uint8 flags;
    }

    event Transfer(
        uint128 sourceChainId,
        uint128 targetChainId,
        uint256 amount,
        uint256 gaslessClaimReward_,
        string token,
        address sender,
        string recipient
    );
    event TransferFee(
        uint128 sourceChainId,
        uint128 feeChainId,
        uint256 amount,
        string token,
        address invoker
    );
    event Claim(
        uint128 sourceChainId,
        address invoker,
        address recipient,
        address token,
        uint256 amount,
        uint256 gaslessClaimReward
    );
    event FeeChainUpdated(uint128 feeChainId, address invoker);

    uint256 constant BLOCK_DELTA_MAX = 4 * 60 * 24;
    uint128 constant PERCENT_FACTOR = 10**6;
    uint8 constant DECIMALS = 6;
    uint8 constant ENABLED_MASK = 1;
    uint8 constant WRAPPED_MASK = 2;

    uint128 public chainId;
    uint128 public feeChainId = 0;
    mapping(uint128 => bool) public chains;
    mapping(uint128 => mapping(address => TokenMeta)) public tokens;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public fees;
    mapping(bytes32 => uint) private _hashes;

    constructor(
        uint16 chainId_,
        address owner_,
        uint128 feeChainId_
    ) Ownable(owner_) {
        chainId = chainId_;
        feeChainId = feeChainId_;
    }

    function updateTargetChain(uint128 targetChainId_, bool enabled)
        external
        onlyOwner
        mutex
    {
        require(targetChainId_ != chainId, "source chain ID");
        chains[targetChainId_] = enabled;
    }

    function updateFeeChain(uint128 feeChainId_)
        external
        onlyOwner
        whenPaused
        mutex
    {
        require(feeChainId != feeChainId_, "equal chain ids");
        feeChainId = feeChainId_;
        emit FeeChainUpdated(feeChainId_, msg.sender);
    }

    function updateToken(
        uint128 targetChainId_,
        address sourceToken_,
        string calldata targetToken_,
        uint256 minAmount_,
        uint256 minFee_,
        uint256 thresholdFee_,
        uint128 beforePercentFee_,
        uint128 afterPercentFee_,
        bool enabled_,
        bool wrapped_
    ) external onlyOwner mutex {
        require((sourceToken_ != address(0)) || !wrapped_, "native");
        require(chains[targetChainId_], "disabled");
        uint8 flag = 0;
        if (enabled_) {
            flag |= ENABLED_MASK;
        }
        if (wrapped_) {
            flag |= WRAPPED_MASK;
        }

        tokens[targetChainId_][sourceToken_] = TokenMeta(
            minAmount_,
            minFee_,
            thresholdFee_,
            beforePercentFee_,
            afterPercentFee_,
            targetToken_,
            flag
        );
    }

    function transfer(
        uint128 targetChainId_,
        string calldata recipient_,
        uint256 gaslessClaimReward_
    ) external payable mutex whenNotPaused {
        _transfer(
            targetChainId_,
            address(0),
            msg.value,
            recipient_,
            gaslessClaimReward_,
            10**(18 - DECIMALS)
        );
    }

    function transferERC20(
        uint128 targetChainId_,
        address sourceToken_,
        uint256 amount_,
        string calldata recipient_,
        uint256 gaslessClaimReward_
    ) external mutex whenNotPaused {
        require(sourceToken_ != address(0), "unavaliable token");

        IERC20 token = IERC20(sourceToken_);
        uint256 flags = _transfer(
            targetChainId_,
            sourceToken_,
            amount_,
            recipient_,
            gaslessClaimReward_,
            10**(token.decimals() - DECIMALS)
        );

        if (flags & WRAPPED_MASK != 0) {
            IERC20Burnable(sourceToken_).burnFrom(msg.sender, amount_);
        } else {
            assert(token.transferFrom(msg.sender, address(this), amount_));
        }
    }

    function _transfer(
        uint128 targetChainId_,
        address sourceToken_,
        uint256 amount_,
        string calldata recipient_,
        uint256 gaslessClaimReward_,
        uint256 delimiter_
    ) internal virtual returns (uint256) {
        require(chains[targetChainId_], "target chain is disable");
        TokenMeta memory tokenMeta = tokens[targetChainId_][sourceToken_];
        require(tokenMeta.flags & ENABLED_MASK != 0, "token is disable");
        require(amount_ >= tokenMeta.minAmount, "less than min amount");
        require(amount_ > 0, "zero amount");

        uint128 percent = amount_ > tokenMeta.thresholdFee
            ? tokenMeta.afterPercentFee
            : tokenMeta.beforePercentFee;
        uint256 fee = tokenMeta.minFee + (amount_ * percent) / PERCENT_FACTOR;
        require(fee < amount_, "fee more than amount");
        uint256 amount;
        unchecked {
            amount = amount_ - fee;
        }
        require(
            amount > gaslessClaimReward_,
            "gassless claim reward more than amount"
        );

        fees[sourceToken_] += fee;
        if (tokenMeta.flags & WRAPPED_MASK == 0) {
            balances[sourceToken_] += amount;
        }

        emit Transfer(
            chainId,
            targetChainId_,
            amount / delimiter_,
            gaslessClaimReward_ / delimiter_,
            tokenMeta.targetToken,
            msg.sender,
            recipient_
        );

        return tokenMeta.flags;
    }

    function subtractBalances(
        address targetToken_,
        address sender_,
        address recipient_,
        uint256 amount_,
        uint256 gaslessClaimReward_,
        uint256 delimiter_
    ) internal {
        uint256 amount = sender_ != recipient_
            ? (amount_ + gaslessClaimReward_) * delimiter_
            : amount_ * delimiter_;
        require(balances[targetToken_] >= amount, "have no tokens for claim");
        balances[targetToken_] -= amount;
    }

    function claim(
        uint128 sourceChainId_,
        address targetToken_,
        uint256 amount_,
        uint256 gaslessClaimReward_,
        address payable recipient_,
        bytes calldata txHash_,
        bytes calldata signature_
    ) external mutex whenNotPaused {
        require(txHash_.length > 0, "empty txHash");
        require(amount_ > 0, "zero amount");
        require(
            amount_ > gaslessClaimReward_,
            "gassless claim reward more than amount"
        );
        require(
            recipient_ == msg.sender || gaslessClaimReward_ > 0,
            "zero gasless claim reward"
        );
        require(chainId != sourceChainId_, "uncompatible chains");
        require(chains[sourceChainId_], "chain is not available");

        bytes32 data = keccak256(
            abi.encodePacked(
                sourceChainId_,
                chainId,
                amount_,
                gaslessClaimReward_,
                targetToken_,
                recipient_,
                txHash_
            )
        );
        require(_hashes[data] == 0, "duplicate data");
        require(
            ECDSA.recover(
                keccak256(
                    abi.encodePacked("\x19Ethereum Signed Message:\n32", data)
                ),
                signature_
            ) == protocolSigner,
            "only protocol signer"
        );
        _hashes[data] = block.number;

        uint256 amount = recipient_ == msg.sender
            ? amount_
            : amount_ - gaslessClaimReward_;
        emit Claim(
            sourceChainId_,
            msg.sender,
            recipient_,
            targetToken_,
            amount_,
            gaslessClaimReward_
        );

        if (targetToken_ == address(0)) {
            uint256 delimiter = 10**(18 - DECIMALS);
            subtractBalances(
                targetToken_,
                msg.sender,
                recipient_,
                amount,
                gaslessClaimReward_,
                delimiter
            );

            if (recipient_ != msg.sender) {
                recipient_.transfer(amount * delimiter);
                payable(msg.sender).transfer(gaslessClaimReward_ * delimiter);
            } else {
                recipient_.transfer(amount * delimiter);
            }
        } else {
            IERC20 token = IERC20(targetToken_);
            uint256 delimiter = 10**(token.decimals() - DECIMALS);
            TokenMeta memory tokenMeta = tokens[sourceChainId_][targetToken_];
            if (tokenMeta.flags & WRAPPED_MASK != 0) {
                IERC20Mintable mintableToken = IERC20Mintable(targetToken_);
                if (recipient_ != msg.sender) {
                    mintableToken.mint(recipient_, amount * delimiter);
                    mintableToken.mint(
                        msg.sender,
                        gaslessClaimReward_ * delimiter
                    );
                } else {
                    mintableToken.mint(recipient_, amount * delimiter);
                }
            } else {
                subtractBalances(
                    targetToken_,
                    msg.sender,
                    recipient_,
                    amount,
                    gaslessClaimReward_,
                    delimiter
                );

                if (recipient_ != msg.sender) {
                    assert(
                        token.transfer(recipient_, amount * delimiter) &&
                            token.transfer(
                                msg.sender,
                                gaslessClaimReward_ * delimiter
                            )
                    );
                } else {
                    assert(token.transfer(recipient_, amount * delimiter));
                }
            }
        }
    }

    function transferFee(
        address sourceToken_,
        uint block_,
        bytes calldata signature_
    ) external mutex whenNotPaused {
        require(
            (block.number < block_ + BLOCK_DELTA_MAX) && block_ < block.number,
            "invalid block"
        );
        bytes32 data = keccak256(
            abi.encodePacked(block_, chainId, sourceToken_)
        );
        require(_hashes[data] == 0, "duplicate data");
        require(
            ECDSA.recover(
                keccak256(
                    abi.encodePacked("\x19Ethereum Signed Message:\n32", data)
                ),
                signature_
            ) == protocolSigner,
            "only protocol signer"
        );
        _hashes[data] = block_;

        require(chains[feeChainId], "Fee chain is disable");
        TokenMeta memory tokenMeta = tokens[feeChainId][sourceToken_];
        require(tokenMeta.flags & ENABLED_MASK != 0, "token is disable");

        uint256 fee = fees[sourceToken_];
        if (tokenMeta.flags & WRAPPED_MASK == 0) {
            balances[sourceToken_] += fee;
        }
        fees[sourceToken_] = 0;

        uint256 delimiter = 10**(18 - DECIMALS);
        if (sourceToken_ != address(0)) {
            delimiter = 10**(IERC20(sourceToken_).decimals() - DECIMALS);
        }
        uint256 absFee = fee != 0 ? fee / delimiter : 0;

        emit TransferFee(
            chainId,
            feeChainId,
            absFee,
            tokenMeta.targetToken,
            msg.sender
        );
    }

    function chargebackUntracked(
        uint128 targetChainId_,
        address sourceToken_,
        address payable chargebackAddress_
    ) external onlyOwner whenNotPaused mutex {
        require(chargebackAddress_ != address(0), "zero address");
        if (sourceToken_ == address(0)) {
            require(
                address(this).balance >
                    (balances[sourceToken_] + fees[sourceToken_]),
                "uncorrect amount"
            );
            chargebackAddress_.transfer(
                address(this).balance -
                    balances[sourceToken_] -
                    fees[sourceToken_]
            );
        } else {
            IERC20 token = IERC20(sourceToken_);
            uint256 chargebackAmount = token.balanceOf(address(this));
            require(
                chargebackAmount >
                    (balances[sourceToken_] + fees[sourceToken_]),
                "uncorrect amount"
            );
            TokenMeta memory tokenMeta = tokens[targetChainId_][sourceToken_];
            if (tokenMeta.flags & WRAPPED_MASK == 0) {
                chargebackAmount -= balances[sourceToken_] + fees[sourceToken_];
            }

            assert(token.transfer(chargebackAddress_, chargebackAmount));
        }
    }

    function updateSignerRequest(address signer_) external onlyOwner mutex {
        _updateSignerRequest(signer_);
    }

    function updateSigner() external onlyOwner whenPaused mutex {
        _updateSigner();
    }

    function emergencyWithdrawRequest(address token_, address recipient_)
        external
        onlyOwner
        mutex
    {
        _emergencyWithdrawRequest(token_, recipient_);
    }

    function emergencyWithdraw(address token_)
        external
        onlyOwner
        whenPaused
        mutex
    {
        _emergencyWithdraw(token_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    receive() external payable {}
}
