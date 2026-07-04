// Seeded PRNG so mock data is stable across reloads.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rng = mulberry32(42);
export const rand = (min: number, max: number) => min + rng() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export const severityColor: Record<Severity, string> = {
  critical: "var(--risk-critical)",
  high: "var(--risk-high)",
  medium: "var(--risk-medium)",
  low: "var(--risk-low)",
  info: "var(--risk-info)",
};

// ---------- KPIs ----------
export const kpis = {
  totalThreats: 148_237,
  criticalThreats: 42,
  fraudPreventedUsd: 24_618_400,
  transactionsMonitored: 8_942_113,
  averageRiskScore: 37,
  falsePositiveReduction: 78,
  quantumReadiness: 62,
};

// ---------- Threat timeline (live feed) ----------
const threatSources = ["Firewall", "EDR", "IAM", "Cloud", "DNS", "Email", "SWIFT", "VPN"];
const attackTypes = ["Credential Stuffing", "Business Email Compromise", "Insider Threat", "Malware Beacon", "Data Exfiltration", "Fraudulent Wire", "API Abuse", "Session Hijack", "MFA Fatigue", "Ransomware Precursor"];

export const liveThreats = Array.from({ length: 40 }).map((_, i) => {
  const sev: Severity = pick(["critical","critical","high","high","medium","medium","medium","low","low","info"] as const);
  return {
    id: `T-${10230 - i}`,
    ts: Date.now() - i * 1000 * randInt(20, 240),
    severity: sev,
    source: pick(threatSources),
    type: pick(attackTypes),
    entity: `user-${randInt(1000, 9999)}@bank.com`,
    ip: `${randInt(10,220)}.${randInt(0,255)}.${randInt(0,255)}.${randInt(0,255)}`,
    country: pick(["RU","CN","US","BR","IR","NG","DE","GB","IN","VN"]),
    risk: randInt(30, 99),
  };
});

// ---------- Risk distribution ----------
export const riskDistribution = [
  { name: "Critical", value: 42, color: "var(--risk-critical)" },
  { name: "High", value: 168, color: "var(--risk-high)" },
  { name: "Medium", value: 512, color: "var(--risk-medium)" },
  { name: "Low", value: 2140, color: "var(--risk-low)" },
];

// ---------- Threat heatmap (7 days x 24 hours) ----------
export const heatmap = Array.from({ length: 7 }, (_, d) =>
  Array.from({ length: 24 }, (_, h) => {
    const business = h > 8 && h < 20 ? 1.5 : 0.6;
    return Math.round(rand(4, 60) * business);
  })
);

// ---------- Attack categories ----------
export const attackCategories = [
  { name: "Credential Attacks", value: 3420 },
  { name: "Malware / EDR", value: 2210 },
  { name: "Fraud / Wire", value: 1875 },
  { name: "Phishing / BEC", value: 1642 },
  { name: "Data Exfiltration", value: 921 },
  { name: "API Abuse", value: 640 },
  { name: "Insider", value: 218 },
];

// ---------- Fraud trend (30 days) ----------
export const fraudTrend = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  prevented: Math.round(rand(400_000, 1_400_000)),
  attempted: Math.round(rand(600_000, 2_100_000)),
}));

// ---------- Transaction monitoring stream ----------
export const txStream = Array.from({ length: 60 }, (_, i) => ({
  t: i,
  approved: Math.round(rand(1800, 3200)),
  flagged: Math.round(rand(20, 180)),
  blocked: Math.round(rand(2, 40)),
}));

// ---------- Recent alerts ----------
export const recentAlerts = Array.from({ length: 12 }).map((_, i) => ({
  id: `A-${9018 - i}`,
  title: pick(["Anomalous SWIFT payment", "MFA fatigue detected", "Impossible travel", "Beaconing to C2", "Privileged account misuse", "Bulk wire attempt", "Data exfil to Mega.nz", "Phishing landing hit", "Endpoint EDR quarantine", "IAM role escalation"]),
  severity: pick(["critical","high","medium","medium","low"] as const) as Severity,
  ts: Date.now() - i * 1000 * randInt(60, 900),
  owner: pick(["N. Chen", "R. Patel", "M. Silva", "A. Kowalski", "—"]),
  status: pick(["open","investigating","triage"] as const),
}));

