// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Escrow} from "./Escrow.sol";

contract EscrowFactory {
    address public admin;
    address public feeLogic;
    address public staking;
    address public arbitrationAdapter;
    address public usdt;
    address public backendSigner;

    // orderId (bytes32) => escrow address
    mapping(bytes32 => address) public escrowOf;

    event AdminChanged(address indexed newAdmin);
    event BackendSignerUpdated(address indexed newBackendSigner);
    event EscrowDeployed(
        bytes32 indexed orderId,
        address escrow,
        address indexed buyer,
        address indexed seller,
        uint256 amountUSDT
    );

    constructor(address _admin, address _usdt, address _feeLogic, address _staking, address _arb) {
        admin = _admin;
        usdt = _usdt;
        feeLogic = _feeLogic;
        staking = _staking;
        arbitrationAdapter = _arb;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    function setAdmin(address a) external onlyAdmin {
        admin = a;
        emit AdminChanged(a);
    }

    function setBackendSigner(address signer) external onlyAdmin {
        require(signer != address(0), "invalid signer");
        backendSigner = signer;
        emit BackendSignerUpdated(signer);
    }

    function deployEscrow(
        bytes32 orderId,
        address buyer,
        address seller,
        uint256 amountUSDT,
        uint256 expiresAt,
        bytes calldata signature
    ) external returns (address) {
        require(backendSigner != address(0), "backend signer not set");
        require(escrowOf[orderId] == address(0), "exists");
        require(block.timestamp <= expiresAt, "signature expired");
        require(_verifySignature(orderId, buyer, seller, amountUSDT, expiresAt, signature), "invalid signature");

        Escrow e = new Escrow(usdt, feeLogic, staking, arbitrationAdapter, buyer, seller, amountUSDT, orderId);
        escrowOf[orderId] = address(e);

        emit EscrowDeployed(orderId, address(e), buyer, seller, amountUSDT);
        return address(e);
    }

    function _verifySignature(
        bytes32 orderId,
        address buyer,
        address seller,
        uint256 amountUSDT,
        uint256 expiresAt,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes32 digest = keccak256(abi.encode(orderId, buyer, seller, amountUSDT, block.chainid, address(this), expiresAt));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "bad v");
        address recovered = ecrecover(ethSigned, v, r, s);
        return recovered == backendSigner;
    }

    function _splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "bad signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
