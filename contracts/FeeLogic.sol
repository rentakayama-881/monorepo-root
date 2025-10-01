// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface, IERC20} from "./interfaces/AggregatorV3Interface.sol";

contract FeeLogic {
    struct TierConfig {
        uint256 upperIDR; // upper bound in IDR (scaled by 1e8 per Chainlink, see getIDR)
        uint16 feeBps;    // fee in basis points (10000 = 100%)
    }

    address public admin;
    uint256 public rollingWindowSeconds = 30 days;
    AggregatorV3Interface public usdtIdrFeed; // USDT/IDR price feed

    // seller => rolling volume in IDR for current window bucket
    mapping(address => uint256) public volumeInWindow;
    mapping(address => uint256) public windowStart;

    TierConfig[] public tiers; // ascending by upperIDR

    event AdminChanged(address indexed newAdmin);
    event WindowChanged(uint256 secondsWindow);
    event TiersUpdated();

    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin");
        _;
    }

    constructor(address _admin, address _usdtIdrFeed) {
        admin = _admin;
        usdtIdrFeed = AggregatorV3Interface(_usdtIdrFeed);
        // default tiers per blueprint
        tiers.push(TierConfig({upperIDR: 5_000_000 * 1e8, feeBps: 1000})); // < 5jt => 10%
        tiers.push(TierConfig({upperIDR: 10_000_000 * 1e8, feeBps: 500})); // 5-10jt => 5%
        tiers.push(TierConfig({upperIDR: type(uint256).max, feeBps: 100})); // >10jt => 1%
    }

    function setAdmin(address _admin) external onlyAdmin { admin = _admin; emit AdminChanged(_admin); }
    function setWindow(uint256 secondsWindow) external onlyAdmin { rollingWindowSeconds = secondsWindow; emit WindowChanged(secondsWindow); }

    function setTiers(TierConfig[] memory newTiers) external onlyAdmin {
        delete tiers;
        for (uint i; i < newTiers.length; i++) {
            tiers.push(newTiers[i]);
        }
        emit TiersUpdated();
    }

    function _getUSDTtoIDR() internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = usdtIdrFeed.latestRoundData();
        require(answer > 0, "bad price");
        require(block.timestamp - updatedAt < 1 hours, "stale price");
        return uint256(answer); // Chainlink typically 1e8 decimals
    }

    function quoteFeeBps(address seller, uint256 orderAmountUSDT) public view returns (uint16 feeBps) {
        // convert order amount to IDR using Chainlink
        uint256 idr = (orderAmountUSDT * _getUSDTtoIDR()) / 1e6; // USDT assumes 6 decimals
        // compute volume in current window
        uint256 vol = _currentVolume(seller);
        uint256 total = vol + idr;
        for (uint i; i < tiers.length; i++) {
            if (total <= tiers[i].upperIDR) return tiers[i].feeBps;
        }
        return tiers[tiers.length - 1].feeBps;
    }

    function _currentVolume(address seller) internal view returns (uint256) {
        if (block.timestamp > windowStart[seller] + rollingWindowSeconds) return 0;
        return volumeInWindow[seller];
    }

    function accrueVolume(address seller, uint256 amountUSDT) external {
        // to be restricted by Escrow/EscrowFactory via access control in production
        uint256 idr = (amountUSDT * _getUSDTtoIDR()) / 1e6;
        if (block.timestamp > windowStart[seller] + rollingWindowSeconds) {
            windowStart[seller] = block.timestamp;
            volumeInWindow[seller] = idr;
        } else {
            volumeInWindow[seller] += idr;
        }
    }
}
