import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GlassCard, PageHeader, SectionHeader } from "@/components/sq/glass-card";
import { REGIONS, type RegionCode, usePrefs, refreshPrefs, formatMoney } from "@/lib/currency";
import { updateProfilePrefs, getMyCheckHistory } from "@/lib/prefs.functions";
import { seedDeterministic } from "@/lib/seed.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { session } from "@/lib/session";
import { toast } from "sonner";
import { User2, Globe2, Building2, Coins, History, ShieldCheck, AlertTriangle, Ban } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_app/profile")({
  ssr: false,
  component: ProfilePage,
});

function ProfilePage() {
  const prefs = usePrefs();
  const update = useServerFn(updateProfilePrefs);
  const seed = useServerFn(seedDeterministic);
  const history = useServerFn(getMyCheckHistory);

  const [region, setRegion] = useState<RegionCode>(prefs.region);
  const [bank, setBank] = useState(prefs.bank);
  const [currency, setCurrency] = useState(prefs.currency);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setRegion(prefs.region); setBank(prefs.bank); setCurrency(prefs.currency); }, [prefs.region, prefs.bank, prefs.currency]);

  const historyQ = useQuery({ queryKey: ["tx-check-history"], queryFn: () => history() });

  async function save(reseed: boolean) {
    setSaving(true);
    try {
      await update({ data: { region, currency, bank } });
      await refreshPrefs();
      toast.success("Preferences saved");
      if (reseed) {
        toast.message("Re-seeding tenant data in the new currency…");
        await seed({ data: { scenario: "demo", currency } });
        toast.success("Tenant data re-generated in " + currency);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  const currencyChanged = currency !== prefs.currency;

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Your account, operating region, and transaction checking history." />

      <div className="grid grid-cols-12 gap-6">
        <GlassCard className="col-span-12 md:col-span-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 grid place-items-center text-lg font-bold text-black">
              {session.getEmail().slice(0,2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{session.getEmail()}</div>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{session.getRole() ?? "—"}</div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            <Row icon={<Globe2 className="h-3.5 w-3.5" />} label="Region" value={REGIONS[prefs.region]?.label ?? prefs.region} />
            <Row icon={<Building2 className="h-3.5 w-3.5" />} label="Bank" value={prefs.bank} />
            <Row icon={<Coins className="h-3.5 w-3.5" />} label="Currency" value={prefs.currency} />
            <Row icon={<User2 className="h-3.5 w-3.5" />} label="Sample" value={formatMoney(125000, prefs)} />
          </div>
        </GlassCard>

        <GlassCard className="col-span-12 md:col-span-8">
          <SectionHeader title="Region, bank & currency" description="Numbers across every module render in your tenant's currency and locale." />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Region">
              <select value={region} onChange={(e) => {
                const r = e.target.value as RegionCode;
                setRegion(r);
                setCurrency(REGIONS[r].currency);
                setBank(REGIONS[r].banks[0]);
              }} className="w-full bg-white/5 hairline rounded-lg px-3 py-2 text-sm">
                {(Object.keys(REGIONS) as RegionCode[]).map((k) => <option key={k} value={k}>{REGIONS[k].label} ({k})</option>)}
              </select>
            </Field>
            <Field label="Bank">
              <select value={bank} onChange={(e) => setBank(e.target.value)} className="w-full bg-white/5 hairline rounded-lg px-3 py-2 text-sm">
                {REGIONS[region].banks.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Currency">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full bg-white/5 hairline rounded-lg px-3 py-2 text-sm">
                {["INR","USD","EUR","GBP","AED","SGD","JPY"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button disabled={saving} onClick={() => save(false)} className="text-xs px-3 py-2 rounded-lg hairline hover:bg-white/6 disabled:opacity-60">
              {saving ? "Saving…" : "Save preferences"}
            </button>
            <button disabled={saving || !currencyChanged} onClick={() => save(true)} className="text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-black font-semibold hover:brightness-110 disabled:opacity-60">
              {saving ? "Working…" : "Save & re-seed tenant in " + currency}
            </button>
            {currencyChanged && <span className="text-[10px] text-amber-300">Currency change — re-seed to refresh transactions.</span>}
          </div>
        </GlassCard>

        <GlassCard className="col-span-12">
          <SectionHeader
            title="Transaction checking history"
            description="Every correlation you triggered against a transaction, newest first."
            action={<span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><History className="h-3 w-3" /> {historyQ.data?.length ?? 0} checks</span>}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/6">
                  <th className="text-left py-2">When</th>
                  <th className="text-left">Verdict</th>
                  <th className="text-left">Risk</th>
                  <th className="text-left">Amount</th>
                  <th className="text-left">Merchant</th>
                  <th className="text-left">Country</th>
                  <th className="text-left">Top signals</th>
                </tr>
              </thead>
              <tbody>
                {(historyQ.data ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b border-white/4 hover:bg-white/3">
                    <td className="py-2 text-[11px] text-muted-foreground font-mono">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</td>
                    <td><VerdictBadge v={r.verdict} /></td>
                    <td className="font-mono">{r.risk_score ?? "—"}</td>
                    <td className="font-mono">{formatMoney(r.amount_local, { currency: r.currency || prefs.currency })}</td>
                    <td className="text-muted-foreground">{r.merchant ?? "—"}</td>
                    <td>{r.country ?? "—"}</td>
                    <td className="text-[11px] text-muted-foreground max-w-[300px] truncate">{(r.signals ?? []).slice(0,3).map((s: any) => s.name).join(" · ") || "—"}</td>
                  </tr>
                ))}
                {historyQ.data && historyQ.data.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">No checks yet. Run a correlation from the Transactions page — every check is logged here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg hairline bg-white/3 px-3 py-2">
      <span className="text-muted-foreground inline-flex items-center gap-2">{icon} {label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function VerdictBadge({ v }: { v: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    blocked: { cls: "bg-rose-500/20 text-rose-300", icon: <Ban className="h-3 w-3" />, label: "Blocked" },
    flagged: { cls: "bg-amber-500/20 text-amber-300", icon: <AlertTriangle className="h-3 w-3" />, label: "Flagged" },
    clean:   { cls: "bg-emerald-500/20 text-emerald-300", icon: <ShieldCheck className="h-3 w-3" />, label: "Clean" },
  };
  const m = map[v] ?? map.clean;
  return <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${m.cls}`}>{m.icon}{m.label}</span>;
}
