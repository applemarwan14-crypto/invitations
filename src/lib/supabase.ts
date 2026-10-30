import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export type Role = "admin" | "staff";

export interface Profile {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Invitation {
  id: string;
  code: string;
  guest_name: string;
  phone: string | null;
  allowed: number;
  entered: number;
  status: "active" | "cancelled";
  created_at: string;
  updated_at: string;
}

export type ScanResult = "valid" | "admitted" | "not_found" | "cancelled" | "used" | "exceeds";

export interface Scan {
  id: number;
  invitation_id: string | null;
  code: string | null;
  staff_id: string | null;
  result: ScanResult;
  people: number;
  scanned_at: string;
}

export interface GateResponse {
  result: ScanResult;
  code: string | null;
  guest_name: string | null;
  allowed: number | null;
  entered: number | null;
  remaining: number;
}

export interface EventSettings {
  id: number;
  title: string;
  host_line: string;
  event_name: string;
  date_text: string;
  venue_text: string;
  note: string;
  theme: string;
  wa_message: string;
}
