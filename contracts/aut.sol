// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "./ERC20TotalBurnable.sol";
import "./Mineable.sol";
import "./Vestable.sol";

contract AUT is ERC20, ERC20TotalBurnable, ERC20Capped, ERC20Pausable, Vestable, Mineable {

    event MineToCoinbase(address coinbase, uint256 amount);

    uint256 private _totalSupply = 1e10 * (10 ** uint256(decimals()));

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /**
    * - `coinbase_`:      80%  miner address
    * - `direct1_`:        9%  direct transfer address 1
    * - `direct2_`:        1%  direct transfer address 2
    * - `beneficiary_`:   10%  period token vesting address
    */
    constructor(address coinbase_, address direct1_, address direct2_, address beneficiary_)
    ERC20("AU_TOKEN", "AUT") ERC20Capped(_totalSupply)
    Vestable(259200, 259200000, beneficiary_)
    Mineable(75 * (10 ** uint256(decimals())), 12614400, coinbase_, _totalSupply * 80 / 100) {

        _mint(direct1_, _totalSupply * 9 / 100);
        _mint(direct2_, _totalSupply * 1 / 100);
        _mint(address(periodTokenVestingMap[beneficiary_].periodTokenVesting), _totalSupply * 10 / 100);

        // Grant the contract deployer the default admin role: it will be able
        // to grant and revoke any roles
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(OPERATOR_ROLE, coinbase_);
    }

    function changeCoinbase(address _address) public override{
        revokeRole(OPERATOR_ROLE, coinbase());
        super.changeCoinbase(_address);
        _setupRole(OPERATOR_ROLE, coinbase());
    }

    /**
     * @notice mine to coinbase
     */
    function mine() public override returns (uint256) {
        uint256 mineNum = super.mine();
        emit MineToCoinbase(coinbase(), mineNum);
        _mint(coinbase(), mineNum);
        return mineNum;
    }

    /**
     * only RELEASER_ROLE or beneficiary can call release
     *
     * @notice Transfers vested tokens to _address.
     * @param _address which _address will be released
     */
    function release(address _address) public {
        release(_address, this);
    }

    /**
     * burn 1% of amount
     * @dev See {IERC20-transfer}.
     *
     * Requirements:
     *
     * - `recipient` cannot be the zero address.
     * - the caller must have a balance of at least `amount`.
     */
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        uint256 transferAmount = amount;
        address sender = _msgSender();
        if (!hasRole(OPERATOR_ROLE, sender) && !isPeriodTokenVesting[sender]) {
            uint256 burnedAmount = amount * 1 / 100;
            burn(burnedAmount);
            transferAmount = amount - burnedAmount;
        }

        return super.transfer(recipient, transferAmount);
    }

    /**
     * burn 1% of amount
     * @dev See {IERC20-transferFrom}.
     *
     * Emits an {Approval} event indicating the updated allowance. This is not
     * required by the EIP. See the note at the beginning of {ERC20}.
     *
     * Requirements:
     *
     * - `sender` and `recipient` cannot be the zero address.
     * - `sender` must have a balance of at least `amount`.
     * - the caller must have allowance for ``sender``'s tokens of at least
     * `amount`.
     */

    function transferFrom(address sender, address recipient, uint256 amount ) public virtual override returns (bool) {
        uint256 transferAmount = amount;
        if (!hasRole(OPERATOR_ROLE, sender)) {
            uint256 burnedAmount = amount * 1 / 100;
            burnFrom(sender, burnedAmount);
            transferAmount = amount - burnedAmount;
        }

        return super.transferFrom(sender, recipient, transferAmount);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newOwner != address(0), "AUT: new owner is the zero address");
        require(!hasRole(DEFAULT_ADMIN_ROLE, newOwner), "AUT: new owner should not be admin");
        _setupRole(DEFAULT_ADMIN_ROLE, newOwner);
        renounceRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

     /**
     * @dev Triggers stopped state in case of the emergency.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function pause() public whenNotPaused onlyRole(DEFAULT_ADMIN_ROLE) {
        super._pause();
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function unpause() public whenPaused onlyRole(DEFAULT_ADMIN_ROLE) {
        super._unpause();
    }

    // The functions below are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal override(ERC20, ERC20Capped) {
        super._mint(account, amount);
    }

}
