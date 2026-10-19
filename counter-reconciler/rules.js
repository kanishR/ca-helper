// rules.js — the per-row rule, with no browser code in it.
//
// Everything here is a plain function: data in, data out. No DOM, no files.
// That keeps the business rule easy to read and easy to test with Node
// (see rules.test.js), separate from the page code in app.js.
//
// Money is kept in paise (whole numbers) so totals never drift.
// 1,234.50 rupees -> 123450 paise.

const HEADER_WORDS = {
  date: ['date', 'bill date', 'receipt date', 'vch date', 'voucher date'],
  amount: ['amount', 'total', 'net amount', 'received', 'credit', 'amt'],
  bill: ['bill no', 'bill number', 'receipt no', 'voucher no', 'vch no', 'bill', 'receipt'],
  name: ['name', 'party', 'particulars', 'party name', 'customer', 'patient', 'student', 'ledger'],
  mode: ['mode', 'payment mode', 'pay mode', 'cash/upi'],
};

function clean(text) {
  return String(text ?? '').trim().toLowerCase().replace(/[.:]/g, '').replace(/\s+/g, ' ');
}

// "₹1,25,000.50" -> 12500050. Returns null when the cell is not a number.
function toPaise(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null;
  const text = String(value ?? '').replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '');
  if (text === '' || !/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Math.round(parseFloat(text) * 100);
}

function rupees(paise) {
  return paise / 100;
}

// Which column holds which field? Exact header matches win over partial ones.
function detectColumns(headerRow) {
  const headers = headerRow.map(clean);
  const found = {};
  for (const [field, words] of Object.entries(HEADER_WORDS)) {
    let index = headers.findIndex((h) => words.includes(h));
    if (index === -1) index = headers.findIndex((h) => h && words.some((w) => h.includes(w)));
    found[field] = index; // -1 when not found
  }
  return found;
}

// The header row is the first of the top 20 rows that has an amount-like
// header. This skips title rows that Tally and hand-made sheets put on top.
function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cols = detectColumns(rows[i] || []);
    if (cols.amount !== -1) return i;
  }
  return 0;
}

// Apply one per-row amount to every data row of one sheet.
//   rows:      the sheet as a 2-D array (rows of cells), header included
//   headerRow: index of the header row
//   amountCol: index of the amount column
//   perRowPaise:     the CA's number for this counter, in paise
// Each data row gets before / after / difference and a flag:
//   'left'    before > per-row amount (money left on the row)
//   'short'   before < per-row amount (negative difference)
//   'ok'      exactly equal
//   'skipped' blank, text or a total line; left out of every total
// `moved` is money moved in from (or out to) other counters for the same
// bill; it stays 0 until reconcileBills runs. `diff` is always
// before + moved - after.
function applyRule(rows, headerRow, amountCol, perRowPaise) {
  const results = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const isBlank = row.every((cell) => String(cell ?? '').trim() === '');
    if (isBlank) continue;

    const isTotalLine = row.some((cell) => /^(grand\s*)?(sub\s*)?total\b/i.test(String(cell ?? '').trim()));
    const before = toPaise(row[amountCol]);
    if (isTotalLine || before === null) {
      results.push({ index: i, rowNo: i + 1, cells: row, flag: 'skipped',
        reason: isTotalLine ? 'Total line' : 'Amount is blank or not a number' });
      continue;
    }

    const after = perRowPaise;
    const diff = before - after;
    results.push({ index: i, rowNo: i + 1, cells: row, before, after, moved: 0, diff, flag: flagFor(diff) });
  }
  return results;
}

function flagFor(diff) {
  return diff > 0 ? 'left' : diff < 0 ? 'short' : 'ok';
}

function billKey(cell) {
  return String(cell ?? '').trim().toUpperCase();
}

