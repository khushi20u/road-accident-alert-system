import { useState } from "react";
import { reportAccident } from "../services/api";
import VerifyBanner from "./VerifyBanner";

const SEVERITY_CONFIG = {
  low:      { color: "text-emerald-400", bg: "bg-emerald-900/40", border: "border-emerald-500", icon: "ℹ️" },
  medium:   { color: "text-yellow-400",  bg: "bg-yellow-900/40",  border: "border-yellow-500",  icon: "⚠️" },
  critical: { color: "text-red-400",     bg: "bg-red-900/40",     border: "border-red-500",     icon: "🚨" },
};

export default function ReportForm({ onAccidentReported }) {
  const [form, setForm] = useState({ description: "", locationDescription: "" });
  const [image, setImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  const getLocation = () => {
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setLocationLoading(false); },
      () => { setError("Could not get location. Please allow location access."); setLocationLoading(false); }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) return setError("Please share your location first.");
    if (!form.description.trim()) return setError("Please describe the accident.");
    setLoading(true); setError(""); setResult(null);
    try {
      const data = await reportAccident({ description: form.description, latitude: location.lat, longitude: location.lon, locationDescription: form.locationDescription, image });
      setResult(data);
      if (onAccidentReported) onAccidentReported(data);
    } catch (err) {
      if (err.status === 429) setError("⏱️ Rate limit reached. Max 3 reports per hour to prevent false alarms.");
      else setError("Failed to submit. Please try again.");
    } finally { setLoading(false); }
  };

  const handleReset = () => { setResult(null); setForm({ description: "", locationDescription: "" }); setLocation(null); setImage(null); setError(""); };

  if (result) {
    const { ai_analysis, nearest_responders, accident_id } = result;
    const cfg = SEVERITY_CONFIG[ai_analysis.severity] || SEVERITY_CONFIG.medium;

    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Severity banner */}
        <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-6 mb-4`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{cfg.icon}</span>
            <div>
              <div className={`${cfg.color} font-black text-xl uppercase tracking-wide`}>
                {ai_analysis.severity} Severity
              </div>
              <div className="text-gray-400 text-sm">Report #{accident_id}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-gray-400 text-xs">AI Confidence</div>
              <div className={`${cfg.color} font-bold text-lg`}>{Math.round(ai_analysis.confidence * 100)}%</div>
            </div>
          </div>
          <p className="text-gray-200 leading-relaxed">{ai_analysis.summary}</p>
        </div>

        {/* Validity status */}
        {result.validity?.is_suspicious ? (
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-xl p-4 mb-4">
            <div className="text-yellow-400 font-bold mb-1">⚠️ Report Held for Verification</div>
            <div className="text-yellow-200/70 text-sm">{result.validity.message}</div>
            {result.validity.flags?.map((f, i) => (
              <div key={i} className="text-yellow-300/60 text-xs mt-1">• {f}</div>
            ))}
            <VerifyBanner accident={{ id: accident_id, summary: ai_analysis.summary, location: form.locationDescription }} userLocation={location} onVerified={() => {}} />
          </div>
        ) : (
          <div className="bg-emerald-900/30 border border-emerald-600 rounded-xl p-4 mb-4">
            <div className="text-emerald-400 font-bold">✅ Report Verified — Responders Dispatched</div>
            <div className="text-emerald-200/70 text-sm mt-1">{result.validity?.message}</div>
          </div>
        )}

        {/* AI chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {ai_analysis.requires_ambulance && <span className="bg-red-900/50 text-red-300 px-3 py-1 rounded-full text-xs font-semibold">🚑 Ambulance Required</span>}
          {ai_analysis.requires_police && <span className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold">🚔 Police Required</span>}
          {ai_analysis.requires_fire && <span className="bg-orange-900/50 text-orange-300 px-3 py-1 rounded-full text-xs font-semibold">🚒 Fire Unit Required</span>}
          {ai_analysis.estimated_casualties > 0 && <span className="bg-red-900/50 text-red-300 px-3 py-1 rounded-full text-xs font-semibold">👥 Est. {ai_analysis.estimated_casualties} casualties</span>}
          <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs font-semibold">Reports left this hour: {result.remaining_reports_this_hour}</span>
        </div>

        {/* Recommended response */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
          <div className="text-gray-400 text-xs uppercase tracking-widest mb-2">Recommended Response</div>
          <p className="text-gray-200 text-sm leading-relaxed">{ai_analysis.recommended_response}</p>
        </div>

        {/* Nearest responders */}
        {nearest_responders?.length > 0 && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
            <div className="text-gray-400 text-xs uppercase tracking-widest mb-3">Responders Alerted ({nearest_responders.length})</div>
            <div className="flex flex-col gap-3">
              {nearest_responders.map((r) => (
                <div key={r.id} className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                  <span className="text-2xl">{r.type === "hospital" ? "🏥" : r.type === "ambulance" ? "🚑" : "🚔"}</span>
                  <div className="flex-1">
                    <div className="text-white font-semibold text-sm">{r.name}</div>
                    <div className="text-gray-400 text-xs">{r.distance_km} km away · {r.city}</div>
                    {r.contact && <div className="text-blue-400 text-xs">📞 {r.contact}</div>}
                  </div>
                  {r.estimated_response_minutes && (
                    <div className="bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full text-xs font-bold">
                      ~{r.estimated_response_minutes} min
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4 mb-4 text-yellow-200/80 text-sm">
          ⚠️ If life-threatening, also call <strong>108</strong> (Ambulance) or <strong>100</strong> (Police) directly.
        </div>

        <button onClick={handleReset} className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition">
          Report Another Accident
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-red-500 mb-2">🚨 Report an Accident</h1>
          <p className="text-gray-400 leading-relaxed">Your report instantly alerts nearby hospitals and emergency services using AI triage.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Location */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-300 font-semibold text-sm">📍 Your Location *</label>
            {location ? (
              <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl px-4 py-3 text-emerald-400 font-medium text-sm">
                ✅ Location captured ({location.lat.toFixed(5)}, {location.lon.toFixed(5)})
              </div>
            ) : (
              <button type="button" onClick={getLocation} disabled={locationLoading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold px-6 py-3 rounded-xl transition w-fit text-sm">
                {locationLoading ? "Getting location..." : "📍 Share My Location"}
              </button>
            )}
          </div>

          {/* Landmark */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-300 font-semibold text-sm">📌 Landmark / Road Name</label>
            <input
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none transition text-sm"
              placeholder="e.g. NH-44 near Sagar bypass, Jabalpur"
              value={form.locationDescription}
              onChange={(e) => setForm({ ...form, locationDescription: e.target.value })}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-300 font-semibold text-sm">Describe the Accident *</label>
            <textarea
              className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-red-500 focus:outline-none transition text-sm resize-none"
              placeholder="e.g. Two trucks collided head-on. One person unconscious, fire visible on the front vehicle. Highway blocked."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              required
            />
            <span className="text-gray-500 text-xs">Be specific — AI uses this to assess severity and dispatch the right responders</span>
          </div>

          {/* Photo */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-300 font-semibold text-sm">Upload Photo (optional)</label>
            <input
              type="file" accept="image/*" capture="environment"
              className="text-gray-400 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-300 file:font-semibold hover:file:bg-gray-600 file:cursor-pointer"
              onChange={(e) => setImage(e.target.files[0])}
            />
            {image && <span className="text-emerald-400 text-xs">✅ {image.name}</span>}
            <span className="text-gray-500 text-xs">Photo helps AI better assess severity</span>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black py-4 rounded-xl text-base transition">
            {loading ? "AI Analyzing & Alerting Responders..." : "🚨 Send Emergency Alert"}
          </button>
        </form>

        {/* Info footer */}
        <div className="flex gap-4 mt-6 pt-6 border-t border-gray-800 flex-wrap">
          {["AI triage in <2 seconds", "Geo-locates nearest responders", " Real-time WebSocket alerts"].map((item) => (
            <div key={item} className="text-gray-500 text-xs flex-1 min-w-32">{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}