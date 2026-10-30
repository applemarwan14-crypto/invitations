alter table public.event_settings
  add column wa_message text not null default 'حياك الله {الاسم} 🌹
يسعدنا دعوتك لحضور مناسبتنا، ومرفق بطاقة الدعوة الخاصة بك ({العدد}).
نأمل إبراز الرمز عند الدخول.';
