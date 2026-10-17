# Test guide

Two made-up clients are in `samples/`. Each run of `node samples/make-samples.js` recreates exactly the same files, so the results below never change.

## Client 1: City Nursing Home (3 accounts)

Excel files with two title rows on top, real Excel dates and a Total line at the bottom.

1. Double-click `index.html`.
2. Type **City Nursing Home** as Client and **Q2 FY 2026-27** as Quarter.
3. Name the cards Consultation, Lab and Pharmacy, choose each file from `samples/client-1-city-nursing-home/`, and type each amount per row from the table.
4. Press **Submit** and compare each card with the table.

| Account | File | Amount per row (₹) | Amount left | Short | Skipped |
| --- | --- | --- | --- | --- | --- |
| Consultation | consultation.xlsx | 500 | 7 rows · ₹18,250 | 11 rows · ₹3,500 | 1 (Total line) |
| Lab | lab.xlsx | 1,200 | 15 rows · ₹37,750 | 3 rows · ₹1,800 | 1 (Total line) |
| Pharmacy | pharmacy.xlsx | 3,000 | 16 rows · ₹36,500 | 4 rows · ₹1,600 | 1 (Total line) |

## Client 2: Sharma Traders (4 accounts)

Tally-style headers (Vch Date, Vch No, Party, Received), one CSV file, amounts typed as text such as "₹4,750", a blank row, an "N/A" amount and a refund (a negative amount).

1. Reload the page (to start clean) and type **Sharma Traders** as Client.
2. Click **+ Add account** once so there are 4 cards.
3. Name them Hardware, Paints, Electrical and Plumbing, choose each file from `samples/client-2-sharma-traders/`, and type each amount.
4. Press **Submit** and compare.

| Account | File | Amount per row (₹) | Amount left | Short | Skipped |
| --- | --- | --- | --- | --- | --- |
| Hardware | hardware.xlsx | 2,000 | 7 rows · ₹18,000 | 6 rows · ₹5,100 | 1 (N/A) |
| Paints | paints.xlsx | 4,500 | 6 rows · ₹18,000 | 9 rows · ₹13,000 | 1 (N/A) |
| Electrical | electrical.csv | 1,500 | 2 rows · ₹4,250 | 9 rows · ₹7,400 | 1 (N/A) |
| Plumbing | plumbing.xlsx | 800 | 6 rows · ₹15,500 | 5 rows · ₹3,200 | 1 (N/A) |

## Things to check on the way

- **Show rows** on a red alert opens a table below the cards; the refund row (Party "Refund to …") is at the top with the largest negative difference.
- Clicking the same **Show rows** again closes the table.
- The Amount column dropdown shows "Amount" for client 1 and "Received" for client 2: the tool found the right column by itself.
- **Download combined workbook** gives one file with Summary, one sheet per account, and Differences. Open it in Excel and check that the Differences sheet lists every amber and red row.
- Leave one amount box empty and press Submit: you should get a red message, not a crash.
