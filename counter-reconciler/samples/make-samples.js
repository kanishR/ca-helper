// Creates made-up sheets for two clients to try the tool with:
//   node samples/make-samples.js
// Every name and number here is invented.
//
// Each client is a list of bills. The same bill number appears on every
// counter where that patient / student paid, and is missing where they did
// not pay, so the cross-counter matching gets tested.
const fs = require('fs');
const path = require('path');
const XLSX = require('../vendor/xlsx.full.min.js');
const Rules = require('../rules.js');

const modes = ['Cash', 'UPI', 'Card', 'Bank transfer'];

// Client 1: hand-made Excel registers. Title rows on top, plain numbers, a Total line.
const nursingHome = {
  folder: 'client-1-sharma-nursing-home',
  counters: [
    { name: 'Consultation', file: 'consultation.xlsx', perRow: 500 },
    { name: 'Lab', file: 'lab.xlsx', perRow: 1200 },
    { name: 'Pharmacy', file: 'pharmacy.xlsx', perRow: 3000 },
  ],
  // bill no, patient, [Consultation, Lab, Pharmacy] amounts (null = no row on that counter)
  bills: [
    [1001, 'Ramesh Kumar', [null, null, 8500]],   // paid everything at Pharmacy
    [1002, 'Sunita Devi', [500, 1200, 3000]],     // exact everywhere
    [1003, 'Arjun Patel', [1500, 900, null]],     // Consultation extra covers Lab short, rest makes a short Pharmacy row
    [1004, 'Fatima Begum', [300, null, null]],    // short, nothing to move
    [1005, 'Vikram Reddy', [500, null, 1800]],    // Pharmacy short, nothing to move
    [1006, 'Lakshmi Iyer', [null, 4000, null]],   // paid at Lab only, not enough for Pharmacy
    [1007, 'Mohan Lal', [500, 1200, null]],       // exact, no money for Pharmacy, so no new row
    [1008, 'Geeta Sharma', [null, null, 12000]],  // big Pharmacy payment, money still left after all counters
    [1009, 'Imran Khan', [800, null, 2500]],      // Consultation extra partly covers Pharmacy short
    [1010, 'Priya Menon', [null, 1200, 3000]],    // exact, never visited Consultation
  ],
  sheet(counter, list) {
    const rows = [['Sharma Nursing Home'], [`${counter.name} register Q2`], [], ['Date', 'Bill No', 'Patient', 'Mode', 'Amount']];
    list.forEach(({ bill, name, amount }, i) => rows.push([`${String(1 + bill - 1001).padStart(2, '0')}-07-2026`, bill, name, modes[i % 4], amount]));
    rows.push(['', '', 'Total', '', list.reduce((s, x) => s + x.amount, 0)]);
    return rows;
  },
};

// Client 2: looks like a Tally export. Company name and period on top,
// Tally-style dates, "Vch No" / "Particulars" / "Credit" headers, some amounts
// typed as text like "₹2,500.00", a blank row, a cancelled voucher and a
// Grand Total. books.csv is a CSV file.
const coaching = {
  folder: 'client-2-bright-future-coaching',
  counters: [
    { name: 'Monthly fees', file: 'monthly-fees.xlsx', perRow: 2500 },
    { name: 'Test series', file: 'test-series.xlsx', perRow: 800 },
    { name: 'Books', file: 'books.csv', perRow: 450 },
  ],
  bills: [
    ['R-101', 'Aarav Mehta', [2500, 800, 450]],     // exact everywhere
    ['R-102', 'Diya Iyer', [3750, null, null]],     // extra fees pay for a test series and books row
    ['R-103', 'Kabir Singh', [2000, null, 900]],    // Books extra partly covers fees short
    ['R-104', 'Ananya Rao', [null, 1600, null]],    // paid at Test series only: short fees row is created
    ['R-105', 'Vivaan Shah', ['Cancelled', 800, null]], // cancelled fees voucher is skipped
    ['R-106', 'Isha Nair', [7500, null, null]],     // money still left after all counters
    ['R-107', 'Rohan Das', [2500, 600, null]],      // test series short, nothing to move
    ['R-108', 'Meera Joshi', [null, null, 1350]],   // paid at Books only
  ],
  sheet(counter, list) {
    const rows = [['Bright Future Coaching Classes'], [`${counter.name} receipts`], ['1-Jul-2026 to 30-Sep-2026'], [],
      ['Vch Date', 'Vch No', 'Particulars', 'Vch Type', 'Mode', 'Credit']];
    list.forEach(({ bill, name, amount }, i) => {
      const n = Number(bill.slice(2)) - 100;
      const cell = typeof amount === 'number' && i % 3 === 1 ? `₹${amount.toLocaleString('en-IN')}.00` : amount;
      rows.push([`${String(2 + n).padStart(2, '0')}-${['Jul', 'Aug', 'Sep'][n % 3]}-2026`, bill, name, 'Receipt', modes[(i + 1) % 4], cell]);
      if (i === 2) rows.push([]);
    });
    rows.push(['', '', 'Grand Total', '', '', list.reduce((s, x) => s + (typeof x.amount === 'number' ? x.amount : 0), 0)]);
    return rows;
  },
};

