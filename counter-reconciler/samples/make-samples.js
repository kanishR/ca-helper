// Creates two clients' worth of test sheets: node samples/make-samples.js
// The numbers come from a fixed seed, so every run makes the same files,
// and TEST-GUIDE.md can list the exact results to expect.
const fs = require('fs');
const path = require('path');
const XLSX = require('../vendor/xlsx.full.min.js');

let seed = 42;
function rand() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
const pick = (list) => list[Math.floor(rand() * list.length)];
const modes = ['Cash', 'UPI', 'Card', 'Bank transfer'];
const names = ['Ramesh Kumar', 'Sunita Devi', 'Mohd. Arif', 'Priya Nair', 'Anil Gupta', 'Kavita Rao',
  'Suresh Patel', 'Neha Singh', 'Vijay Sharma', 'Lakshmi Iyer', 'Rahul Verma', 'Fatima Begum'];

// rows: amounts around `per`, some equal, some higher, some lower.
function amounts(count, per) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const r = rand();
    if (r < 0.3) out.push(per);                                   // exactly the amount per row
    else if (r < 0.75) out.push(per + Math.round(rand() * 20) * 250); // full bill paid here: amount left
    else out.push(Math.max(100, per - Math.round(rand() * 8) * 100));  // paid less: short
  }
  return out;
}

function dateText(day) { return `${String(day).padStart(2, '0')}-07-2026`; }

function write(file, rows, asCsv) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (asCsv) return fs.writeFileSync(file, XLSX.utils.sheet_to_csv(sheet));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Register');
  fs.writeFileSync(file, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
}

// ---------- Client 1: City Nursing Home (3 accounts, Excel files) ----------
// Title rows on top, real Excel dates, a total line at the bottom.
function nursingHome(file, title, count, per, firstBill) {
  const list = amounts(count, per);
  const rows = [[title], ['Quarter: Q2 FY 2026-27'], [], ['Date', 'Bill No', 'Patient Name', 'Payment Mode', 'Amount']];
  list.forEach((a, i) => rows.push([new Date(Date.UTC(2026, 6 + Math.floor(i / 12), 1 + (i % 28))), firstBill + i, pick(names), pick(modes), a]));
  rows.push(['', '', 'Total', '', list.reduce((s, a) => s + a, 0)]);
  write(file, rows);
}
const c1 = path.join(__dirname, 'client-1-city-nursing-home');
nursingHome(path.join(c1, 'consultation.xlsx'), 'City Nursing Home - Consultation register', 30, 500, 1001);
nursingHome(path.join(c1, 'lab.xlsx'), 'City Nursing Home - Lab register', 25, 1200, 2001);
nursingHome(path.join(c1, 'pharmacy.xlsx'), 'City Nursing Home - Pharmacy register', 35, 3000, 3001);

// ---------- Client 2: Sharma Traders (4 accounts, mixed formats) ----------
// Tally-style headers (Vch Date, Vch No, Party, Received), amounts typed as
// text with ₹ and Indian commas, a blank row, a "N/A" amount and a refund.
function traders(file, count, per, firstVch, asCsv) {
  const list = amounts(count, per);
  const rows = [['Sharma Traders'], ['Day Book'], ['Vch Date', 'Vch No', 'Party', 'Mode', 'Received']];
  list.forEach((a, i) => {
    const text = '₹' + a.toLocaleString('en-IN');
    rows.push([dateText(1 + (i % 28)), firstVch + i, pick(names), pick(modes), i % 3 === 0 ? text : a]);
    if (i === 5) rows.push(['', '', '', '', '']);                       // blank row
  });
  rows.push([dateText(29), firstVch + count, 'Walk-in', 'Cash', 'N/A']);      // not a number
  rows.push([dateText(30), firstVch + count + 1, 'Refund to Anil Gupta', 'UPI', -per]); // refund
  write(file, rows, asCsv);
}
const c2 = path.join(__dirname, 'client-2-sharma-traders');
traders(path.join(c2, 'hardware.xlsx'), 20, 2000, 5001, false);
traders(path.join(c2, 'paints.xlsx'), 18, 4500, 6001, false);
traders(path.join(c2, 'electrical.csv'), 22, 1500, 7001, true);
traders(path.join(c2, 'plumbing.xlsx'), 15, 800, 8001, false);

console.log('Wrote samples for client 1 (3 files) and client 2 (4 files)');
