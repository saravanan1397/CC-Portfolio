// Run with: node --test tests/redemption-balances.test.cjs
// Execute the application's functions in memory; never load or save live data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function app() {
  const ctx = vm.createContext({ console, Intl, Date, Math,
    state: { cards: [], rpSpends: [], pprManualPoints: [], pprPartnerTransfers: [] },
    renderDerivedCache: null, partnerProgramPlatformValue: 'Hotel/Airline Partners',
    welcomeBenefitPointsType: 'Welcome Benefit (Points)', rpRedeemedBenefitPrefix: 'rp-redeemed-',
    crypto: require('node:crypto').webcrypto,
  });
  for (const match of code.matchAll(/^(?:async )?function \w+\(/gm)) {
    let end = code.indexOf('\n}', match.index) + 2;
    let compiled;
    while (end > 1) {
      try { compiled = new vm.Script(code.slice(match.index, end)); break; }
      catch (error) {
        end = code.indexOf('\n}', end) + 2;
        if (end <= 1) throw error;
      }
    }
    compiled.runInContext(ctx);
  }
  ctx.formatPoints = v => `${v} pts`;
  ctx.formatMoney = v => `INR ${v}`;
  return ctx;
}
const card = (id = 'neu') => ({ id, name: id === 'neu' ? 'Tata Neu Infinity' : id, benefits: [] });
const credit = (cardId = 'neu', points = 1000, id = 'credit') => ({ id, cardId, points,
  unredeemedPointsRecord: true, unredeemedBalanceInitialized: true, redemptionModel: 'split-v2' });
const debit = (cardId = 'Neucoins', points = 200, id = 'debit') => ({ id, cardId, points,
  redeemedPoints: points, neucoinsSourceCardId: 'neu', pointsValue: points,
  redemptionModel: 'split-v2', createdAt: '2026-01-01' });
const transfer = (id, source, points, partner = 'Marriott') => ({ ...debit('Hotel/Airline Partners', points, id),
  originatingCardId: source, partnerName: partner, pointsValue: 0, pointsReceived: points,
  partnerTransferRatio: '1:1', partnerRedeemedPoints: 0, pprRedemptions: [] });
