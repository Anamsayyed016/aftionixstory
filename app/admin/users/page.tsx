import Link from "next/link";

import { listAdminUsers } from "@/lib/admin/queries";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ui/glass-card";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await listAdminUsers();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Users
        </h2>
        <p className="mt-1 text-sm text-ink-dim">
          Basic account view and activity counts. No content editing in v1.
        </p>
      </div>

      <GlassCard className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-charcoal/40 text-xs uppercase tracking-wider text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Activity</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">
                    {u.name || "—"}
                    {u.role === "ADMIN" ? (
                      <Badge variant="violet" className="ml-2">
                        Admin
                      </Badge>
                    ) : null}
                  </p>
                  <p className="font-mono text-xs text-ink-dim">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="success">{u.plan}</Badge>
                  <p className="mt-1 text-xs text-ink-faint">
                    Gens {u.monthlyGenerationCount}/{u.generationLimit}
                  </p>
                </td>
                <td className="px-4 py-3 text-ink-dim">
                  <p>{u._count.stories} stories</p>
                  <p>{u._count.businesses} businesses</p>
                  <p>{u._count.generationLogs} generations</p>
                  {u.freelancerProfile ? (
                    <p>
                      Freelancer:{" "}
                      <Link
                        href={`/f/${u.freelancerProfile.slug}`}
                        className="text-lilac hover:underline"
                      >
                        /f/{u.freelancerProfile.slug}
                      </Link>
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-ink-faint">
                  {u.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
