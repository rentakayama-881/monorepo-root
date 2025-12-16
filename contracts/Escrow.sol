// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "./interfaces/IERC20.sol";

interface IFeeLogic {
    function quoteFeeBps(address seller, uint256 orderAmountUSDT) external view returns (uint16);
    function accrueVolume(address seller, uint256 amountUSDT) external;
}

interface IStaking {
    function minimumStakeUSDT() external view returns (uint256);
    function stake(address) external view returns (uint256);
}

contract Escrow {
    enum Status { Pending, Funded, Delivered, Disputed, Resolved, Refunded, Cancelled }

    IERC20 public immutable usdt;
    IFeeLogic public feeLogic;
    IStaking public staking;
    address public arbitrationAdapter;

    address public buyer;
    address public seller;
    uint256 public amountUSDT; // expected amount in USDT (6 decimals)
    bytes32 public orderId;    // off-chain order id

    Status public status;

    event Funded(address indexed from, uint256 amount);
    event Delivered(bytes ipfsData);
    event DisputeOpened(address indexed by, bytes details);
    event Resolved(bytes decision);
    event Refunded(uint256 toBuyer);
    event Released(uint256 toSeller, uint256 fee);

    constructor(
        address _usdt,
        address _feeLogic,
        address _staking,
        address _arb,
        address _buyer,
        address _seller,
        uint256 _amountUSDT,
        bytes32 _orderId
    ){
        usdt = IERC20(_usdt);
        feeLogic = IFeeLogic(_feeLogic);
        staking = IStaking(_staking);
        arbitrationAdapter = _arb;
        buyer = _buyer;
        seller = _seller;
        amountUSDT = _amountUSDT;
        orderId = _orderId;
        status = Status.Pending;
    }

    modifier onlyBuyer(){ require(msg.sender == buyer, "only buyer"); _; }

    function fund(uint256 amount) external onlyBuyer {
        require(status == Status.Pending, "bad state");
        require(amount == amountUSDT, "amount mismatch");
        require(staking.stake(seller) >= staking.minimumStakeUSDT(), "seller below min stake");
        usdt.transferFrom(msg.sender, address(this), amount);
        status = Status.Funded;
        emit Funded(msg.sender, amount);
    }

    function deliver(bytes calldata ipfsData) external {
        require(msg.sender == seller, "only seller");
        require(status == Status.Funded, "bad state");
        status = Status.Delivered;
        emit Delivered(ipfsData);
    }

    function openDispute(bytes calldata details) external {
        require(status == Status.Delivered || status == Status.Funded, "bad state");
        require(msg.sender == buyer || msg.sender == seller, "only parties");
        status = Status.Disputed;
        emit DisputeOpened(msg.sender, details);
    }

    // resolve called by arbitration adapter or directly by arbitrator via adapter gating
    function resolveAndExecute(bool releaseToSeller, uint256 feeOverrideBps, bytes calldata decision) external {
        require(msg.sender == arbitrationAdapter, "only arbAdapter");
        require(status == Status.Disputed || status == Status.Delivered || status == Status.Funded, "bad state");
        status = Status.Resolved;

        if (releaseToSeller) {
            uint16 feeBps = feeOverrideBps > 0 ? uint16(feeOverrideBps) : feeLogic.quoteFeeBps(seller, amountUSDT);
            uint256 fee = (amountUSDT * feeBps) / 10_000;
            uint256 net = amountUSDT - fee;
            usdt.transfer(seller, net);
            usdt.transfer(address(uint160(uint256(keccak256("feeSink")))), fee); // placeholder sink; replace with admin multisig
            feeLogic.accrueVolume(seller, amountUSDT);
            emit Released(net, fee);
        } else {
            usdt.transfer(buyer, amountUSDT);
            emit Refunded(amountUSDT);
        }
        emit Resolved(decision);
    }
}