function fixture(rows, cards = [card()]) { const a = app(); a.state.cards = cards; a.state.rpSpends = rows; return a; }
function checkBalances(a, expected) {
  assert.equal(a.getCardUnredeemedPoints(a.state.cards[0]), expected);
  assert.equal(a.getRpPointsUsageTotals().notSpent, expected);
  const rows = a.state.rpSpends.filter(a.isUnredeemedPointsRecord);
  assert.equal(rows.reduce((sum, r) => sum + a.getRpSpendDisplayPoints(r), 0), expected);
  a.syncRpRedeemedBenefitsFromSpends();
  assert.equal(a.getCardUnredeemedPoints(a.state.cards[0]), expected);
}
test('Neucoins alias and direct card balances debit once in portfolio and RP displays', () => {
  for (const source of ['Neucoins', 'neu']) {
    const a = fixture([credit(source), debit()]);
    checkBalances(a, 800);
    a.state.rpSpends[1] = debit('Neucoins', 100);
    checkBalances(a, 900);
    a.state.rpSpends.pop();
    checkBalances(a, 1000);
  }
});
test('existing alias and card credits share one balance without duplicate display', () => {
  const a = fixture([credit('Neucoins', 400), credit('neu', 600, 'second'), debit('Neucoins', 500)]);
  checkBalances(a, 500);
  assert.equal(a.getUnredeemedSourceBalance(a.state.rpSpends[0]), 0);
  assert.equal(a.getUnredeemedSourceBalance(a.state.rpSpends[1]), 500);
});
test('chosen Neu Plus does not debit Neu Infinity', () => {
  const a = fixture([credit('Neucoins'), { ...credit('Neucoins', 500, 'pluscredit'), neucoinsSourceCardId: 'plus' },
    { ...debit(), neucoinsSourceCardId: 'plus' }], [card(), { ...card('plus'), name: 'Tata Neu Plus' }]);
  assert.equal(a.getCardUnredeemedPoints('neu'), 1000);
  assert.equal(a.getCardUnredeemedPoints('plus'), 300);
  assert.equal(a.getRpPointsUsageTotals().notSpent, 1300);
});
test('Welcome/Earned allocation and greyed cards preserve source balances', () => {
  const c = { ...card(), muted: true, benefits: [{ id: 'w', type: 'Welcome Benefit (Points)', pointsAmount: 500 }] };
  const a = fixture([credit(), { ...debit(), pointAllocationExplicit: true, welcomeRedeemedPoints: 150, earnedRedeemedPoints: 50 }], [c]);
  checkBalances(a, 1300);
  assert.equal(a.getUnredeemedSourceBalance(a.state.rpSpends[0]), 950);
  assert.equal(a.getCardPointAllocation(c).welcomeRemainingPoints, 350);
});
test('ordinary redemptions debit at zero monetary value, edits/deletes restore balance', () => {
  const a = fixture([credit(), { ...debit('neu'), pointsValue: 0 }]);
  checkBalances(a, 800);
  assert.equal(a.applyCardPointRedemption('neu', 200).currentUnredeemed, 800);
  a.state.rpSpends[1] = debit('neu', 100);
  checkBalances(a, 900);
  a.state.rpSpends.pop();
  checkBalances(a, 1000);
});
test('standalone platform remaining balance handles multiple credits', () => {
  const a = fixture([credit('Voucher', 300), credit('Voucher', 700, 'c2'), debit('Voucher', 450)], []);
  assert.equal(a.getCardUnredeemedPoints('Voucher'), 550);
  assert.equal(a.getRpPointsUsageTotals().notSpent, 550);
});
test('PPR redemption uses Card A then B then C; manual points remain separate', () => {
  const a = fixture([credit('a', 100, 'ca'), credit('b', 200, 'cb'), credit('c', 300, 'cc'),
    transfer('ta', 'a', 100), transfer('tb', 'b', 200), transfer('tc', 'c', 300)], [card('a'), card('b'), card('c')]);
  a.state.pprManualPoints = [{ id: 'm', partnerName: 'Marriott', points: 500 }];
  const result = a.distributePartnerRedeemedValue('Marriott', 1000, 'unredeemed', 500, { redemptionId: 'batch' });
  assert.equal(result.redeemedPoints, 500);
  assert.deepEqual(Array.from(result.allocations, r => r.points), [100, 200, 200]);
  assert.deepEqual(Array.from(result.allocations, r => r.value), [200, 400, 400]);
  assert.equal(a.getPprPartnerUnredeemedPoints('Marriott'), 600);
  assert.equal(a.getRpPointsUsageTotals().notSpent, 0);
  const restored = a.restorePprRedemptionBatch('Marriott', 'batch');
  assert.equal(restored.redeemedPoints, 500);
  assert.equal(a.getPprPartnerUnredeemedPoints('Marriott'), 1100);
  assert.equal(a.getRpPointsUsageTotals().notSpent, 0); // original card transfers still exist
});
test('partner rounding never consumes more card points than originally transferred', () => {
  const row = { ...transfer('t', 'neu', 3), partnerTransferRatio: '2:1', pointsReceived: 2, partnerRedeemedPoints: 2 };
  const a = fixture([credit(), row]);
  assert.equal(a.getRpSpendRedemptionAmount(row), 3);
  assert.equal(a.getCardUnredeemedPoints('neu'), 997);
});
test('one purchase can contain contributions to separate partners', () => {
  const a = fixture([{ ...transfer('a', 'neu', 100, 'Marriott'), purchaseId: 'same' },
    { ...transfer('b', 'neu', 200, 'Accor'), purchaseId: 'same' }]);
  assert.equal(a.getPprPartnerUnredeemedPoints('Marriott'), 100);
  assert.equal(a.getPprPartnerUnredeemedPoints('Accor'), 200);
});
test('partner transfer with bonus, redemption and deletion preserves original card balance', () => {
  const a = fixture([credit('neu', 1000), transfer('t', 'neu', 1000)]);
  const plan = a.getPprPartnerTransferPlan('Marriott', 1000, 2, 1, 200);
  assert.equal(plan.destinationPoints, 700);
  a.state.pprPartnerTransfers = [a.normalizePprPartnerTransfer({ ...plan, id: 'chain',
    sourcePartnerName: 'Marriott', destinationPartnerName: 'Airline', ratioFrom: 2, ratioTo: 1 })];
  assert.equal(a.getPprPartnerUnredeemedPoints('Marriott'), 0);
  assert.equal(a.getPprPartnerUnredeemedPoints('Airline'), 700);
  const result = a.distributePartnerRedeemedValue('Airline', 750, 'unredeemed', 700, { redemptionId: 'flight' });
  assert.equal(result.redeemedPoints, 700);
  assert.equal(a.getPprPartnerUnredeemedPoints('Airline'), 0);
  assert.equal(a.getPprDownstreamValueForRpSpend('t'), 750);
  assert.equal(a.getCardUnredeemedPoints('neu'), 0);
  a.removePprPartnerTransferTree('chain');
  assert.equal(a.getPprPartnerUnredeemedPoints('Marriott'), 1000);
  assert.equal(a.getPprDownstreamValueForRpSpend('t'), 0);
  assert.equal(a.getCardUnredeemedPoints('neu'), 0);
});

