// app.js — the page's behaviour.
//
// The browser gives every script a `document` object: the live page built
// from index.html. This file finds elements in it, listens for clicks and
// file picks ("events"), and changes the page in response.
//
// Two globals come from the scripts loaded before this one:
//   XLSX  — the SheetJS library (vendor/xlsx.full.min.js): reads and writes Excel
//   Rules — our per-patient rule (rules.js)

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

    // Fill the "Amount column" dropdown with this sheet's headers.
    const headers = rows[counter.headerRow] || [];
    counter.amountCol.innerHTML = '';
    headers.forEach((h, i) => {
      const option = new Option(String(h || `Column ${i + 1}`), i);
      counter.amountCol.appendChild(option);
    });
    if (counter.cols.amount !== -1) counter.amountCol.value = counter.cols.amount;

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
  if (used.length === 0) return showMessage('Upload at least one sheet and enter its amount per patient.');

  for (const c of used) {
    const label = c.nameInput.value || 'a counter';
    if (!c.rows) return showMessage(`Choose a file for ${label}.`);
    const amount = Rules.toPaise(c.amountInput.value);
    if (amount === null || amount <= 0) return showMessage(`Enter an amount per patient above ₹0 for ${label}.`);
  }

  for (const c of used) {
    const amount = Rules.toPaise(c.amountInput.value);
    c.results = Rules.applyRule(c.rows, c.headerRow, Number(c.amountCol.value), amount);
    renderAlerts(c);
  }
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

  const titles = { left: 'rows with amount left', short: 'short rows', skipped: 'skipped rows' };
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
  const pick = (r, i) => (i === -1 ? '' : showCell(r.cells[i]));
  const list = counter.results
    .filter((r) => r.flag === kind)
    .sort((a, b) => Math.abs(b.diff || 0) - Math.abs(a.diff || 0));

  const table = document.createElement('table');
  table.className = 'grid';
  const head = kind === 'skipped'
    ? ['Row no', 'Reason', 'Amount cell']
    : ['Row no', 'Date', 'Receipt no', 'Patient', 'Mode', 'Before', 'After', 'Difference'];
  table.appendChild(tr(head, 'th'));

  for (const r of list) {
    const cells = kind === 'skipped'
      ? [r.rowNo, r.reason, showCell(r.cells[Number(counter.amountCol.value)])]
      : [r.rowNo, pick(r, cols.date), pick(r, cols.receipt), pick(r, cols.patient), pick(r, cols.mode),
         fmt(r.before), fmt(r.after), signed(r.diff)];
    const row = tr(cells, 'td');
    row.className = kind;
    if (kind !== 'skipped') [5, 6, 7].forEach((i) => row.children[i].classList.add('num'));
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
  table.appendChild(tr(['Counter', 'Rows', 'Amount per patient', 'Total before', 'Total after', 'Amount left', 'Short'], 'th'));
  for (const c of used) {
    const s = Rules.summarize(c.results);
    const row = tr([c.nameInput.value, s.rows, fmt(Rules.toPaise(c.amountInput.value)),
      fmt(s.before), fmt(s.after), fmt(s.leftTotal), fmt(-s.shortTotal)], 'td');
    [1, 2, 3, 4, 5, 6].forEach((i) => row.children[i].classList.add('num'));
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

// The cleaned sheet: every original row and column, plus Before / After /
// Difference / Flag, and a total line at the bottom.
function cleanedRows(counter) {
  const header = [...(counter.rows[counter.headerRow] || []), 'Before (₹)', 'After (₹)', 'Difference (₹)', 'Flag'];
  const out = [header];
  const width = (counter.rows[counter.headerRow] || []).length;
  const pad = (cells) => [...cells, ...Array(Math.max(0, width - cells.length)).fill('')];
  const labels = { left: 'Amount left', short: 'Short', ok: '', skipped: 'Skipped' };
  for (const r of counter.results) {
    if (r.flag === 'skipped') {
      out.push([...pad(r.cells), '', '', '', `Skipped: ${r.reason}`]);
    } else {
      out.push([...pad(r.cells), Rules.rupees(r.before), Rules.rupees(r.after), Rules.rupees(r.diff), labels[r.flag]]);
    }
  }
  const s = Rules.summarize(counter.results);
  out.push([]);
  out.push([...Array(width).fill(''), Rules.rupees(s.before), Rules.rupees(s.after), Rules.rupees(s.before - s.after), 'Total']);
  return out;
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
    ['Counter', 'File', 'Rows', 'Amount per patient (₹)', 'Total before (₹)', 'Total after (₹)', 'Amount left (₹)', 'Short (₹)', 'Skipped rows'],
  ];
  for (const c of used) {
    const s = Rules.summarize(c.results);
    summary.push([c.nameInput.value, c.fileName, s.rows, Number(c.amountInput.value), Rules.rupees(s.before),
      Rules.rupees(s.after), Rules.rupees(s.leftTotal), Rules.rupees(s.shortTotal), s.skipped]);
  }
  add(summary, 'Summary');

  for (const c of used) add(cleanedRows(c), c.nameInput.value);

  const diffs = [['Counter', 'Row no', 'Date', 'Receipt no', 'Patient', 'Mode', 'Before (₹)', 'After (₹)', 'Difference (₹)', 'Flag']];
  for (const c of used) {
    const at = (r, i) => (i === -1 ? '' : r.cells[i]);
    for (const r of c.results) {
      if (r.flag !== 'left' && r.flag !== 'short') continue;
      diffs.push([c.nameInput.value, r.rowNo, at(r, c.cols.date), at(r, c.cols.receipt), at(r, c.cols.patient),
        at(r, c.cols.mode), Rules.rupees(r.before), Rules.rupees(r.after), Rules.rupees(r.diff),
        r.flag === 'left' ? 'Amount left' : 'Short']);
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

['Consultation', 'Lab', 'Pharmacy'].forEach(addCard);
document.getElementById('add-counter').addEventListener('click', () => {
  if (counters.length >= 10) return showMessage('Up to 10 counters are supported.');
  addCard(`Counter ${counters.length + 1}`);
});
document.getElementById('submit').addEventListener('click', submit);
