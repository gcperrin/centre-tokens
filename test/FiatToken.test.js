var FiatToken = artifacts.require('FiatToken');
var name = 'Sample Fiat Token';
var symbol = 'C-USD';
var currency = 'USD';
var decimals = 2;
var fee = 25;
var feeBase = 1000;

contract('FiatToken', function (accounts) {
  let token;
  let feeAccount = accounts[8];

  calculateFeeAmount = function(amount) {
    return Math.floor((fee / feeBase) * amount);
  }

  checkTransferEvents = function(transfer, from, to, value, feeAmount) {
    assert.equal(transfer.logs[0].event, 'Fee');
    assert.equal(transfer.logs[0].args.from, from);
    assert.equal(transfer.logs[0].args.feeAccount, feeAccount);
    assert.equal(transfer.logs[0].args.feeAmount, feeAmount);
    assert.equal(transfer.logs[1].event, 'Transfer');
    assert.equal(transfer.logs[1].args.from, from);
    assert.equal(transfer.logs[1].args.to, to);
    assert.equal(transfer.logs[1].args.value, value);
  }

  beforeEach(async function () {
    token = await FiatToken.new(name, symbol, currency, decimals, fee, feeBase, feeAccount);
  });

  it('should start with a totalSupply of 0', async function () {
    let totalSupply = await token.totalSupply();

    assert.equal(totalSupply, 0);
  });

  it('should return mintingFinished false after construction', async function () {
    let mintingFinished = await token.mintingFinished();

    assert.equal(mintingFinished, false);
  });

  it('should mint a given amount of tokens to a given address', async function () {
    const result = await token.mint(accounts[0], 100);
    assert.equal(result.logs[0].event, 'Mint');
    assert.equal(result.logs[0].args.to.valueOf(), accounts[0]);
    assert.equal(result.logs[0].args.amount.valueOf(), 100);
    assert.equal(result.logs[1].event, 'Transfer');
    assert.equal(result.logs[1].args.from.valueOf(), 0x0);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 100);

    let totalSupply = await token.totalSupply();
    assert.equal(totalSupply, 100);
  });

  it('should add mutliple mints to a given address in address balance', async function () {
    await token.mint(accounts[0], 100);
    await token.mint(accounts[0], 200);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 300);

  });


  it('should add mutliple mints to total supply', async function () {
    await token.mint(accounts[0], 100);
    await token.mint(accounts[0], 400);
    await token.mint(accounts[1], 600);

    let totalSupply = await token.totalSupply();
    assert.equal(totalSupply, 1100);
  });

  it('should fail to mint from a non-owner call', async function () {
     token.mint(accounts[0], 400);
     try {
      await token.mint(accounts[0], 100, {from: accounts[1]});
      assert.fail();
    } catch (e) {

    } finally {
      let balance0 = await token.balanceOf(accounts[0]);
      assert.equal(balance0, 400);
    }
  });

  it('should fail to mint after call to finishMinting', async function () {
    await token.finishMinting();
    assert.equal(await token.mintingFinished(), true);
    try {
      await (token.mint(accounts[0], 100));
      assert.fail("Minting not stopped");
    } catch (e) {}

  });

  it('should set fees and complete transferFrom with fees', async function() {
    fee = 12;
    feeBase = 100;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await token.mint(accounts[0], 900);
    await token.approve(accounts[3], 634);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 634);

    transfer = await token.transferFrom(accounts[0], accounts[3], 534, {from: accounts[3]});

    let feeAmount = calculateFeeAmount(534);
    checkTransferEvents(transfer, accounts[0], accounts[3], 534, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 900 - 534 - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 534);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);

  });

  it('should set long-decimal fees and complete transferFrom with fees', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await token.mint(accounts[0], 900);
    await token.approve(accounts[3], 634);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 634);

    transfer = await token.transferFrom(accounts[0], accounts[3], 534, {from: accounts[3]});

    let feeAmount = calculateFeeAmount(534);
    checkTransferEvents(transfer, accounts[0], accounts[3], 534, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 900 - 534 - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 534);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);
  });

  it('should set fees and and fail to complete transferFrom with insufficient balance to cover fees', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await token.mint(accounts[0], 900);
    await token.approve(accounts[3], 895);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 895);
    try {
        transfer = await token.transferFrom(accounts[0], accounts[3], 895, {from: accounts[3]});
        assert.fail()
      } catch(e) {

      } finally {
        let balance0 = await token.balanceOf(accounts[0]);
        assert.equal(balance0, 900);
        let balance3 = await token.balanceOf(accounts[3]);
        assert.equal(balance3, 0);
        let balanceFeeAccount = await token.balanceOf(feeAccount);
        assert.equal(balanceFeeAccount, 0);
      }
  });

  it('should set long-decimal fees and complete transfer with fees', async function() {
    fee = 123589;
    feeBase = 1000000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await token.mint(accounts[0], 1900);
    await token.approve(accounts[3], 1500);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 1500);

    let transfer = await token.transfer(accounts[3], 1000, {from: accounts[0]});

    let feeAmount = calculateFeeAmount(1000);
    checkTransferEvents(transfer, accounts[0], accounts[3], 1000, feeAmount);


    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 1900 - 1000 - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 1000);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);
  });

  it('should set long-decimal fees and complete transfer with fees from non-owner', async function() {
    fee = 123589;
    feeBase = 1000000;
    await token.updateTransferFee(fee, feeBase);
    await token.mint(accounts[2], 1900);

    let transfer = await token.transfer(accounts[3], 1000, {from: accounts[2]});

    let feeAmount = calculateFeeAmount(1000);
    checkTransferEvents(transfer, accounts[2], accounts[3], 1000, feeAmount);

    let balance0 = await token.balanceOf(accounts[2]);
    assert.equal(balance0, 1900 - 1000 - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 1000);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);
  });

  it('should set allowance and balances before and after approved transfer', async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await token.mint(accounts[0], 500);
    await token.approve(accounts[3], 100);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 100);

    let transfer = await token.transferFrom(accounts[0], accounts[3], 50, {from: accounts[3]});

    let feeAmount = calculateFeeAmount(50);
    checkTransferEvents(transfer, accounts[0], accounts[3], 50, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 450 - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, 50);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);
  });

  it('should fail on unauthorized approved transfer and not change balances', async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await token.mint(accounts[0], 500);
    await token.approve(accounts[3], 100);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 100);

    try {
      await token.transferFrom(accounts[0], accounts[3], 50, {from: accounts[4]});
      assert.fail()
    } catch(e) {

    } finally {
      let balance0 = await token.balanceOf(accounts[0]);
      assert.equal(balance0, 500);
      let balance3 = await token.balanceOf(accounts[3]);
      assert.equal(balance3, 0);
    }
  });

  it('should fail on invalid approved transfer amount and not change balances', async function() {
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    await token.mint(accounts[0], 500);
    await token.approve(accounts[3], 100);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 100);

    try {
      await token.transferFrom(accounts[0], accounts[3], 450, {from: accounts[3]});
      assert.fail()
    } catch(e) {

    } finally {
      let balance0 = await token.balanceOf(accounts[0]);
      assert.equal(balance0, 500);
      let balance3 = await token.balanceOf(accounts[3]);
      assert.equal(balance3, 0);
    }
  });

  it('should test consistency of transfer(x) and approve(x) + transferFrom(x) with fees', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    let transferAmount = 650;
    let feeAmount = calculateFeeAmount(transferAmount);
    let totalAmount = transferAmount + feeAmount;
    await token.mint(accounts[0], totalAmount);

    let transfer = await token.transfer(accounts[3], transferAmount);
    checkTransferEvents(transfer, accounts[0], accounts[3], transferAmount, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, totalAmount - transferAmount - feeAmount);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, transferAmount);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);

    await token.allowance.call(accounts[1], accounts[4]);
    assert.equal(allowed.c[0], 0);
    await token.mint(accounts[1], totalAmount);

    await token.approve(accounts[4], transferAmount, {from: accounts[1]});
    allowed = await token.allowance.call(accounts[1], accounts[4]);
    assert.equal(allowed.c[0], transferAmount);

    transfer = await token.transferFrom(accounts[1], accounts[4], transferAmount, {from: accounts[4]});

    checkTransferEvents(transfer, accounts[1], accounts[4], transferAmount, feeAmount);

    let balance1 = await token.balanceOf(accounts[1]);
    assert.equal(balance0, totalAmount - transferAmount - feeAmount);
    let balance4 = await token.balanceOf(accounts[4]);
    assert.equal(balance3, transferAmount);
    let balanceFeeAccountNew = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccountNew.c[0], feeAmount + balanceFeeAccount.c[0]);
  });