function setForm(a, { source = 'Neucoins', points = 200, editingId = '', unredeemed = false } = {}) {
  const input = (value = '') => ({ value: String(value), dataset: {}, focus() {} });
  a.els = {
    rpCardSelect: { ...input(source), dataset: { neucoinsSourceCardId: 'neu' } },
    rpProductName: input('Purchase'), rpPurchasedFrom: input('Shop'),
    rpPoints: input(points), rpPointsValue: input(points),
    rpOriginatingCardId: input(), rpPartnerTransferRatio: input(),
    rpPointsReceived: input(), editingRpSpendId: input(editingId),
    rpUnredeemedPoints: { checked: unredeemed }, rpPointAllocationPanel: { dataset: { active: 'false' } },
  };
  a.messages = [];
  a.showToast = message => a.messages.push(message);
  a.saveState = async () => {};
  a.render = () => {};
  a.resetRpSpendForm = () => {};
  a.showRpSpendConfirmModal = async () => false;
}
test('real RP save handler debits Neucoins; overspend edit is rejected; smaller edit restores difference', async () => {
  const a = fixture([credit('Neucoins')]);
  setForm(a);
  await a.saveRpSpendFromForm();
  checkBalances(a, 800);
  const id = a.state.rpSpends[1].id;
  setForm(a, { points: 1100, editingId: id });
  await a.saveRpSpendFromForm();
  assert.ok(a.messages.some(m => m.includes('Only')));
  checkBalances(a, 800);
  setForm(a, { points: 100, editingId: id });
  await a.saveRpSpendFromForm();
  checkBalances(a, 900);
});
test('Neucoins top-ups and balance edits preserve prior redemptions', async () => {
  const a = fixture([credit('Neucoins'), debit()]);
  setForm(a, { points: 100, unredeemed: true });
  await a.saveRpSpendFromForm();
  checkBalances(a, 900);
  setForm(a, { points: 750, editingId: 'credit', unredeemed: true });
  await a.saveRpSpendFromForm();
  checkBalances(a, 750);
  assert.equal(a.state.rpSpends[0].cardId, 'neu');
  assert.equal(a.state.rpSpends[0].points, 950);
});
test('tracked voucher save rejects redemption above available balance', async () => {
  const a = fixture([credit('Voucher', 100)]);
  setForm(a, { source: 'Voucher', points: 101 });
  await a.saveRpSpendFromForm();
  assert.equal(a.state.rpSpends.length, 1);
  assert.ok(a.messages.some(m => m.includes('Only')));
});
test('PPR edit to smaller amount or zero restores only that batch; manual share does not enter cards', () => {
  const a = fixture([credit('neu', 100), transfer('t', 'neu', 100)]);
  a.state.pprManualPoints = [{ id: 'm', partnerName: 'Marriott', points: 500 }];
  a.distributePartnerRedeemedValue('Marriott', 400, 'unredeemed', 200, { redemptionId: 'batch' });
  assert.equal(a.getPprPartnerUnredeemedPoints('Marriott'), 400);
  assert.equal(a.state.pprManualPoints[0].redeemedPoints, 100);
  assert.equal(a.getCardPointAllocation(a.state.cards[0]).redeemedValue, 200);
  let edited = a.updatePprRedemptionBatch('Marriott', 'batch', 50, 100);
  assert.ok(!edited.error);
  assert.equal(a.getPprPartnerUnredeemedPoints('Marriott'), 550);
  assert.equal(a.state.pprManualPoints[0].redeemedPoints, 0);
  edited = a.updatePprRedemptionBatch('Marriott', 'batch', 50, 0);
  assert.ok(!edited.error);
  assert.equal(a.getPprPartnerUnredeemedPoints('Marriott'), 600);
  assert.equal(a.getCardUnredeemedPoints('neu'), 0);
});

test('gross cash benefits remain separate from Net P/L after fees', () => {
  const c = {
    ...card('cash-card'),
    annualFee: 1000,
    taxFee: 180,
    previousAnnualFees: [{ amount: 500 }],
    futureAnnualFees: [{ amount: 300 }],
    benefits: [
      { id: 'cash', type: 'Cashback / Statement Credit', valueType: 'cash', amount: 3000 },
      { id: 'points', type: 'Unredeemed Points', valueType: 'points', amount: 10000 },
    ],
  };
  const a = fixture([], [c]);
  const totals = a.getTotals(a.state.cards);
  assert.equal(totals.grossCashBenefits, 3000);
  assert.equal(totals.fees, 1980);
  assert.equal(totals.net, 1020);
  assert.equal(totals.cashBenefitsNet, 1020);
});
