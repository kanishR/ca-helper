// app.js — the page's behaviour.
//
// The browser gives every script a `document` object: the live page built
// from index.html. This file finds elements in it, listens for clicks and
// file picks ("events"), and changes the page in response.
//
// Two globals come from the scripts loaded before this one:
//   XLSX  — the SheetJS library (vendor/xlsx.full.min.js): reads and writes Excel
//   Rules — our per-row rule (rules.js)

const cardsEl = document.getElementById('cards');
const template = document.getElementById('card-template');
const messageEl = document.getElementById('message');
const resultsEl = document.getElementById('results');
const detailEl = document.getElementById('detail');

// One entry per counter card. Everything the page knows lives here.
const counters = [];

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const fmt = (paise) => money.format(Rules.rupees(paise));
const signed = (paise) => (paise > 0 ? '+' : '') + fmt(paise);

// ---------- cards ----------

function addCard(name) {
  // Clone the hidden <template> into a real card and keep handles to its parts.
  const el = template.content.firstElementChild.cloneNode(true);
  const counter = {
    el,
    nameInput: el.querySelector('.name'),
    fileInput: el.querySelector('.file'),
    amountInput: el.querySelector('.amount'),
    amountCol: el.querySelector('.amount-col'),
    billCol: el.querySelector('.bill-col'),
    rows: null,      // the sheet as a 2-D array, once a file is read
    headerRow: 0,
    cols: null,      // detected column positions
    results: null,   // output of Rules.applyRule after Submit
    fileName: '',
  };
  counter.nameInput.value = name;
  counter.fileInput.addEventListener('change', () => readFile(counter));
  counters.push(counter);
  cardsEl.appendChild(el);
}