// ---------- Recent investigations ----------
export const recentInvestigations = Array.from({ length: 8 }).map((_, i) => ({
  id: `INV-${2440 + i}`,
  title: pick(["Coordinated wire fraud ring", "APT beaconing over DNS", "Insider data staging", "Account takeover cluster", "Merchant BIN sweep", "PSD2 SCA bypass attempt"]),
  confidence: randInt(72, 98),
  ts: Date.now() - i * 3600_000 * randInt(1, 40),
  impactUsd: randInt(120_000, 4_800_000),
}));

// ---------- Blocked transactions ----------
export const blockedTx = Array.from({ length: 10 }).map((_, i) => ({
  id: `TX-${880_120 - i}`,
  amount: Math.round(rand(5_000, 480_000)),
  currency: pick(["USD","EUR","GBP","CHF"]),
  country: pick(["RU","CN","NG","AE","IR","BR"]),
  reason: pick(["High risk beneficiary", "Impossible travel", "New device + MFA fatigue", "Sanctions list match", "AI correlated attack"]),
  risk: randInt(80, 99),
  ts: Date.now() - i * 1000 * randInt(120, 6000),
}));

// ---------- Correlation Engine events ----------
export type CorrelationEvent = {
  id: string;
  title: string;
  source: string;
  ts: number;
  riskContribution: number;
  confidence: number;
  details: string;
  severity: Severity;
  data: Record<string, string>;
};

const baseTs = Date.now() - 1000 * 60 * 42;
export const correlationEvents: CorrelationEvent[] = [
  { id: "e1", title: "Login", source: "IAM / Okta", ts: baseTs + 0, riskContribution: 5, confidence: 88, severity: "info",
    details: "Successful password + MFA login for corporate customer #C-88214.", data: { user: "j.watson@bank.com", geo: "London, UK", asn: "AS15169" } },
  { id: "e2", title: "New Device", source: "Endpoint / MDM", ts: baseTs + 62_000, riskContribution: 9, confidence: 91, severity: "low",
    details: "Login originated from an unenrolled Windows 11 device with a fresh fingerprint.", data: { os: "Windows 11 23H2", fingerprint: "fp-7ab3…921", trusted: "false" } },
  { id: "e3", title: "VPN Anchor", source: "Network / VPN", ts: baseTs + 145_000, riskContribution: 12, confidence: 86, severity: "medium",
    details: "Session traversed a commercial VPN exit node in NL, breaking the customer's usual geo pattern.", data: { exit: "NordVPN NL-421", asn: "AS9009", geoDelta: "1200km" } },
  { id: "e4", title: "Endpoint Malware", source: "EDR / SentinelOne", ts: baseTs + 260_000, riskContribution: 22, confidence: 94, severity: "high",
    details: "Info-stealer variant (RedLine.C2) executed and read chromium credential store.", data: { family: "RedLine", hash: "b8f2…ac91", action: "Quarantined" } },
  { id: "e5", title: "Password Reset", source: "IAM", ts: baseTs + 380_000, riskContribution: 14, confidence: 89, severity: "medium",
    details: "Self-service password reset completed 3 minutes after malware execution.", data: { channel: "Email token", ip: "185.220.101.44" } },
  { id: "e6", title: "New Beneficiary", source: "Core Banking", ts: baseTs + 520_000, riskContribution: 18, confidence: 90, severity: "high",
    details: "Beneficiary added: IBAN NL22INGB0007…, no prior relationship, high-risk MCC.", data: { iban: "NL22 INGB 0007 214 921", bic: "INGBNL2A" } },
  { id: "e7", title: "Large Transaction", source: "Payments / SWIFT", ts: baseTs + 620_000, riskContribution: 24, confidence: 93, severity: "critical",
    details: "SWIFT MT103 for EUR 482,000 to newly added beneficiary. Amount is 34× the customer's 90-day median.", data: { amount: "EUR 482,000", channel: "SWIFT MT103" } },
  { id: "e8", title: "Threat Intel Match", source: "TI / Recorded Future", ts: baseTs + 640_000, riskContribution: 20, confidence: 96, severity: "critical",
    details: "Beneficiary IBAN appears on Europol mule-account feed (Campaign: FIN7-Wire-24Q4).", data: { feed: "Europol EMPACT", campaign: "FIN7-Wire-24Q4", ttl: "72h" } },
  { id: "e9", title: "Final AI Decision", source: "SentinelQ AI Core", ts: baseTs + 660_000, riskContribution: 0, confidence: 97, severity: "critical",
    details: "Correlated fraud + cyber attack. Payment held, session revoked, customer notified, SOC ticket opened.", data: { verdict: "BLOCK", action: "Auto-mitigate", ticket: "SOC-90218" } },
];

