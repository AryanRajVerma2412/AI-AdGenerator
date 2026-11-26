import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import api from "../api.js";

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("name", data.user.name);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-8 sm:pt-14 text-[#28301C]">
      {/* Brand Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F7F6EC] border border-[#9A7E3B]/40 shadow-md shadow-[#9A7E3B]/10">
          <Sparkles className="h-6 w-6 text-[#9A7E3B]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2515]">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-[#28301C]/80">
          Join AdGen to generate high-converting AI video ads in minutes
        </p>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-[#28301C]/10 bg-white p-6 sm:p-8 backdrop-blur-xl shadow-xl shadow-[#28301C]/5">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#28301C]">
              Full Name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9A7E3B]" />
              <input
                className="w-full rounded-xl border border-[#28301C]/15 bg-[#F7F6EC] pl-10 pr-4 py-2.5 text-sm text-[#1E2515] placeholder-[#28301C]/40 transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9A7E3B]/25"
                type="text"
                name="name"
                placeholder="Alex Morgan"
                value={form.name}
                onChange={change}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#28301C]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9A7E3B]" />
              <input
                className="w-full rounded-xl border border-[#28301C]/15 bg-[#F7F6EC] pl-10 pr-4 py-2.5 text-sm text-[#1E2515] placeholder-[#28301C]/40 transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9A7E3B]/25"
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={change}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#28301C]">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9A7E3B]" />
              <input
                className="w-full rounded-xl border border-[#28301C]/15 bg-[#F7F6EC] pl-10 pr-10 py-2.5 text-sm text-[#1E2515] placeholder-[#28301C]/40 transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9A7E3B]/25"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                value={form.password}
                onChange={change}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#28301C]/60 hover:text-[#1E2515]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700 animate-slide-up">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] py-3 text-sm font-bold text-white shadow-lg shadow-[#9A7E3B]/25 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 border-t border-[#28301C]/10 pt-4 text-center text-xs text-[#28301C]/70">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-[#9A7E3B] hover:text-[#1E2515] hover:underline">
            Log in instead
          </Link>
        </div>
      </div>
    </div>
  );
}
