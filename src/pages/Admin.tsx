import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, Loader2, LogOut, Palette, ScanLine, Users, UserCog } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminData } from "@/hooks/useAdminData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Dashboard from "@/components/admin/Dashboard";
import GuestsPanel from "@/components/admin/GuestsPanel";
import DesignPanel from "@/components/admin/DesignPanel";
import StaffPanel from "@/components/admin/StaffPanel";

const TABS = [
  { id: "dash", label: "المتابعة", icon: BarChart3 },
  { id: "guests", label: "الضيوف", icon: Users },
  { id: "design", label: "تصميم الدعوة", icon: Palette },
  { id: "staff", label: "الموظفون", icon: UserCog },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function Admin() {
  const { signOut, profile } = useAuth();
  const data = useAdminData();
  const [tab, setTab] = useState<TabId>("dash");

  return (
    <div className="min-h-full pb-24 sm:pb-8">
      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">لوحة المدير</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("inline-block size-2 rounded-full", data.live ? "bg-success animate-pulse" : "bg-slate-300")} />
              {data.live ? "متصل مباشرة" : "جاري الاتصال…"} · {profile?.display_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/scan">
              <Button variant="accent" size="sm"><ScanLine /> الماسح</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="تسجيل الخروج"><LogOut /></Button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-4 sm:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                tab === t.id && "text-foreground",
              )}
            >
              <t.icon className="size-4" /> {t.label}
              {tab === t.id && <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {data.loading || !data.settings ? (
          <div className="flex justify-center py-20"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {tab === "dash" && <Dashboard data={data} />}
            {tab === "guests" && <GuestsPanel data={data} />}
            {tab === "design" && <DesignPanel data={data} />}
            {tab === "staff" && <StaffPanel data={data} />}
          </motion.div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground", tab === t.id && "text-accent")}
          >
            <t.icon className="size-5" /> {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