/*Comments out approveWithFee/inreaseApprovalWithFee/decreaseApprovalWithFee tests*/
/*
  it('should set long-decimal fees, approve transfer amount with fee, and complete transferFrom with fees', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    let transferAmount = 650;
    let feeAmount = calculateFeeAmount(transferAmount);
    let totalAmount = transferAmount + feeAmount;
    await token.mint(accounts[0], totalAmount);


    await token.approveWithFee(accounts[3], transferAmount);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], totalAmount);

    transfer = await token.transferFrom(accounts[0], accounts[3], transferAmount, {from: accounts[3]});

    checkTransferEvents(transfer, accounts[0], accounts[3], transferAmount, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, transferAmount);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);
  });
*/
/*
  it('should set long-decimal fees, set approval amount with fee, complete transferFrom, increase approval with fees and complete transferFrom another with fees', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    let transferAmount = 650;
    let feeAmount = calculateFeeAmount(transferAmount);
    let totalAmount = transferAmount + feeAmount;
    await token.mint(accounts[0], totalAmount);
    console.log(totalAmount);


    await token.approveWithFee(accounts[3], transferAmount);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], totalAmount);
    transfer = await token.transferFrom(accounts[0], accounts[3], transferAmount, {from: accounts[3]});

    checkTransferEvents(transfer, accounts[0], accounts[3], transferAmount, feeAmount);

    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);
    let balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, transferAmount);
    let balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount);

    let transferAmountOld = transferAmount;
    let feeAmountOld = feeAmount;
    let totalAmountOld = totalAmount;

    transferAmount = 800;
    feeAmount = calculateFeeAmount(transferAmount);
    totalAmount = transferAmount + feeAmount;
    await token.mint(accounts[0], totalAmount);

    await token.increaseApprovalWithFee(accounts[3], transferAmount);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], totalAmount);

    transfer = await token.transferFrom(accounts[0], accounts[3], transferAmount, {from: accounts[3]});

    checkTransferEvents(transfer, accounts[0], accounts[3], transferAmount, feeAmount);

    balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);
    balance3 = await token.balanceOf(accounts[3]);
    assert.equal(balance3, transferAmount + transferAmountOld);
    balanceFeeAccount = await token.balanceOf(feeAccount);
    assert.equal(balanceFeeAccount, feeAmount + feeAmountOld);
  });
*/
/*
  it('should set approve transfer amount with fee, decrease approval amount with fee', async function() {
    fee = 1235;
    feeBase = 10000;
    await token.updateTransferFee(fee, feeBase);
    let allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
    let transferAmount = 650;

    await token.approveWithFee(accounts[3], transferAmount);
    await token.decreaseApprovalWithFee(accounts[3], transferAmount);
    allowed = await token.allowance.call(accounts[0], accounts[3]);
    assert.equal(allowed.c[0], 0);
  });
*/
  it('should have correct name', async function () {
    let actual = await token.name.call();
    assert.equal(actual, name);
  });

  it('should have correct symbol', async function () {
    let actual = await token.symbol.call();
    assert.equal(actual, symbol);
  });

  it('should have correct decimals', async function () {
    let actual = await token.decimals.call();
    assert.equal(actual, decimals);
  });

  it('should have correct currency', async function () {
    let actual = await token.currency.call();
    assert.equal(actual, currency);
  });

});