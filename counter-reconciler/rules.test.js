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
});

test('findHeaderRow skips title rows', () => {
  const rows = [['City Nursing Home'], ['Pharmacy register Q2'], ['Date', 'Bill No', 'Patient', 'Amount']];
  assert.strictEqual(R.findHeaderRow(rows), 2);
  const cols = R.detectColumns(rows[2]);
  assert.strictEqual(cols.date, 0);
  assert.strictEqual(cols.bill, 1);
  assert.strictEqual(cols.name, 2);
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

test('reconcileBills matches the same bill number across counters', () => {
  const header = ['Bill No', 'Patient', 'Amount'];
  const sheet = (name, perRow, data) => {
    const rows = [header, ...data, ['', 'Total', 0]];
    return { name, perRowPaise: perRow * 100, billCol: 0, nameCol: 1, width: 3,
      results: R.applyRule(rows, 0, 2, perRow * 100) };
  };
  const cons = sheet('Consultation', 500, [[1003, 'C', 1500], [1004, 'D', 300]]);
  const lab = sheet('Lab', 1200, [[1003, 'C', 900]]);
  const pharm = sheet('Pharmacy', 3000, [[1001, 'A', 8500]]);
  R.reconcileBills([cons, lab, pharm]);
  const find = (s, bill) => s.results.filter((r) => r.cells[0] === bill);

  // 1001 paid everything at Pharmacy: new Consultation and Lab rows, ₹3,800 still left on Pharmacy.
  assert.deepStrictEqual(find(pharm, 1001).map((r) => [r.after, r.moved, r.diff, r.flag]), [[300000, -170000, 380000, 'left']]);
  assert.deepStrictEqual(find(cons, 1001).map((r) => [r.added, r.after, r.moved, r.flag, r.cells[1]]), [[true, 50000, 50000, 'ok', 'A']]);
  assert.deepStrictEqual(find(lab, 1001).map((r) => [r.added, r.after, r.moved, r.flag]), [[true, 120000, 120000, 'ok']]);

  // 1003: ₹1,000 left on Consultation pays Lab's ₹300 short, the other ₹700 makes a short Pharmacy row.
  assert.deepStrictEqual(find(cons, 1003).map((r) => [r.moved, r.diff, r.flag]), [[-100000, 0, 'ok']]);
  assert.deepStrictEqual(find(lab, 1003).map((r) => [r.moved, r.diff, r.flag]), [[30000, 0, 'ok']]);
  assert.deepStrictEqual(find(pharm, 1003).map((r) => [r.added, r.moved, r.diff, r.flag]), [[true, 70000, -230000, 'short']]);

  // 1004 has nothing to move: stays short, no new rows.
  assert.deepStrictEqual(find(cons, 1004).map((r) => r.flag), ['short']);
  assert.strictEqual(find(lab, 1004).length + find(pharm, 1004).length, 0);

  // New rows go above the Total line, and money is never created or lost.
  assert.strictEqual(cons.results[cons.results.length - 1].reason, 'Total line');
  const all = [cons, lab, pharm].map((s) => R.summarize(s.results));
  assert.strictEqual(all.reduce((t, s) => t + s.moved, 0), 0);
  const paid = all.reduce((t, s) => t + s.before, 0);
  const net = all.reduce((t, s) => t + s.after + s.leftTotal + s.shortTotal, 0);
  assert.strictEqual(paid, net);
});
