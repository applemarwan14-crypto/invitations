import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import Scanner from "@/pages/Scanner";
import Blocked from "@/pages/Blocked";
import type { Role } from "@/lib/supabase";

function FullLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function Guard({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile || !profile.is_active) return <Blocked />;
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Home() {
  const { session, profile, loading } = useAuth();
  if (loading) return <FullLoader />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile || !profile.is_active) return <Blocked />;
  return <Navigate to={profile.role === "admin" ? "/admin" : "/scan"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/*" element={<Guard roles={["admin"]}><Admin /></Guard>} />
          <Route path="/scan" element={<Guard roles={["admin", "staff"]}><Scanner /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
      <Toaster position="top-center" richColors dir="rtl" toastOptions={{ style: { fontFamily: "inherit" } }} />
    </AuthProvider>
  );
}
