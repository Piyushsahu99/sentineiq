import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { Switch } from "@/components/ui/switch";
import { Shield, Bell, Plug, Database, Rss, Atom, KeyRound, RotateCw, Sparkles, Trash2, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { seedDeterministic } from "@/lib/seed.functions";
import { updateProfilePrefs } from "@/lib/prefs.functions";
import { REGIONS, type RegionCode, usePrefs, refreshPrefs, formatMoney, formatCompact } from "@/lib/currency";

export const Route = createFileRoute("/_app/settings")({
  ssr: false,
  component: SettingsPage,
});

const tabs = [
  { k: "region", label: "Region & Currency", icon: Globe2 },
  { k: "data", label: "Demo Data", icon: Sparkles },
  { k: "roles", label: "User Roles", icon: Shield },
  { k: "notifs", label: "Notifications", icon: Bell },
  { k: "api", label: "API Integrations", icon: Plug },
  { k: "siem", label: "SIEM Integrations", icon: Database },
  { k: "feeds", label: "Threat Feeds", icon: Rss },
  { k: "quantum", label: "Quantum Policy", icon: Atom },
] as const;


function SettingsPage() {
  const [tab, setTab] = useState<typeof tabs[number]["k"]>("region");
  const seed = useServerFn(seedDeterministic);
  const updatePrefs = useServerFn(updateProfilePrefs);
  const prefs = usePrefs();
  const [region, setRegion] = useState<RegionCode>(prefs.region);
  const [bank, setBank] = useState(prefs.bank);
  const [currency, setCurrency] = useState(prefs.currency);
  const [savingPrefs, setSavingPrefs] = useState(false);
  useEffect(() => { setRegion(prefs.region); setBank(prefs.bank); setCurrency(prefs.currency); }, [prefs.region, prefs.bank, prefs.currency]);

  const [busy, setBusy] = useState<null | "seed" | "reset">(null);

  async function runSeed(scenario: "demo" | "high_risk" | "baseline" | "reset") {
    setBusy(scenario === "reset" ? "reset" : "seed");
    try {
      const res = await seed({ data: { scenario, currency: prefs.currency } });
      if (scenario === "reset") {
        toast.success("Demo data cleared.");
      } else {
        toast.success(
          `Seeded: ${res.transactions?.length ?? 0} tx · ${res.alerts ?? 0} alerts · ${res.investigations ?? 0} investigations · ${res.telemetry_count ?? 0} telemetry`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setBusy(null);
    }
  }


  return (
    <div>
      <PageHeader title="Settings" subtitle="Governance, integrations, and platform policy." />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-3">
          <GlassCard className="p-2">
            {tabs.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${tab === t.k ? "bg-white/8" : "hover:bg-white/4 text-muted-foreground"}`}>
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </GlassCard>
        </div>

        <div className="col-span-12 md:col-span-9 space-y-6">
          {tab === "region" && (
            <GlassCard>
              <SectionHeader
                title="Region, bank & currency"
                description="Applies to every module. Currency changes optionally re-seed the tenant so numbers stay consistent."
                action={<Link to="/profile" className="text-[11px] text-cyan-300 hover:underline">Open full profile →</Link>}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Region</span>
                  <select value={region} onChange={(e) => {
                    const r = e.target.value as RegionCode;
                    setRegion(r); setCurrency(REGIONS[r].currency); setBank(REGIONS[r].banks[0]);
                  }} className="mt-1 w-full bg-white/5 hairline rounded-lg px-3 py-2 text-sm">
                    {(Object.keys(REGIONS) as RegionCode[]).map((k) => <option key={k} value={k}>{REGIONS[k].label} ({k})</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Bank</span>
                  <select value={bank} onChange={(e) => setBank(e.target.value)} className="mt-1 w-full bg-white/5 hairline rounded-lg px-3 py-2 text-sm">
                    {REGIONS[region].banks.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Currency</span>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full bg-white/5 hairline rounded-lg px-3 py-2 text-sm">
                    {["INR","USD","EUR","GBP","AED","SGD","JPY"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">Preview: <span className="font-mono text-cyan-300">{formatMoney(125000, { currency, region, locale: REGIONS[region].locale, bank })}</span></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={savingPrefs} onClick={async () => {
                  setSavingPrefs(true);
                  try { await updatePrefs({ data: { region, currency, bank } }); await refreshPrefs(); toast.success("Preferences saved"); }
                  catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  finally { setSavingPrefs(false); }
                }} className="text-xs px-3 py-2 rounded-lg hairline hover:bg-white/6 disabled:opacity-60">
                  {savingPrefs ? "Saving…" : "Save preferences"}
                </button>
                <button disabled={savingPrefs || currency === prefs.currency} onClick={async () => {
                  setSavingPrefs(true);
                  try {
                    await updatePrefs({ data: { region, currency, bank } });
                    await refreshPrefs();
                    await seed({ data: { scenario: "demo", currency } });
                    toast.success("Saved & re-seeded in " + currency);
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
                  finally { setSavingPrefs(false); }
                }} className="text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold hover:brightness-110 disabled:opacity-60">
                  Save & re-seed tenant in {currency}
                </button>
              </div>
            </GlassCard>
          )}

          {tab === "data" && (

            <GlassCard>
              <SectionHeader
                title="Demo Data"
                description="Populate every module with a deterministic, idempotent dataset — safe to re-run."
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  disabled={busy !== null}
                  onClick={() => runSeed("demo")}
                  className="rounded-xl hairline bg-gradient-to-br from-cyan-500/15 to-violet-500/15 hover:brightness-110 disabled:opacity-60 p-4 text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    <div className="text-sm font-semibold">Full demo scenario</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    8 customers · 30 transactions · 24 alerts · 8 investigations · 40 telemetry events · IOCs, threats, quantum assets.
                  </div>
                  <div className="text-[10px] text-cyan-300 mt-2">{busy === "seed" ? "Seeding…" : "Recommended"}</div>
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => runSeed("high_risk")}
                  className="rounded-xl hairline bg-white/3 hover:bg-white/6 disabled:opacity-60 p-4 text-left"
                >
                  <div className="text-sm font-semibold mb-1">High-risk only</div>
                  <div className="text-[11px] text-muted-foreground">Same schema, biased toward critical alerts and blocked wires.</div>
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => runSeed("baseline")}
                  className="rounded-xl hairline bg-white/3 hover:bg-white/6 disabled:opacity-60 p-4 text-left"
                >
                  <div className="text-sm font-semibold mb-1">Baseline / quiet</div>
                  <div className="text-[11px] text-muted-foreground">Quiet tenant with low-risk activity for empty-state screenshots.</div>
                </button>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-lg hairline bg-rose-500/5 p-3">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2"><Trash2 className="h-4 w-4 text-rose-300" /> Reset demo data</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Removes every row tagged <code className="font-mono">seed:*</code>. Leaves live data untouched.</div>
                </div>
                <button
                  disabled={busy !== null}
                  onClick={() => runSeed("reset")}
                  className="text-xs px-3 py-1.5 rounded-lg hairline hover:bg-rose-500/15 text-rose-200 disabled:opacity-60"
                >
                  {busy === "reset" ? "Clearing…" : "Reset"}
                </button>
              </div>
            </GlassCard>
          )}

          {tab === "roles" && (
            <GlassCard>
              <SectionHeader title="User Roles &amp; Permissions" />
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="[&>th]:text-left [&>th]:py-2">
                    <th>Role</th><th>Dashboard</th><th>Correlate</th><th>Block Wire</th><th>Approve SAR</th><th>Manage Users</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["SOC Analyst", true, true, false, false, false],
                    ["Fraud Analyst", true, true, true, false, false],
                    ["Risk Manager", true, true, true, true, false],
                    ["Executive", true, false, false, true, true],
                  ].map((r) => (
                    <tr key={String(r[0])} className="border-t border-white/4">
                      <td className="py-2 font-medium">{r[0]}</td>
                      {r.slice(1).map((v, i) => (
                        <td key={i} className="py-2">{v ? <span className="text-emerald-300">●</span> : <span className="text-muted-foreground">○</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassCard>
          )}

          {tab === "notifs" && (
            <GlassCard>
              <SectionHeader title="Notification Preferences" />
              <div className="space-y-3">
                {["Critical alerts","Blocked transactions","AI investigations","Quantum policy drift","Weekly executive digest"].map((c) => (
                  <div key={c} className="flex items-center justify-between rounded-lg hairline bg-white/3 p-3">
                    <div className="text-sm">{c}</div>
                    <div className="flex items-center gap-4">
                      <label className="text-xs text-muted-foreground flex items-center gap-2">Email <Switch defaultChecked /></label>
                      <label className="text-xs text-muted-foreground flex items-center gap-2">Slack <Switch defaultChecked /></label>
                      <label className="text-xs text-muted-foreground flex items-center gap-2">SMS <Switch /></label>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {tab === "api" && (
            <GlassCard>
              <SectionHeader title="API Integrations" action={<button onClick={() => toast.success("New API key generated")} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">Generate key</button>} />
              <div className="space-y-2">
                {[
                  { name: "Ingest — Fraud Engine", key: "sq_live_a7f2…c891", used: "8.4M req/day" },
                  { name: "Ingest — Core Banking", key: "sq_live_2b91…f04a", used: "2.1M req/day" },
                  { name: "Query — Copilot", key: "sq_live_44e6…9d12", used: "184K req/day" },
                ].map((a) => (
                  <div key={a.name} className="flex items-center gap-3 rounded-lg hairline bg-white/3 p-3">
                    <KeyRound className="h-4 w-4 text-cyan-300" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{a.key}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{a.used}</div>
                    <button className="text-xs px-2 py-1 rounded-md hairline hover:bg-white/6 inline-flex items-center gap-1"><RotateCw className="h-3 w-3" />Rotate</button>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {tab === "siem" && (
            <GlassCard>
              <SectionHeader title="SIEM Integrations" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {["Splunk Enterprise","Microsoft Sentinel","IBM QRadar","Elastic Security","Chronicle","Sumo Logic"].map((s) => (
                  <div key={s} className="flex items-center justify-between rounded-lg hairline bg-white/3 p-3">
                    <div>
                      <div className="text-sm font-medium">{s}</div>
                      <div className="text-[11px] text-muted-foreground">{Math.random() > 0.4 ? "Connected · syncing" : "Not connected"}</div>
                    </div>
                    <Switch defaultChecked={Math.random() > 0.4} />
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {tab === "feeds" && (
            <GlassCard>
              <SectionHeader title="Threat Feed Settings" />
              <div className="space-y-2">
                {["Recorded Future","Mandiant","AlienVault OTX","Europol EMPACT","FS-ISAC","Anomali","Abuse.ch","Internal Bank Feeds"].map((f) => (
                  <div key={f} className="flex items-center justify-between rounded-lg hairline bg-white/3 p-3">
                    <div>
                      <div className="text-sm font-medium">{f}</div>
                      <div className="text-[11px] text-muted-foreground">{Math.floor(Math.random()*500)} IOCs / hour</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {tab === "quantum" && (
            <GlassCard>
              <SectionHeader title="Quantum Policy Settings" />
              <div className="space-y-3">
                <PolicyRow label="Minimum TLS version" value="1.2 (enforce 1.3 by 2026-Q2)" />
                <PolicyRow label="Deprecate RSA-2048" value="2027-01-01 (hard cutoff)" />
                <PolicyRow label="PQC target algorithm" value="Hybrid Kyber-1024 + X25519" />
                <PolicyRow label="Dilithium migration deadline" value="2027-Q4" />
                <PolicyRow label="HNDL alerting threshold" value="$10M exposure per asset class" />
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg hairline bg-white/3 p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
      </div>
      <div className="text-xs font-mono text-cyan-300">{value}</div>
    </div>
  );
}
