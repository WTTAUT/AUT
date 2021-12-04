// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "./PeriodTokenVesting.sol";

contract Vestable is AccessControlEnumerable {
    event LockBeneficiary(address beneficiary);
    event UnlockBeneficiary(address beneficiary);

    // cliffDuration: duration in seconds of the cliff in which tokens will begin to vest
    uint256 private _cliffDuration;
    // duration: duration in seconds of the period in which the tokens will vest
    uint256 private _duration;
    address[] private _beneficiaries;

    struct PeriodTokenVestingData {
        PeriodTokenVesting periodTokenVesting;
        bool isLock;
        bool isValid;
    }

    mapping (address => PeriodTokenVestingData) internal periodTokenVestingMap;
    mapping (address => bool) internal isPeriodTokenVesting;

    bytes32 public constant RELEASER_ROLE = keccak256("RELEASER_ROLE");

    /**
    * - `cliffDuration_`: duration in seconds of the cliff in which tokens will begin to vest
    * - `duration_`:  duration in seconds of the period in which the tokens will vest
    * - `beneficiary_`: beneficiary
    */
    constructor(uint256 cliffDuration_, uint256 duration_, address beneficiary_) {
        _cliffDuration = cliffDuration_;
        _duration = duration_;
        _beneficiaries = [beneficiary_];

        uint256 currentTime = block.timestamp;

        for (uint i = 0; i < _beneficiaries.length; i++) {
            address beneficiary = _beneficiaries[i];
            PeriodTokenVesting periodTokenVesting = new PeriodTokenVesting(beneficiary, currentTime, _cliffDuration, _duration);
            periodTokenVestingMap[beneficiary].periodTokenVesting = periodTokenVesting;
            periodTokenVestingMap[beneficiary].isValid = true;

            isPeriodTokenVesting[address(periodTokenVesting)] = true;
        }
    }

    /**
    * duration in seconds of the cliff in which tokens will begin to vest
    */
    function cliffDuration() public view returns (uint256) {
        return _cliffDuration;
    }

    /**
    * duration in seconds of the period in which the tokens will vest
    */
    function duration() public view returns (uint256) {
        return _duration;
    }

    function beneficiaries() public view returns (address[] memory) {
        return _beneficiaries;
    }

     /**
     * @dev Modifier to make a function callable only when _address is periodTokenVesting beneficiary.
     *
     * Requirements:
     *
     * - The _address must be periodTokenVesting beneficiary.
     */
    modifier onlyTokenVestingBeneficiary(address _address) {

        require(
            periodTokenVestingMap[_address].isValid,
            "_address not the beneficiary."
        );

        _;
    }

    /**
     * @dev Modifier to make a function callable only when periodTokenVesting beneficiary address was locked.
     *
     * Requirements:
     *
     * - The periodTokenVesting beneficiary address must be locked.
     */
    modifier whenBeneficiaryLock(address _address) {

        require(
            periodTokenVestingMap[_address].isLock,
            "beneficiary _address was unlocked."
        );

        _;
    }

    /**
     * @dev Modifier to make a function callable only when periodTokenVesting beneficiary address was unlocked.
     *
     * Requirements:
     *
     * - The periodTokenVesting beneficiary address must be unlocked.
     */
    modifier whenBeneficiaryUnlock(address _address) {

        require(
            !periodTokenVestingMap[_address].isLock,
            "beneficiary _address was locked."
        );

        _;
    }

    /**
     * only RELEASER_ROLE or beneficiary can call release
     *
     * @notice Transfers vested tokens to _address.
     * @param _address which _address will be released
     * @param _token ERC20 token which is being vested
     */
    function release(address _address, IERC20 _token) internal virtual onlyTokenVestingBeneficiary(_address) whenBeneficiaryUnlock(_address) {

        address sender = _msgSender();
        if (!hasRole(RELEASER_ROLE, sender)) {
            require(
                sender == _address,
                "You're not RELEASER_ROLE. You can only release yourself."
            );
        }
        periodTokenVestingMap[_address].periodTokenVesting.release(_token);
    }

     /**
     * make beneficiary can't call release
     *
     * @param _address beneficiary address
     */
    function lockBeneficiary(address _address) public
    onlyRole(DEFAULT_ADMIN_ROLE)
    onlyTokenVestingBeneficiary(_address)
    whenBeneficiaryUnlock(_address) {
        periodTokenVestingMap[_address].isLock = true;
        emit LockBeneficiary(_address);
    }

    /**
     * make beneficiary can call release
     *
     * @param _address beneficiary address
     */
    function unlockBeneficiary(address _address) public
    onlyRole(DEFAULT_ADMIN_ROLE)
    onlyTokenVestingBeneficiary(_address)
    whenBeneficiaryLock(_address) {
        periodTokenVestingMap[_address].isLock = false;
        emit UnlockBeneficiary(_address);
    }

    function isLock(address _beneficiary) public view onlyTokenVestingBeneficiary(_beneficiary) returns (bool) {
        return periodTokenVestingMap[_beneficiary].isLock;
    }

    function tokenVestingAddress(address _beneficiary) public view onlyTokenVestingBeneficiary(_beneficiary) returns (address) {
        return address(periodTokenVestingMap[_beneficiary].periodTokenVesting);
    }
}