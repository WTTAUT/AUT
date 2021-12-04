// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @dev Extension of {ERC20Burnable} add totol burnt
 */
abstract contract ERC20TotalBurnable is ERC20Burnable {

    uint256 private _totalBurnt;

    /**
     * @dev Destroys `amount` tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 amount) public virtual override{
        _totalBurnt += amount;
        super.burn(amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, deducting from the caller's
     * allowance.
     *
     * See {ERC20-_burn} and {ERC20-allowance}.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `amount`.
     */
    function burnFrom(address account, uint256 amount) public virtual override{
        _totalBurnt += amount;
        super.burnFrom(account, amount);
    }


    function totalBurnt() public view virtual returns (uint256) {
        return _totalBurnt;
    }

}