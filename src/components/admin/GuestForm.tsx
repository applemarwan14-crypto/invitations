import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase, type Invitation } from "@/lib/supabase";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Invitation | null;
  onSaved: () => void;
}

export default function GuestForm({ open, onClose, editing, onSaved }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [allowed, setAllowed] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.guest_name ?? "");
    setPhone(editing?.phone ?? "");
    setAllowed(editing?.allowed ?? 1);
  }, [open, editing]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const guest_name = name.trim();
    if (!guest_name) return;
    if (editing && allowed < editing.entered) {
      toast.error(`دخل ${editing.entered} بالفعل، لا يمكن أن يكون العدد أقل من ذلك`);
      return;
    }
    setBusy(true);
    const row = { guest_name, phone: phone.trim() || null, allowed };
    const { error } = editing
      ? await supabase.from("invitations").update(row).eq("id", editing.id)
      : await supabase.from("invitations").insert(row);
    setBusy(false);
    if (error) return toast.error("تعذر الحفظ: " + error.message);
    toast.success(editing ? "تم تحديث الدعوة" : "تمت إضافة الضيف");
    onSaved();
    if (editing) onClose();
    else { setName(""); setPhone(""); setAllowed(1); }
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? "تعديل الدعوة" : "إضافة ضيف"}>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="g-name">اسم الضيف</Label>
          <Input id="g-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عائلة محمد العتيبي" autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-phone">الجوال (اختياري — للواتساب)</Label>
          <Input id="g-phone" dir="ltr" inputMode="tel" maxLength={32} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="g-count">العدد المسموح</Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => setAllowed((n) => Math.max(1, n - 1))}>−</Button>
            <Input id="g-count" type="number" min={1} max={100} className="w-20 text-center" value={allowed} onChange={(e) => setAllowed(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />
            <Button type="button" variant="outline" size="icon" onClick={() => setAllowed((n) => Math.min(100, n + 1))}>+</Button>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={busy}>{busy && <Loader2 className="animate-spin" />} حفظ</Button>
          <Button type="button" variant="outline" onClick={onClose}>إغلاق</Button>
        </div>
        {!editing && <p className="text-xs text-muted-foreground">بعد الحفظ تبقى النافذة مفتوحة لإضافة ضيف آخر بسرعة.</p>}
      </form>
    </Dialog>
  );
}