// Match rows across counters by bill number and move money between them.
//   sheets: one entry per counter, in card order:
//     { name, results (from applyRule), perRowPaise, billCol, nameCol, width }
// For each bill number:
//   1. All money left on that bill's rows goes into one pool.
//   2. The pool first pays that bill's short rows, in card order.
//   3. What is still in the pool adds a new row for that bill to each counter
//      where it has no row, in card order. A new row gets the full amount per
//      row as After; if the pool cannot cover it, the row is marked short.
//   4. Anything still left goes back to the rows it came from, so it shows as
//      amount left on the bill.
// Changes `moved`, `diff`, `flag` and `note` on rows and appends new rows
// (marked added: true) to each sheet's results, before its last Total line.
function reconcileBills(sheets) {
  const bills = new Map(); // bill key -> { label, name, perSheet: [[rows], [rows], ...] }
  sheets.forEach((sheet, k) => {
    if (sheet.billCol === -1) return;
    for (const r of sheet.results) {
      if (r.flag === 'skipped') continue;
      const key = billKey(r.cells[sheet.billCol]);
      if (!key) continue;
      if (!bills.has(key)) bills.set(key, { label: r.cells[sheet.billCol], name: '', perSheet: sheets.map(() => []) });
      const bill = bills.get(key);
      if (!bill.name && sheet.nameCol !== -1) bill.name = r.cells[sheet.nameCol];
      bill.perSheet[k].push(r);
    }
  });

  const added = sheets.map(() => []);
  for (const bill of bills.values()) {
    const rows = bill.perSheet.flatMap((list, k) => list.map((r) => ({ r, k })));
    const givers = [];
    let pool = 0;
    for (const { r, k } of rows) {
      if (r.diff > 0) { givers.push({ r, k, gave: r.diff }); pool += r.diff; r.moved -= r.diff; }
    }
    const takers = [];
    for (const { r, k } of rows) {
      if (r.diff < 0 && pool > 0) {
        const take = Math.min(pool, -r.diff);
        r.moved += take; pool -= take; takers.push({ r, k, took: take });
      }
    }
    sheets.forEach((sheet, k) => {
      if (pool <= 0 || bill.perSheet[k].length > 0 || sheet.billCol === -1) return;
      const take = Math.min(pool, sheet.perRowPaise);
      pool -= take;
      const cells = Array(sheet.width).fill('');
      cells[sheet.billCol] = bill.label;
      if (sheet.nameCol !== -1) cells[sheet.nameCol] = bill.name;
      const r = { index: null, rowNo: 'New', cells, before: 0, after: sheet.perRowPaise, moved: take, added: true };
      added[k].push(r);
      takers.push({ r, k, took: take });
    });
    for (const g of givers) {
      const back = Math.min(pool, g.gave);
      g.r.moved += back; pool -= back; g.gave -= back;
    }

    // Notes say where the money went, by counter name.
    for (const { r } of rows.concat(takers.filter((t) => t.r.added))) {
      r.diff = r.before + r.moved - r.after;
      r.flag = flagFor(r.diff);
    }
    const inr = (p) => '₹' + rupees(p).toLocaleString('en-IN');
    const names = (list) => [...new Set(list.map((x) => sheets[x.k].name))].join(', ');
    for (const g of givers.filter((x) => x.gave > 0)) {
      const to = takers.filter((t) => t.k !== g.k);
      g.r.note = `Moved ${inr(g.gave)} to ${names(to) || 'other counters'}`;
    }
    for (const t of takers) {
      const from = givers.filter((g) => g.gave > 0 && g.k !== t.k);
      t.r.note = `${t.r.added ? 'New row. ' : ''}Got ${inr(t.took)} from ${names(from) || 'this bill'}`;
    }
  }

  sheets.forEach((sheet, k) => {
    if (added[k].length === 0) return;
    let at = sheet.results.length;
    for (let i = sheet.results.length - 1; i >= 0; i--) {
      if (sheet.results[i].reason === 'Total line') { at = i; break; }
    }
    sheet.results.splice(at, 0, ...added[k]);
  });
}

function summarize(results) {
  const s = { rows: 0, before: 0, after: 0, moved: 0, added: 0, leftRows: 0, leftTotal: 0, shortRows: 0, shortTotal: 0, skipped: 0 };
  for (const r of results) {
    if (r.flag === 'skipped') { s.skipped++; continue; }
    s.rows++;
    s.before += r.before;
    s.after += r.after;
    s.moved += r.moved;
    if (r.added) s.added++;
    if (r.flag === 'left') { s.leftRows++; s.leftTotal += r.diff; }
    if (r.flag === 'short') { s.shortRows++; s.shortTotal += r.diff; }
  }
  return s;
}

const Rules = { toPaise, rupees, detectColumns, findHeaderRow, applyRule, reconcileBills, summarize };

// In Node (tests) export the functions; in the browser they become a global.
if (typeof module !== 'undefined') module.exports = Rules;
