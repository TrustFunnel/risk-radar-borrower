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

// One row per bank that reports a personal-loan rate.
export function personalRates(tabs) {
  const avg = tabs.average ?? {};
  return Object.entries(avg)
    .filter(([, v]) => v.personal && v.personal.rate > 0)
    .map(([name, v]) => {
      const lo = tabs.minimum?.[name]?.personal?.rate;
      const hi = tabs.maximum?.[name]?.personal?.rate;
      const all = [v.personal.rate, lo, hi].filter((x) => typeof x === "number" && x > 0);
      return {
        bank: name,
        sourceUrl: v.url,
        rate: v.personal.rate,
        rateMin: Math.min(...all),
        rateMax: Math.max(...all),
        updatedOn: v.personal.updatedOn,
      };
    });
}
