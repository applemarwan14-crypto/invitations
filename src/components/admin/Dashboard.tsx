import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { Ban, CheckCircle2, ScanLine, UserCheck, Users, XCircle } from "lucide-react";
import type { AdminData } from "@/hooks/useAdminData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtTime, resultLabels } from "@/lib/utils";

const REJECTED = new Set(["not_found", "cancelled", "used", "exceeds"]);

function Stat({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: number | string; sub?: string; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`size-5 ${tone}`} />
      </div>
      <motion.div key={String(value)} initial={{ scale: 0.9, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="mt-2 text-3xl font-bold tabular-nums">
        {value}
      </motion.div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export default function Dashboard({ data }: { data: AdminData }) {
  const { invitations, scans, profiles } = data;

  const stats = useMemo(() => {
    const active = invitations.filter((i) => i.status === "active");
    const expected = active.reduce((s, i) => s + i.allowed, 0);
    const arrived = invitations.reduce((s, i) => s + i.entered, 0);
    const scanCount = scans.filter((s) => s.result !== "admitted").length;
    const rejected = scans.filter((s) => REJECTED.has(s.result)).length;
    const fullyArrived = active.filter((i) => i.entered >= i.allowed).length;
    return {
      expected, arrived, scanCount, rejected, fullyArrived,
      invites: active.length,
      cancelled: invitations.length - active.length,
      pct: expected ? Math.round((arrived / expected) * 100) : 0,
    };
  }, [invitations, scans]);

  const timeline = useMemo(() => {
    const buckets = new Map<number, number>();
    for (const s of scans) {
      if (s.result !== "admitted") continue;
      const t = new Date(s.scanned_at);
      t.setMinutes(Math.floor(t.getMinutes() / 15) * 15, 0, 0);
      buckets.set(t.getTime(), (buckets.get(t.getTime()) ?? 0) + s.people);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, n]) => ({ time: fmtTime(new Date(t).toISOString()), people: n }));
  }, [scans]);

  const invById = useMemo(() => new Map(invitations.map((i) => [i.id, i])), [invitations]);
  const staffById = useMemo(() => new Map(profiles.map((p) => [p.user_id, p.display_name ?? p.email ?? ""])), [profiles]);
  const feed = scans.slice(0, 40);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={UserCheck} label="الحضور" value={stats.arrived} sub={`من ${stats.expected} شخص · ${stats.pct}%`} tone="text-success" />
        <Stat icon={Users} label="الدعوات الفعّالة" value={stats.invites} sub={`اكتملت ${stats.fullyArrived} · ملغاة ${stats.cancelled}`} tone="text-accent" />
        <Stat icon={ScanLine} label="مرات المسح" value={stats.scanCount} tone="text-slate-500" />
        <Stat icon={XCircle} label="المرفوضون" value={stats.rejected} tone="text-danger" />
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">نسبة الحضور</span>
            <span className="tabular-nums text-muted-foreground">{stats.arrived} / {stats.expected}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full rounded-full bg-success" initial={false} animate={{ width: `${stats.pct}%` }} transition={{ type: "spring", damping: 20 }} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>الداخلون كل ربع ساعة</CardTitle></CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">لا يوجد دخول حتى الآن</p>
            ) : (
              <div dir="ltr" className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v) => [v, "أشخاص"]} contentStyle={{ borderRadius: 12, fontFamily: "inherit", direction: "rtl" }} />
                    <Bar dataKey="people" fill="#b8892b" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>آخر العمليات</CardTitle></CardHeader>
          <CardContent className="max-h-80 space-y-1 overflow-y-auto">
            {feed.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">لا توجد عمليات بعد</p>}
            <AnimatePresence initial={false}>
              {feed.map((s) => {
                const inv = s.invitation_id ? invById.get(s.invitation_id) : undefined;
                const ok = s.result === "admitted" || s.result === "valid";
                return (
                  <motion.div key={s.id} layout initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-muted">
                    {s.result === "admitted" ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : ok ? <ScanLine className="size-4 shrink-0 text-slate-400" /> : <Ban className="size-4 shrink-0 text-danger" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{inv?.guest_name ?? "رمز غير معروف"}</div>
                      <div className="truncate text-xs text-muted-foreground">{staffById.get(s.staff_id ?? "") ?? "—"} · {fmtTime(s.scanned_at)}</div>
                    </div>
                    <Badge variant={s.result === "admitted" ? "success" : ok ? "default" : "danger"}>
                      {resultLabels[s.result]}{s.people > 0 ? ` ${s.people}` : ""}
                    </Badge>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
