// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract Mineable is AccessControlEnumerable {
    event CoinbaseChanged(address indexed previousCoinbase, address indexed newCoinbase);

    uint256 private _minePerBlock;
    uint256 private _halveBlock; // how many block halve
    uint256 private _lastMineBlock;
    uint256 private _nextHalveBlock;

    uint256 private _totalMined;
    uint256 private _mineCap;

    address private _coinbase;// 80%

    bytes32 public constant MINER_ROLE = keccak256("MINER_ROLE");


    constructor(uint256 minePerBlock_, uint256 halveBlock_, address coinbase_, uint256 mineCap_) {
        _minePerBlock = minePerBlock_;
        _halveBlock = halveBlock_;
        _lastMineBlock = block.number;
        _nextHalveBlock = _halveBlock + block.number;
        _coinbase = coinbase_;
        _mineCap = mineCap_;

        _setupRole(MINER_ROLE, _coinbase);

    }


    function changeCoinbase(address _address) public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _address != address(0),
            "coinbase cannot be the zero address."
        );
        require(
            _address != _coinbase,
            "coinbase cannot change to the same."
            );

        emit CoinbaseChanged(_coinbase, _address);
        revokeRole(MINER_ROLE, _coinbase);
        _coinbase = _address;
        _setupRole(MINER_ROLE, _coinbase);
    }

    function coinbase() public view returns (address) {
        return _coinbase;
    }

    function lastMineBlock() public view returns (uint256) {
        return _lastMineBlock;
    }

    function nextHalveBlock() public view returns (uint256) {
        return _nextHalveBlock;
    }   
    
    function minePerBlock() public view returns (uint256) {
        return _minePerBlock;
    }    
    
    function totalMined() public view returns (uint256) {
        return _totalMined;
    }

    /**
     * @notice get mine num
     */
    function mine() public virtual onlyRole(MINER_ROLE) returns (uint256) {
                
        require(
            _totalMined < _mineCap,
            "Mineable: mine cap exceeded"
        );
        
        uint256 currentBlockNum = block.number;

        require(
            currentBlockNum > _lastMineBlock,
            "Cannot mine repeatedly"
        );

        uint256 currentMinePerBlock = _minePerBlock; // get _minePerBlock before halve
        if (currentBlockNum >= _nextHalveBlock) {
            currentBlockNum = _nextHalveBlock;

            // halve
            _nextHalveBlock = _nextHalveBlock + _halveBlock;
            _minePerBlock = _minePerBlock / 2;
        }

        uint256 mineNum = (currentBlockNum - _lastMineBlock) * currentMinePerBlock;
        _lastMineBlock = currentBlockNum;
        if (_totalMined + mineNum > _mineCap) {
            mineNum = _mineCap - _totalMined;
        }

        _totalMined += mineNum;
        return mineNum;
    }
}