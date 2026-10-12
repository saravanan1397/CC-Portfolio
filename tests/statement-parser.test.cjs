// Run with: node --test tests/statement-parser.test.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const code = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const context = vm.createContext({ toNumber: (value) => Number(value) || 0 });

for (const name of [
  "parseCardStatementItems",
  "getStatementTransactionExclusion",
  "parseStatementDate",
  "parseStatementRewardBalance",
  "parseStatementPeriod",
  "normalizeStatementEarningRules",
  "getStatementRuleExclusion",
  "matchStatementCategoryRule",
  "getStatementCapPeriodKey",
  "calculateStatementRewardPoints",
  "createStatementImportId",
  "applyReviewedStatementPoints",
]) {
  const regularStart = code.indexOf(`function ${name}(`);
  const asyncStart = code.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 && (regularStart < 0 || asyncStart < regularStart)
    ? asyncStart
    : regularStart;
  assert.notEqual(start, -1, `Expected ${name} to exist`);
  const end = code.indexOf("\n}", start) + 2;
  new vm.Script(code.slice(start, end)).runInContext(context);
}

function transactionItems(date, description, category, amount, direction, y) {
  return [
    { text: date, x: 35, y, page: 1 },
    { text: description, x: 90, y, page: 1 },
    { text: category, x: 360, y, page: 1 },
    { text: `${amount} ${direction}`, x: 540, y, page: 1 },
  ];
}

test("marks eligible debit purchases for review and always excludes Cr, GST, EMI principal, and processing fees", () => {
  const items = [
    ...transactionItems("01/10/2026", "Restaurant purchase", "RESTAURANTS", "1,250.00", "Dr", 600),
    ...transactionItems("02/10/2026", "Card payment received", "", "1,250.00", "Cr", 580),
    ...transactionItems("03/10/2026", "GST", "", "18.00", "Dr", 560),
    ...transactionItems("04/10/2026", "EMI PRINCIPAL - 2/3 REF 123", "RETAIL", "500.00", "Dr", 540),
    ...transactionItems("05/10/2026", "EMI PROCESSING FEE", "RETAIL", "99.00", "Dr", 520),
  ];

  const result = context.parseCardStatementItems(items);
  assert.equal(result.transactions.length, 5);
  assert.equal(result.transactions.filter((row) => row.include).length, 1);
  assert.deepEqual(
    Array.from(result.transactions, (row) => row.exclusionReason),
    ["", "Cr credit or reversal", "GST", "EMI Principal", "Processing Fee"]
  );
  assert.equal(result.transactions[0].date, "2026-10-01");
  assert.equal(result.transactions[0].bankCategory, "RESTAURANTS");
});

test("finds statement point balance and statement period without mixing pages", () => {
  const items = [
    { text: "12/09/2026 - 10/10/2026", x: 260, y: 700, page: 1 },
    { text: "EDGE REWARD BALANCE", x: 40, y: 320, page: 1 },
    { text: "8,904", x: 61, y: 296, page: 1 },
    { text: "08-10-2026", x: 114, y: 296, page: 1 },
    { text: "987654321", x: 170, y: 296, page: 1 },
    { text: "700", x: 61, y: 296, page: 2 },
    { text: "11-10-2026", x: 114, y: 296, page: 2 },
  ];

  const result = context.parseCardStatementItems(items);
  assert.equal(result.statementPeriod, "2026-09-12 – 2026-10-10");
  assert.equal(result.rewardBalance.points, 8904);
  assert.equal(result.rewardBalance.date, "2026-10-08");
});

test("finds an EDGE POINTS heading when the bank does not label it EDGE REWARD", () => {
  const items = [
    { text: "eDGE POINTS", x: 36, y: 319, page: 1 },
    { text: "BALANCE", x: 112, y: 319, page: 1 },
    { text: "DATE", x: 117, y: 311, page: 1 },
    { text: "56,431", x: 59, y: 296, page: 1 },
    { text: "08/10/2026", x: 114, y: 296, page: 1 },
  ];

  const result = context.parseCardStatementItems(items);
  assert.equal(result.rewardBalance.points, 56431);
  assert.equal(result.rewardBalance.date, "2026-10-08");
});

