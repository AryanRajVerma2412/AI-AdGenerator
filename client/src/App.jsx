import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NewProject from "./pages/NewProject.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import Generation from './pages/Generation.jsx';

export default function App() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-[#F7F6EC] text-[#28301C]">
      {/* Decorative warm cream & gold ambient background glows */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-[#D2CF9A]/20 rounded-full blur-[140px] -z-10" />
      <div className="pointer-events-none fixed top-1/3 -right-40 w-[500px] h-[500px] bg-[#9A7E3B]/8 rounded-full blur-[130px] -z-10" />
      <div className="pointer-events-none fixed bottom-10 -left-40 w-[500px] h-[500px] bg-[#D2CF9A]/15 rounded-full blur-[130px] -z-10" />

      <div>
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
          <Routes>
            <Route path="/generate" element={<ProtectedRoute><Generation /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/new"
              element={
                <ProtectedRoute>
                  <NewProject />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute>
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <footer className="mt-16 border-t border-[#28301C]/10 bg-white/75 py-6 text-center text-xs text-[#28301C]/70 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#9A7E3B] animate-pulse"></span>
            <span className="text-[#28301C] font-medium">AI Pipeline Engine Online</span>
          </div>
          <p>© {new Date().getFullYear()} AdGen Studio — Gemini Vision & Scripting • Edge & Neural Voice • FFmpeg Engine</p>
        </div>
      </footer>
    </div>
  );
}
