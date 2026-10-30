import { useMemo, useState } from "react";
import JSZip from "jszip";
import Papa from "papaparse";
import { toast } from "sonner";
import { Ban, Eraser, FileDown, FileUp, Image as ImageIcon, MessageCircle, Pencil, Plus, RotateCcw, Search, Trash2, Archive } from "lucide-react";
import type { AdminData } from "@/hooks/useAdminData";
import { supabase, type Invitation } from "@/lib/supabase";
import { canvasToBlob, renderInvitation } from "@/lib/invitationImage";
import { cn, safeFileName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import GuestForm from "./GuestForm";
import ImportDialog from "./ImportDialog";
import PreviewDialog from "./PreviewDialog";

type Filter = "all" | "pending" | "arrived" | "cancelled";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "pending", label: "لم يحضروا" },
  { id: "arrived", label: "حضروا" },
  { id: "cancelled", label: "ملغاة" },
];

function stamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
}

export default function GuestsPanel({ data }: { data: AdminData }) {
  const { invitations, settings, loadInvitations } = data;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Invitation | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<Invitation | null>(null);
  const [zipping, setZipping] = useState(false);

  const list = useMemo(() => {
    const term = q.trim();
    return invitations.filter((i) => {
      if (term && !i.guest_name.includes(term) && !(i.phone ?? "").includes(term)) return false;
      if (filter === "cancelled") return i.status === "cancelled";
      if (filter === "arrived") return i.status === "active" && i.entered > 0;
      if (filter === "pending") return i.status === "active" && i.entered === 0;
      return true;
    });
  }, [invitations, q, filter]);

  const toggleStatus = async (inv: Invitation) => {
    const status = inv.status === "active" ? "cancelled" : "active";
    const { error } = await supabase.from("invitations").update({ status }).eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success(status === "cancelled" ? `أُلغيت دعوة ${inv.guest_name}` : `أُعيد تفعيل دعوة ${inv.guest_name}`);
    void loadInvitations();
  };

  const remove = async (inv: Invitation) => {
    if (!confirm(`حذف دعوة «${inv.guest_name}» نهائياً؟ الأفضل إلغاؤها بدلاً من الحذف.`)) return;
    const { error } = await supabase.from("invitations").delete().eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    void loadInvitations();
  };

  const downloadZip = async () => {
    const targets = invitations.filter((i) => i.status === "active");
    if (!targets.length || !settings) return;
    setZipping(true);
    const id = toast.loading(`جاري توليد 0 / ${targets.length}`);
    try {
      const zip = new JSZip();
      const used = new Set<string>();
      for (let n = 0; n < targets.length; n++) {
        const inv = targets[n];
        const blob = await canvasToBlob(await renderInvitation(inv, settings));
        let name = safeFileName(inv.guest_name);
        while (used.has(name)) name += "_";
        used.add(name);
        zip.file(`${name}.png`, blob);
        if (n % 5 === 0) toast.loading(`جاري توليد ${n + 1} / ${targets.length}`, { id });
      }
      const out = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = `invitations-${stamp()}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      toast.success(`تم تجهيز ${targets.length} دعوة`, { id });
    } catch {
      toast.error("تعذر إنشاء الملف", { id });
    } finally {
      setZipping(false);
    }
  };

  const exportCsv = () => {
    const csv = Papa.unparse(
      invitations.map((i) => ({
        الاسم: i.guest_name, الجوال: i.phone ?? "", العدد: i.allowed, دخل: i.entered,
        الحالة: i.status === "active" ? "فعّالة" : "ملغاة", الرمز: i.code,
      })),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `guests-backup-${stamp()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const wipePhones = async () => {
    if (!confirm("مسح جميع أرقام الجوالات نهائياً؟ (يُنصح به بعد انتهاء المناسبة)")) return;
    const { error } = await supabase.from("invitations").update({ phone: null }).not("phone", "is", null);
    if (error) return toast.error(error.message);
    toast.success("تم مسح أرقام الجوالات");
    void loadInvitations();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> إضافة ضيف</Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp /> استيراد CSV</Button>
        <Button variant="outline" onClick={downloadZip} disabled={zipping}><Archive /> كل الصور ZIP</Button>
        <Button variant="outline" onClick={exportCsv}><FileDown /> نسخة احتياطية</Button>
        <Button variant="ghost" className="text-danger" onClick={wipePhones}><Eraser /> مسح الجوالات</Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pr-9" placeholder="ابحث بالاسم أو الجوال" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm", filter === f.id ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{list.length} دعوة</p>

      <Card className="divide-y divide-border overflow-hidden">
        {list.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">لا توجد دعوات</p>}
        {list.map((inv) => {
          const full = inv.entered >= inv.allowed;
          return (
            <div key={inv.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", inv.status === "cancelled" && "bg-red-50/40")}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("font-medium", inv.status === "cancelled" && "line-through text-muted-foreground")}>{inv.guest_name}</span>
                  {inv.status === "cancelled" ? <Badge variant="danger">ملغاة</Badge> : full ? <Badge variant="success">اكتمل الحضور</Badge> : inv.entered > 0 ? <Badge variant="warning">حضر جزئياً</Badge> : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                  <span className="tabular-nums">دخل {inv.entered} من {inv.allowed}</span>
                  {inv.phone && <span dir="ltr" className="tabular-nums">{inv.phone}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="success" onClick={() => setPreview(inv)}><MessageCircle /> إرسال</Button>
                <Button size="icon" variant="ghost" title="عرض الصورة" onClick={() => setPreview(inv)}><ImageIcon /></Button>
                <Button size="icon" variant="ghost" title="تعديل" onClick={() => { setEditing(inv); setFormOpen(true); }}><Pencil /></Button>
                <Button size="icon" variant="ghost" title={inv.status === "active" ? "إلغاء الدعوة" : "إعادة التفعيل"} onClick={() => toggleStatus(inv)}>
                  {inv.status === "active" ? <Ban className="text-amber-600" /> : <RotateCcw className="text-success" />}
                </Button>
                <Button size="icon" variant="ghost" title="حذف" onClick={() => remove(inv)}><Trash2 className="text-danger" /></Button>
              </div>
            </div>
          );
        })}
      </Card>

      <GuestForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} onSaved={loadInvitations} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={loadInvitations} />
      {settings && <PreviewDialog inv={preview} settings={settings} onClose={() => setPreview(null)} />}
    </div>
  );
}
