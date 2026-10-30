import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Plus, ShieldCheck, Trash2, Copy } from "lucide-react";
import type { AdminData } from "@/hooks/useAdminData";
import { supabase, type Profile } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => chars[n % chars.length]).join("");
}

async function callStaffFn(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("manage-staff", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

export default function StaffPanel({ data }: { data: AdminData }) {
  const { profile: me } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState(genPassword);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const toggleActive = async (p: Profile) => {
    const { error } = await supabase.from("profiles").update({ is_active: !p.is_active }).eq("user_id", p.user_id);
    if (error) return toast.error(error.message);
    toast.success(p.is_active ? "تم إيقاف الحساب" : "تم تفعيل الحساب");
    void data.loadProfiles();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await callStaffFn({ action: "create", email, password, display_name: name });
      setCreated({ email, password });
      setEmail(""); setName(""); setPassword(genPassword());
      void data.loadProfiles();
    } catch (err) {
      toast.error("تعذر إنشاء الحساب: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (p: Profile) => {
    const pw = genPassword();
    if (!confirm(`تعيين كلمة مرور جديدة لـ ${p.display_name ?? p.email}؟`)) return;
    try {
      await callStaffFn({ action: "set_password", user_id: p.user_id, password: pw });
      setCreated({ email: p.email ?? "", password: pw });
      setOpen(true);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const remove = async (p: Profile) => {
    if (!confirm(`حذف حساب ${p.display_name ?? p.email} نهائياً؟`)) return;
    try {
      await callStaffFn({ action: "delete", user_id: p.user_id });
      toast.success("تم حذف الحساب");
      void data.loadProfiles();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">الموظف يقدر يمسح ويسجّل الدخول ويبحث بالاسم فقط — ما يشوف الجوالات ولا يعدّل الدعوات.</p>
        <Button onClick={() => { setCreated(null); setOpen(true); }}><Plus /> موظف جديد</Button>
      </div>

      <Card className="divide-y divide-border">
        {data.profiles.map((p) => {
          const self = p.user_id === me?.user_id;
          return (
            <div key={p.user_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.display_name}</span>
                  {p.role === "admin" ? <Badge variant="warning"><ShieldCheck className="ml-1 size-3" />مدير</Badge> : <Badge>موظف</Badge>}
                  {!p.is_active && <Badge variant="danger">موقوف</Badge>}
                  {self && <span className="text-xs text-muted-foreground">(أنت)</span>}
                </div>
                <div dir="ltr" className="text-left text-xs text-muted-foreground sm:text-right">{p.email}</div>
              </div>
              {!self && (
                <div className="flex gap-1">
                  <Button size="sm" variant={p.is_active ? "outline" : "success"} onClick={() => toggleActive(p)}>{p.is_active ? "إيقاف" : "تفعيل"}</Button>
                  <Button size="icon" variant="ghost" title="كلمة مرور جديدة" onClick={() => resetPassword(p)}><KeyRound /></Button>
                  <Button size="icon" variant="ghost" title="حذف" onClick={() => remove(p)}><Trash2 className="text-danger" /></Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} title={created ? "بيانات الدخول" : "إضافة موظف"}>
        {created ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">انسخ البيانات وأرسلها للموظف بشكل خاص. لن تظهر كلمة المرور مرة أخرى.</p>
            <div dir="ltr" className="space-y-1 rounded-xl bg-muted p-4 font-mono text-sm">
              <div>{created.email}</div>
              <div>{created.password}</div>
            </div>
            <Button className="w-full" onClick={() => { void navigator.clipboard.writeText(`${created.email}\n${created.password}`); toast.success("تم النسخ"); }}><Copy /> نسخ</Button>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-2"><Label>الاسم</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input required type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>كلمة المرور (16 حرف عشوائي)</Label>
              <div className="flex gap-2">
                <Input dir="ltr" className="font-mono" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="button" variant="outline" onClick={() => setPassword(genPassword())}>توليد</Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} إنشاء الحساب</Button>
          </form>
        )}
      </Dialog>
    </div>
  );
}
