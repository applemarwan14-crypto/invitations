import { useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function Login() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error("بيانات الدخول غير صحيحة");
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 p-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-5 rounded-3xl bg-white p-7 shadow-2xl"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-2xl bg-slate-900 p-3 text-accent">
            <QrCode className="size-8" />
          </div>
          <h1 className="text-2xl font-bold">بوابة الدعوات</h1>
          <p className="text-sm text-muted-foreground">سجّل دخولك للمتابعة</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" type="email" dir="ltr" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input id="password" type="password" dir="ltr" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} دخول
        </Button>
      </motion.form>
    </div>
  );
}