// Write the files, then run them through the same rules the page uses and
// print the numbers the page should show (for the tables in samples/README.md).
const inr = (p) => (p < 0 ? '-' : '') + '₹' + Math.abs(Rules.rupees(p)).toLocaleString('en-IN');
for (const client of [nursingHome, coaching]) {
  const dir = path.join(__dirname, client.folder);
  fs.mkdirSync(dir, { recursive: true });
  const sheets = client.counters.map((counter, k) => {
    const list = client.bills.filter((b) => b[2][k] !== null).map(([bill, name, amounts]) => ({ bill, name, amount: amounts[k] }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(client.sheet(counter, list)), 'Register');
    const file = path.join(dir, counter.file);
    fs.writeFileSync(file, XLSX.write(book, { type: 'buffer', bookType: counter.file.endsWith('.csv') ? 'csv' : 'xlsx' }));

    const read = XLSX.read(fs.readFileSync(file));
    const back = XLSX.utils.sheet_to_json(read.Sheets[read.SheetNames[0]], { header: 1, raw: true, defval: '' });
    const header = Rules.findHeaderRow(back);
    const cols = Rules.detectColumns(back[header]);
    const perRowPaise = Rules.toPaise(counter.perRow);
    return { ...counter, name: counter.name, perRowPaise, billCol: cols.bill, nameCol: cols.name, width: back[header].length,
      results: Rules.applyRule(back, header, cols.amount, perRowPaise) };
  });
  Rules.reconcileBills(sheets);

  console.log(`\n${client.folder}`);
  console.log('| Counter | File | Amount per row | Rows | New rows | Total before | Moved in / out | Total after | Amount left | Short | Skipped |');
  for (const sh of sheets) {
    const s = Rules.summarize(sh.results);
    console.log(`| ${sh.name} | ${sh.file} | ${inr(sh.perRowPaise)} | ${s.rows} | ${s.added} | ${inr(s.before)} | ${s.moved > 0 ? '+' : ''}${inr(s.moved)} | ${inr(s.after)} | ${s.leftRows} · ${inr(s.leftTotal)} | ${s.shortRows} · ${inr(-s.shortTotal)} | ${s.skipped} |`);
  }
  console.log('\n| Bill | ' + sheets.map((sh) => sh.name).join(' | ') + ' | Left on bill | Short on bill |');
  for (const [bill] of client.bills) {
    const rows = sheets.map((sh) => sh.results.find((r) => r.flag !== 'skipped' && String(r.cells[sh.billCol]) === String(bill)));
    const cell = (r) => (!r ? '–' : `${inr(r.before)} → ${inr(r.after)}${r.added ? ' (new)' : ''}${r.flag === 'short' ? ' short ' + inr(-r.diff) : ''}`);
    const left = rows.reduce((t, r) => t + (r && r.diff > 0 ? r.diff : 0), 0);
    const short = rows.reduce((t, r) => t + (r && r.diff < 0 ? -r.diff : 0), 0);
    console.log(`| ${bill} | ${rows.map(cell).join(' | ')} | ${left ? inr(left) : ''} | ${short ? inr(short) : ''} |`);
  }
}