export const correlationSummary = {
  score: 94,
  attackType: "Account Takeover → Authorized Push Payment Fraud",
  confidence: 97,
  businessImpactUsd: 512_000,
  fraudProbability: 96,
  cyberThreatProbability: 89,
};

// ---------- Transactions table ----------
export const transactions = Array.from({ length: 60 }).map((_, i) => ({
  id: `TX-${900_000 + i}`,
  ts: Date.now() - i * 60_000 * randInt(1, 30),
  amount: Math.round(rand(20, 480_000)),
  currency: pick(["USD","EUR","GBP","CHF","JPY"]),
  country: pick(["US","GB","DE","FR","JP","BR","RU","CN","NG","AE","IN","NL"]),
  device: pick(["iOS","Android","Web","API"]),
  method: pick(["Card","SEPA","SWIFT","ACH","Instant"]),
  merchant: pick(["Amazon","Nike","Steam","Binance","Local Wire","Salary","Cash Advance","Adyen","Booking.com"]),
  status: pick(["approved","approved","approved","flagged","blocked"] as const),
  risk: randInt(1, 99),
  customer: `C-${randInt(10_000, 99_999)}`,
}));

// ---------- Telemetry per category ----------
export const telemetryCategories = ["Firewall","VPN","IAM","Endpoint","Email","Cloud","DNS","Authentication"] as const;
export type TelemetryCategory = typeof telemetryCategories[number];

export function generateTelemetry(cat: TelemetryCategory, n = 30) {
  return Array.from({ length: n }).map((_, i) => ({
    id: `${cat.slice(0,3).toUpperCase()}-${randInt(10000,99999)}-${i}`,
    ts: Date.now() - i * 1000 * randInt(30, 900),
    severity: pick(["critical","high","medium","medium","low","info"] as const) as Severity,
    source: cat === "Firewall" ? pick(["Palo Alto","Fortinet","Check Point"])
      : cat === "VPN" ? pick(["Cisco AnyConnect","GlobalProtect","Zscaler"])
      : cat === "IAM" ? pick(["Okta","Azure AD","Ping"])
      : cat === "Endpoint" ? pick(["SentinelOne","CrowdStrike","Defender"])
      : cat === "Email" ? pick(["Proofpoint","Mimecast","M365"])
      : cat === "Cloud" ? pick(["AWS CloudTrail","Azure Monitor","GCP Audit"])
      : cat === "DNS" ? pick(["Cisco Umbrella","Cloudflare Gateway"])
      : pick(["Okta","Azure AD","Duo"]),
    message: pick([
      "Anomalous authentication burst detected",
      "Suspicious outbound to newly-registered domain",
      "Privileged role assignment outside change window",
      "Encrypted archive uploaded to consumer storage",
      "Impossible travel — 2 successful logins",
      "MFA push flood targeting single user",
      "Certificate downgrade to TLS 1.0 attempted",
      "Unusual API call volume from service principal",
      "Beaconing pattern (jitter 30s) to 185.220.x",
      "Endpoint quarantine: RedLine.stealer variant",
    ]),
    user: `u-${randInt(1000,9999)}@bank.com`,
    device: `dev-${randInt(100,999)}`,
    risk: randInt(10, 99),
  }));
}

// ---------- Threat intelligence ----------
export const maliciousIps = Array.from({ length: 15 }).map((_, i) => ({
  ip: `${randInt(20,220)}.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,254)}`,
  country: pick(["RU","CN","IR","NG","BR","VN","US","IN"]),
  category: pick(["C2","Scanner","Botnet","Phishing","Ransomware","Exfil"]),
  firstSeen: Date.now() - randInt(1, 90) * 86400_000,
  confidence: randInt(60, 99),
  hits: randInt(1, 4200),
  id: `IP-${i}`,
}));

