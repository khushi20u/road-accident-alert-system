import { useState } from "react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function VerifyBanner({ accident, userLocation, onVerified }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);

  if (!accident || !userLocation) return null;

  const handleConfirm = async () => {
    setStatus("loading");
    try {
      const res = await fetch(`${BASE_URL}/accidents/${accident.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmer_id: crypto.randomUUID(),
          user_lat: userLocation.lat,
          user_lon: userLocation.lon,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Failed"); }
      const data = await res.json();
      setResult(data);
      setStatus("confirmed");
      if (data.is_verified && onVerified) onVerified(accident.id);
    } catch (err) {
      setStatus("error");
      setResult({ message: err.message });
    }
  };

  return (
    <div className="mt-4 bg-yellow-900/20 border border-yellow-700 rounded-xl p-4 flex items-start justify-between gap-4 flex-wrap">
      <div className="flex gap-3 items-start">
        <span className="text-2xl">👁️</span>
        <div>
          <div className="text-yellow-400 font-bold text-sm">Unverified Report Nearby</div>
          <div className="text-yellow-200/70 text-xs mt-1">{accident.summary}</div>
          <div className="text-yellow-300/50 text-xs mt-1">📍 {accident.location || "Unknown location"}</div>
        </div>
      </div>
      <div className="shrink-0">
        {status === "idle" && (
          <button onClick={handleConfirm}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition">
            ✅ I See This Accident
          </button>
        )}
        {status === "loading" && (
          <button disabled className="bg-yellow-700 text-yellow-300 font-bold px-4 py-2 rounded-lg text-sm opacity-60">
            Confirming...
          </button>
        )}
        {status === "confirmed" && (
          <div className="text-right">
            <div className="text-emerald-400 font-bold text-sm">
              {result?.is_verified ? "🚨 Verified! Dispatching..." : "✅ Confirmed!"}
            </div>
            <div className="text-gray-500 text-xs mt-1">
              {result?.confirmation_count}/{result?.confirmations_needed} confirmations
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="text-red-400 text-sm max-w-48">{result?.message}</div>
        )}
      </div>
    </div>
  );
}