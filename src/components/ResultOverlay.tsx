import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Minus, Plus, XCircle } from "lucide-react";
import type { GateResponse } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

const REASONS: Record<string, { title: string; desc: (r: GateResponse) => string }> = {
  not_found: { title: "دعوة غير موجودة", desc: () => "الرمز غير مسجّل في النظام" },
  cancelled: { title: "دعوة ملغاة", desc: () => "تم إلغاء هذه الدعوة من المدير" },
  used: { title: "دعوة مستخدمة", desc: (r) => `دخل ${r.entered} من ${r.allowed} مسبقاً — لا يوجد متبقي` },
  exceeds: { title: "العدد أكبر من المتبقي", desc: (r) => `المتبقي ${r.remaining} فقط من ${r.allowed}` },
};

interface Props {
  res: GateResponse;
  onAdmit: (count: number) => Promise<void>;
  onClose: () => void;
}

export default function ResultOverlay({ res, onAdmit, onClose }: Props) {
  const [count, setCount] = useState(res.remaining || 1);
  const [busy, setBusy] = useState(false);
  const ok = res.result === "valid" || res.result === "admitted";

  useEffect(() => setCount(res.remaining || 1), [res]);

  // Auto-dismiss after a successful admission.
  useEffect(() => {
    if (res.result !== "admitted") return;
    const t = window.setTimeout(onClose, 2500);
    return () => window.clearTimeout(t);
  }, [res, onClose]);

  const admit = async () => {
    setBusy(true);
    await onAdmit(count);
    setBusy(false);
  };

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-6 text-center text-white ${ok ? "bg-green-600" : "bg-red-600"}`}
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={res.result === "admitted" ? onClose : undefined}
    >
      <motion.div initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", damping: 12, stiffness: 260 }}>
        {ok ? <CheckCircle2 className="size-28" strokeWidth={1.5} /> : <XCircle className="size-28" strokeWidth={1.5} />}
      </motion.div>

      {res.result === "valid" && (
        <>
          <div>
            <div className="text-lg opacity-90">مسموح بالدخول</div>
            <div className="mt-2 break-words text-4xl font-bold leading-tight">{res.guest_name}</div>
            <div className="mt-3 text-xl tabular-nums opacity-95">المتبقي {res.remaining} من {res.allowed}</div>
          </div>
          <div className="w-full max-w-xs space-y-3">
            <div className="text-sm opacity-90">كم شخص يدخل الآن؟</div>
            <div className="flex items-center justify-center gap-4">
              <button className="rounded-full bg-white/20 p-4 active:bg-white/30" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="أقل"><Minus className="size-7" /></button>
              <span className="w-20 text-6xl font-bold tabular-nums">{count}</span>
              <button className="rounded-full bg-white/20 p-4 active:bg-white/30" onClick={() => setCount((c) => Math.min(res.remaining, c + 1))} aria-label="أكثر"><Plus className="size-7" /></button>
            </div>
            <Button size="lg" className="h-16 w-full bg-white text-xl font-bold text-green-700 hover:bg-white/90" onClick={admit} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} تأكيد دخول {count}
            </Button>
            <button className="w-full py-2 text-white/80 underline-offset-4 hover:underline" onClick={onClose} disabled={busy}>إلغاء</button>
          </div>
        </>
      )}

      {res.result === "admitted" && (
        <div>
          <div className="text-2xl font-bold">تم تسجيل الدخول ✓</div>
          <div className="mt-2 break-words text-4xl font-bold">{res.guest_name}</div>
          <div className="mt-3 text-xl tabular-nums opacity-95">دخل {res.entered} من {res.allowed}{res.remaining > 0 ? ` · المتبقي ${res.remaining}` : ""}</div>
          <div className="mt-8 text-sm opacity-80">اضغط للمتابعة</div>
        </div>
      )}

      {!ok && (
        <>
          <div>
            <div className="text-4xl font-bold">{REASONS[res.result]?.title ?? "مرفوض"}</div>
            {res.guest_name && <div className="mt-3 break-words text-2xl">{res.guest_name}</div>}
            <div className="mt-3 text-lg opacity-95">{REASONS[res.result]?.desc(res)}</div>
          </div>
          <Button size="lg" className="h-14 w-full max-w-xs bg-white text-lg font-bold text-red-700 hover:bg-white/90" onClick={onClose}>
            متابعة المسح
          </Button>
        </>
      )}
    </motion.div>
  );
}
