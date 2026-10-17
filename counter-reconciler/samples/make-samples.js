// Creates three small sample sheets to try the tool with: node samples/make-samples.js
const XLSX = require('../vendor/xlsx.full.min.js');
const modes = ['Cash', 'UPI', 'Card', 'Bank transfer'];
function make(file, title, amounts) {
  const rows = [[title], [], ['Date', 'Bill No', 'Patient', 'Mode', 'Amount']];
  amounts.forEach((a, i) => rows.push([`0${1 + (i % 9)}-07-2026`, 1000 + i, `Patient ${i + 1}`, modes[i % 4], a]));
  rows.push(['', '', 'Total', '', amounts.reduce((s, a) => s + a, 0)]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Register');
  require('fs').writeFileSync(`${__dirname}/${file}`, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
}
make('consultation.xlsx', 'Consultation register Q2', [500, 1500, 500, 300, 2500, 500, 800]);
make('lab.xlsx', 'Lab register Q2', [1200, 1200, 4000, 900, 1200, 6500]);
make('pharmacy.xlsx', 'Pharmacy register Q2', [8500, 3000, 4200, 1800, 3000, 12000, 2500]);
console.log('Wrote samples/consultation.xlsx, lab.xlsx, pharmacy.xlsx');
