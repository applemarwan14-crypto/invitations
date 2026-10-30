import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Blocked() {
  const { signOut } = useAuth();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <ShieldOff className="size-12 text-danger" />
      <h1 className="text-xl font-bold">الحساب غير مفعّل</h1>
      <p className="text-muted-foreground">تواصل مع المدير لتفعيل حسابك.</p>
      <Button variant="outline" onClick={signOut}>تسجيل الخروج</Button>
    </div>
  );
}