async function readFile(counter) {
  const file = counter.fileInput.files[0];
  if (!file) return;
  try {
    // The file is read into memory here, inside the browser. Nothing is uploaded.
    const buffer = await file.arrayBuffer();
    const book = XLSX.read(buffer, { cellDates: true });
    const sheet = book.Sheets[book.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

    counter.rows = rows;
    counter.fileName = file.name;
    counter.headerRow = Rules.findHeaderRow(rows);
    counter.cols = Rules.detectColumns(rows[counter.headerRow] || []);
    counter.results = null;

    // Fill the "Amount column" and "Bill no column" dropdowns with this sheet's headers.
    const headers = rows[counter.headerRow] || [];
    counter.amountCol.innerHTML = '';
    counter.billCol.innerHTML = '';
    counter.billCol.appendChild(new Option('(none: do not match bills)', -1));
    headers.forEach((h, i) => {
      const label = String(h || `Column ${i + 1}`);
      counter.amountCol.appendChild(new Option(label, i));
      counter.billCol.appendChild(new Option(label, i));
    });
    if (counter.cols.amount !== -1) counter.amountCol.value = counter.cols.amount;
    counter.billCol.value = counter.cols.bill;

    const dataRows = rows.length - counter.headerRow - 1;
    counter.el.querySelector('.drop').classList.add('has-file');
    counter.el.querySelector('.file-label').textContent = file.name;
    counter.el.querySelector('.columns').hidden = false;
    counter.el.querySelector('.info').textContent =
      `${dataRows} rows · headers found on row ${counter.headerRow + 1}`;
    counter.el.querySelector('.alerts').innerHTML = '';
    closeDetail();
  } catch (err) {
    showMessage(`Could not read ${file.name}: ${err.message}. Is it password-protected or damaged?`);
  }
}

// ---------- submit ----------

function submit() {
  hideMessage();
  const used = counters.filter((c) => c.rows || c.amountInput.value);
  if (used.length === 0) return showMessage('Upload at least one sheet and enter its amount per row.');

  for (const c of used) {
    const label = c.nameInput.value || 'a counter';
    if (!c.rows) return showMessage(`Choose a file for ${label}.`);
    const amount = Rules.toPaise(c.amountInput.value);
    if (amount === null || amount <= 0) return showMessage(`Enter an amount per row above ₹0 for ${label}.`);
  }

  for (const c of used) {
    const amount = Rules.toPaise(c.amountInput.value);
    c.results = Rules.applyRule(c.rows, c.headerRow, Number(c.amountCol.value), amount);
  }
  // Same bill number on different counters = same patient / customer: move money between them.
  Rules.reconcileBills(used.map((c) => ({
    name: c.nameInput.value,
    results: c.results,
    perRowPaise: Rules.toPaise(c.amountInput.value),
    billCol: Number(c.billCol.value),
    nameCol: c.cols.name,
    width: (c.rows[c.headerRow] || []).length,
  })));
  used.forEach(renderAlerts);
  renderSummary(used);
}

// ---------- alerts and the row table ----------

function renderAlerts(counter) {
  const s = Rules.summarize(counter.results);
  const box = counter.el.querySelector('.alerts');
  box.innerHTML = '';
  closeDetail();

  box.appendChild(alertLine(counter, 'left', s.leftRows,
    `${s.leftRows} ${s.leftRows === 1 ? 'row has' : 'rows have'} amount left · ${fmt(s.leftTotal)}`, 'No rows with amount left'));
  box.appendChild(alertLine(counter, 'short', s.shortRows,
    `${s.shortRows} ${s.shortRows === 1 ? 'row is' : 'rows are'} short · ${fmt(-s.shortTotal)}`, 'No short rows'));
  if (s.added > 0) {
    box.appendChild(alertLine(counter, 'added', s.added,
      `${s.added} new ${s.added === 1 ? 'row' : 'rows'} added for bills paid at other counters`, ''));
  }
  if (s.skipped > 0) {
    box.appendChild(alertLine(counter, 'skipped', s.skipped, `${s.skipped} ${s.skipped === 1 ? "row" : "rows"} skipped (blank, text or total line)`, ''));
  }
}

function alertLine(counter, kind, count, text, calmText) {
  const div = document.createElement('div');
  if (count === 0) {
    div.className = 'alert calm';
    div.textContent = calmText;
    return div;
  }
  div.className = `alert ${kind === 'skipped' ? 'calm' : kind}`;
  const span = document.createElement('span');
  span.textContent = text;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Show rows';
  button.addEventListener('click', () => toggleRows(counter, kind, button));
  div.append(span, button);
  return div;
}

// "Show rows" opens the table below the cards; clicking it again closes it.
function toggleRows(counter, kind, button) {
  const key = `${counters.indexOf(counter)}:${kind}`;
  const wasOpen = detailEl.dataset.showing === key;
  closeDetail();
  if (wasOpen) return;

  const titles = { left: 'rows with amount left', short: 'short rows', skipped: 'skipped rows', added: 'new rows' };
  document.getElementById('detail-title').textContent = `${counter.nameInput.value}: ${titles[kind]}`;
  document.getElementById('detail-table').appendChild(rowTable(counter, kind));
  detailEl.dataset.showing = key;
  detailEl.hidden = false;
  button.textContent = 'Hide rows';
  detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDetail() {
  detailEl.hidden = true;
  detailEl.dataset.showing = '';
  document.getElementById('detail-table').innerHTML = '';
  document.querySelectorAll('.alert button').forEach((b) => (b.textContent = 'Show rows'));
}

function rowTable(counter, kind) {
  const { cols } = counter;
  const billCol = Number(counter.billCol.value);
  const pick = (r, i) => (i === -1 ? '' : showCell(r.cells[i]));
  const list = counter.results
    .filter((r) => (kind === 'added' ? r.added : r.flag === kind))
    .sort((a, b) => Math.abs(b.diff || 0) - Math.abs(a.diff || 0));

  const table = document.createElement('table');
  table.className = 'grid';
  const head = kind === 'skipped'
    ? ['Row no', 'Reason', 'Amount cell']
    : ['Row no', 'Date', 'Bill no', 'Name / Party', 'Mode', 'Before', 'Moved', 'After', 'Difference', 'Note'];
  table.appendChild(tr(head, 'th'));

  for (const r of list) {
    const cells = kind === 'skipped'
      ? [r.rowNo, r.reason, showCell(r.cells[Number(counter.amountCol.value)])]
      : [r.rowNo, pick(r, cols.date), pick(r, billCol), pick(r, cols.name), pick(r, cols.mode),
         fmt(r.before), r.moved ? signed(r.moved) : '', fmt(r.after), signed(r.diff), r.note || ''];
    const row = tr(cells, 'td');
    row.className = r.flag;
    if (kind !== 'skipped') [5, 6, 7, 8].forEach((i) => row.children[i].classList.add('num'));
    table.appendChild(row);
  }
  return table;
}

function tr(values, tag) {
  const row = document.createElement('tr');
  for (const v of values) {
    const cell = document.createElement(tag);
    cell.textContent = v;   // textContent, never innerHTML: sheet text is shown as text, not run as HTML
    row.appendChild(cell);
  }
  return row;
}

function showCell(value) {
  if (value instanceof Date) return value.toLocaleDateString('en-IN');
  return String(value ?? '');
}

// ---------- summary and downloads ----------

function renderSummary(used) {
  const table = document.getElementById('summary');
  table.innerHTML = '';
  table.appendChild(tr(['Counter', 'Rows', 'New rows', 'Amount per row', 'Total before', 'Moved in / out', 'Total after', 'Amount left', 'Short'], 'th'));
  for (const c of used) {
    const s = Rules.summarize(c.results);
    const row = tr([c.nameInput.value, s.rows, s.added, fmt(Rules.toPaise(c.amountInput.value)),
      fmt(s.before), signed(s.moved), fmt(s.after), fmt(s.leftTotal), fmt(Math.abs(s.shortTotal))], 'td');
    [1, 2, 3, 4, 5, 6, 7, 8].forEach((i) => row.children[i].classList.add('num'));
    table.appendChild(row);
  }

  const downloads = document.getElementById('downloads');
  downloads.innerHTML = '';
  for (const c of used) {
    downloads.appendChild(button(`Download ${c.nameInput.value} (cleaned)`, () => downloadOne(c)));
  }
  downloads.appendChild(button('Download combined workbook', () => downloadCombined(used), 'primary'));
  resultsEl.hidden = false;
}

function button(text, onClick, style = 'secondary') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = style;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

// The cleaned sheet: every original row and column, with the amount column
// overwritten by the new per-row amount and the sheet's own Total lines
// updated to the new sum. New rows for bills paid at other counters go just
// above the Total line. Before / Moved / Difference / Flag / Note are added
// on the right so the original amount stays visible. A Total line is added
// only if the sheet had none.
function cleanedRows(counter) {
  const amountCol = Number(counter.amountCol.value);
  const header = [...(counter.rows[counter.headerRow] || []), 'Before (₹)', 'Moved (₹)', 'Difference (₹)', 'Flag', 'Note'];
  const out = [header];
  const width = (counter.rows[counter.headerRow] || []).length;
  const pad = (cells) => [...cells, ...Array(Math.max(0, width - cells.length)).fill('')];
  const money = (t) => [Rules.rupees(t.before), Rules.rupees(t.moved), Rules.rupees(t.before + t.moved - t.after)];
  // A Total line sums the rows since the previous Total line; a Grand Total sums everything above it.
  const zero = () => ({ before: 0, moved: 0, after: 0 });
  let since = zero();
  const all = zero();
  let hadTotal = false;
  for (const r of counter.results) {
    const cells = pad(r.cells);
    if (r.reason === 'Total line') {
      const sum = /grand/i.test(r.cells.join(' ')) ? all : since;
      cells[amountCol] = Rules.rupees(sum.after);
      out.push([...cells, ...money(sum), 'Total (updated)', '']);
      since = zero();
      hadTotal = true;
    } else if (r.flag === 'skipped') {
      out.push([...cells, '', '', '', `Skipped: ${r.reason}`, '']);
    } else {
      cells[amountCol] = Rules.rupees(r.after);
      out.push([...cells, Rules.rupees(r.before), Rules.rupees(r.moved), Rules.rupees(r.diff), flagLabel(r), r.note || '']);
      for (const t of [since, all]) { t.before += r.before; t.moved += r.moved; t.after += r.after; }
    }
  }
  if (!hadTotal) {
    const cells = Array(width).fill('');
    cells[amountCol] = Rules.rupees(all.after);
    out.push([], [...cells, ...money(all), 'Total', '']);
  }
  return out;
}

function flagLabel(r) {
  const labels = { left: 'Amount left', short: 'Short', ok: '' };
  return [r.added ? 'New row' : '', labels[r.flag]].filter(Boolean).join(' · ');
}

function downloadOne(counter) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(cleanedRows(counter)), sheetName(counter.nameInput.value, []));
  XLSX.writeFile(book, fileName(`${counter.nameInput.value}_cleaned`));
}

