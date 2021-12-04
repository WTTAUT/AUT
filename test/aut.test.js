const Aut = artifacts.require("aut");
const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { ZERO_ADDRESS } = require('@openzeppelin/test-helpers/src/constants');
const { assert, expect } = require("chai");

// before run the test, you should change AUT constructor Vestalbe’s param cliffDuration to 30 duration to 300, 
// change AUT constructor Mineable's param halveBlock to 100, minePerBlock to 40400000 * 10^18
contract("AUT test", ([other, admin, coinbase, direct1, direct2, beneficiary]) => {
    const cliffDuration = 30
    const duration = 300
    const halveBlock = 100
    const rateMap = {
        direct1: 9,
        direct2: 1,
        beneficiary: 10,
        mineCap: 80
    }

    function contractInit()  {
        return Aut.new(coinbase, direct1, direct2, beneficiary, {from: admin})
    }

    before(async () => {
        this.aut = await contractInit()
        this.decimals = await this.aut.decimals()
        this.cap = await this.aut.cap()

        this.adminRole = await this.aut.DEFAULT_ADMIN_ROLE()
        this.operatorRole = await this.aut.OPERATOR_ROLE()
        this.minerRole = await this.aut.MINER_ROLE()
        this.releaserRole = await this.aut.RELEASER_ROLE()

        assert.equal((await this.aut.minePerBlock()).toString(10), "40400000000000000000000000", 
        "before run the test, you should change AUT constructor Vestalbe’s param cliffDuration to 30 duration to 300, change AUT constructor Mineable's param halveBlock to 100, minePerBlock to 40400000 * 10^18")
    })

    describe("init AUT, check balance and role", async () => {
        it("direct1 init balance", async () => {
            expect(await this.aut.balanceOf(direct1)).to.be.bignumber.equal(new BN(this.cap).mul(new BN(rateMap.direct1)).div(new BN(100)))
        })
        it("direct2 init balance", async () => {
            expect(await this.aut.balanceOf(direct2)).to.be.bignumber.equal(new BN(this.cap).mul(new BN(rateMap.direct2)).div(new BN(100)))
        })
        it("beneficiary token vesting contract balance", async () => {
            expect(await this.aut.balanceOf(await this.aut.tokenVestingAddress(beneficiary))).to.be.bignumber.equal(new BN(this.cap).mul(new BN(rateMap.beneficiary)).div(new BN(100)))
        })

        it("admin address has admin role", async () => {
            expect(await this.aut.hasRole(this.adminRole, admin)).to.true
        })
        it("operator address has operator role", async () => {
            expect(await this.aut.hasRole(this.operatorRole, coinbase)).to.true
        })
        it("miner address has miner role", async () => {
            expect(await this.aut.hasRole(this.minerRole, coinbase)).to.true
        })
    })


    describe("approve/decreaseAllowance/increaseAllowance/allowance", async () => {
        it("approve/allowance", async () => {
            await this.aut.approve(other, 100, {from: direct1})
            assert.equal(await this.aut.allowance(direct1, other), 100)
        })
        it("increaseAllowance", async () => {
            await this.aut.increaseAllowance(other, 100, {from: direct1})
            assert.equal(await this.aut.allowance(direct1, other), 200)
        })
        it("decreaseAllowance", async () => {
            await this.aut.decreaseAllowance(other, 100, {from: direct1})
            assert.equal(await this.aut.allowance(direct1, other), 100)
        })
    })

    describe("pause/unpause", async () => {
        it("other address can not call pause ", async () => {
            await expectRevert(this.aut.pause(), "AccessControl: account")
        })

        it("admin address can call pause", async () => {
            expectEvent(await this.aut.pause({from: admin}), "Paused", {account: admin})
            expect(await this.aut.paused()).to.true
        })
        it("can not repeat pause", async () => {
            await expectRevert(this.aut.pause({from: admin}), "Pausable: paused")
        })
        it("when paused, can not transfer", async () => {
            await expectRevert(this.aut.transfer(admin, 100), "ERC20Pausable: token transfer while paused.")
        })

        // ---- unpause
        it("other address can not call unpause", async () => {
            await expectRevert(this.aut.unpause(), "AccessControl: account")
        })
        it("admin address can call unpause", async () => {
            expectEvent(await this.aut.unpause({from: admin}), "Unpaused", {account: admin})
            expect(await this.aut.paused()).to.false
        })
        it("can not repeat unpause", async () => {
            await expectRevert(this.aut.unpause({from: admin}), "Pausable: not paused")
        })
        it("when not paused, can transfer", async () => {
            expectEvent(await this.aut.transfer(other, 100, {from: direct1}), "Transfer", {from: direct1, to: other})
        })
    })

    describe("transfer", async () => {

        it("burn 1% ", async () => {
            expectEvent(await this.aut.transfer(coinbase, new BN(100), {from: direct1}), "Transfer", {from: direct1, to: ZERO_ADDRESS, value: new BN(1)})
            assert.equal(await this.aut.balanceOf(coinbase), 99)
        })
        it("operator role do not burn", async () => {
            expectEvent(await this.aut.transfer(other, new BN(99), {from: coinbase}), "Transfer", {from: coinbase, to: other, value: new BN(99)})
        })
        it("transfer value can not > balance", async () => {
            await expectRevert(this.aut.transfer(coinbase, new BN(await this.aut.balanceOf(direct1)).add(new BN(1)), {from: direct1}), "transfer amount exceeds balance")
        })
        it("recipient address can not be 0x0", async () => {
            await expectRevert(this.aut.transfer(ZERO_ADDRESS, new BN(100), {from: direct1}), "transfer to the zero address")
        })
        it("transfer value can be 0", async () => {
            expectEvent(await this.aut.transfer(coinbase, new BN(0), {from: other}), "Transfer", {from: other, to: coinbase, value: new BN(0)})
        })
    })

    describe("transferFrom", async () => {
        before(async () => {
            this.aut = await contractInit()
        })

        it("burn 1% ", async () => {
            await this.aut.approve(direct2, new BN(100), {from: direct1})
            expectEvent(await this.aut.transferFrom(direct1, coinbase, new BN(100), {from: direct2}), "Transfer", {from: direct1, to: ZERO_ADDRESS, value: new BN(1)})
            assert.equal(await this.aut.balanceOf(coinbase), 99)
            assert.equal(await this.aut.allowance(direct1, direct2), 0, "allowance error");
        })
        it("sender is operator role do not burn", async () => {
            await this.aut.approve(direct2, new BN(99), {from: coinbase})
            expectEvent(await this.aut.transferFrom(coinbase, other, new BN(99), {from: direct2}), "Transfer", {from: coinbase, to: other, value: new BN(99)})
        })
        it("transfer value can not > allowance", async () => {
            transferAmount = new BN(await this.aut.balanceOf(direct1))
            await this.aut.approve(direct2, transferAmount.sub(new BN(1)), {from: direct1})
            await expectRevert(this.aut.transferFrom(direct1, coinbase, transferAmount, {from: direct2}), "transfer amount exceeds allowance")
        })
        it("transfer value can not > balance", async () => {
            transferAmount = new BN(await this.aut.balanceOf(direct1)).add(new BN(1))
            await this.aut.approve(direct2, transferAmount, {from: direct1})
            await expectRevert(this.aut.transferFrom(direct1, coinbase, transferAmount, {from: direct2}), "transfer amount exceeds balance")
        })
        it("recipient address can not be 0x0", async () => {
            // 公用上个测试的 approve
            await expectRevert(this.aut.transferFrom(direct1, ZERO_ADDRESS, new BN(100), {from: direct2}), "transfer to the zero address")
        })
        it("transfer value can be 0", async () => {
            expectEvent(await this.aut.transferFrom(other, coinbase, new BN(0), {from: direct2}), "Transfer", {from: other, to: coinbase, value: new BN(0)})
        })
    })

    describe("burn/burnFrom/totalBurnt", async () => {
        beforeEach(async () => {
            this.aut = await contractInit()
        })

        it("burn", async () => {
            expectEvent(await this.aut.burn(new BN(100), {from: direct1}), "Transfer", {from: direct1, to: ZERO_ADDRESS, value: new BN(100)})
        })
        it("burnFrom", async () => {
            await this.aut.approve(direct2, new BN(100), {from: direct1})
            expectEvent(await this.aut.burnFrom(direct1, new BN(100), {from: direct2}), "Transfer", {from: direct1, to: ZERO_ADDRESS, value: new BN(100)})
            assert.equal(await this.aut.allowance(direct1, direct2), 0, "allowance error");
        })
        it("burn or burnFrom amount should not > balance", async () => {
            burnAmount = new BN(await this.aut.balanceOf(direct1)).add(new BN(1))
            await this.aut.approve(direct2, burnAmount, {from: direct1})

            await expectRevert(this.aut.burn(burnAmount, {from: direct1}), "ERC20: burn amount exceeds balance")
            await expectRevert(this.aut.burnFrom(direct1, burnAmount, {from: direct2}), "ERC20: burn amount exceeds balance")
        })
        it("totalBurnt after burn,burnFrom,transfer,transferFrom", async () => {
            amount = new BN(100)
            await this.aut.approve(direct2, new BN(200), {from: direct1})

            // // direct1 burn and burnFrom 100
            expectEvent(await this.aut.burn(new BN(100), {from: direct1}), "Transfer", {from: direct1, to: ZERO_ADDRESS, value: new BN(100)})
            expectEvent(await this.aut.burnFrom(direct1, new BN(100), {from: direct2}), "Transfer", {from: direct1, to: ZERO_ADDRESS, value: new BN(100)})

            // direct1 transfer and transferFrom 100
            expectEvent(await this.aut.transfer(coinbase, new BN(100), {from: direct1}), "Transfer", {from: direct1, to: ZERO_ADDRESS, value: new BN(1)})
            expectEvent(await this.aut.transferFrom(direct1, coinbase, new BN(100), {from: direct2}), "Transfer", {from: direct1, to: ZERO_ADDRESS, value: new BN(1)})

            // 100 + 100 + 1 + 1 = 202
            expect(await this.aut.totalBurnt()).to.be.bignumber.equal(new BN(202));
        })

    })

    describe("role based access control", async () => {
        it("getRoleAdmin", async () => {
            expect(await this.aut.getRoleAdmin(this.minerRole)).to.equal(this.adminRole);
            expect(await this.aut.getRoleAdmin(this.operatorRole)).to.equal(this.adminRole);
            expect(await this.aut.getRoleAdmin(this.releaserRole)).to.equal(this.adminRole);
            expect(await this.aut.getRoleAdmin(this.adminRole)).to.equal(this.adminRole);
        })
        it("getRoleMember", async () => {
            expect(await this.aut.getRoleMember(this.adminRole, 0)).to.equal(admin);
            expect(await this.aut.getRoleMember(this.minerRole, 0)).to.equal(coinbase);
            expect(await this.aut.getRoleMember(this.operatorRole, 0)).to.equal(coinbase);
            await expectRevert(this.aut.getRoleMember(this.releaserRole, 0), "processing transaction")
        })
        it("getRoleMemberCount", async () => {
            expect(await this.aut.getRoleMemberCount(this.adminRole)).to.be.bignumber.equal(new BN(1));
            expect(await this.aut.getRoleMemberCount(this.operatorRole)).to.be.bignumber.equal(new BN(1));
            expect(await this.aut.getRoleMemberCount(this.releaserRole)).to.be.bignumber.equal(new BN(0));
            expect(await this.aut.getRoleMemberCount(this.minerRole)).to.be.bignumber.equal(new BN(1));
        })
        it("hasRole", async () => {
            expect(await this.aut.hasRole(this.adminRole, admin)).to.be.true;
            expect(await this.aut.hasRole(this.operatorRole, coinbase)).to.be.true;
            expect(await this.aut.hasRole(this.minerRole, coinbase)).to.be.true;
            expect(await this.aut.hasRole(this.releaserRole, coinbase)).to.be.false;
        })
        it("grantRole", async () => {
            // other address is not admin role, can not call grantRole
            expect(await this.aut.hasRole(this.adminRole, other)).to.be.false;

            await expectRevert(this.aut.grantRole(this.adminRole, direct1, {from: other}), "is missing role ")
            expectEvent(await this.aut.grantRole(this.adminRole, other, {from: admin}), "RoleGranted", {role: this.adminRole, account: other, sender: admin})

            // admin grant other address admin role, other address can call grantRole
            expect(await this.aut.hasRole(this.adminRole, other)).to.be.true;
            expect(await this.aut.getRoleMember(this.adminRole, 1)).to.equal(other);

            expectEvent(await this.aut.grantRole(this.adminRole, direct1, {from: other}), "RoleGranted", {role: this.adminRole, account: direct1, sender: other})
            expect(await this.aut.getRoleMemberCount(this.adminRole)).to.be.bignumber.equal(new BN(3));

        })
        it("revokeRole", async () => {
            expect(await this.aut.hasRole(this.adminRole, direct1)).to.be.true;

            expectEvent(await this.aut.revokeRole(this.adminRole, direct1, {from: other}), "RoleRevoked", {role: this.adminRole, account: direct1, sender: other})

            expect(await this.aut.hasRole(this.adminRole, direct1)).to.be.false;

            await expectRevert(this.aut.grantRole(this.adminRole, other, {from: direct1}), "is missing role ")
        })
        it("renounceRole", async () => {
            await expectRevert(this.aut.renounceRole(this.adminRole, direct1, {from: admin}), "can only renounce roles for self ")
            await expectRevert(this.aut.renounceRole(this.adminRole, other, {from: admin}), "can only renounce roles for self ")
            expectEvent(await this.aut.renounceRole(this.adminRole, admin, {from: admin}), "RoleRevoked", {role: this.adminRole, account: admin, sender: admin})

            expect(await this.aut.getRoleMember(this.adminRole, 0)).to.equal(other);
            expect(await this.aut.getRoleMemberCount(this.adminRole)).to.be.bignumber.equal(new BN(1));
        })
    })

    describe("transferOwnership", async () => {
        before(async () => {
            this.aut = await contractInit()
        })
        it("can not call transferOwnership except by admin", async () => {
            await expectRevert(this.aut.transferOwnership(direct1, {from: other}), "is missing role 0x00000")
        })
        it("new owner address can not be 0x0", async () => {
            await expectRevert(this.aut.transferOwnership(ZERO_ADDRESS, {from: admin}), "AUT: new owner is the zero address.")
        })
        it("admin can call transferOwnership", async () => {
            expect(await this.aut.getRoleMemberCount(this.adminRole)).to.be.bignumber.equal(new BN(1));
            expect(await this.aut.getRoleMember(this.adminRole, 0)).to.equal(admin);

            expectEvent(await this.aut.transferOwnership(other, {from: admin}), "RoleGranted", {role: this.adminRole, account: other, sender: admin})

            expect(await this.aut.getRoleMemberCount(this.adminRole)).to.be.bignumber.equal(new BN(1));
            expect(await this.aut.getRoleMember(this.adminRole, 0)).to.equal(other);
        })
        it("new owner address can not be admin role", async () => {
            expectEvent(await this.aut.grantRole(this.adminRole, admin, {from: other}), "RoleGranted", {role: this.adminRole, account: admin, sender: other})
            expect(await this.aut.getRoleMemberCount(this.adminRole)).to.be.bignumber.equal(new BN(2));

            await expectRevert(this.aut.transferOwnership(other, {from: admin}), "AUT: new owner should not be admin")
        })
    })

    describe("about mine", async () => {
        before(async () => {
            this.aut = await contractInit()
        })
        it("query coinbase", async () => {
            expect(await this.aut.coinbase()).to.equal(coinbase)
        })
        it("can not mine except by mine role", async () => {
            await expectRevert(this.aut.mine({from: admin}), "is missing role")
        })
        it("can not mine when paused is true", async () => {
            expectEvent(await this.aut.pause({from: admin}), "Paused", {account: admin})
            await expectRevert(this.aut.mine({from: coinbase}), "token transfer while paused.")

            // recover paused to false
            expectEvent(await this.aut.unpause({from: admin}), "Unpaused", {account: admin})
        })
        it("miner role mine in halve period and lastMineBlock/totalMined function", async () => {
            lastMineBlock = new BN(await this.aut.lastMineBlock())

            // advance 10 block
            await time.advanceBlockTo(lastMineBlock.add(new BN(10)))
            minePerBlock = await this.aut.minePerBlock()
            
            receipt = await this.aut.mine({from: coinbase})
            currentMineBlock = new BN(await this.aut.lastMineBlock())
            mineAmount = minePerBlock.mul(currentMineBlock.sub(lastMineBlock))
            expectEvent(receipt, "MineToCoinbase", 
                {coinbase: await this.aut.coinbase(), amount: mineAmount}
            )

            // check lastMineBlock
            expect(currentMineBlock).to.be.bignumber.equal(new BN(receipt.receipt.blockNumber))
            // check totalMined
            expect(await this.aut.totalMined()).to.be.bignumber.equal(mineAmount)
        })
        it("miner role mine out halve period and nextHalveBlock function", async () => {
            // when current block after current halve block, just mine at current halve block
            lastMineBlock = new BN(await this.aut.lastMineBlock())
            nextHalveBlock = new BN(await this.aut.nextHalveBlock())
            // advance to nextHalveBlock + 10 block
            await time.advanceBlockTo(nextHalveBlock.add(new BN(10)))
            minePerBlock = await this.aut.minePerBlock()

            receipt = await this.aut.mine({from: coinbase})
            
            // check mine out halve period
            expectEvent(receipt, "MineToCoinbase", 
                {coinbase: await this.aut.coinbase(), amount: minePerBlock.mul(nextHalveBlock.sub(lastMineBlock))}
            )

            lastMineBlockAfterMine = new BN(await this.aut.lastMineBlock())
            nextHalveBlockAfterMine = new BN(await this.aut.nextHalveBlock())
            minePerBlockAfterMine = await this.aut.minePerBlock()

            // check function lastMineBlock, nextHalveBlock, minePerBlock after halve
            expect(lastMineBlockAfterMine).to.be.bignumber.equal(nextHalveBlock)
            expect(nextHalveBlockAfterMine).to.be.bignumber.equal(nextHalveBlock.add(new BN(halveBlock)))
            expect(minePerBlockAfterMine).to.be.bignumber.equal(minePerBlock.div(new BN(2)))     
        })
        it("miner role mine last block and cap exceeded", async () => {
            mineCap = new BN(this.cap).mul(new BN(rateMap.mineCap)).div(new BN(100))

            do {
                await time.advanceBlockTo(new BN(10).add(await this.aut.nextHalveBlock()))
                totalMinedBefore = await this.aut.totalMined()
                receipt = await this.aut.mine({from: coinbase})
                // console.log(`----> ${totalMinedBefore} ===> ${await this.aut.totalMined()}`)
            } while (mineCap.gt(await this.aut.totalMined()))

            expectEvent(receipt, "MineToCoinbase", 
                {coinbase: await this.aut.coinbase(), amount: mineCap.sub(totalMinedBefore)}
            )

            await expectRevert(this.aut.mine({from: coinbase}), "Mineable: mine cap exceeded")
        })
        it("can not change coinbase except by admin", async () => {
            await expectRevert(this.aut.changeCoinbase(other, {from: coinbase}), "is missing role 0x00000")
        })
        it("admin can not change coinbase to same", async () => {
            await expectRevert(this.aut.changeCoinbase(coinbase, {from: admin}), "coinbase cannot change to the same")
        })
        it("admin can not change coinbase to 0x0", async () => {
            await expectRevert(this.aut.changeCoinbase(ZERO_ADDRESS, {from: admin}), "coinbase cannot be the zero address")
        })
        it("admin change coinbase", async () => {
            expectEvent(await this.aut.changeCoinbase(other, {from: admin}), "CoinbaseChanged", {previousCoinbase: coinbase, newCoinbase: other})
            expect(await this.aut.coinbase()).to.equal(other);

            expect(await this.aut.hasRole(this.minerRole, coinbase)).to.be.false;
            expect(await this.aut.hasRole(this.operatorRole, coinbase)).to.be.false;
            expect(await this.aut.hasRole(this.minerRole, other)).to.be.true;
            expect(await this.aut.hasRole(this.operatorRole, other)).to.be.true;
        })
    })

    describe("about release", async () => {
        // !!! warnning: Now there is only one beneficiary address. if there are more than one, 
        // need to test "beneficiary address call, release param address is not yourself".
        before(async () => {
            this.aut = await contractInit()
        })
        it("only beneficiary and releaser role can call release", async () => {
            tokenVestingAddress = await this.aut.tokenVestingAddress(beneficiary)

            // admin can not call release but releaser role can 
            await expectRevert(this.aut.release(beneficiary, {from: admin}), 
                "You're not RELEASER_ROLE. You can only release yourself.")
            expectEvent(await this.aut.grantRole(this.releaserRole, admin, {from: admin}), 
            "RoleGranted", {role: this.releaserRole, account: admin, sender: admin})

            time.increase(time.duration.seconds(cliffDuration))
            expectEvent(await this.aut.release(beneficiary, {from: admin}), 
            "Transfer", {from: tokenVestingAddress, to: beneficiary})

            // beneficiary can call release
            time.increase(time.duration.seconds(cliffDuration))
            expectEvent(await this.aut.release(beneficiary, {from: beneficiary}), 
            "Transfer", {from: tokenVestingAddress, to: beneficiary})

        })
        it("release/lockBeneficiary/unlockBeneficiary param should be beneficiary", async () => {
            await expectRevert(this.aut.release(admin, {from: admin}), "_address not the beneficiary.")
            await expectRevert(this.aut.lockBeneficiary(admin, {from: admin}), "_address not the beneficiary.")
            await expectRevert(this.aut.unlockBeneficiary(admin, {from: admin}), "_address not the beneficiary.")
        })
        it("release amount is correct and can not repeated call", async () => {
            cliffDurationAmount = new BN(this.cap).mul(new BN(rateMap.beneficiary)).div(new BN(100)).mul(new BN(cliffDuration)).div(new BN(duration))
            time.increase(time.duration.seconds(cliffDuration))
            expectEvent(await this.aut.release(beneficiary, {from: beneficiary}), 
            "Transfer", {from: await this.aut.tokenVestingAddress(beneficiary), to: beneficiary, value: cliffDurationAmount})
            // can not call repeated
            await expectRevert(this.aut.release(beneficiary, {from: beneficiary}), "TokenVesting: no tokens are due")
        })
        it("only admin role can call lockBeneficiary/unlockBeneficiary and can not repeated call", async () => {
            // can not call lockBeneficiary/unlockBeneficiary except admin role
            await expectRevert(this.aut.lockBeneficiary(beneficiary, {from: beneficiary}), "is missing role 0x00000")
            await expectRevert(this.aut.unlockBeneficiary(beneficiary, {from: beneficiary}), "is missing role 0x00000")

            // admin can call lockBeneficiary/unlockBeneficiary
            expect(await this.aut.isLock(beneficiary)).to.be.false
            expectEvent(await this.aut.lockBeneficiary(beneficiary, {from: admin}), "LockBeneficiary", {beneficiary: beneficiary})
            expect(await this.aut.isLock(beneficiary)).to.be.true
            await expectRevert(this.aut.lockBeneficiary(beneficiary, {from: admin}), "beneficiary _address was locked.")

            expectEvent(await this.aut.unlockBeneficiary(beneficiary, {from: admin}), "UnlockBeneficiary", {beneficiary: beneficiary})
            expect(await this.aut.isLock(beneficiary)).to.be.false
            await expectRevert(this.aut.unlockBeneficiary(beneficiary, {from: admin}), "beneficiary _address was unlocked.")
        })
        it("can not release when beneficiary was locked", async () => {
            expectEvent(await this.aut.lockBeneficiary(beneficiary, {from: admin}), "LockBeneficiary", {beneficiary: beneficiary})
            expect(await this.aut.isLock(beneficiary)).to.be.true

            await expectRevert(this.aut.release(beneficiary, {from: beneficiary}), "beneficiary _address was locked.")

            // recover
            expectEvent(await this.aut.unlockBeneficiary(beneficiary, {from: admin}), "UnlockBeneficiary", {beneficiary: beneficiary})
        })
        it("all have been released, can not call release", async () => {
            tokenVestingAddress = await this.aut.tokenVestingAddress(beneficiary)

            // release all
            time.increase(time.duration.seconds(duration))
            expectEvent(await this.aut.release(beneficiary, {from: beneficiary}), 
            "Transfer", {from: tokenVestingAddress, to: beneficiary})
         
            expect(await this.aut.balanceOf(tokenVestingAddress)).to.be.bignumber.equal(new BN(0))

            await expectRevert(this.aut.release(beneficiary, {from: beneficiary}), "TokenVesting: no tokens are due")
        })
    })
})