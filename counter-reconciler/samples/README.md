# Sample sheets for two clients

Every name and number here is made up. Use these files to test the reconciler before you try it with a real client's sheets.

| Folder | Client | What the sheets look like |
| --- | --- | --- |
| `client-1-sharma-nursing-home/` | Sharma Nursing Home | Hand-made Excel registers: title rows on top, `Date / Bill No / Patient / Mode / Amount`, plain numbers, a **Total** line at the bottom. |
| `client-2-bright-future-coaching/` | Bright Future Coaching Classes | Look like a Tally export: company name and period on top, `Vch Date / Vch No / Particulars / Vch Type / Mode / Credit`, some amounts typed as text (`₹2,500.00`), a blank row, one **Cancelled** voucher and a **Grand Total** line. `books.csv` is a CSV file, to check that CSV works as well as Excel. |

The same bill number means the same patient or student on every counter. Some bills appear on only one or two counters, so the cross-counter matching gets tested.

## How to test

Do this once for each client. Reload the page (Cmd+R) before you start the second client.

1. Double-click `counter-reconciler/index.html` to open it in your browser.
2. Type the client name and the quarter (for example `Q2 FY 2026-27`).
3. Rename the three counter cards and choose one file for each, from the table below. Check that **Bill no column** shows `Bill No` (client 1) or `Vch No` (client 2).
4. Type the **Amount per row** shown for each counter.
5. Press **Submit** and check that the Summary matches the first table.
6. Click **Show rows** on an alert to see those rows, with the money moved and a note. Then try **Download combined workbook** and open it in Excel: its Differences sheet should match the second table.

## The rule, in short

For each bill number, across all counters:

1. Each row is set to that counter's amount per row.
2. Money left on one counter first pays the same bill's short rows on other counters.
3. Money still left adds a new row for that bill on each counter where it has no row, in card order. If the money runs out, the new row is marked **Short**.
4. Anything still left stays as **Amount left** on the bill.

"Skipped" rows are total lines and rows whose amount is not a number (like *Cancelled*). They are left out of every total.

## Client 1: Sharma Nursing Home

| Counter | File | Amount per row | Rows | New rows | Total before | Moved in / out | Total after | Amount left | Short | Skipped |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Consultation | consultation.xlsx | ₹500 | 9 | 3 | ₹4,100 | +₹200 | ₹4,500 | ₹0 | ₹200 | 1 |
| Lab | lab.xlsx | ₹1,200 | 7 | 2 | ₹8,500 | -₹100 | ₹8,400 | ₹0 | ₹0 | 1 |
| Pharmacy | pharmacy.xlsx | ₹3,000 | 8 | 2 | ₹30,800 | -₹100 | ₹24,000 | ₹11,100 | ₹4,400 | 1 |

Bill by bill (paid → set to):

| Bill | Consultation | Lab | Pharmacy | What it tests | Left | Short |
| --- | --- | --- | --- | --- | --- | --- |
| 1001 | ₹0 → ₹500 (new) | ₹0 → ₹1,200 (new) | ₹8,500 → ₹3,000 | Paid everything at Pharmacy | ₹3,800 | |
| 1002 | ₹500 → ₹500 | ₹1,200 → ₹1,200 | ₹3,000 → ₹3,000 | Exact everywhere | | |
| 1003 | ₹1,500 → ₹500 | ₹900 → ₹1,200 | ₹0 → ₹3,000 (new, short) | Extra pays a short row first, rest makes a short new row | | ₹2,300 |
| 1004 | ₹300 → ₹500 (short) | – | – | Short, nothing to move | | ₹200 |
| 1005 | ₹500 → ₹500 | – | ₹1,800 → ₹3,000 (short) | Short, nothing to move | | ₹1,200 |
| 1006 | ₹0 → ₹500 (new) | ₹4,000 → ₹1,200 | ₹0 → ₹3,000 (new, short) | Paid at Lab only, not enough for Pharmacy | | ₹700 |
| 1007 | ₹500 → ₹500 | ₹1,200 → ₹1,200 | – | No money left, so no new Pharmacy row | | |
| 1008 | ₹0 → ₹500 (new) | ₹0 → ₹1,200 (new) | ₹12,000 → ₹3,000 | Money still left after every counter | ₹7,300 | |
| 1009 | ₹800 → ₹500 | – | ₹2,500 → ₹3,000 (short) | Extra covers part of a short row | | ₹200 |
| 1010 | – | ₹1,200 → ₹1,200 | ₹3,000 → ₹3,000 | Never visited Consultation | | |

## Client 2: Bright Future Coaching Classes

| Counter | File | Amount per row | Rows | New rows | Total before | Moved in / out | Total after | Amount left | Short | Skipped |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Monthly fees | monthly-fees.xlsx | ₹2,500 | 7 | 2 | ₹18,250 | -₹350 | ₹17,500 | ₹3,750 | ₹3,350 | 2 (Cancelled + Grand Total) |
| Test series | test-series.xlsx | ₹800 | 6 | 2 | ₹3,800 | +₹800 | ₹4,800 | ₹0 | ₹200 | 1 |
| Books | books.csv | ₹450 | 5 | 2 | ₹2,700 | -₹450 | ₹2,250 | ₹0 | ₹0 | 1 |

| Bill | Monthly fees | Test series | Books | What it tests | Left | Short |
| --- | --- | --- | --- | --- | --- | --- |
| R-101 | ₹2,500 → ₹2,500 | ₹800 → ₹800 | ₹450 → ₹450 | Exact everywhere | | |
| R-102 | ₹3,750 → ₹2,500 | ₹0 → ₹800 (new) | ₹0 → ₹450 (new) | Extra fees pay for exactly two new rows | | |
| R-103 | ₹2,000 → ₹2,500 (short) | – | ₹900 → ₹450 | Books extra covers part of fees short | | ₹50 |
| R-104 | ₹0 → ₹2,500 (new, short) | ₹1,600 → ₹800 | – | Paid at Test series only | | ₹1,700 |
| R-105 | Cancelled (skipped) | ₹800 → ₹800 | – | Cancelled voucher is ignored | | |
| R-106 | ₹7,500 → ₹2,500 | ₹0 → ₹800 (new) | ₹0 → ₹450 (new) | Money still left after every counter | ₹3,750 | |
| R-107 | ₹2,500 → ₹2,500 | ₹600 → ₹800 (short) | – | Short, nothing to move | | ₹200 |
| R-108 | ₹0 → ₹2,500 (new, short) | – | ₹1,350 → ₹450 | Paid at Books only | | ₹1,600 |

## Making new samples

`make-samples.js` writes these files and prints both tables. Edit the bills in it, then run this from the `counter-reconciler` folder:

```
node samples/make-samples.js
```
