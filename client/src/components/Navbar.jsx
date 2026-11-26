import { Link, useNavigate, useLocation } from "react-router-dom";
import { Sparkles, Video, Plus, LogOut, FolderKanban } from "lucide-react";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const name = localStorage.getItem("name") || "Creator";

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#28301C]/10 bg-white/90 backdrop-blur-xl transition-all shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3.5">
        {/* Brand Logo */}
        <Link to="/" className="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#28301C] border border-[#9A7E3B]/40 shadow-sm transition-all group-hover:border-[#9A7E3B]">
            <Video className="h-5 w-5 text-[#9A7E3B] transition-transform group-hover:rotate-6" />
            <div className="absolute -top-1 -right-1">
              <Sparkles className="h-3.5 w-3.5 text-[#D2CF9A] animate-pulse" />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-extrabold tracking-tight text-[#1E2515]">
                Ad<span className="text-[#9A7E3B]">Gen</span>
              </span>
              <span className="rounded-full border border-[#9A7E3B]/30 bg-[#9A7E3B]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#28301C]">
                AI Studio
              </span>
            </div>
          </div>
        </Link>

        {/* Right Nav */}
        {token ? (
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-5">
            <Link to="/generate" className="text-sm font-semibold text-[#9A7E3B]">Generate media</Link>
            <Link
              to="/"
              className={`hidden sm:flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                location.pathname === "/"
                  ? "text-[#9A7E3B]"
                  : "text-[#28301C]/75 hover:text-[#1E2515]"
              }`}
            >
              <FolderKanban className="h-4 w-4 text-[#9A7E3B]" />
              <span>Projects</span>
            </Link>

            <Link
              to="/new"
              className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-4 py-2 text-sm font-bold text-white shadow-md shadow-[#9A7E3B]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Create Ad</span>
            </Link>

            <div className="h-4 w-px bg-[#28301C]/15 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-[#28301C]/15 bg-[#F7F6EC] py-1 pl-1 pr-3 text-xs text-[#28301C] backdrop-blur-md">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#9A7E3B] text-[11px] font-bold text-white uppercase shadow-inner">
                  {name.charAt(0)}
                </div>
                <span className="max-w-[100px] truncate font-semibold text-[#28301C] hidden md:inline">
                  {name}
                </span>
              </div>

              <button
                onClick={logout}
                title="Log out"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[#28301C]/60 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-[#28301C] transition-colors hover:text-[#1E2515]"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-4 py-1.5 text-sm font-bold text-white shadow-md shadow-[#9A7E3B]/20 transition-all hover:opacity-95"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
