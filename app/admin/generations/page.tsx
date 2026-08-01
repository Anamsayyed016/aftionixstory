import { getGenerationCostSummary } from "@/lib/admin/queries";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";

export const dynamic = "force-dynamic";

function formatAction(action: string) {
  return action.replaceAll("_", " ").toLowerCase();
}

export default async function AdminGenerationsPage() {
  const summary = await getGenerationCostSummary();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Generations &amp; cost
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          From GenerationLogs (story / image actions). Token estimates for cost
          visibility — not billed invoices.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total runs", value: summary.total },
          { label: "Succeeded", value: summary.successCount },
          { label: "Failed", value: summary.failureCount },
          {
            label: "Est. tokens (in+out)",
            value:
              summary.estimatedInputTokens + summary.estimatedOutputTokens,
          },
        ].map((c) => (
          <GlassCard key={c.label} className="p-4">
            <p className="text-xs uppercase tracking-wider text-ink-faint">
              {c.label}
            </p>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
              {c.value.toLocaleString()}
            </p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="overflow-x-auto p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-semibold">By action</h3>
        </div>
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
            <tr>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Count</th>
              <th className="px-4 py-2 font-medium">Est. in</th>
              <th className="px-4 py-2 font-medium">Est. out</th>
            </tr>
          </thead>
          <tbody>
            {summary.byAction.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-ink-dim">
                  No generation logs yet.
                </td>
              </tr>
            ) : (
              summary.byAction.map((row) => (
                <tr key={row.action} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 capitalize">
                    {formatAction(row.action)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{row._count.id}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {(row._sum.estimatedInputTokens ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {(row._sum.estimatedOutputTokens ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </GlassCard>

      <GlassCard className="overflow-x-auto p-0">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-display text-lg font-semibold">Recent</h3>
        </div>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Model</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {summary.recent.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2 text-xs text-ink-faint">
                  {row.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{row.user.email}</td>
                <td className="px-4 py-2 capitalize">
                  {formatAction(row.action)}
                </td>
                <td className="px-4 py-2 text-xs text-ink-dim">
                  {row.provider}/{row.model}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={row.success ? "success" : "violet"}>
                    {row.success ? "ok" : "fail"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
