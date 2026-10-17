// rules.js — the per-patient rule, with no browser code in it.
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
  receipt: ['bill no', 'receipt no', 'voucher no', 'vch no', 'bill', 'receipt'],
  patient: ['patient', 'name', 'party', 'particulars', 'patient name'],
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

// Apply one per-patient amount to every data row of one sheet.
//   rows:      the sheet as a 2-D array (rows of cells), header included
//   headerRow: index of the header row
//   amountCol: index of the amount column
//   perPatientPaise: the CA's number for this counter, in paise
// Each data row gets before / after / difference and a flag:
//   'left'    before > per-patient amount (money left on the row)
//   'short'   before < per-patient amount (negative difference)
//   'ok'      exactly equal
//   'skipped' blank, text or a total line; left out of every total
function applyRule(rows, headerRow, amountCol, perPatientPaise) {
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

    const after = perPatientPaise;
    const diff = before - after;
    const flag = diff > 0 ? 'left' : diff < 0 ? 'short' : 'ok';
    results.push({ index: i, rowNo: i + 1, cells: row, before, after, diff, flag });
  }
  return results;
}

function summarize(results) {
  const s = { rows: 0, before: 0, after: 0, leftRows: 0, leftTotal: 0, shortRows: 0, shortTotal: 0, skipped: 0 };
  for (const r of results) {
    if (r.flag === 'skipped') { s.skipped++; continue; }
    s.rows++;
    s.before += r.before;
    s.after += r.after;
    if (r.flag === 'left') { s.leftRows++; s.leftTotal += r.diff; }
    if (r.flag === 'short') { s.shortRows++; s.shortTotal += r.diff; }
  }
  return s;
}

const Rules = { toPaise, rupees, detectColumns, findHeaderRow, applyRule, summarize };

// In Node (tests) export the functions; in the browser they become a global.
if (typeof module !== 'undefined') module.exports = Rules;
