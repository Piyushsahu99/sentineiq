import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ingestBankBatch, getInvestigationNarrative, regenerateInvestigationNarrative } from "@/lib/ingest.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, FileJson, Sparkles, ExternalLink, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/ingest")({
  component: IngestPage,
});

const SAMPLE = JSON.stringify({
  transactions: [
    { txn_id: "TXN12345", user_id: "U001", amount: 250000, merchant: "ABC Store", location: "Mumbai", device: "Android", channel: "card", currency: "INR" },
    { txn_id: "TXN12346", user_id: "U001", amount: 9800, merchant: "Gadget Hub", location: "Dubai", device: "Android", channel: "wire", currency: "INR" },
  ],
  cyberEvents: [
    { user: "U001", event: "VPN Login", ip: "1.2.3.4", device: "Android" },
    { user: "U001", event: "Impossible travel detected", ip: "5.6.7.8", device: "iPhone" },
  ],
}, null, 2);

function verdictColor(v: string) {
  if (v === "blocked") return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (v === "pending") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  if (v === "approved") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  return "bg-slate-500/15 text-slate-300 border-slate-500/40";
}

function IngestPage() {
  const ingest = useServerFn(ingestBankBatch);
  const getNarr = useServerFn(getInvestigationNarrative);
  const [json, setJson] = useState(SAMPLE);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [narratives, setNarratives] = useState<Record<string, any>>({});

  async function submit() {
    let payload: any;
    try { payload = JSON.parse(json); }
    catch { toast.error("Invalid JSON — check syntax"); return; }
    setBusy(true); setResults(null); setNarratives({});
    try {
      const r = await ingest({ data: {
        transactions: payload.transactions ?? [],
        cyberEvents: payload.cyberEvents ?? payload.cyber_events ?? [],
      }});
      setResults(r);
      const blocked = r.results.filter((x: any) => x.verdict === "blocked").length;
      toast.success(`Ingested ${r.transactions_ingested} transactions · ${blocked} blocked`);
    } catch (e: any) {
      toast.error(e?.message || "Ingestion failed");
    } finally { setBusy(false); }
  }

  async function loadNarrative(id: string) {
    if (narratives[id]) return;
    try {
      const n = await getNarr({ data: { investigationId: id } });
      setNarratives((s) => ({ ...s, [id]: n?.ai_narrative || { summary: "AI narrative not yet available. Retry in a few seconds." } }));
    } catch { toast.error("Failed to load AI explanation"); }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Upload className="h-6 w-6" /> Bank Data Ingest</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload real transactions and cyber telemetry from your bank. SentinelQ runs the full correlation engine
          and generates a plain-English AI explanation for every flagged transaction.
        </p>
      </div>

      <Tabs defaultValue="json">
        <TabsList>
          <TabsTrigger value="json"><FileJson className="h-4 w-4 mr-1" /> Paste JSON</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
        </TabsList>
        <TabsContent value="json" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payload</CardTitle>
              <CardDescription>
                Object with <code>transactions[]</code> and <code>cyberEvents[]</code>. Max 200 tx / 500 events per batch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea value={json} onChange={(e) => setJson(e.target.value)} className="font-mono text-xs h-72" />
              <div className="flex gap-2">
                <Button onClick={submit} disabled={busy}>
                  {busy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Analyzing…</> : <><Sparkles className="h-4 w-4 mr-1" /> Ingest & Analyze</>}
                </Button>
                <Button variant="outline" onClick={() => setJson(SAMPLE)}>Reset sample</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="schema">
          <Card>
            <CardContent className="pt-6 space-y-3 text-sm">
              <div>
                <div className="font-medium">Transaction</div>
                <pre className="bg-black/40 rounded p-3 text-xs overflow-x-auto">{`{ txn_id, user_id, amount, merchant, location, device, channel, currency, country? }`}</pre>
              </div>
              <div>
                <div className="font-medium">Cyber event</div>
                <pre className="bg-black/40 rounded p-3 text-xs overflow-x-auto">{`{ user, event, ip, device, ts? }`}</pre>
              </div>
              <p className="text-muted-foreground text-xs">
                <code>user_id</code> / <code>user</code> is your bank's customer identifier — SentinelQ auto-creates a
                customer record on first sight and links every subsequent event and transaction to it.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {results && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Analysis Results
              <Badge variant="outline">{results.transactions_ingested} tx</Badge>
              <Badge variant="outline">{results.telemetry_ingested} events</Badge>
              <Badge variant="outline">{results.customers_created_or_matched} customers</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.results.map((r: any) => (
              <div key={r.db_id} className="border border-white/10 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm">{r.txn_id}</span>
                  <Badge className={verdictColor(r.verdict)}>{r.verdict}</Badge>
                  <Badge variant="outline">risk {r.composite}</Badge>
                  <Badge variant="outline">{r.dominant_kind}</Badge>
                  {r.investigation_id && (
                    <Link to="/explainable-ai" className="ml-auto text-xs text-cyan-300 hover:underline flex items-center gap-1">
                      view investigation <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                {r.top_signals.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc pl-5">
                    {r.top_signals.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                )}
                {r.investigation_id && (
                  <div>
                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => loadNarrative(r.investigation_id)}>
                      <Sparkles className="h-3 w-3 mr-1" /> AI Explanation
                    </Button>
                    {narratives[r.investigation_id] && (
                      <div className="mt-2 bg-white/[0.03] border border-white/10 rounded p-3 text-xs space-y-2">
                        <div>{narratives[r.investigation_id].summary}</div>
                        {narratives[r.investigation_id].why_flagged && (
                          <div>
                            <div className="font-semibold mb-1">Why flagged</div>
                            <ul className="list-disc pl-5">
                              {narratives[r.investigation_id].why_flagged.map((b: string, i: number) => <li key={i}>{b}</li>)}
                            </ul>
                          </div>
                        )}
                        {narratives[r.investigation_id].recommended_actions && (
                          <div>
                            <div className="font-semibold mb-1">Recommended actions</div>
                            <ul className="list-disc pl-5">
                              {narratives[r.investigation_id].recommended_actions.map((b: string, i: number) => <li key={i}>{b}</li>)}
                            </ul>
                          </div>
                        )}
                        {narratives[r.investigation_id].confidence_rationale && (
                          <div className="text-muted-foreground italic">{narratives[r.investigation_id].confidence_rationale}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
