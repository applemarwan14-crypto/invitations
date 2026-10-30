import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import QrScanner from "qr-scanner";
import { toast } from "sonner";
import { Camera, Flashlight, LayoutDashboard, Loader2, LogOut, Search, SwitchCamera } from "lucide-react";
import { supabase, type GateResponse } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { errorFeedback, successFeedback, unlockAudio } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import ResultOverlay from "@/components/ResultOverlay";

interface SearchRow { code: string; guest_name: string; allowed: number; entered: number; status: string }

export default function Scanner() {
  const { profile, signOut } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const busyRef = useRef(false);
  const facingRef = useRef<"environment" | "user">("environment");
  const [started, setStarted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<GateResponse | null>(null);
  const [hasFlash, setHasFlash] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [searching, setSearching] = useState(false);

  const showResult = useCallback((r: GateResponse) => {
    setResult(r);
    if (r.result === "valid" || r.result === "admitted") successFeedback();
    else errorFeedback();
  }, []);

  const lookup = useCallback(async (code: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    scannerRef.current?.pause();
    setChecking(true);
    const { data, error } = await supabase.rpc("scan_invitation", { p_code: code });
    setChecking(false);
    if (error) {
      busyRef.current = false;
      errorFeedback();
      toast.error(navigator.onLine ? "خطأ في التحقق، حاول مرة أخرى" : "لا يوجد اتصال بالإنترنت");
      void scannerRef.current?.start();
      return;
    }
    showResult(data as GateResponse);
  }, [showResult]);

  const close = useCallback(() => {
    setResult(null);
    busyRef.current = false;
    void scannerRef.current?.start();
  }, []);

  const admit = async (count: number) => {
    if (!result?.code) return;
    const { data, error } = await supabase.rpc("admit_guests", { p_code: result.code, p_count: count });
    if (error) {
      errorFeedback();
      toast.error(navigator.onLine ? "تعذر تسجيل الدخول، حاول مرة أخرى" : "لا يوجد اتصال بالإنترنت");
      return;
    }
    showResult(data as GateResponse);
  };

  const start = async () => {
    unlockAudio();
    if (!videoRef.current) return;
    const s = new QrScanner(videoRef.current, (r) => void lookup(r.data), {
      preferredCamera: "environment",
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 8,
      returnDetailedScanResult: true,
    });
    scannerRef.current = s;
    try {
      await s.start();
      setStarted(true);
      setHasFlash(await s.hasFlash());
    } catch {
      toast.error("تعذر فتح الكاميرا. اسمح للمتصفح باستخدامها ثم أعد المحاولة.");
    }
  };

  useEffect(() => () => { scannerRef.current?.destroy(); }, []);

  const toggleFlash = async () => {
    await scannerRef.current?.toggleFlash();
    setFlashOn(!!scannerRef.current?.isFlashOn());
  };

  const switchCamera = async () => {
    const s = scannerRef.current;
    if (!s) return;
    const cams = await QrScanner.listCameras(true);
    if (cams.length < 2) return toast("لا توجد كاميرا أخرى");
    facingRef.current = facingRef.current === "user" ? "environment" : "user";
    await s.setCamera(facingRef.current);
    setHasFlash(await s.hasFlash());
  };

  useEffect(() => {
    if (!searchOpen) return;
    const term = q.trim();
    if (term.length < 2) { setRows([]); return; }
    const t = window.setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase.rpc("search_invitations", { p_query: term });
      setSearching(false);
      if (!error) setRows((data as SearchRow[]) ?? []);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, searchOpen]);

  const openSearch = () => {
    unlockAudio();
    scannerRef.current?.pause();
    setSearchOpen(true);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setQ("");
    setRows([]);
    if (!result) void scannerRef.current?.start();
  };
  const pickRow = (r: SearchRow) => {
    setSearchOpen(false);
    setQ("");
    setRows([]);
    void lookup(r.code);
  };

  return (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <div className="text-xs text-white/60">الماسح</div>
          <div className="truncate font-medium">{profile?.display_name}</div>
        </div>
        <div className="flex gap-1">
          {profile?.role === "admin" && (
            <Link to="/admin"><Button size="icon" variant="ghost" className="text-white hover:bg-white/10" aria-label="لوحة المدير"><LayoutDashboard /></Button></Link>
          )}
          <Button size="icon" variant="ghost" className="text-white hover:bg-white/10" onClick={signOut} aria-label="تسجيل الخروج"><LogOut /></Button>
        </div>
      </header>

      <div className="relative mx-3 flex-1 overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <Camera className="size-16 text-white/40" />
            <p className="text-white/70">اضغط لبدء المسح بالكاميرا</p>
            <Button size="lg" variant="accent" className="h-14 px-10 text-lg" onClick={start}>ابدأ المسح</Button>
          </div>
        )}
        {checking && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="size-12 animate-spin" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <Button variant="ghost" className="h-14 flex-col gap-1 bg-white/10 text-white hover:bg-white/20" onClick={toggleFlash} disabled={!started || !hasFlash}>
          <Flashlight className={flashOn ? "text-yellow-300" : ""} /> <span className="text-xs">الإضاءة</span>
        </Button>
        <Button variant="ghost" className="h-14 flex-col gap-1 bg-white/10 text-white hover:bg-white/20" onClick={openSearch}>
          <Search /> <span className="text-xs">بحث بالاسم</span>
        </Button>
        <Button variant="ghost" className="h-14 flex-col gap-1 bg-white/10 text-white hover:bg-white/20" onClick={switchCamera} disabled={!started}>
          <SwitchCamera /> <span className="text-xs">تبديل الكاميرا</span>
        </Button>
      </div>

      <Dialog open={searchOpen} onClose={closeSearch} title="بحث يدوي بالاسم" className="text-foreground">
        <div className="space-y-3">
          <Input autoFocus placeholder="اكتب حرفين على الأقل" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {searching && <Loader2 className="mx-auto my-4 size-6 animate-spin text-muted-foreground" />}
            {!searching && q.trim().length >= 2 && rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد نتائج</p>}
            {rows.map((r) => (
              <button key={r.code} onClick={() => pickRow(r)} className="flex w-full items-center justify-between gap-2 rounded-xl p-3 text-right hover:bg-muted">
                <span className="font-medium">{r.guest_name}</span>
                {r.status === "cancelled" ? <Badge variant="danger">ملغاة</Badge> : r.entered >= r.allowed ? <Badge variant="danger">مكتملة</Badge> : <Badge variant="success">متبقي {r.allowed - r.entered}</Badge>}
              </button>
            ))}
          </div>
        </div>
      </Dialog>

      <AnimatePresence>{result && <ResultOverlay key={result.result + (result.entered ?? "")} res={result} onAdmit={admit} onClose={close} />}</AnimatePresence>
    </div>
  );
}
