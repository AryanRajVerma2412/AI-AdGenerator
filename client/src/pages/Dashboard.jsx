import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Sparkles, 
  Plus, 
  Search, 
  Trash2, 
  ArrowUpRight, 
  Play, 
  Clock, 
  CheckCircle2, 
  Film,
  Ban
} from "lucide-react";
import api, { fileUrl } from "../api.js";

const statusConfig = {
  processing: {
    label: "Rendering",
    badge: "bg-[#FAF0D7] text-[#28301C] border-[#9A7E3B]/40",
    dot: "bg-[#9A7E3B] animate-pulse",
  },
  completed: {
    label: "Ready",
    badge: "bg-[#EAF3DE] text-[#28301C] border-[#9A7E3B]/35",
    dot: "bg-[#9A7E3B]",
  },
  cancelled: {
    label: "Cancelled",
    badge: "bg-[#F0EFE6] text-[#28301C]/80 border-[#28301C]/20",
    dot: "bg-[#28301C]/50",
  },
  failed: {
    label: "Failed",
    badge: "bg-red-50 text-red-700 border-red-300",
    dot: "bg-red-500",
  },
};

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const userName = localStorage.getItem("name") || "Creator";

  const load = async () => {
    try {
      const { data } = await api.get("/projects");
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const remove = async (id, name) => {
    if (!confirm(`Are you sure you want to delete "${name || "this project"}"?`)) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects((p) => p.filter((x) => x._id !== id));
    } catch (err) {
      alert("Failed to delete project");
    }
  };

  // Filtered projects
  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "all" || p.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const totalCount = projects.length;
  const completedCount = projects.filter((p) => p.status === "completed").length;
  const processingCount = projects.filter((p) => p.status === "processing").length;
  const cancelledCount = projects.filter((p) => p.status === "cancelled").length;

  return (
    <div className="space-y-8 animate-fade-in text-[#28301C]">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#28301C]/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2515]">
              Video Projects
            </h1>
            <span className="flex items-center gap-1 rounded-full border border-[#9A7E3B]/30 bg-[#9A7E3B]/10 px-2.5 py-0.5 text-xs font-bold text-[#28301C]">
              <Sparkles className="h-3 w-3 text-[#9A7E3B]" /> AI Studio
            </span>
          </div>
          <p className="mt-1 text-sm text-[#28301C]/80">
            Welcome back, <span className="text-[#1E2515] font-bold">{userName}</span>. Manage, preview, and export your AI generated campaigns.
          </p>
        </div>

        <Link
          to="/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#9A7E3B]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Generate New Ad</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#28301C]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#28301C]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#28301C]/75">Total Campaigns</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F6EC] border border-[#28301C]/10 text-[#9A7E3B]">
              <Film className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#1E2515]">{loading ? "-" : totalCount}</div>
          <p className="mt-1 text-xs text-[#28301C]/60">All created ad projects</p>
        </div>

        <div className="rounded-2xl border border-[#28301C]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#28301C]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#28301C]/75">Ready to Download</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F6EC] border border-[#28301C]/10 text-[#9A7E3B]">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#1E2515]">{loading ? "-" : completedCount}</div>
          <p className="mt-1 text-xs text-[#28301C]/60">Fully synthesized videos</p>
        </div>

        <div className="rounded-2xl border border-[#28301C]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#28301C]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#28301C]/75">Pipeline Processing</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F6EC] border border-[#28301C]/10 text-[#9A7E3B]">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#9A7E3B]">{loading ? "-" : processingCount}</div>
          <p className="mt-1 text-xs text-[#28301C]/60">Active rendering queue</p>
        </div>

        <div className="rounded-2xl border border-[#28301C]/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-[#28301C]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#28301C]/75">Cancelled</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F7F6EC] border border-[#28301C]/10 text-[#28301C]/60">
              <Ban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[#28301C]/80">{loading ? "-" : cancelledCount}</div>
          <p className="mt-1 text-xs text-[#28301C]/60">Cancelled by user</p>
        </div>
      </div>

      {/* Search and Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9A7E3B]" />
          <input
            type="text"
            placeholder="Search by product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-[#28301C]/15 bg-white pl-10 pr-4 py-2 text-sm text-[#1E2515] placeholder-[#28301C]/40 backdrop-blur-md transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9A7E3B]/20"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-[#28301C]/10 bg-white p-1 backdrop-blur-md shadow-sm">
          {[
            { id: "all", label: "All", count: totalCount },
            { id: "completed", label: "Ready", count: completedCount },
            { id: "processing", label: "Rendering", count: processingCount },
            { id: "cancelled", label: "Cancelled", count: cancelledCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                activeFilter === tab.id
                  ? "bg-[#9A7E3B] text-white shadow-sm"
                  : "text-[#28301C]/75 hover:text-[#1E2515]"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeFilter === tab.id ? "bg-white/25 text-white" : "bg-[#F7F6EC] text-[#28301C]"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        /* Shimmer Loading Skeletons */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="overflow-hidden rounded-2xl border border-[#28301C]/10 bg-white p-4 shadow-sm">
              <div className="h-44 w-full rounded-xl bg-[#F7F6EC] animate-pulse" />
              <div className="mt-4 space-y-2">
                <div className="h-5 w-2/3 rounded-md bg-[#F7F6EC] animate-pulse" />
                <div className="h-4 w-1/2 rounded-md bg-[#F7F6EC]/60 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : !filteredProjects.length ? (
        /* Empty State */
        <div className="relative overflow-hidden rounded-3xl border border-[#28301C]/10 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F7F6EC] border border-[#9A7E3B]/30 text-[#9A7E3B] shadow-inner">
            <Film className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-[#1E2515]">
            {searchQuery ? "No matching projects found" : "No video projects created yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[#28301C]/80">
            {searchQuery
              ? `We couldn't find any projects matching "${searchQuery}". Try clearing your search.`
              : "Turn any product photo into an engaging, multi-scene video ad with AI voiceover and music in seconds."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery("")}
                className="rounded-xl border border-[#28301C]/15 bg-[#F7F6EC] px-4 py-2 text-sm font-bold text-[#28301C] hover:text-[#1E2515]"
              >
                Clear Search
              </button>
            ) : (
              <Link
                to="/new"
                className="inline-flex items-center gap-2 rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#9A7E3B]/20 transition-all hover:scale-[1.02]"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Create your first ad
              </Link>
            )}
          </div>
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((p) => {
            const status = statusConfig[p.status] || statusConfig.processing;
            const previewImage = fileUrl(p.script?.[0]?.imageUrl || p.productImageUrl);
            const dateStr = p.createdAt
              ? new Date(p.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              : "Recent";

            return (
              <div
                key={p._id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#28301C]/10 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#9A7E3B]/50 hover:shadow-lg"
              >
                {/* Media Thumbnail Container */}
                <div className="relative h-48 w-full overflow-hidden bg-[#F5F4E4]">
                  <img
                    src={previewImage}
                    alt={p.productName}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80" />

                  {/* Badges on Thumbnail */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="rounded-lg border border-[#28301C]/15 bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#28301C] backdrop-blur-md">
                      {p.aspectRatio || "9:16"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold backdrop-blur-md ${status.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                  </div>

                  {/* Play Overlay on Hover */}
                  <Link
                    to={`/projects/${p._id}`}
                    className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#9A7E3B] text-white shadow-xl backdrop-blur-md transition-transform duration-300 hover:scale-110">
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </div>
                  </Link>
                </div>

                {/* Content details */}
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="truncate text-base font-bold text-[#1E2515] transition-colors group-hover:text-[#9A7E3B]">
                        {p.productName}
                      </h3>
                      <span className="shrink-0 text-[11px] text-[#28301C]/60">{dateStr}</span>
                    </div>

                    <p className="line-clamp-2 text-xs text-[#28301C]/80 leading-relaxed">
                      {p.description || "AI-generated advertisement video"}
                    </p>

                    {p.ctaText && (
                      <div className="pt-1">
                        <span className="inline-block rounded-md bg-[#F7F6EC] border border-[#28301C]/10 px-2 py-0.5 text-[11px] font-semibold text-[#28301C]">
                          CTA: {p.ctaText}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="mt-5 flex items-center justify-between border-t border-[#28301C]/10 pt-3.5">
                    <Link
                      to={`/projects/${p._id}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#9A7E3B] transition-colors hover:text-[#1E2515]"
                    >
                      <span>Open Studio</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>

                    <button
                      onClick={() => remove(p._id, p.productName)}
                      title="Delete Project"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#28301C]/40 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
