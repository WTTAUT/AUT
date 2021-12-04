// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PeriodTokenVesting
 * @dev A token holder contract that can release its token balance gradually like a
 * typical vesting scheme, with a cliff and vesting period. Optionally revocable by the
 * owner.
 */
contract PeriodTokenVesting is Ownable {
    // The vesting schedule is time-based (i.e. using block timestamps as opposed to e.g. block numbers), and is
    // therefore sensitive to timestamp manipulation (which is something miners can do, to a certain degree). Therefore,
    // it is recommended to avoid using short time durations (less than a minute). Typical vesting schemes, with a
    // cliff period of a year and a duration of four years, are safe to use.
    // solhint-disable not-rely-on-time

    using SafeERC20 for IERC20;

    event TokensReleased(address token, uint256 amount);

    // beneficiary of tokens after they are released
    address internal _beneficiary;

    // Durations and timestamps are expressed in UNIX time, the same units as block.timestamp.
    uint256 internal _cliff;
    uint256 internal _start;
    uint256 internal _duration;
    
    uint256 internal _cliffDuration;

    mapping (address => uint256) internal _released;

    /**
     * @dev Creates a vesting contract that vests its balance of any ERC20 token to the
     * beneficiary, gradually in a linear fashion until start + duration. By then all
     * of the balance will have vested.
     * @param beneficiary_ address of the beneficiary to whom vested tokens are transferred
     * @param cliffDuration_ duration in seconds of the cliff in which tokens will begin to vest
     * @param start_ the time (as Unix time) at which point vesting starts
     * @param duration_ duration in seconds of the period in which the tokens will vest
     */
    constructor(address beneficiary_, uint256 start_, uint256 cliffDuration_, uint256 duration_) {
        
        require(beneficiary_ != address(0), "TokenVesting: beneficiary_ is the zero address");
        // solhint-disable-next-line max-line-length
        require(cliffDuration_ <= duration_, "TokenVesting: cliff is longer than duration");
        require(duration_ > 0, "TokenVesting: duration_ is 0");
        // solhint-disable-next-line max-line-length
        require(start_ + duration_ > block.timestamp, "TokenVesting: final time is before current time");

        _beneficiary = beneficiary_;
        _duration = duration_;
        _cliff = start_ + cliffDuration_;
        _start = start_;
        
        _cliffDuration = cliffDuration_;
    }

    /**
     * @return the beneficiary of the tokens.
     */
    function beneficiary() public view returns (address) {
        return _beneficiary;
    }

    /**
     * @return the cliff time of the token vesting.
     */
    function cliff() public view returns (uint256) {
        return _cliff;
    }

    /**
     * @return the start time of the token vesting.
     */
    function start() public view returns (uint256) {
        return _start;
    }

    /**
     * @return the duration of the token vesting.
     */
    function duration() public view returns (uint256) {
        return _duration;
    }

    /**
     * @return the amount of the token released.
     */
    function released(address token) public view returns (uint256) {
        return _released[token];
    }

    /**
     * @notice Transfers vested tokens to beneficiary.
     * @param token ERC20 token which is being vested
     */
    function release(IERC20 token) public onlyOwner {
        uint256 unreleased = _vestedAmount(token) - _released[address(token)];

        require(unreleased > 0, "TokenVesting: no tokens are due");

        _released[address(token)] = _released[address(token)] + unreleased;

        token.safeTransfer(_beneficiary, unreleased);

        emit TokensReleased(address(token), unreleased);
    }

    /**
     * @dev Calculates the amount that has already vested.
     * @param token ERC20 token which is being vested
     */
    function _vestedAmount(IERC20 token) internal view returns (uint256) {
        uint256 currentBalance = token.balanceOf(address(this));
        uint256 totalBalance = currentBalance + _released[address(token)];

        if (block.timestamp < _cliff) {
            return 0;
        } else if (block.timestamp >= _start + _duration) {
            return totalBalance;
        } else {
            return totalBalance * ((block.timestamp - _start) / _cliffDuration * _cliffDuration) / _duration;
        }
    }
}
