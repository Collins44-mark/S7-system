"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n-context";
import { subscribeSaveFeedback } from "@/lib/save-feedback-bus";

type Phase = "idle" | "loading" | "success" | "error";

const MIN_SPIN_MS = 480;
const HOLD_MS = 720;

export function SaveFeedback() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("idle");
  const pending = useRef(0);
  const startedAt = useRef(0);
  const generation = useRef(0);
  const failed = useRef(false);

  useEffect(() => {
    return subscribeSaveFeedback((event) => {
      if (event === "start") {
        pending.current += 1;
        generation.current += 1;
        if (pending.current === 1) {
          startedAt.current = Date.now();
          failed.current = false;
        }
        setPhase("loading");
        return;
      }

      pending.current = Math.max(0, pending.current - 1);
      if (event === "fail") failed.current = true;
      if (pending.current > 0) return;

      const gen = generation.current;
      const ok = !failed.current;
      const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - startedAt.current));
      window.setTimeout(() => {
        if (generation.current !== gen || pending.current > 0) return;
        setPhase(ok ? "success" : "error");
        window.setTimeout(() => {
          if (generation.current !== gen || pending.current > 0) return;
          setPhase("idle");
        }, HOLD_MS);
      }, wait);
    });
  }, []);

  if (phase === "idle") return null;

  const label =
    phase === "loading"
      ? t("common.saving")
      : phase === "success"
        ? t("common.saved")
        : t("common.saveFailed");

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-[92px] w-[92px] items-center justify-center rounded-[28px] bg-neutral-900/88 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-white/10 backdrop-blur-xl">
        <span className="sr-only">{label}</span>
        {phase === "loading" ? <SpinRing /> : phase === "success" ? <Tick /> : <Cross />}
      </div>
    </div>
  );
}

function SpinRing() {
  return (
    <svg className="h-11 w-11 animate-spin" viewBox="0 0 44 44" aria-hidden>
      <circle
        cx="22"
        cy="22"
        r="16"
        fill="none"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="3"
      />
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
      <circle
        cx="22"
        cy="22"
        r="16"
        fill="none"
        stroke="white"
        strokeWidth="3"
        className="save-ring-draw"
      />
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
      <circle
        cx="22"
        cy="22"
        r="16"
        fill="none"
        stroke="white"
        strokeWidth="3"
        className="save-ring-draw"
      />
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
