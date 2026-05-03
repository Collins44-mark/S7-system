"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAuthStore } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Box } from "lucide-react";

type LoginResponse =
  | { access_token: string; role: "SUPER_ADMIN" }
  | {
      access_token: string;
      role: "BUSINESS";
      businessId: string;
      businessName: string;
      id: string;
    };

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !session) return;
    if (session.role === "SUPER_ADMIN") {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/dashboard");
    }
  }, [token, session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>("/auth/login", {
        loginId: loginId.trim(),
        password,
      });
      if (data.role === "SUPER_ADMIN") {
        setSession(data.access_token, { role: "SUPER_ADMIN" });
        router.replace("/admin/dashboard");
      } else {
        setSession(data.access_token, {
          role: "BUSINESS",
          businessId: data.businessId,
          businessName: data.businessName,
          id: data.id,
        });
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 p-4">
      <Card className="glass w-full max-w-md border-white/70 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600">
            <Box className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="text-2xl text-slate-800">Sign in</CardTitle>
          <CardDescription className="text-slate-600">
            Business code (e.g. S7-0001) or the super admin Login ID from{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">SUPER_ADMIN_ID</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loginId">Login ID</Label>
              <Input
                id="loginId"
                required
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="rounded-xl"
                placeholder="Business code or SUPER_ADMIN_ID value"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="btn-primary-gradient h-11 w-full rounded-xl text-white"
            >
              {loading ? "Please wait…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
