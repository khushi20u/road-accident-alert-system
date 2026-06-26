import { useState, useEffect } from "react";
import { useWebSocket } from "../hooks/useWebSocket";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const RESPONDER_CODES = {
  "AIIMS-001": { id: 1, name: "AIIMS Bhopal", type: "hospital" },
  "HAMID-001": { id: 2, name: "Hamidia Hospital", type: "hospital" },
  "AMB-001":   { id: 3, name: "City Ambulance Unit 1", type: "ambulance" },
  "AMB-002":   { id: 4, name: "City Ambulance Unit 2", type: "ambulance" },
  "POL-001":   { id: 5, name: "MP Police Control Room", type: "police" },
  "JBP-001":   { id: 6, name: "Jabalpur Hospital", type: "hospital" },
  "JBP-AMB":   { id: 7, name: "Jabalpur Ambulance", type: "ambulance" },
};

const TYPE_ICONS   = { hospital: "🏥", ambulance: "🚑", police: "🚔", fire: "🚒" };
const TYPE_LABELS  = { hospital: "Hospital", ambulance: "Ambulance Unit", police: "Police", fire: "Fire Unit" };
const SEVERITY_COLORS = { critical: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const SEVERITY_BG     = { critical: "bg-red-900/30 border-red-700", medium: "bg-yellow-900/30 border-yellow-700", low: "bg-emerald-900/30 border-emerald-700" };

// ── Proper Login Screen ───────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [credentials, setCredentials] = useState({ facilityId: "", accessCode: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simulate a small network delay for realism
    await new Promise((r) => setTimeout(r, 800));

    const combinedKey = `${credentials.facilityId.toUpperCase().trim()}-${credentials.accessCode.toUpperCase().trim()}`;
    const directKey   = credentials.facilityId.toUpperCase().trim();

    const responder = RESPONDER_CODES[combinedKey] || RESPONDER_CODES[directKey];

    if (responder) {
      onLogin({ ...responder, code: directKey });
    } else {
      setError("Invalid Facility ID or Access Code. Please contact your system administrator.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-gradient-to-br from-red-950 via-gray-900 to-gray-950 p-12 border-r border-gray-800">
        <div>
          <div className="text-red-500 font-black text-2xl tracking-tight mb-2">🚨 RoadAlert India</div>
          <div className="text-gray-500 text-sm">Emergency Response Network</div>
        </div>

        <div className="space-y-8">
          <div>
            <div className="text-white font-black text-3xl leading-tight mb-4">
              Real-time emergency<br />coordination for<br />first responders
            </div>
            <div className="text-gray-400 text-sm leading-relaxed">
              AI-powered triage alerts delivered instantly to your facility. Accept, coordinate, and track accident response — all in one place.
            </div>
          </div>

          <div className="space-y-4">
            {[
              { icon: "⚡", title: "Instant Alerts", desc: "Sub-100ms WebSocket delivery" },
              { icon: "🤖", title: "AI Triage", desc: "Gemini-powered severity scoring" },
              { icon: "📍", title: "Geo-matched", desc: "Only alerts within your radius" },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="text-xl mt-0.5">{f.icon}</div>
                <div>
                  <div className="text-white font-semibold text-sm">{f.title}</div>
                  <div className="text-gray-500 text-xs">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-gray-600 text-xs">
          Secured by RoadAlert Emergency Network · v1.0
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-red-500 font-black text-xl mb-8 text-center">🚨 RoadAlert India</div>

          {/* Form header */}
          <div className="mb-8">
            <h1 className="text-white font-black text-3xl mb-2">Responder Login</h1>
            <p className="text-gray-400 text-sm">Sign in to your emergency response dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Facility ID */}
            <div className="space-y-2">
              <label className="text-gray-300 text-sm font-semibold block">Facility ID</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3M9 7h1m-1 4h1m4-4h1m-1 4h1M9 21v-4a2 2 0 012-2h2a2 2 0 012 2v4"/>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="e.g. AIIMS"
                  value={credentials.facilityId}
                  onChange={(e) => { setCredentials({ ...credentials, facilityId: e.target.value }); setError(""); }}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none transition font-mono tracking-wider text-sm uppercase"
                  required
                />
              </div>
            </div>

            {/* Access Code */}
            <div className="space-y-2">
              <label className="text-gray-300 text-sm font-semibold block">Access Code</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </div>
                <input
                  type={showCode ? "text" : "password"}
                  placeholder="Enter your access code"
                  value={credentials.accessCode}
                  onChange={(e) => { setCredentials({ ...credentials, accessCode: e.target.value }); setError(""); }}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-12 py-3.5 text-white placeholder-gray-600 focus:border-red-500 focus:outline-none transition font-mono tracking-widest text-sm"
                  required
                />
                <button type="button" onClick={() => setShowCode((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                  {showCode ? (
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 flex items-start gap-3">
                <span className="text-red-400 mt-0.5">⚠️</span>
                <span className="text-red-300 text-sm">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black py-4 rounded-xl text-base transition flex items-center justify-center gap-3 mt-2">
              {loading ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Authenticating...
                </>
              ) : "Sign In to Portal"}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">Demo Credentials</div>
            <div className="space-y-2">
              {[
                { facility: "AIIMS", code: "001", label: "AIIMS Bhopal", type: "hospital" },
                { facility: "AMB",   code: "001", label: "City Ambulance Unit 1", type: "ambulance" },
                { facility: "POL",   code: "001", label: "MP Police Control Room", type: "police" },
                { facility: "JBP",   code: "001", label: "Jabalpur Hospital", type: "hospital" },
              ].map((d) => (
                <button key={d.facility} type="button"
                  onClick={() => setCredentials({ facilityId: d.facility, accessCode: d.code })}
                  className="w-full flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-2.5 transition text-left">
                  <span className="text-lg">{TYPE_ICONS[d.type]}</span>
                  <div className="flex-1">
                    <div className="text-white text-sm font-semibold">{d.label}</div>
                    <div className="text-gray-500 text-xs font-mono">{d.facility} · ****</div>
                  </div>
                  <div className="text-gray-600 text-xs">Click to fill</div>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center text-gray-700 text-xs mt-6">
            Access restricted to authorized emergency responders only
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Alert Card ────────────────────────────────────────────────────────────────
function AlertCard({ alert, onAccept, onDecline }) {
  const [status, setStatus] = useState("pending");
  const color   = SEVERITY_COLORS[alert.severity] || "#888";
  const bgClass = SEVERITY_BG[alert.severity]     || "bg-gray-800 border-gray-700";

  return (
    <div className={`${bgClass} border rounded-2xl p-5`} style={{ borderTop: `4px solid ${color}` }}>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span style={{ background: color }} className="text-white font-black text-xs px-3 py-1 rounded-full uppercase tracking-wide">
          {alert.severity}
        </span>
        <span className="text-gray-500 text-xs ml-auto">{alert.timestamp}</span>
        {alert.verified_by_community && (
          <span className="bg-emerald-900/50 text-emerald-400 text-xs px-3 py-1 rounded-full font-semibold">✅ Community Verified</span>
        )}
      </div>
      <p className="text-white font-medium leading-relaxed mb-2">{alert.summary || alert.alert_message}</p>
      <div className="text-gray-400 text-sm mb-4">📍 {alert.location || "Location not specified"}</div>
      <div className="flex gap-3 mb-4 flex-wrap">
        {alert.estimated_casualties > 0 && (
          <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
            <div className="text-gray-500 text-xs uppercase tracking-wide">Casualties</div>
            <div className="text-white font-black text-lg">{alert.estimated_casualties}</div>
          </div>
        )}
        {alert.nearest_responders?.[0]?.distance_km && (
          <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
            <div className="text-gray-500 text-xs uppercase tracking-wide">Distance</div>
            <div className="text-white font-black text-lg">{alert.nearest_responders[0].distance_km} km</div>
          </div>
        )}
        {alert.nearest_responders?.[0]?.estimated_response_minutes && (
          <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
            <div className="text-gray-500 text-xs uppercase tracking-wide">Est. ETA</div>
            <div className="text-white font-black text-lg">{alert.nearest_responders[0].estimated_response_minutes} min</div>
          </div>
        )}
      </div>
      {alert.recommended_response && (
        <div className="bg-emerald-900/20 border border-emerald-800 rounded-xl px-4 py-3 text-emerald-300 text-sm mb-4">
          🩺 <strong>Bring:</strong> {alert.recommended_response}
        </div>
      )}
      {status === "pending" && (
        <div className="flex gap-3">
          <button onClick={() => { setStatus("accepted"); onAccept(alert); }}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition">
            ✅ Accept & Respond
          </button>
          <button onClick={() => { setStatus("declined"); onDecline(alert); }}
            className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold px-5 py-3 rounded-xl transition">
            ✗
          </button>
        </div>
      )}
      {status === "accepted" && (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl py-3 text-emerald-400 font-bold text-center">
          🚀 Responding — en route to accident site
        </div>
      )}
      {status === "declined" && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl py-3 text-gray-500 font-semibold text-center">
          ✗ Marked unavailable for this alert
        </div>
      )}
    </div>
  );
}

// ── Main Portal ───────────────────────────────────────────────────────────────
export default function ResponderPortal() {
  const [responder,     setResponder]     = useState(null);
  const [alerts,        setAlerts]        = useState([]);
  const [isAvailable,   setIsAvailable]   = useState(true);
  const [acceptedCount, setAcceptedCount] = useState(0);

  const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

  const wsUrl = responder
  ? `${WS_BASE}/ws/responder/${responder.id}`
  : `${WS_BASE}/ws/dashboard`;

  const { isConnected, lastMessage } = useWebSocket(wsUrl);

  useEffect(() => {
    if (!lastMessage || !responder) return;
    if (lastMessage.type === "NEW_ACCIDENT_ALERT") {
      setAlerts((prev) => [{ ...lastMessage.data, timestamp: new Date().toLocaleTimeString() }, ...prev]);
      if (lastMessage.data.severity === "critical" && Notification.permission === "granted") {
        new Notification("🚨 CRITICAL ACCIDENT ALERT", { body: lastMessage.data.summary });
      }
    }
  }, [lastMessage, responder]);

  useEffect(() => {
    if (responder && Notification.permission === "default") Notification.requestPermission();
  }, [responder]);

  const handleAccept = async (alert) => {
    setAcceptedCount((c) => c + 1);
    try {
      await fetch(`${BASE_URL}/accidents/${alert.accident_id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "responding" }),
      });
    } catch (e) { console.error(e); }
  };

  if (!responder) return <LoginScreen onLogin={setResponder} />;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{TYPE_ICONS[responder.type]}</span>
          <div>
            <div className="text-white font-black text-lg">{responder.name}</div>
            <div className="text-gray-500 text-xs font-mono">ID: {responder.code}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setIsAvailable((p) => !p)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition ${isAvailable ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"}`}>
            {isAvailable ? "🟢 Available" : "🔴 Unavailable"}
          </button>
          <div className={`px-4 py-2 rounded-full text-sm font-bold ${isConnected ? "bg-emerald-900/30 text-emerald-400" : "bg-red-900/30 text-red-400"}`}>
            {isConnected ? "📡 Live" : "⚠️ Reconnecting..."}
          </div>
          <button onClick={() => setResponder(null)}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded-xl text-sm transition">
            Sign Out
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="flex bg-gray-900 border-b border-gray-800">
        {[
          { label: "Alerts Received", value: alerts.length,                          color: "text-blue-400" },
          { label: "Accepted",        value: acceptedCount,                           color: "text-emerald-400" },
          { label: "Pending",         value: Math.max(0, alerts.length - acceptedCount), color: "text-yellow-400" },
        ].map((s) => (
          <div key={s.label} className="flex-1 flex flex-col items-center py-4 border-r border-gray-800 last:border-0">
            <div className={`${s.color} text-3xl font-black`}>{s.value}</div>
            <div className="text-gray-500 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      <div className="max-w-3xl mx-auto p-6">
        <h2 className="text-white font-black text-xl mb-4 flex items-center gap-3">
          Incoming Alerts
          {alerts.length > 0 && (
            <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">{alerts.length}</span>
          )}
        </h2>

        {!isAvailable && (
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl px-4 py-3 text-yellow-300 text-sm mb-4">
            ⚠️ You are marked as unavailable. Toggle to Available to receive new alerts.
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-16 text-center">
            <div className="text-5xl mb-4">📡</div>
            <div className="text-white font-bold text-lg mb-2">Listening for alerts...</div>
            <div className="text-gray-500 text-sm">You'll be notified instantly when an accident is reported near you</div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {alerts.map((alert, i) => (
              <AlertCard key={i} alert={alert} onAccept={handleAccept} onDecline={() => {}} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}