export const threatCampaigns = [
  { name: "FIN7 Wire-24Q4", actor: "FIN7", sector: "Banking / Payments", ttps: 12, victims: 214, updated: "2h ago" },
  { name: "Storm-1811 BEC", actor: "Storm-1811", sector: "Corporate Treasury", ttps: 8, victims: 87, updated: "6h ago" },
  { name: "Scattered Spider MFA", actor: "UNC3944", sector: "Retail Banking", ttps: 14, victims: 342, updated: "1d ago" },
  { name: "Kimsuky Recon", actor: "APT43", sector: "Central Banks", ttps: 9, victims: 41, updated: "2d ago" },
  { name: "LockBit 4.0 Ops", actor: "LockBit", sector: "Financial Services", ttps: 18, victims: 612, updated: "12h ago" },
  { name: "MoqHao Mobile", actor: "Roaming Mantis", sector: "Retail Banking", ttps: 7, victims: 189, updated: "4h ago" },
];

export const malwareFamilies = [
  { name: "RedLine", type: "Infostealer", trend: 41 },
  { name: "IcedID", type: "Loader", trend: -8 },
  { name: "Emotet", type: "Botnet", trend: 14 },
  { name: "LockBit", type: "Ransomware", trend: 22 },
  { name: "MoqHao", type: "Mobile Banking", trend: 33 },
  { name: "Qakbot", type: "Banking Trojan", trend: -12 },
];

export const mitreMatrix = {
  tactics: ["Initial Access","Execution","Persistence","Priv. Esc.","Defense Evasion","Credential Access","Discovery","Lateral","Collection","C2","Exfiltration","Impact"],
  hot: [
    { t: 0, n: 4 }, { t: 1, n: 3 }, { t: 5, n: 7 }, { t: 4, n: 6 }, { t: 9, n: 8 },
    { t: 10, n: 5 }, { t: 11, n: 3 }, { t: 7, n: 4 }, { t: 3, n: 2 }, { t: 2, n: 3 },
  ],
};

export const iocs = Array.from({ length: 12 }).map((_, i) => ({
  id: `IOC-${i}`,
  type: pick(["SHA256","Domain","URL","IP","Email"]),
  value: pick([
    "b8f2c19ac1e2…a0f1", "login-secure-bnk[.]top", "185.220.101.44",
    "c2.pay-alerts[.]xyz", "help@bank-support[.]co", "d41d8cd98f00…e42"
  ]),
  campaign: pick(["FIN7-24Q4","Storm-1811","LockBit 4.0","Kimsuky"]),
  first: `${randInt(1,30)}d ago`,
  conf: randInt(70, 99),
}));

// ---------- Quantum ----------
export const cryptoAssets = [
  { asset: "TLS 1.0 endpoints", count: 42, risk: "critical" as Severity, hndl: 12_400_000 },
  { asset: "TLS 1.2 (RSA-2048)", count: 1_284, risk: "high" as Severity, hndl: 88_600_000 },
  { asset: "TLS 1.3 (X25519)", count: 3_912, risk: "medium" as Severity, hndl: 210_000_000 },
  { asset: "RSA-2048 keys in HSM", count: 214, risk: "high" as Severity, hndl: 340_000_000 },
  { asset: "ECC P-256 signing keys", count: 128, risk: "medium" as Severity, hndl: 92_000_000 },
  { asset: "Legacy 3DES payment HSM", count: 6, risk: "critical" as Severity, hndl: 4_200_000 },
  { asset: "AES-256 data-at-rest", count: 14_820, risk: "low" as Severity, hndl: 0 },
];

export const quantumRoadmap = [
  { q: "2025 Q1", milestone: "Inventory & crypto-agility library", status: "done" },
  { q: "2025 Q3", milestone: "Deprecate TLS <1.2, migrate 3DES", status: "in-progress" },
  { q: "2026 Q2", milestone: "Hybrid Kyber+X25519 in customer channels", status: "planned" },
  { q: "2026 Q4", milestone: "Dilithium signatures for internal PKI", status: "planned" },
  { q: "2027 Q4", milestone: "Full PQC on SWIFT + core banking", status: "planned" },
];

// ---------- Customers ----------
export const customers = Array.from({ length: 12 }).map((_, i) => ({
  id: `C-${10_000 + i * 37}`,
  name: pick(["Jonathan Watson","Priya Ramanathan","Marcus Silva","Anna Kowalski","Yuki Tanaka","Aisha Bello","Diego Fernandez","Hannah Müller","Omar Haddad","Sofia Rossi","Chen Wei","Isabelle Laurent"]),
  segment: pick(["Retail","Wealth","SMB","Corporate"]),
  risk: randInt(5, 92),
  trustedDevices: randInt(1, 5),
  avgAmount: randInt(80, 12_000),
  activeHour: randInt(7, 22),
  location: pick(["London","Paris","Berlin","New York","Tokyo","Lagos","São Paulo","Dubai"]),
}));

