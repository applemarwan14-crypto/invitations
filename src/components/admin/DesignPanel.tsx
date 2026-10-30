import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import type { AdminData } from "@/hooks/useAdminData";
import { supabase, type EventSettings } from "@/lib/supabase";
import { THEMES, renderInvitation } from "@/lib/invitationImage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FIELDS: { key: keyof EventSettings; label: string; placeholder: string }[] = [
  { key: "title", label: "العنوان الرئيسي", placeholder: "دعوة كريمة" },
  { key: "host_line", label: "سطر الداعي", placeholder: "تتشرف عائلة … بدعوتكم" },
  { key: "event_name", label: "المناسبة", placeholder: "لحضور حفل زفاف …" },
  { key: "date_text", label: "التاريخ والوقت", placeholder: "الخميس 12 نوفمبر 2026 — 8 مساءً" },
  { key: "venue_text", label: "المكان", placeholder: "قاعة … — الرياض" },
  { key: "note", label: "ملاحظة أسفل البطاقة", placeholder: "نأمل إبراز الدعوة عند الدخول" },
];

export default function DesignPanel({ data }: { data: AdminData }) {
  const [form, setForm] = useState<EventSettings>(data.settings!);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      const c = await renderInvitation({ code: "PREVIEW23456789AB", guest_name: "عائلة محمد بن عبدالله", allowed: 4 }, form);
      setPreview(c.toDataURL("image/png"));
    }, 300);
    return () => window.clearTimeout(t);
  }, [form]);

  const set = (k: keyof EventSettings, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    const { id: _id, ...rest } = form;
    const { error } = await supabase.from("event_settings").update(rest).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    data.setSettings(form);
    toast.success("تم حفظ التصميم");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>نصوص الدعوة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}</Label>
              <Input value={String(form[f.key] ?? "")} placeholder={f.placeholder} maxLength={120} onChange={(e) => set(f.key, e.target.value)} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label>الألوان</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(THEMES).map(([id, t]) => (
                <button key={id} onClick={() => set("theme", id)} className={cn("flex items-center gap-2 rounded-xl border p-2 text-sm", form.theme === id ? "border-accent ring-2 ring-accent/30" : "border-border")}>
                  <span className="size-6 rounded-full border" style={{ background: `linear-gradient(135deg, ${t.bg1}, ${t.bg2})`, borderColor: t.accent }} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>رسالة الواتساب</Label>
            <Textarea rows={4} value={form.wa_message} onChange={(e) => set("wa_message", e.target.value)} />
            <p className="text-xs text-muted-foreground">استخدم {"{الاسم}"} و {"{العدد}"} وسيتم استبدالهما تلقائياً.</p>
          </div>
          <Button onClick={save} disabled={busy} className="w-full">{busy ? <Loader2 className="animate-spin" /> : <Save />} حفظ التصميم</Button>
        </CardContent>
      </Card>
      <Card className="lg:sticky lg:top-28 lg:self-start">
        <CardHeader><CardTitle>معاينة</CardTitle></CardHeader>
        <CardContent>
          <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl bg-muted">
            {preview ? <img src={preview} alt="معاينة الدعوة" className="h-full w-full object-contain" /> : <Loader2 className="size-8 animate-spin text-muted-foreground" />}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">رمز المعاينة تجريبي ولن يُقبل عند البوابة.</p>
        </CardContent>
      </Card>
    </div>
  );
}
