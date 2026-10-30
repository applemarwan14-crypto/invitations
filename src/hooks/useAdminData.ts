import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase, type EventSettings, type Invitation, type Profile, type Scan } from "@/lib/supabase";

export function useAdminData() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const loadInvitations = useCallback(async () => {
    const { data, error } = await supabase.from("invitations").select("*").order("created_at", { ascending: false }).limit(5000);
    if (error) toast.error("تعذر تحميل الدعوات");
    else setInvitations(data as Invitation[]);
  }, []);

  const loadScans = useCallback(async () => {
    const { data, error } = await supabase.from("scans").select("*").order("scanned_at", { ascending: false }).limit(5000);
    if (!error) setScans(data as Scan[]);
  }, []);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at");
    if (data) setProfiles(data as Profile[]);
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from("event_settings").select("*").eq("id", 1).maybeSingle();
    if (data) setSettings(data as EventSettings);
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadInvitations(), loadScans(), loadProfiles(), loadSettings()]);
    setLoading(false);
  }, [loadInvitations, loadScans, loadProfiles, loadSettings]);

  useEffect(() => {
    void reloadAll();
    // Debounced refetch on any realtime change (RLS is enforced on realtime too).
    const bump = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { void loadInvitations(); void loadScans(); }, 400);
    };
    const ch = supabase
      .channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "invitations" }, bump)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scans" }, bump)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    // Safety net: poll every 20s in case the socket drops.
    const poll = window.setInterval(bump, 20000);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(timer.current);
      void supabase.removeChannel(ch);
    };
  }, [reloadAll, loadInvitations, loadScans]);

  return {
    invitations, scans, profiles, settings, loading, live,
    setSettings, loadInvitations, loadProfiles, loadSettings, reloadAll,
  };
}

export type AdminData = ReturnType<typeof useAdminData>;
