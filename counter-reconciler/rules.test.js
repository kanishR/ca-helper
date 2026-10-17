// Run with: node --test
// Uses Node's built-in test runner, so there is nothing to install.
const test = require('node:test');
const assert = require('node:assert');
const R = require('./rules.js');

test('toPaise reads Indian-style amounts', () => {
  assert.strictEqual(R.toPaise('₹1,25,000.50'), 12500050);
  assert.strictEqual(R.toPaise(3000), 300000);
  assert.strictEqual(R.toPaise('-200'), -20000);
  assert.strictEqual(R.toPaise(''), null);
  assert.strictEqual(R.toPaise('abc'), null);
  assert.strictEqual(R.toPaise('Rs. 500'), 50000);
  assert.strictEqual(R.toPaise('INR 1,500'), 150000);
});

test('findHeaderRow skips title rows', () => {
  const rows = [['City Nursing Home'], ['Pharmacy register Q2'], ['Date', 'Bill No', 'Patient', 'Amount']];
  assert.strictEqual(R.findHeaderRow(rows), 2);
  const cols = R.detectColumns(rows[2]);
  assert.strictEqual(cols.date, 0);
  assert.strictEqual(cols.receipt, 1);
  assert.strictEqual(cols.party, 2);
  assert.strictEqual(cols.amount, 3);
});

test('applyRule flags left-over, short and equal rows the same for every payment mode', () => {
  const rows = [
    ['Date', 'Patient', 'Mode', 'Amount'],
    ['01-07-2026', 'A', 'Cash', 8500],
    ['01-07-2026', 'B', 'UPI', 3000],
    ['02-07-2026', 'C', 'Bank transfer', '4,200'],
    ['02-07-2026', 'D', 'Cash', 1800],
    [],
    ['', 'Total', '', 17500],
  ];
  const out = R.applyRule(rows, 0, 3, 300000);
  assert.deepStrictEqual(out.map((r) => r.flag), ['left', 'ok', 'left', 'short', 'skipped']);
  assert.deepStrictEqual(out.slice(0, 4).map((r) => r.diff), [550000, 0, 120000, -120000]);

  const s = R.summarize(out);
  assert.strictEqual(s.rows, 4);
  assert.strictEqual(s.leftRows, 2);
  assert.strictEqual(s.leftTotal, 670000);
  assert.strictEqual(s.shortRows, 1);
  assert.strictEqual(s.shortTotal, -120000);
  assert.strictEqual(s.skipped, 1);
});