// ---------- Explainable AI ----------
export const shapFactors = [
  { name: "Beneficiary on TI mule feed", value: +0.34, positive: false },
  { name: "SWIFT amount vs 90-day median", value: +0.22, positive: false },
  { name: "New device + VPN in 5 min", value: +0.18, positive: false },
  { name: "Malware execution on endpoint", value: +0.14, positive: false },
  { name: "Password reset velocity", value: +0.06, positive: false },
  { name: "Customer verified via MFA", value: -0.05, positive: true },
  { name: "Long-tenured account (11y)", value: -0.03, positive: true },
];

// ---------- Knowledge Graph ----------
export type GNode = { id: string; type: "Customer"|"Account"|"Device"|"IP"|"Transaction"|"Merchant"|"Actor"|"Malware"|"Location"|"VPN"; label: string };
export type GEdge = { from: string; to: string; label?: string };

export const graph: { nodes: GNode[]; edges: GEdge[] } = {
  nodes: [
    { id: "c1", type: "Customer", label: "J. Watson" },
    { id: "a1", type: "Account", label: "ACC-8821" },
    { id: "d1", type: "Device", label: "iPhone 15" },
    { id: "d2", type: "Device", label: "Win11-Fresh" },
    { id: "ip1", type: "IP", label: "185.220.101.44" },
    { id: "ip2", type: "IP", label: "82.14.19.7" },
    { id: "v1", type: "VPN", label: "NordVPN NL" },
    { id: "l1", type: "Location", label: "London, UK" },
    { id: "l2", type: "Location", label: "Amsterdam, NL" },
    { id: "t1", type: "Transaction", label: "€482,000" },
    { id: "t2", type: "Transaction", label: "€120" },
    { id: "m1", type: "Merchant", label: "Beneficiary NL22" },
    { id: "act1", type: "Actor", label: "FIN7" },
    { id: "mw1", type: "Malware", label: "RedLine" },
  ],
  edges: [
    { from: "c1", to: "a1", label: "owns" },
    { from: "c1", to: "d1", label: "trusted" },
    { from: "a1", to: "d1" },
    { from: "a1", to: "d2", label: "new" },
    { from: "d2", to: "ip1" },
    { from: "ip1", to: "v1" },
    { from: "v1", to: "l2" },
    { from: "d1", to: "l1" },
    { from: "a1", to: "t1", label: "wire" },
    { from: "t1", to: "m1" },
    { from: "m1", to: "act1", label: "linked" },
    { from: "d2", to: "mw1", label: "infected" },
    { from: "mw1", to: "act1" },
    { from: "a1", to: "t2" },
    { from: "d1", to: "ip2" },
  ],
};

// ---------- Alerts ----------
export const alerts = Array.from({ length: 24 }).map((_, i) => ({
  id: `ALT-${20_100 + i}`,
  title: pick(["APT beacon on core-banking segment","SWIFT MT103 auto-blocked","Insider staging to /tmp","Impossible travel — VIP account","Ransomware precursor on branch VLAN","MFA fatigue on treasury desk","Data exfil to Mega.nz","BEC lure delivered to CFO","Privileged token replay","Card BIN attack from AS9009"]),
  severity: pick(["critical","critical","high","high","medium","medium","low"] as const) as Severity,
  ts: Date.now() - i * 1000 * randInt(120, 12_000),
  status: pick(["open","open","investigating","acknowledged","resolved"] as const),
  assignee: pick(["N. Chen","R. Patel","M. Silva","A. Kowalski","—","—"]),
  slaMin: randInt(-30, 180),
  source: pick(["EDR","SIEM","Fraud Engine","TI","Email","IAM"]),
}));

// ---------- Country coords for world map ----------
export const countryCoords: Record<string, [number, number]> = {
  US: [-100, 40], GB: [-2, 54], DE: [10, 51], FR: [2, 47], JP: [138, 36],
  BR: [-52, -10], RU: [90, 62], CN: [104, 35], NG: [8, 10], AE: [54, 24],
  IN: [78, 21], NL: [5, 52], IR: [53, 32], VN: [108, 16],
};
