import QRCodeStyling from "qr-code-styling";
import type { EventSettings } from "./supabase";

export const W = 1080;
export const H = 1350;

interface Theme { bg1: string; bg2: string; accent: string; text: string; soft: string; qr: string }

export const THEMES: Record<string, { label: string } & Theme> = {
  gold: { label: "كحلي وذهبي", bg1: "#0b1530", bg2: "#1c2a52", accent: "#d4af37", text: "#ffffff", soft: "#c9d1e6", qr: "#0b1530" },
  emerald: { label: "زمردي", bg1: "#062b22", bg2: "#0e4a3b", accent: "#e2c275", text: "#ffffff", soft: "#cfe3dc", qr: "#062b22" },
  rose: { label: "وردي فاتح", bg1: "#fbf3ee", bg2: "#f3dfd5", accent: "#b76e79", text: "#3b2a2f", soft: "#6f5a60", qr: "#3b2a2f" },
  ivory: { label: "عاجي كلاسيكي", bg1: "#fffaf0", bg2: "#f1e7d2", accent: "#9c7a2e", text: "#2a2418", soft: "#5f5440", qr: "#2a2418" },
};

let fontsReady: Promise<unknown> | null = null;
function ensureFonts() {
  fontsReady ??= Promise.all([
    document.fonts.load('700 80px "Reem Kufi"', "دعوة"),
    document.fonts.load('700 60px "Amiri"', "دعوة"),
    document.fonts.load('500 40px "IBM Plex Sans Arabic"', "دعوة 123"),
    document.fonts.load('700 40px "IBM Plex Sans Arabic"', "دعوة 123"),
  ]);
  return fontsReady;
}

async function qrBitmap(code: string, size: number, color: string) {
  const qr = new QRCodeStyling({
    width: size,
    height: size,
    type: "canvas",
    data: code,
    margin: 0,
    qrOptions: { errorCorrectionLevel: "H" },
    dotsOptions: { type: "rounded", color },
    cornersSquareOptions: { type: "extra-rounded", color },
    cornersDotOptions: { type: "dot", color },
    backgroundOptions: { color: "#ffffff" },
  });
  const blob = (await qr.getRawData("png")) as Blob;
  return createImageBitmap(blob);
}

/** Draws text centred, shrinking the font until it fits maxWidth. */
function fitText(ctx: CanvasRenderingContext2D, text: string, y: number, font: (px: number) => string, start: number, min: number, maxWidth: number) {
  let px = start;
  ctx.font = font(px);
  while (px > min && ctx.measureText(text).width > maxWidth) {
    px -= 2;
    ctx.font = font(px);
  }
  ctx.fillText(text, W / 2, y, maxWidth);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function ornament(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 220, cy);
  ctx.lineTo(cx - 30, cy);
  ctx.moveTo(cx + 30, cy);
  ctx.lineTo(cx + 220, cy);
  ctx.stroke();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-11, -11, 22, 22);
  ctx.restore();
}

function corner(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export interface InviteData { code: string; guest_name: string; allowed: number }

export async function renderInvitation(inv: InviteData, s: EventSettings): Promise<HTMLCanvasElement> {
  await ensureFonts();
  const t = THEMES[s.theme] ?? THEMES.gold;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.bg1);
  g.addColorStop(1, t.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Frame
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 4;
  roundRect(ctx, 40, 40, W - 80, H - 80, 28);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  roundRect(ctx, 58, 58, W - 116, H - 116, 20);
  ctx.stroke();
  corner(ctx, 58, 58, 1, 1, t.accent);
  corner(ctx, W - 58, 58, -1, 1, t.accent);
  corner(ctx, 58, H - 58, 1, -1, t.accent);
  corner(ctx, W - 58, H - 58, -1, -1, t.accent);

  const maxW = W - 220;

  // Title
  ctx.fillStyle = t.accent;
  fitText(ctx, s.title || "دعوة", 165, (px) => `700 ${px}px "Reem Kufi"`, 96, 48, maxW);
  ornament(ctx, W / 2, 245, t.accent);

  // Host line
  ctx.fillStyle = t.soft;
  if (s.host_line) fitText(ctx, s.host_line, 315, (px) => `700 ${px}px "Amiri"`, 44, 26, maxW);

  // Guest name
  ctx.fillStyle = t.soft;
  ctx.font = `500 32px "IBM Plex Sans Arabic"`;
  ctx.fillText("الضيف الكريم", W / 2, 385);
  ctx.fillStyle = t.text;
  fitText(ctx, inv.guest_name, 455, (px) => `700 ${px}px "Amiri"`, 72, 34, maxW);

  // Event details
  ctx.fillStyle = t.soft;
  let y = 540;
  if (s.event_name) { fitText(ctx, s.event_name, y, (px) => `700 ${px}px "Amiri"`, 46, 26, maxW); y += 62; }
  ctx.font = `500 34px "IBM Plex Sans Arabic"`;
  if (s.date_text) { fitText(ctx, s.date_text, y, (px) => `500 ${px}px "IBM Plex Sans Arabic"`, 34, 22, maxW); y += 52; }
  if (s.venue_text) { fitText(ctx, s.venue_text, y, (px) => `500 ${px}px "IBM Plex Sans Arabic"`, 34, 22, maxW); }

  // QR card
  const qrSize = 340;
  const pad = 30;
  const cardW = qrSize + pad * 2;
  const cardX = (W - cardW) / 2;
  const cardY = 715;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, cardY, cardW, cardW, 28);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 3;
  roundRect(ctx, cardX, cardY, cardW, cardW, 28);
  ctx.stroke();
  const bmp = await qrBitmap(inv.code, qrSize, t.qr);
  ctx.drawImage(bmp, cardX + pad, cardY + pad, qrSize, qrSize);
  bmp.close();

  // Count pill
  const pillY = cardY + cardW + 52;
  const label = inv.allowed === 1 ? "دعوة لشخص واحد" : inv.allowed === 2 ? "دعوة لشخصين" : `عدد الأشخاص: ${inv.allowed}`;
  ctx.font = `700 34px "IBM Plex Sans Arabic"`;
  const pw = ctx.measureText(label).width + 70;
  ctx.fillStyle = t.accent;
  roundRect(ctx, (W - pw) / 2, pillY - 32, pw, 64, 32);
  ctx.fill();
  ctx.fillStyle = s.theme === "rose" || s.theme === "ivory" ? "#ffffff" : t.bg1;
  ctx.fillText(label, W / 2, pillY + 2);

  // Note
  ctx.fillStyle = t.soft;
  if (s.note) fitText(ctx, s.note, pillY + 68, (px) => `500 ${px}px "IBM Plex Sans Arabic"`, 26, 18, maxW);

  return c;
}

export function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/png"));
}
