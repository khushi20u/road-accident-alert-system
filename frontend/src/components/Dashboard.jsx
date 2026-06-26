import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { useWebSocket } from "../hooks/useWebSocket";
import { getActiveAccidents, getStats, updateStatus } from "../services/api";
import "leaflet/dist/leaflet.css";

const SEVERITY_COLORS = { critical: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const SEVERITY_RADIUS = { critical: 18, medium: 12, low: 8 };

export default function Dashboard() {
  const [accidents, setAccidents] = useState([]);
  const [stats, setStats] = useState({ total_reported: 0, active: 0, critical: 0, resolved: 0, response_rate: 0 });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const { isConnected, lastMessage } = useWebSocket("ws://localhost:8000/ws/dashboard");

  useEffect(() => {
    Promise.all([getActiveAccidents(), getStats()])
      .then(([a, s]) => { setAccidents(a); setStats(s); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "NEW_ACCIDENT") {
      const a = lastMessage.data;
      setAccidents((prev) => [{ id: a.accident_id, latitude: a.latitude, longitude: a.longitude, severity: a.severity, summary: a.summary, location: a.location, status: "reported", recommended_response: a.recommended_response }, ...prev]);
      setAlerts((prev) => [{ ...a, timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      setStats((prev) => ({ ...prev, total_reported: prev.total_reported + 1, active: prev.active + 1, critical: a.severity === "critical" ? prev.critical + 1 : prev.critical }));
    }

    if (lastMessage.type === "STATUS_UPDATE") {
      setAccidents((prev) => prev.map((a) => a.id === lastMessage.data.accident_id ? { ...a, status: lastMessage.data.status } : a));
      if (lastMessage.data.status === "resolved") {
        setStats((prev) => ({ ...prev, resolved: prev.resolved + 1, active: Math.max(0, prev.active - 1), response_rate: Math.round(((prev.resolved + 1) / prev.total_reported) * 100) }));
      }
    }

    if (lastMessage.type === "REPORT_VERIFIED") {
      setAlerts((prev) => [{ severity: "medium", alert_message: `✅ Community verified report #${lastMessage.data.accident_id} — responders dispatched.`, location: "", timestamp: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
    }
  }, [lastMessage]);

  const handleResolve = async (id) => {
    await updateStatus(id, "resolved");
    setAccidents((prev) => prev.filter((a) => a.id !== id));
  };

  const statCards = [
    { label: "Total", value: stats.total_reported, color: "text-blue-400", bg: "bg-blue-900/20 border-blue-800" },
    { label: "Active", value: stats.active, color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-800" },
    { label: "Critical", value: stats.critical, color: "text-red-400", bg: "bg-red-900/20 border-red-800" },
    { label: "Resolved", value: stats.resolved, color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-800" },
    { label: "Response Rate", value: `${stats.response_rate}%`, color: "text-purple-400", bg: "bg-purple-900/20 border-purple-800" },
  ];

  return (
    <div className="max-w-screen-xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black text-white">🗺️ Live Accident Dashboard</h1>
        <div className={`px-4 py-1.5 rounded-full text-sm font-bold ${isConnected ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"}`}>
          {isConnected ? "🟢 Live" : "🔴 Reconnecting..."}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {statCards.map((s) => (
          <div key={s.label} className={`${s.bg} border rounded-xl p-4 text-center`}>
            <div className={`${s.color} text-3xl font-black`}>{s.value}</div>
            <div className="text-gray-500 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500">Loading accidents...</div>
      ) : (
        <div className="flex gap-4 h-[540px]">
          {/* Map */}
          <div className="flex-1 relative rounded-2xl overflow-hidden border border-gray-800">
            <MapContainer center={[23.2, 77.4]} zoom={6} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://osm.org">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {accidents.map((a) => (
                <CircleMarker
                  key={a.id}
                  center={[a.latitude, a.longitude]}
                  radius={SEVERITY_RADIUS[a.severity] || 10}
                  fillColor={SEVERITY_COLORS[a.severity] || "#888"}
                  color="#fff"
                  weight={2}
                  fillOpacity={0.9}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <div style={{ color: SEVERITY_COLORS[a.severity], fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                        {a.severity} — #{a.id}
                      </div>
                      <div style={{ marginBottom: 6, fontSize: "0.88rem" }}>{a.summary}</div>
                      <div style={{ fontSize: "0.78rem", color: "#6b7280", marginBottom: 8 }}>📍 {a.location || "Unknown"}</div>
                      {a.status !== "resolved" && (
                        <button onClick={() => handleResolve(a.id)}
                          style={{ width: "100%", padding: "0.4rem", background: "#22c55e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>
                          ✅ Mark Resolved
                        </button>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-gray-900/95 border border-gray-700 rounded-xl p-3 z-[1000] flex flex-col gap-2">
              {Object.entries(SEVERITY_COLORS).map(([sev, color]) => (
                <div key={sev} className="flex items-center gap-2">
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
                  <span className="text-gray-300 text-xs capitalize">{sev}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert Feed */}
          <div className="w-80 flex flex-col gap-3 overflow-y-auto">
            <h3 className="text-white font-bold text-base">⚡ Live Alert Feed</h3>
            {alerts.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500 flex-1 flex flex-col items-center justify-center">
                <div className="text-4xl mb-3">📡</div>
                <div className="font-semibold mb-1">Listening for alerts...</div>
                <div className="text-xs text-gray-600">Reports appear here in real-time</div>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                  style={{ borderLeft: `4px solid ${SEVERITY_COLORS[alert.severity] || "#888"}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ color: SEVERITY_COLORS[alert.severity] }} className="font-bold text-xs uppercase">
                      {alert.severity}
                    </span>
                    <span className="text-gray-600 text-xs">{alert.timestamp}</span>
                  </div>
                  <div className="text-gray-200 text-sm leading-relaxed mb-2">
                    {alert.alert_message || alert.summary}
                  </div>
                  <div className="text-gray-500 text-xs">📍 {alert.location || "Unknown"}</div>
                  {alert.nearest_responders?.length > 0 && (
                    <div className="text-blue-400 text-xs font-semibold mt-2">
                      🚑 {alert.nearest_responders.length} responders alerted
                      {alert.nearest_responders[0]?.estimated_response_minutes && (
                        <span className="ml-2 bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">
                          ETA ~{alert.nearest_responders[0].estimated_response_minutes} min
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}