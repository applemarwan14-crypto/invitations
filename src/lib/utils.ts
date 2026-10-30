import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalise a phone number to international digits for wa.me (defaults to Saudi +966). */
export function toWhatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("05") && d.length === 10) d = "966" + d.slice(1);
  else if (d.startsWith("5") && d.length === 9) d = "966" + d;
  return d.length >= 8 ? d : null;
}

export function whatsappLink(phone: string | null, text: string) {
  const n = toWhatsappNumber(phone);
  const q = encodeURIComponent(text);
  return n ? `https://wa.me/${n}?text=${q}` : `https://wa.me/?text=${q}`;
}

export function safeFileName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 60) || "invite";
}

export const resultLabels: Record<string, string> = {
  valid: "مسح سليم",
  admitted: "دخول",
  not_found: "غير موجودة",
  cancelled: "ملغاة",
  used: "مستخدمة",
  exceeds: "تجاوز العدد",
};

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
}
