// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ArbitrationAdapter {
    address public arbitrator; // EOA or role signer for hybrid off-chain decisions

    event ArbitratorChanged(address indexed newArbitrator);
    event RulingSubmitted(bytes32 indexed orderId, bytes32 rulingHash, address indexed submitter);

    modifier onlyArbitrator() { require(msg.sender == arbitrator, "only arbitrator"); _; }

    constructor(address _arbitrator){ arbitrator = _arbitrator; }

    function setArbitrator(address a) external onlyArbitrator { arbitrator = a; emit ArbitratorChanged(a); }

    // For hybrid: off-chain arbitrator signs data and calls resolve on Escrow.
    function submitRuling(bytes32 orderId, bytes32 rulingHash) external onlyArbitrator {
        emit RulingSubmitted(orderId, rulingHash, msg.sender);
    }
}
