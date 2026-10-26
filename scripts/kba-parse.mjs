// Parses the Kenya Bankers Association "Total Cost of Credit" interest-rate
// report (https://www.costofcredit.co.ke/site/interest-rate, as markdown) into
// per-bank personal-loan rates: the average, minimum and maximum tabs.

const COLS = ["asset", "business", "corporate", "digital", "mortgage", "personal"];
const RATE_ROWS = ["Central Bank Rate (CBR) + Bank Premium (K)", "KESONIA + Premium"];

const toIso = (dmy) => (dmy ? dmy.split("/").reverse().join("-") : undefined);

export function parseKbaReport(markdown) {
  const tabs = {};
  let tab = null;
  let bank = null;
  for (const line of markdown.split("\n")) {
    const t = line.match(/following are the (\w+)/);
    if (t) { tab = t[1]; tabs[tab] = {}; bank = null; continue; }
    if (!tab) continue;
    const b = line.match(/^\| \*\*\[(.+?)\]\((.+?)\)\*\* \|/);
    if (b) { bank = b[1]; tabs[tab][bank] = { url: b[2] }; continue; }
    if (!bank || !line.startsWith("| ")) continue;
    const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (!RATE_ROWS.includes(cells[0])) continue;
    cells.slice(1).forEach((v, i) => {
      const m = v.match(/^(-?[\d.]+)%(?:.*?Last updated on:<br>(\d\d\/\d\d\/\d{4}))?/);
      const col = COLS.at(i);
      if (m && col && !(col in tabs[tab][bank])) tabs[tab][bank][col] = { rate: Number(m[1]), updatedOn: toIso(m[2]) };
    });
  }
  return tabs;
}

// Report columns borrowers can hold, mapped to the app's product kinds.
export const KINDS = { personal: "personal", digital: "mobile", asset: "asset", mortgage: "mortgage", business: "business" };

// One row per bank per product it reports a rate for.
export function productRates(tabs, cols = Object.keys(KINDS)) {
  const avg = tabs.average ?? {};
  return cols.flatMap((col) => Object.entries(avg)
    .filter(([, v]) => v[col] && v[col].rate > 0)
    .map(([name, v]) => {
      const lo = tabs.minimum?.[name]?.[col]?.rate;
      const hi = tabs.maximum?.[name]?.[col]?.rate;
      const all = [v[col].rate, lo, hi].filter((x) => typeof x === "number" && x > 0);
      return {
        bank: name,
        kind: KINDS[col],
        sourceUrl: v.url,
        rate: v[col].rate,
        rateMin: Math.min(...all),
        rateMax: Math.max(...all),
        updatedOn: v[col].updatedOn,
      };
    }));
}

// One row per bank that reports a personal-loan rate.
export const personalRates = (tabs) => productRates(tabs, ["personal"]);