test("groups transaction rows by PDF page so matching coordinates cannot merge", () => {
  const items = [
    ...transactionItems("01/10/2026", "Page one purchase", "RETAIL", "100.00", "Dr", 600),
    ...transactionItems("02/10/2026", "Page two purchase", "RETAIL", "200.00", "Dr", 600)
      .map((item) => ({ ...item, page: 2 })),
  ];

  const result = context.parseCardStatementItems(items);
  assert.equal(result.transactions.length, 2);
  assert.deepEqual(
    Array.from(result.transactions, (row) => row.description),
    ["Page one purchase", "Page two purchase"]
  );
});

test("applies the card base rate, accelerator, spend cap, and bonus-points cap by statement date", () => {
  const transactions = [
    { include: true, direction: "DR", date: "2026-10-02", amount: 300, description: "Dining", bankCategory: "DINING", earningRuleId: "dining" },
    { include: true, direction: "DR", date: "2026-10-01", amount: 200, description: "Dining", bankCategory: "DINING", earningRuleId: "dining" },
  ];
  const rules = {
    basePoints: 2,
    baseSpend: 100,
    categories: [{ id: "dining", match: "dining", multiplier: 5, capSpend: 300, capPoints: 12 }],
    exclusions: [],
  };

  const result = context.calculateStatementRewardPoints(transactions, rules);
  assert.equal(result.totalPoints, 22);
  assert.deepEqual(Array.from(result.rows, (row) => row.points), [6, 16]);
  assert.deepEqual(Array.from(result.rows, (row) => row.bonusPoints), [0, 12]);
});

test("resets a category cap by its configured calendar period", () => {
  const transactions = [
    { include: true, direction: "DR", date: "2026-11-01", amount: 200, description: "Dining", bankCategory: "DINING", earningRuleId: "dining" },
    { include: true, direction: "DR", date: "2026-10-31", amount: 200, description: "Dining", bankCategory: "DINING", earningRuleId: "dining" },
  ];
  const rules = {
    basePoints: 1,
    baseSpend: 100,
    categories: [{ id: "dining", match: "dining", multiplier: 5, capSpend: 100, capPoints: 0, capPeriod: "month" }],
    exclusions: [],
  };

  assert.equal(context.calculateStatementRewardPoints(transactions, rules).totalPoints, 12);
  assert.equal(context.getStatementCapPeriodKey("2026-11-01", "month"), "2026-11");
  assert.equal(context.getStatementCapPeriodKey("2026-11-01", "year"), "2026");
});

test("supports percentage-based reward programs with category bonus caps", () => {
  const transactions = [
    { include: true, direction: "DR", date: "2026-10-01", amount: 1000, description: "Neu partner", bankCategory: "SHOPPING", earningRuleId: "partner" },
  ];
  const rules = {
    baseRateType: "percent_of_spend",
    basePoints: 1.5,
    baseSpend: 0,
    categories: [{ id: "partner", match: "partner", multiplier: 5, capSpend: 500, capPoints: 10 }],
    exclusions: [],
  };

  const result = context.calculateStatementRewardPoints(transactions, rules);
  assert.equal(result.totalPoints, 25);
  assert.deepEqual(Array.from(result.rows, (row) => [row.basePoints, row.bonusPoints]), [[15, 10]]);
});

test("card-specific exclusion keywords always exclude matching transactions", () => {
  const transaction = {
    include: true,
    direction: "DR",
    description: "Fuel station purchase",
    bankCategory: "FUEL",
  };
  const rules = { basePoints: 2, baseSpend: 100, categories: [], exclusions: ["fuel"] };

  assert.equal(context.getStatementRuleExclusion(transaction, rules), "Card exclusion: fuel");
  assert.equal(context.getStatementRuleExclusion({ ...transaction, description: "Cafe purchase", bankCategory: "DINING" }, rules), "");
});

