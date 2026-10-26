// Industry of a borrower's work, guessed from the employer and job title they
// type. The early warning side uses it to watch for stress in that sector
// (layoffs, delayed pay); the borrower can always correct the guess.
// Sections follow KNBS's grouping of the Kenyan economy, simplified.

export const INDUSTRIES = [
  "Agriculture and agribusiness",
  "Manufacturing",
  "Construction and real estate",
  "Wholesale and retail trade",
  "Transport and logistics",
  "Hotels, tourism and food",
  "ICT and telecoms",
  "Banking, insurance and finance",
  "Government and public service",
  "Education",
  "Health",
  "Energy, water and utilities",
  "Mining",
  "Professional services",
  "NGO and non-profit",
  "Security services",
  "Media, arts and entertainment",
  "Other",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export type EmploymentType = "employed" | "civil_servant" | "self_employed" | "business_owner" | "casual" | "unemployed";

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "employed", label: "Employed (private company)" },
  { value: "civil_servant", label: "Government / civil servant" },
  { value: "self_employed", label: "Self-employed / freelancer" },
  { value: "business_owner", label: "Run my own business" },
  { value: "casual", label: "Casual or gig work (boda, delivery)" },
  { value: "unemployed", label: "Not working right now" },
];

// Well-known Kenyan employers first, so "KCB" or "TSC" resolves exactly.
const EMPLOYERS: [RegExp, Industry][] = [
  [/\b(safaricom|airtel|telkom|liquid|jamii|zuku|faiba)\b/, "ICT and telecoms"],
  [/\b(kcb|equity|co-?op(erative)? bank|ncba|absa|stanbic|standard chartered|dtb|i&m|family bank|sidian|kingdom bank|letshego|faulu|kwft|britam|jubilee|cic|sanlam|old mutual|madison|apa|nse|cbk|central bank|stima sacco|mwalimu sacco|harambee sacco|unaitas|tala|branch|m-?kopa)\b/, "Banking, insurance and finance"],
  [/\b(tsc|teachers service|university|college|academy|school|kenyatta university|uon|jkuat|moi university|strathmore)\b/, "Education"],
  [/\b(kdf|defence forces|national police|kenya police|nps|kra|county government|county of|ministry|state department|judiciary|parliament|kenha|kura|kerra|ntsa|nssf|nhif|sha|shif|kenya prisons|public service|government)\b/, "Government and public service"],
  [/\b(kengen|kplc|kenya power|ketraco|kenya pipeline|vivo energy|rubis|totalenergies|water (and sewerage )?company|nairobi water|ewasco|geothermal)\b/, "Energy, water and utilities"],
  [/\b(knh|kenyatta national hospital|aga khan|nairobi hospital|mp shah|gertrude|mater|hospital|clinic|pharmacy|medical|health centre|dispensary)\b/, "Health"],
  [/\b(naivas|quickmart|carrefour|chandarana|tuskys|cleanshelf|jumia|kilimall|duka|shop|supermarket|wholesale|retail)\b/, "Wholesale and retail trade"],
  [/\b(bidco|eabl|kenya breweries|bamburi|unga|brookside|pwani oil|mabati|devki|kapa|factory|manufactur\w*|millers?)\b/, "Manufacturing"],
  [/\b(kenya airways|kq|kenya railways|sgr|kpa|ports authority|uber|bolt|little cab|g4s logistics|dhl|wells fargo|matatu|sacco transport|boda|courier|logistics|transport|trucking|freight|clearing and forwarding)\b/, "Transport and logistics"],
  [/\b(kenya tea|ktda|tea estate|flower|floricultur\w*|horticulture|coffee|sugar|mumias|chemelil|nzoia|kakuzi|del monte|farm|dairy|new kcc|agri\w*)\b/, "Agriculture and agribusiness"],
  [/\b(serena|sarova|hilton|marriott|radisson|kempinski|java house|kfc|artcaffe|hotel|lodge|resort|restaurant|cafe|tours|safari)\b/, "Hotels, tourism and food"],
  [/\b(g4s|securex|kk security|bm security|security guard|security services)\b/, "Security services"],
  [/\b(un|unicef|unhcr|wfp|amref|world vision|red cross|ngo|foundation|church|mission)\b/, "NGO and non-profit"],
  [/\b(nation media|standard group|royal media|citizen tv|radio|tv station|studio|music|film)\b/, "Media, arts and entertainment"],
  [/\b(deloitte|pwc|kpmg|ernst|ey|law firm|advocates|consult\w*)\b/, "Professional services"],
  [/\b(base titanium|mining|quarry)\b/, "Mining"],
  [/\b(construction|contractor|builders?|real estate|properties|hass|cytonn)\b/, "Construction and real estate"],
];

// Then the job title, for employers we don't know.
const TITLES: [RegExp, Industry][] = [
  [/\b(teacher|lecturer|tutor|principal|head ?teacher|ecde)\b/, "Education"],
  [/\b(nurse|doctor|clinical officer|pharmac\w*|lab tech|physiotherap\w*|dentist|chv|community health)\b/, "Health"],
  [/\b(police|officer.*(county|ministry)|chief|clerk.*county|civil servant|soldier|warder)\b/, "Government and public service"],
  [/\b(driver|rider|boda|conductor|mechanic|dispatch|delivery|turn ?boy)\b/, "Transport and logistics"],
  [/\b(farmer|farm|agronomist|dairy|livestock|fisher|vet)\b/, "Agriculture and agribusiness"],
  [/\b(mason|fundi|carpenter|plumber|electrician|welder|foreman|site engineer|quantity surveyor|architect)\b/, "Construction and real estate"],
  [/\b(developer|software|it support|network|data analyst|engineer.*(software|network))\b/, "ICT and telecoms"],
  [/\b(banker|teller|loan officer|credit officer|relationship manager|accountant|insurance agent|actuar\w*)\b/, "Banking, insurance and finance"],
  [/\b(chef|cook|waiter|waitress|barista|housekeep|tour guide|receptionist.*hotel)\b/, "Hotels, tourism and food"],
  [/\b(shop|trader|mama mboga|hawker|sales ?(person|rep|agent)|cashier|retail|wholesale|m-?pesa agent)\b/, "Wholesale and retail trade"],
  [/\b(guard|watchman|askari|security)\b/, "Security services"],
  [/\b(machine operator|factory|production|tailor|seamstress)\b/, "Manufacturing"],
  [/\b(lawyer|advocate|consultant|auditor)\b/, "Professional services"],
  [/\b(journalist|musician|artist|actor|photographer|content creator|dj)\b/, "Media, arts and entertainment"],
  [/\b(miner|quarry)\b/, "Mining"],
];

export interface IndustryGuess {
  industry: Industry;
  basis: "employer" | "job_title";
}

export function guessIndustry(employer: string, jobTitle: string): IndustryGuess | null {
  const e = ` ${employer.toLowerCase()} `;
  const t = ` ${jobTitle.toLowerCase()} `;
  for (const [re, industry] of EMPLOYERS) if (re.test(e)) return { industry, basis: "employer" };
  for (const [re, industry] of TITLES) if (re.test(t)) return { industry, basis: "job_title" };
  return null;
}

export const isIndustry = (s: string): s is Industry => (INDUSTRIES as readonly string[]).includes(s);
