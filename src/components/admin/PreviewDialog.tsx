import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, MessageCircle, Share2 } from "lucide-react";
import type { EventSettings, Invitation } from "@/lib/supabase";
import { canvasToBlob, renderInvitation } from "@/lib/invitationImage";
import { safeFileName, whatsappLink } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function inviteMessage(s: EventSettings, inv: Invitation) {
  const count = inv.allowed === 1 ? "لشخص واحد" : inv.allowed === 2 ? "لشخصين" : `لـ ${inv.allowed} أشخاص`;
  return (s.wa_message || "").replaceAll("{الاسم}", inv.guest_name).replaceAll("{العدد}", count);
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export default function PreviewDialog({ inv, settings, onClose }: { inv: Invitation | null; settings: EventSettings; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!inv) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setBlob(null);
    setUrl(null);
    renderInvitation(inv, settings)
      .then(canvasToBlob)
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(() => toast.error("تعذر توليد الصورة"));
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [inv, settings]);

  if (!inv) return null;
  const fileName = `دعوة-${safeFileName(inv.guest_name)}.png`;
  const text = inviteMessage(settings, inv);
  const file = blob ? new File([blob], fileName, { type: "image/png" }) : null;
  const canShareFile = !!file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("تعذرت المشاركة");
    }
  };

  return (
    <Dialog open={!!inv} onClose={onClose} title={inv.guest_name}>
      <div className="space-y-4">
        <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-xl bg-muted">
          {url ? <img src={url} alt={`دعوة ${inv.guest_name}`} className="h-full w-full object-contain" /> : <Loader2 className="size-8 animate-spin text-muted-foreground" />}
        </div>
        {inv.status === "cancelled" && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">هذه الدعوة ملغاة ولن تُقبل عند البوابة.</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          {canShareFile && (
            <Button variant="success" onClick={share} className="sm:col-span-2"><Share2 /> مشاركة الصورة (واتساب)</Button>
          )}
          <Button variant="outline" disabled={!blob} onClick={() => blob && download(blob, fileName)}><Download /> تحميل الصورة</Button>
          <a href={whatsappLink(inv.phone, text)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full"><MessageCircle /> فتح محادثة واتساب</Button>
          </a>
        </div>
        <p className="text-xs text-muted-foreground">
          على الجوال: «مشاركة الصورة» يرسل الصورة مع الرسالة مباشرة. على الكمبيوتر: حمّل الصورة ثم افتح المحادثة وأرفقها.
        </p>
      </div>
    </Dialog>
  );
}
