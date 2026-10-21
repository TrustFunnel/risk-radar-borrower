// Lender type for each bank name in the KBA report.
export const lenderType = (name) => (/microfinance/i.test(name) ? "mfi" : "bank");

export const slug = (name) =>
  name.toLowerCase().replace(/&/g, "and").replace(/\b(limited|ltd|plc|kenya|\(k\)|bank|of|the)\b/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bank";