test("auto-matches category rule keywords against bank category and description", () => {
  const rules = {
    basePoints: 2,
    baseSpend: 100,
    categories: [{ id: "dining-rule", match: "restaurant", multiplier: 5, capSpend: 0, capPoints: 0 }],
    exclusions: [],
  };
  assert.equal(context.matchStatementCategoryRule({ description: "Cafe", bankCategory: "RESTAURANT" }, rules).id, "dining-rule");
  assert.equal(context.matchStatementCategoryRule({ description: "Fuel", bankCategory: "PETROL" }, rules), null);
});

test("statement import fingerprint is stable for the same card and parsed statement", () => {
  const parsed = {
    statementPeriod: "2026-10-01 – 2026-10-31",
    transactions: [{ date: "2026-10-04", description: "Cafe", amount: 150, direction: "DR" }],
  };
  assert.equal(context.createStatementImportId("card-a", parsed), context.createStatementImportId("card-a", parsed));
  assert.notEqual(context.createStatementImportId("card-a", parsed), context.createStatementImportId("card-b", parsed));
});

test("manually confirmed statement points create an unredeemed source but never a Swipe", async () => {
  assert.doesNotMatch(code, /importParsedStatementTransactions|importStatementTransactionsBtn/);
  context.state = { rpSpends: [], swipes: [] };
  context.statementParseSession = {
    reviewConfirmed: true,
    cardId: "card-a",
    cardName: "Test card",
    fileName: "statement.pdf",
    statementPeriod: "2026-10-01 – 2026-10-31",
    statementImportId: "statement-hash",
    earningRules: { baseRateType: "points_per_spend", basePoints: 2, baseSpend: 100, categories: [], exclusions: [] },
    transactions: [{ include: true, direction: "DR", date: "2026-10-02", amount: 450, description: "Cafe" }],
  };
  context.createId = () => "statement-source";
  context.normalizeRpSpend = (record) => record;
  context.syncRpRedeemedBenefitsFromSpends = () => {};
  context.saveState = async () => {};
  context.closeAiModal = () => {};
  context.render = () => {};
  context.showToast = () => {};
  context.formatPoints = (points) => `${points} pts`;

  await context.applyReviewedStatementPoints();
  assert.equal(context.state.rpSpends.length, 1);
  assert.equal(context.state.rpSpends[0].points, 8);
  assert.equal(context.state.rpSpends[0].unredeemedPointsRecord, true);
  assert.equal(context.state.rpSpends[0].unredeemedBalanceInitialized, true);
  assert.equal(context.state.rpSpends[0].statementImportId, "statement-hash");
  assert.equal(context.state.swipes.length, 0);
  context.statementParseSession = {
    reviewConfirmed: true,
    cardId: "card-a",
    statementImportId: "statement-hash",
    earningRules: { baseRateType: "points_per_spend", basePoints: 2, baseSpend: 100, categories: [], exclusions: [] },
    transactions: [{ include: true, direction: "DR", date: "2026-10-02", amount: 450, description: "Cafe" }],
  };
  await assert.rejects(context.applyReviewedStatementPoints(), /already been added/);
  assert.equal(context.state.rpSpends.length, 1);
});

test("Upload Statement stays disabled until the complete workflow is enabled", () => {
  const navs = Array.from(html.matchAll(/<nav[^>]*>([\s\S]*?)<\/nav>/g), (match) => match[1])
    .filter((nav) => nav.includes('data-dashboard-focus="ai"'));
  assert.equal(navs.length, 2);
  navs.forEach((nav) => {
    const aiSearchIndex = nav.indexOf('data-dashboard-focus="ai"');
    const toolsIndex = nav.indexOf('data-dashboard-nav="tools"');
    const uploadIndex = nav.indexOf('data-statement-upload disabled');
    assert.ok(aiSearchIndex >= 0 && aiSearchIndex < toolsIndex && toolsIndex < uploadIndex);
    assert.match(nav.slice(uploadIndex), /Upload Statement<small>In progress<\/small>/);
  });
  assert.match(html, /aria-label="AI search and command bar" hidden/);
  assert.match(code, /function openAiSearchModal\(/);
});
