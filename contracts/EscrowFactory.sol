// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Escrow} from "./Escrow.sol";

contract EscrowFactory {
    address public admin;
    address public feeLogic;
    address public staking;
    address public arbitrationAdapter;
    address public usdt;

    // orderId (bytes32) => escrow address
    mapping(bytes32 => address) public escrowOf;

    event AdminChanged(address indexed newAdmin);
    event EscrowDeployed(bytes32 indexed orderId, address escrow);

    constructor(address _admin, address _usdt, address _feeLogic, address _staking, address _arb) {
        admin = _admin;
        usdt = _usdt;
        feeLogic = _feeLogic;
        staking = _staking;
        arbitrationAdapter = _arb;
    }

    modifier onlyAdmin(){ require(msg.sender == admin, "only admin"); _; }

    function setAdmin(address a) external onlyAdmin { admin = a; emit AdminChanged(a); }

    function deployEscrow(bytes32 orderId, address buyer, address seller, uint256 amountUSDT) external onlyAdmin returns (address) {
        require(escrowOf[orderId] == address(0), "exists");
        Escrow e = new Escrow(usdt, feeLogic, staking, arbitrationAdapter, buyer, seller, amountUSDT, orderId);
        escrowOf[orderId] = address(e);
        emit EscrowDeployed(orderId, address(e));
        return address(e);
    }
}
