import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Download, FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Row { guest_name: string; phone: string | null; allowed: number }

const NAME_KEYS = ["name", "guest_name", "الاسم", "اسم", "الضيف", "اسم الضيف"];
const PHONE_KEYS = ["phone", "mobile", "الجوال", "جوال", "رقم الجوال", "الهاتف"];
const COUNT_KEYS = ["count", "allowed", "العدد", "عدد"];

function pick(rec: Record<string, string>, keys: string[]) {
  for (const k of Object.keys(rec)) if (keys.includes(k.trim().toLowerCase())) return (rec[k] ?? "").trim();
  return "";
}

export default function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);

  const onFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const out: Row[] = [];
        let bad = 0;
        for (const rec of res.data) {
          const name = pick(rec, NAME_KEYS).slice(0, 120);
          if (!name) { bad++; continue; }
          const n = parseInt(pick(rec, COUNT_KEYS).replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)), 10);
          out.push({ guest_name: name, phone: pick(rec, PHONE_KEYS).slice(0, 32) || null, allowed: Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 1 });
        }
        setRows(out);
        setSkipped(bad);
        if (!out.length) toast.error("لم أجد صفوفاً صالحة. تأكد من وجود عمود «الاسم».");
      },
      error: () => toast.error("تعذرت قراءة الملف"),
    });
  };

  const template = () => {
    const csv = "﻿الاسم,الجوال,العدد\nعائلة محمد,0500000000,4\nخالد أحمد,0555555555,1\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "guests-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const submit = async () => {
    setBusy(true);
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("invitations").insert(rows.slice(i, i + 500));
      if (error) { setBusy(false); return toast.error("توقف الاستيراد: " + error.message); }
    }
    setBusy(false);
    toast.success(`تم استيراد ${rows.length} ضيف`);
    setRows([]);
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="استيراد من ملف CSV">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">الأعمدة: <b>الاسم</b> (إجباري)، <b>الجوال</b>، <b>العدد</b>. يمكن تصدير الملف من Excel بصيغة CSV UTF-8.</p>
        <Button variant="outline" size="sm" onClick={template}><Download /> تحميل نموذج</Button>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-8 text-sm text-muted-foreground hover:bg-muted">
          <FileUp className="size-8" />
          اختر ملف CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm">جاهز للاستيراد: <b>{rows.length}</b> ضيف{skipped ? ` · تم تجاهل ${skipped} صف بدون اسم` : ""}</p>
            <ul className="max-h-40 overflow-y-auto rounded-xl bg-muted p-3 text-sm">
              {rows.slice(0, 50).map((r, i) => (
                <li key={i} className="flex justify-between py-0.5"><span>{r.guest_name}</span><span className="text-muted-foreground">{r.allowed}</span></li>
              ))}
            </ul>
            <Button className="w-full" onClick={submit} disabled={busy}>{busy && <Loader2 className="animate-spin" />} استيراد</Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
