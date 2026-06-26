import { useState } from "react";
import ReportForm from "./components/ReportForm";
import Dashboard from "./components/Dashboard";
import ResponderPortal from "./pages/ResponderPortal";

export default function App() {
  const [page, setPage] = useState("report");

  if (page === "responder") return (
    <div className="min-h-screen bg-gray-950 font-sans">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 h-14 flex items-center justify-between sticky top-0 z-50">
        <div className="text-red-500 font-black text-xl tracking-tight">RoadAlert India</div>
        <button onClick={() => setPage("report")} className="text-gray-400 hover:text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition">
          Back to App
        </button>
      </nav>
      <ResponderPortal />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 font-sans">
      <nav className="bg-gray-900 border-b border-gray-800 px-6 h-14 flex items-center justify-between sticky top-0 z-50">
        <div className="text-red-500 font-black text-xl tracking-tight">RoadAlert India</div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage("report")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${page === "report" ? "bg-red-500 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
          >
            Report Accident
          </button>
          <button
            onClick={() => setPage("dashboard")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${page === "dashboard" ? "bg-red-500 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
          >
            Live Dashboard
          </button>
          <button
            onClick={() => setPage("responder")}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-900 text-emerald-400 hover:bg-emerald-800 transition"
          >
            Responder Portal
          </button>
        </div>
      </nav>
      <main className="p-4">
        {page === "report" && <ReportForm />}
        {page === "dashboard" && <Dashboard />}
      </main>
    </div>
  );
}