// Shared Supabase live queries + realtime hooks for SentinelQ pages.
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export type DbAlert = {
  id: string; severity: string; title: string; source: string | null;
  status: string; sla_minutes: number | null; created_at: string;
  transaction_id: string | null; investigation_id: string | null;
  customer_id: string | null; assignee: string | null;
};
export type DbTransaction = {
  id: string; customer_id: string; amount: number; currency: string;
  channel: string; merchant: string | null; country: string | null;
  status: string; risk_score: number | null; created_at: string;
};
export type DbInvestigation = {
  id: string; title: string; confidence: number; attack_type: string | null;
  business_impact: number | null; root_cause: string | null;
  evidence: unknown; risk_factors: unknown; recommended_actions: unknown;
  compliance: unknown; status: string; created_at: string;
  transaction_id: string | null; customer_id: string | null;
};

export function useAlerts() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("alerts-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["alerts"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as DbAlert[];
    },
  });
}

export function useTransactions(limit = 60) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("tx-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        qc.invalidateQueries({ queryKey: ["transactions"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return useQuery({
    queryKey: ["transactions", limit],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []) as DbTransaction[];
    },
  });
}

export function useInvestigations() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("inv-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_investigations" }, () => {
        qc.invalidateQueries({ queryKey: ["investigations"] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return useQuery({
    queryKey: ["investigations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_investigations").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as DbInvestigation[];
    },
  });
}

export function useLatestInvestigation() {
  return useQuery({
    queryKey: ["investigation-latest"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_investigations").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data as DbInvestigation | null;
    },
  });
}

export function useTelemetry() {
  return useQuery({
    queryKey: ["telemetry"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cyber_telemetry").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDashboardStats() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("dash-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => qc.invalidateQueries({ queryKey: ["dashboard-stats"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => qc.invalidateQueries({ queryKey: ["dashboard-stats"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [txAll, txBlocked, alertsCrit, invs, telem] = await Promise.all([
        supabase.from("transactions").select("id, amount, risk_score, status", { count: "exact" }).limit(1000),
        supabase.from("transactions").select("amount").eq("status", "blocked"),
        supabase.from("alerts").select("id", { count: "exact", head: true }).eq("severity", "critical").eq("status", "open"),
        supabase.from("ai_investigations").select("id", { count: "exact", head: true }),
        supabase.from("cyber_telemetry").select("id", { count: "exact", head: true }),
      ]);
      const txCount = txAll.count ?? 0;
      const preventedUsd = (txBlocked.data ?? []).reduce((s, r) => s + Number(r.amount), 0);
      const risks = (txAll.data ?? []).map((r) => r.risk_score ?? 0).filter((n) => n > 0);
      const avgRisk = risks.length ? Math.round(risks.reduce((a, b) => a + b, 0) / risks.length) : 0;
      return {
        transactionsMonitored: txCount,
        fraudPreventedUsd: preventedUsd,
        criticalAlerts: alertsCrit.count ?? 0,
        totalInvestigations: invs.count ?? 0,
        totalTelemetry: telem.count ?? 0,
        avgRisk,
      };
    },
  });
}
