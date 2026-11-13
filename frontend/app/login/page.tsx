"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n-context";
import type { Locale } from "@/lib/messages";
import { useRouter } from "next/navigation";
import { api, isApiUrlMissing } from "@/lib/api";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Lock, UserRound } from "lucide-react";

type LoginResponse =
  | { access_token: string; role: "SUPER_ADMIN" }
  | {
      access_token: string;
      role: "BUSINESS";
      businessId: string;
      businessName: string;
      ownerName?: string | null;
      id: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      poBox?: string | null;
      tin?: string | null;
      vrn?: string | null;
      logoDataUrl?: string | null;
    };

export default function LoginPage() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const token = useAuthStore((s) => s.token);
  const session = useAuthStore((s) => s.session);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "success" | "error">("idle");

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
    setPhase("loading");
    const started = Date.now();
    try {
      const { data } = await api.post<LoginResponse>("/auth/login", {
        loginId: loginId.trim(),
        password,
      });
      await wait(Math.max(0, 520 - (Date.now() - started)));
      setPhase("success");
      await wait(900);
      if (data.role === "SUPER_ADMIN") {
        setSession(data.access_token, { role: "SUPER_ADMIN" });
        router.replace("/admin/dashboard");
      } else {
        setSession(data.access_token, {
          role: "BUSINESS",
          businessId: data.businessId,
          businessName: data.businessName,
          ownerName: data.ownerName,
          id: data.id,
          phone: data.phone,
          email: data.email,
          address: data.address,
          poBox: data.poBox,
          tin: data.tin,
          vrn: data.vrn,
          logoDataUrl: data.logoDataUrl,
        });
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      await wait(Math.max(0, 520 - (Date.now() - started)));
      setError(getApiErrorMessage(err));
      setPhase("error");
      await wait(780);
      setPhase("idle");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-50 p-4">
      <div className="absolute right-4 top-4">
        <Select
          value={locale}
          onValueChange={(v) => {
            if (v === "en" || v === "sw") setLocale(v as Locale);
          }}
        >
          <SelectTrigger className="w-40 rounded-xl bg-white/90 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">{t("common.english")}</SelectItem>
            <SelectItem value="sw">{t("common.swahili")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className="glass relative w-full max-w-[22rem] rounded-[1.75rem] border-white/80 px-2 py-6 shadow-[0_20px_50px_rgba(59,130,246,0.12)]">
        <div className={phase === "idle" ? undefined : "invisible"} aria-hidden={phase !== "idle"}>
        <CardHeader className="space-y-2 px-5 pb-1 text-center">
          <CardTitle className="text-[1.65rem] font-semibold tracking-[0.14em] text-slate-900">
            S7-SYSTEM
          </CardTitle>
          <div className="mx-auto h-1 w-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
          <CardDescription className="text-sm leading-relaxed text-slate-500">
            {t("login.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="loginId" className="text-xs font-medium text-slate-500">
                {t("login.loginId")}
              </Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
                <Input
                  id="loginId"
                  required
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="h-12 rounded-2xl border-blue-100 bg-gradient-to-r from-blue-50 to-white pl-10 pr-3.5 shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-500">
                {t("login.password")}
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-2xl border-indigo-100 bg-gradient-to-r from-indigo-50 to-white pl-10 pr-11 shadow-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-white/80 hover:text-slate-800"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
            {isApiUrlMissing() && (
              <div
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                role="status"
              >
                <strong className="font-semibold">API URL not configured.</strong>{" "}
                Set{" "}
                <code className="rounded bg-white px-1">NEXT_PUBLIC_API_URL</code>{" "}
                on your frontend host (e.g. Vercel) to your backend origin —{" "}
                <strong>no</strong> <code className="rounded bg-white px-1">/api</code>{" "}
                suffix — then redeploy.
              </div>
            )}
            {error && (
              <p
                className="whitespace-pre-wrap text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={phase !== "idle" || isApiUrlMissing()}
              className="btn-primary-gradient mt-1 h-11 w-full rounded-2xl text-white"
            >
              {t("login.submit")}
            </Button>
          </form>
        </CardContent>
        </div>
        {phase !== "idle" && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            role="status"
            aria-live="polite"
          >
            <span className="sr-only">
              {phase === "loading"
                ? t("login.wait")
                : phase === "success"
                  ? t("login.submit")
                  : error}
            </span>
            <div className="flex h-[92px] w-[92px] items-center justify-center rounded-[28px] bg-neutral-900/90 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-white/10">
              {phase === "loading" ? <SpinRing /> : phase === "success" ? <Tick /> : <Cross />}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function SpinRing() {
  return (
    <svg className="h-11 w-11 animate-spin" viewBox="0 0 44 44" aria-hidden>
      <circle cx="22" cy="22" r="16" fill="none" stroke="white" strokeOpacity="0.22" strokeWidth="3" />
      <circle
        cx="22"
        cy="22"
        r="16"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="28 80"
      />
    </svg>
  );
}

function Tick() {
  return (
    <svg className="h-11 w-11" viewBox="0 0 44 44" aria-hidden>
      <circle cx="22" cy="22" r="16" fill="none" stroke="white" strokeWidth="3" className="save-ring-draw" />
      <path
        d="M14 22.5 L19.2 28 L30.5 16"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="save-tick-draw"
      />
    </svg>
  );
}

function Cross() {
  return (
    <svg className="h-11 w-11" viewBox="0 0 44 44" aria-hidden>
      <circle cx="22" cy="22" r="16" fill="none" stroke="white" strokeWidth="3" className="save-ring-draw" />
      <path
        d="M16 16 L28 28 M28 16 L16 28"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        className="save-tick-draw"
      />
    </svg>
  );
}
