// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface, IERC20} from "./interfaces/AggregatorV3Interface.sol";

contract Staking {
    IERC20 public immutable usdt;
    AggregatorV3Interface public immutable usdtIdrFeed;

    mapping(address => uint256) public stake; // in USDT (6 decimals)

    address public admin;

    event Deposited(address indexed seller, uint256 amount);
    event Withdrawn(address indexed seller, uint256 amount);
    event Slashed(address indexed seller, uint256 amount, address indexed to);

    constructor(address _usdt, address _feed, address _admin) {
        usdt = IERC20(_usdt);
        usdtIdrFeed = AggregatorV3Interface(_feed);
        admin = _admin;
    }

    modifier onlyAdmin() { require(msg.sender == admin, "only admin"); _; }

    function _getUSDTtoIDR() internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = usdtIdrFeed.latestRoundData();
        require(answer > 0, "bad price");
        require(block.timestamp - updatedAt < 1 hours, "stale price");
        return uint256(answer); // 1e8
    }

    function minimumStakeUSDT() public view returns (uint256) {
        // Min stake: IDR 800,000 → convert to USDT with 6 decimals
        uint256 idr = 800_000 * 1e8;
        uint256 usdtAmt = (idr * 1e6) / _getUSDTtoIDR();
        return usdtAmt;
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "amount=0");
        usdt.transferFrom(msg.sender, address(this), amount);
        stake[msg.sender] += amount;
        require(stake[msg.sender] >= minimumStakeUSDT(), "below min stake");
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(stake[msg.sender] >= amount, "exceeds stake");
        // In production: enforce locks during active disputes
        stake[msg.sender] -= amount;
        usdt.transfer(msg.sender, amount);
        // still ensure remaining >= min or allow full exit if no active listings; left to business rules
        emit Withdrawn(msg.sender, amount);
    }

    function slash(address seller, uint256 amount, address to) external onlyAdmin {
        require(stake[seller] >= amount, "insufficient stake");
        stake[seller] -= amount;
        usdt.transfer(to, amount);
        emit Slashed(seller, amount, to);
    }
}
