import { Loader2 } from "lucide-react";

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-600">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
