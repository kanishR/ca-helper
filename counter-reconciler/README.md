# Counter Sheet Reconciler

A small web page for a CA. Upload the receipt sheet of each counter of a client (for example Consultation, Lab and Pharmacy of a nursing home, or Fees, Test series and Books of a coaching class), type one **amount per row** for each counter, and press **Submit**. It works for any client: name the counters whatever that client calls them. The page then:

- sets every row of a sheet to that amount (*After*) and keeps the uploaded amount (*Before*),
- flags rows that still have **amount left** (Before is more than the amount) in amber,
- flags **short** rows (Before is less than the amount, so the difference is negative) in red,
- matches rows across counters by **bill number** (same bill = same patient / customer). Money left on one counter first pays that bill's short rows on other counters; what is still left adds a new row for that bill on each counter where it has no row (marked Short if the money runs out). Each moved amount is noted on the row,
- shows those rows in a table with Before, Moved, After, Difference and a note when you click **Show rows**,
- downloads one cleaned Excel file per counter (the amount column set to the new amount, the sheet's own Total line updated to the new sum, new rows added above the Total, and Before / Moved / Difference / Flag / Note columns added) and one combined workbook (Summary, one cleaned sheet per counter, Differences).

The same rule applies to every payment mode: cash, UPI, card and bank transfer.

## How to use it

1. Download this repository (green **Code** button, then **Download ZIP**) and unzip it.
2. Open the `counter-reconciler` folder and double-click `index.html`. It opens in your browser. No internet, no install, no account.
3. Try it with the sample sheets for two made-up clients in `samples/` (see [samples/README.md](samples/README.md) for what to type and what you should see).

Files never leave the computer: the page reads them inside the browser tab and writes the downloads from there.

## How a web page works (the parts of this project)

A web page is plain text files that the browser downloads and runs. There is no "app" beyond these files:

| File | Language | Its one job |
| --- | --- | --- |
| `index.html` | HTML | **Structure**: what is on the page (headings, inputs, buttons, an empty area for the cards). |
| `style.css` | CSS | **Looks**: colours, spacing, the card grid. Delete it and the page still works, just plain. |
| `rules.js` | JavaScript | **The business rule**: before, after, difference, flag. No page code, so it can be tested on its own. |
| `app.js` | JavaScript | **Behaviour**: reacts to file picks and clicks, calls the rule, draws alerts and tables, makes downloads. |
| `vendor/xlsx.full.min.js` | JavaScript | **SheetJS**, a library that reads and writes Excel files. Copied in so the page works offline. |
| `rules.test.js` | JavaScript | Tests for the rule, run with Node. |
| `samples/` | Excel, CSV | Made-up sheets for two clients to try the page with. `make-samples.js` regenerates them. |

What happens when you open the page:

1. The browser reads `index.html` top to bottom and builds the **DOM**, a tree of objects for every element on the page.
2. It loads `style.css` and applies the rules to those elements.
3. It runs the three `<script>` files in order. `app.js` creates the three cards from the `<template>` in the HTML and attaches **event listeners** (functions that run when something happens, like a click).
4. When you pick a file, the browser hands its bytes to `app.js`, SheetJS turns them into rows, and nothing is sent anywhere.
5. When you click a download button, SheetJS builds an `.xlsx` in memory and the browser saves it.

There is no server and no database. That is deliberate (simple, free, and client data stays private). A server is only needed later if we want logins, saved clients or payments.

## Running the tests

Install [Node.js](https://nodejs.org) (free), then in this folder:

```
node --test
```

## Hosting it (optional, free)

Opening `index.html` from disk is enough for one user. To get a link for the CA without sending files:

- **Netlify** or **Cloudflare Pages** (free plans) can publish a private GitHub repository: sign in with GitHub, pick this repo, no build command, publish directory `counter-reconciler`.
- GitHub Pages on a private repository needs a paid GitHub plan, so it is not the default here.

## What version 1 does not do yet

- Colour the cells inside the downloaded Excel files (the Flag column says Amount left / Short instead).
- Read a sheet other than the first one in a workbook.