function downloadCombined(used) {
  const book = XLSX.utils.book_new();
  const names = [];
  const add = (rows, name) => {
    const n = sheetName(name, names);
    names.push(n);
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), n);
  };

  const summary = [
    ['Client', document.getElementById('client').value],
    ['Quarter', document.getElementById('quarter').value],
    ['Run at', new Date().toLocaleString('en-IN')],
    [],
    ['Counter', 'File', 'Rows', 'New rows', 'Amount per row (₹)', 'Total before (₹)', 'Moved in / out (₹)', 'Total after (₹)', 'Amount left (₹)', 'Short (₹)', 'Skipped rows'],
  ];
  for (const c of used) {
    const s = Rules.summarize(c.results);
    summary.push([c.nameInput.value, c.fileName, s.rows, s.added, Number(c.amountInput.value), Rules.rupees(s.before),
      Rules.rupees(s.moved), Rules.rupees(s.after), Rules.rupees(s.leftTotal), Rules.rupees(s.shortTotal), s.skipped]);
  }
  add(summary, 'Summary');

  for (const c of used) add(cleanedRows(c), c.nameInput.value);

  // Every row that is not simply "paid exactly the amount": left, short, moved or new.
  const diffs = [['Counter', 'Row no', 'Date', 'Bill no', 'Name / Party', 'Mode', 'Before (₹)', 'Moved (₹)', 'After (₹)', 'Difference (₹)', 'Flag', 'Note']];
  for (const c of used) {
    const at = (r, i) => (i === -1 ? '' : r.cells[i]);
    for (const r of c.results) {
      if (r.flag === 'skipped' || (r.flag === 'ok' && !r.moved)) continue;
      diffs.push([c.nameInput.value, r.rowNo, at(r, c.cols.date), at(r, Number(c.billCol.value)), at(r, c.cols.name),
        at(r, c.cols.mode), Rules.rupees(r.before), Rules.rupees(r.moved), Rules.rupees(r.after), Rules.rupees(r.diff),
        flagLabel(r), r.note || '']);
    }
  }
  add(diffs, 'Differences');

  XLSX.writeFile(book, fileName('reconciled'));
}

// Excel sheet names: at most 31 characters, none of : \ / ? * [ ], and unique.
function sheetName(name, taken) {
  const base = (String(name).replace(/[:\\/?*[\]]/g, ' ').trim() || 'Sheet').slice(0, 28);
  let n = base;
  for (let i = 2; taken.includes(n); i++) n = `${base} ${i}`;
  return n;
}

function fileName(suffix) {
  const parts = [document.getElementById('client').value, document.getElementById('quarter').value, suffix];
  return parts.filter(Boolean).join('_').replace(/[^\w\-]+/g, '_') + '.xlsx';
}

// ---------- messages ----------

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.hidden = false;
}
function hideMessage() {
  messageEl.hidden = true;
}

// ---------- start ----------

['Counter 1', 'Counter 2', 'Counter 3'].forEach(addCard);
document.getElementById('add-counter').addEventListener('click', () => {
  if (counters.length >= 10) return showMessage('Up to 10 counters are supported.');
  addCard(`Counter ${counters.length + 1}`);
});
document.getElementById('submit').addEventListener('click', submit);
