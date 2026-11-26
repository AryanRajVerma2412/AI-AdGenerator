import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  Download, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Share2, 
  Check, 
  Volume2, 
  VolumeX, 
  Film, 
  Plus, 
  Play, 
  Pause, 
  Maximize, 
  RotateCcw, 
  Layers, 
  Wand2, 
  RefreshCw,
  Upload,
  Smartphone,
  Monitor,
  Square,
  Sliders,
  Save,
  Loader2,
  XCircle,
  Ban,
  AlertTriangle
} from "lucide-react";
import api, { fileUrl } from "../api.js";

const PLATFORM_RATIOS = [
  { id: "9:16", name: "Reels / Shorts", dim: "1080×1920", icon: Smartphone },
  { id: "16:9", name: "YouTube Landscape", dim: "1920×1080", icon: Monitor },
  { id: "1:1", name: "Instagram Post", dim: "1080×1080", icon: Square },
  { id: "4:5", name: "Facebook Feed", dim: "1080×1350", icon: Layers },
];

const SECTION_BADGES = {
  hook: "bg-[#9A7E3B]/20 text-[#FAF9EE] border-[#9A7E3B]/40",
  content: "bg-[#28301C] text-[#D2CF9A] border-[#D2CF9A]/30",
  benefit: "bg-[#3E4C2E] text-[#FAF9EE] border-[#9A7E3B]/30",
  cta: "bg-[#9A7E3B]/30 text-[#FAF9EE] border-[#9A7E3B]/50",
};

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Video Player Controls State
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Aspect ratio switch state
  const [selectedRatio, setSelectedRatio] = useState("9:16");
  const [renderingVideo, setRenderingVideo] = useState(false);
  const [pollVersion, setPollVersion] = useState(0);

  // Scene editing & regeneration states
  const [editingScenes, setEditingScenes] = useState([]);
  const [savingScript, setSavingScript] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  // Cancellation feature states
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelNotification, setCancelNotification] = useState("");

  const downloadVideo = async (event) => {
    event.preventDefault();
    if (downloading) return;
    setDownloading(true);
    try {
      const { data } = await api.get(`/projects/${id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `advertisement-${id}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Could not download the video. Please retry when rendering is complete.");
    } finally { 
      setDownloading(false); 
    }
  };

  useEffect(() => {
    let active = true;
    let timer;

    const poll = async () => {
      try {
        const { data } = await api.get(`/projects/${id}`);
        if (!active) return;
        setProject(data);
        setSelectedRatio(data.aspectRatio || "9:16");
        setEditingScenes(data.script || []);

        if (data.status === "processing") {
          timer = setTimeout(poll, 4000);
        } else {
          setRenderingVideo(false);
        }
      } catch (err) {
        if (active) setError(err.response?.data?.message || "Could not load project");
      }
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, pollVersion]);

  // Video event handlers
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;
    const seekTime = (Number(e.target.value) / 100) * duration;
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleVolumeChange = (e) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const copyLink = () => {
    if (!project?.finalVideoUrl) return;
    navigator.clipboard.writeText(fileUrl(project.finalVideoUrl));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Re-render full video with FFmpeg
  const handleRenderVideo = async (ratioToUse) => {
    setRenderingVideo(true);
    setError("");
    setCancelNotification("");
    try {
      await api.post(`/projects/${id}/render`, {
        aspectRatio: ratioToUse || selectedRatio,
      });
      setProject((prev) => ({ 
        ...prev, 
        status: "processing", 
        generationStage: "Preparing scenes for rendering",
        errorMessage: "" 
      }));
      setPollVersion((version) => version + 1);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to initiate re-rendering");
      setRenderingVideo(false);
    }
  };

  // Real backend cancellation handler
  const handleConfirmCancel = async () => {
    setCancelling(true);
    setError("");
    try {
      const { data } = await api.post(`/projects/${id}/cancel`);
      setShowCancelModal(false);
      setRenderingVideo(false);
      // Immediately stop the progress animation and update status
      setProject((prev) => ({
        ...prev,
        status: "cancelled",
        generationStage: "Generation Cancelled",
        errorMessage: "Generation was cancelled by the user.",
      }));
      setCancelNotification("Video generation cancelled successfully. You can restart or create a new ad at any time.");
    } catch (err) {
      setShowCancelModal(false);
      setError(err.response?.data?.message || "Failed to cancel video generation");
    } finally {
      setCancelling(false);
    }
  };

  // Save modified scene texts
  const handleSaveScript = async () => {
    setSavingScript(true);
    try {
      const { data } = await api.put(`/projects/${id}`, {
        script: editingScenes,
      });
      setProject(data);
      alert("Script changes saved! Click 'Re-render Video with FFmpeg' when you wish to recompile the video.");
    } catch (err) {
      alert("Failed to save script edits");
    } finally {
      setSavingScript(false);
    }
  };

  // Regenerate visual image for a single scene
  const handleRegenerateSceneImage = async (sceneIndex) => {
    setActionLoading((prev) => ({ ...prev, [`image-${sceneIndex}`]: true }));
    try {
      const { data } = await api.post(`/projects/${id}/scenes/${sceneIndex}/regenerate-image`);
      setProject((prev) => {
        const nextScript = [...prev.script];
        nextScript[sceneIndex] = data;
        return { ...prev, script: nextScript };
      });
      setEditingScenes((prev) => {
        const nextScript = [...prev];
        nextScript[sceneIndex] = data;
        return nextScript;
      });
    } catch (err) {
      alert("Failed to regenerate scene visual");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`image-${sceneIndex}`]: false }));
    }
  };

  // Upload custom image for a single scene
  const handleUploadSceneImage = async (sceneIndex, file) => {
    if (!file) return;
    setActionLoading((prev) => ({ ...prev, [`upload-${sceneIndex}`]: true }));
    const formData = new FormData();
    formData.append("sceneImage", file);

    try {
      const { data } = await api.post(`/projects/${id}/scenes/${sceneIndex}/upload-image`, formData);
      setProject((prev) => {
        const nextScript = [...prev.script];
        nextScript[sceneIndex] = data;
        return { ...prev, script: nextScript };
      });
      setEditingScenes((prev) => {
        const nextScript = [...prev];
        nextScript[sceneIndex] = data;
        return nextScript;
      });
    } catch (err) {
      alert("Failed to upload custom image");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`upload-${sceneIndex}`]: false }));
    }
  };

  // Regenerate voiceover audio for a single scene
  const handleRegenerateSceneAudio = async (sceneIndex) => {
    setActionLoading((prev) => ({ ...prev, [`audio-${sceneIndex}`]: true }));
    try {
      const { data } = await api.post(`/projects/${id}/scenes/${sceneIndex}/regenerate-audio`);
      setProject((prev) => {
        const nextScript = [...prev.script];
        nextScript[sceneIndex] = data;
        return { ...prev, script: nextScript };
      });
      setEditingScenes((prev) => {
        const nextScript = [...prev];
        nextScript[sceneIndex] = data;
        return nextScript;
      });
    } catch (err) {
      alert("Failed to regenerate scene audio");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`audio-${sceneIndex}`]: false }));
    }
  };

  if (error && !project) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center animate-fade-in text-[#D2CF9A]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-950/40 border border-red-500/30 text-red-400">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-[#FAF9EE]">Failed to load project</h2>
        <p className="mt-2 text-sm text-[#D2CF9A]/80">{error}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#323D25] border border-[#D2CF9A]/20 px-4 py-2 text-sm font-semibold text-[#FAF9EE] hover:bg-[#28301C]"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center animate-fade-in text-[#D2CF9A]">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#9A7E3B]/30 border-t-[#9A7E3B]" />
        </div>
        <p className="text-sm font-medium text-[#D2CF9A]">Loading project studio...</p>
      </div>
    );
  }

  const isVideoFile = (url) => url && url.match(/\.(mp4|webm|mov|mkv)$/i);
  const ratioConfig = PLATFORM_RATIOS.find((r) => r.id === project.aspectRatio) || PLATFORM_RATIOS[0];

  return (
    <div className="space-y-8 animate-fade-in pb-16 text-[#D2CF9A]">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D2CF9A]/15 pb-6">
        <div className="space-y-2">
          <Link
            to="/"
            className="group inline-flex items-center gap-1.5 text-xs font-semibold text-[#D2CF9A]/75 hover:text-[#FAF9EE] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Back to Projects</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#FAF9EE]">
              {project.productName}
            </h1>
            <span className="rounded-lg border border-[#D2CF9A]/20 bg-[#323D25] px-2.5 py-0.5 text-xs font-semibold text-[#D2CF9A]">
              {ratioConfig.name} ({project.aspectRatio})
            </span>
            {project.category && (
              <span className="rounded-lg border border-[#D2CF9A]/15 bg-[#323D25] px-2.5 py-0.5 text-xs text-[#D2CF9A]/80">
                {project.category}
              </span>
            )}
            {project.status === "completed" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#9A7E3B]/40 bg-[#3E4C2E] px-2.5 py-0.5 text-xs font-semibold text-[#FAF9EE]">
                <CheckCircle2 className="h-3 w-3 text-[#9A7E3B]" /> Ready
              </span>
            )}
            {project.status === "processing" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#9A7E3B]/40 bg-[#9A7E3B]/20 px-2.5 py-0.5 text-xs font-semibold text-[#FAF9EE]">
                <span className="h-2 w-2 rounded-full bg-[#9A7E3B] animate-pulse" />
                Rendering in progress
              </span>
            )}
            {project.status === "cancelled" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D2CF9A]/25 bg-[#28301C] px-2.5 py-0.5 text-xs font-semibold text-[#D2CF9A]/80">
                <Ban className="h-3 w-3 text-[#9A7E3B]" /> Generation Cancelled
              </span>
            )}
            {project.status === "failed" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-950/40 px-2.5 py-0.5 text-xs font-semibold text-red-300">
                <AlertCircle className="h-3 w-3 text-red-400" /> Failed
              </span>
            )}
          </div>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2.5">
          {project.status === "completed" && project.finalVideoUrl && (
            <>
              <button
                onClick={copyLink}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D2CF9A]/20 bg-[#323D25] px-3.5 py-2 text-xs font-semibold text-[#FAF9EE] transition-all hover:bg-[#28301C]"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#9A7E3B]" /> : <Share2 className="h-3.5 w-3.5 text-[#9A7E3B]" />}
                <span>{copied ? "Link Copied!" : "Share Link"}</span>
              </button>

              <a
                href={fileUrl(project.finalVideoUrl)}
                onClick={downloadVideo}
                aria-disabled={downloading}
                download
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-4 py-2 text-xs font-bold text-[#28301C] shadow-lg shadow-[#9A7E3B]/20 transition-all hover:scale-[1.02]"
              >
                <Download className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Download Video</span>
              </a>
            </>
          )}

          <Link
            to="/new"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D2CF9A]/20 bg-[#323D25] px-3.5 py-2 text-xs font-semibold text-[#D2CF9A] hover:text-[#FAF9EE] hover:bg-[#28301C] transition-all"
          >
            <Plus className="h-3.5 w-3.5 text-[#9A7E3B]" />
            <span>New Video</span>
          </Link>
        </div>
      </div>

      {/* NOTIFICATIONS & WARNINGS */}
      {cancelNotification && (
        <div role="status" className="flex items-center justify-between rounded-xl border border-[#9A7E3B]/40 bg-[#323D25] p-4 text-sm text-[#FAF9EE] shadow-lg animate-slide-up">
          <div className="flex items-center gap-2.5">
            <Ban className="h-5 w-5 text-[#9A7E3B] shrink-0" />
            <span>{cancelNotification}</span>
          </div>
          <button 
            onClick={() => setCancelNotification("")}
            className="text-[#D2CF9A]/60 hover:text-[#FAF9EE] text-xs font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {project.warnings?.map((warning) => (
        <div key={warning} role="status" className="rounded-xl border border-[#9A7E3B]/30 bg-[#323D25] p-4 text-sm text-[#D2CF9A]">
          {warning}
        </div>
      ))}

      {/* PROCESSING STATE: HUD WITH CANCEL GENERATION BUTTON */}
      {project.status === "processing" && (
        <div className="relative overflow-hidden rounded-3xl border border-[#9A7E3B]/40 bg-[#323D25] p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left flex-1">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-[#9A7E3B]/20 animate-ping opacity-30" />
                <div className="h-20 w-20 rounded-full border-2 border-[#9A7E3B]/40 border-t-[#9A7E3B] animate-spin" />
                <Wand2 className="h-7 w-7 text-[#9A7E3B] animate-pulse absolute" />
              </div>

              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#9A7E3B] animate-pulse"></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#FAF9EE]">
                    {project.generationStage || "Preparing your advertisement"}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[#FAF9EE]">
                  Rendering Video Ad in {project.aspectRatio} Aspect Ratio...
                </h2>
                <p className="text-xs sm:text-sm text-[#D2CF9A]/80 leading-relaxed max-w-xl">
                  Synthesizing speech voiceovers, applying Ken-Burns zoompan transitions, syncing durations, and mixing background music.
                </p>
                <div className="pt-1 flex items-center justify-center sm:justify-start gap-2 text-[11px] text-[#D2CF9A]/60">
                  <RefreshCw className="h-3 w-3 animate-spin text-[#9A7E3B]" />
                  <span>Auto-refreshing status every few seconds...</span>
                </div>
              </div>
            </div>

            {/* Cancel Generation Button near progress indicator */}
            <div className="shrink-0 flex flex-col items-center sm:items-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                disabled={cancelling}
                className="group inline-flex items-center gap-2 rounded-xl border border-[#9A7E3B]/60 bg-[#28301C] hover:bg-red-950/40 hover:border-red-500/60 px-4 py-2.5 text-xs font-bold text-[#FAF9EE] hover:text-red-200 shadow-md shadow-black/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <XCircle className="h-4 w-4 text-[#9A7E3B] group-hover:text-red-400" />
                <span>Cancel Generation</span>
              </button>
              <span className="text-[10px] text-[#D2CF9A]/50">Stop render & clean up</span>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG MODAL FOR CANCELLATION */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-[#9A7E3B]/40 bg-[#323D25] p-6 shadow-2xl space-y-5 animate-slide-up">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#28301C] border border-[#9A7E3B]/40 text-[#9A7E3B]">
                <AlertTriangle className="h-6 w-6 stroke-[2]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#FAF9EE]">
                  Are you sure you want to cancel video generation?
                </h3>
                <p className="text-xs text-[#D2CF9A]/80 leading-relaxed">
                  This will immediately terminate running FFmpeg assembly, abort AI media synthesis, and clean up all temporary generation resources. You can restart generation at any time.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#D2CF9A]/10">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="rounded-xl border border-[#D2CF9A]/20 bg-[#28301C] px-4 py-2 text-xs font-semibold text-[#FAF9EE] hover:bg-[#323D25] transition-colors"
              >
                Continue Generating
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#9A7E3B] hover:bg-red-700 hover:border-red-600 border border-[#9A7E3B] px-4 py-2 text-xs font-bold text-[#28301C] hover:text-white transition-all shadow-md shadow-[#9A7E3B]/20 disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Cancel Generation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCELLED STATE BANNER */}
      {project.status === "cancelled" && (
        <div className="rounded-2xl border border-[#D2CF9A]/20 bg-[#323D25] p-6 backdrop-blur-xl space-y-4 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#28301C] border border-[#9A7E3B]/40 text-[#9A7E3B]">
              <Ban className="h-6 w-6 stroke-[2]" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#9A7E3B]"></span>
                <h3 className="text-base font-bold text-[#FAF9EE]">Video Generation Cancelled</h3>
              </div>
              <p className="text-xs text-[#D2CF9A]/80 leading-relaxed">
                {project.errorMessage || "Video generation was cancelled by the user. Active processes were safely stopped and partial files were removed."}
              </p>
              <div className="pt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleRenderVideo(project.aspectRatio)}
                  disabled={renderingVideo}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-4 py-2 text-xs font-bold text-[#28301C] shadow-md transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Restart Video Generation</span>
                </button>
                <Link
                  to="/new"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#D2CF9A]/20 bg-[#28301C] px-4 py-2 text-xs font-semibold text-[#D2CF9A] hover:text-[#FAF9EE] hover:bg-[#323D25] transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create New Video</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ERROR BANNER */}
      {project.status === "failed" && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-6 text-red-200 backdrop-blur-xl flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Video Generation Encountered An Error</h3>
            <p className="text-xs text-red-300 leading-relaxed">
              {project.errorMessage || "An unexpected error occurred during rendering."}
            </p>
            <div className="pt-3">
              <button
                onClick={() => handleRenderVideo(project.aspectRatio)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/30"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry Video Assembly</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FEATURE 4: VIDEO PREVIEW (Full-featured Player) & FEATURE 5: AUTO ASPECT RATIO */}
      {project.finalVideoUrl && (
        <div className="rounded-3xl border border-[#D2CF9A]/15 bg-[#323D25] p-5 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D2CF9A]/15 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Film className="h-5 w-5 text-[#9A7E3B]" />
                <h2 className="text-lg font-bold text-[#FAF9EE]">Full Video Preview & Social Formats</h2>
              </div>
              <p className="text-xs text-[#D2CF9A]/80 mt-0.5">
                Actual rendered video with voiceover and background music mixed seamlessly
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#D2CF9A]/75">Current Format:</span>
              <span className="rounded-lg bg-[#28301C] px-2.5 py-1 text-xs font-bold text-[#FAF9EE] border border-[#9A7E3B]/40">
                {ratioConfig.dim} ({project.aspectRatio})
              </span>
            </div>
          </div>

          {/* Video Container with custom player controls */}
          <div className="relative mx-auto flex flex-col items-center">
            {/* Ambient Backlight Glow */}
            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 h-64 w-full max-w-xl bg-[#9A7E3B]/10 rounded-full blur-[100px] -z-10" />

            <div className={`relative overflow-hidden rounded-2xl border border-[#D2CF9A]/15 bg-black shadow-2xl flex items-center justify-center ${
              project.aspectRatio === "16:9" 
                ? "w-full max-w-3xl aspect-video" 
                : project.aspectRatio === "1:1"
                ? "w-full max-w-lg aspect-square"
                : project.aspectRatio === "4:5"
                ? "w-full max-w-md aspect-[4/5]"
                : "max-h-[70vh] aspect-[9/16]"
            }`}>
              <video
                ref={videoRef}
                src={fileUrl(project.finalVideoUrl)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                className="h-full w-full object-contain cursor-pointer"
                onClick={togglePlay}
              />
            </div>

            {/* Custom Interactive Player Bar */}
            <div className="mt-4 w-full max-w-2xl rounded-2xl border border-[#D2CF9A]/15 bg-[#28301C]/95 p-3.5 backdrop-blur-xl space-y-2">
              {/* Timeline Progress Bar */}
              <input
                type="range"
                min="0"
                max="100"
                value={duration ? (currentTime / duration) * 100 : 0}
                onChange={handleSeek}
                className="w-full accent-[#9A7E3B] cursor-pointer h-1.5 rounded-lg bg-[#323D25]"
              />

              <div className="flex items-center justify-between gap-3 text-xs text-[#D2CF9A]">
                <div className="flex items-center gap-3">
                  {/* Play / Pause button */}
                  <button
                    onClick={togglePlay}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] text-[#28301C] shadow-md transition-colors"
                  >
                    {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
                  </button>

                  {/* Volume Control */}
                  <div className="flex items-center gap-1.5">
                    <button onClick={toggleMute} className="text-[#D2CF9A]/70 hover:text-[#FAF9EE]">
                      {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 accent-[#9A7E3B] cursor-pointer h-1 bg-[#323D25]"
                    />
                  </div>

                  {/* Time indicator */}
                  <span className="font-mono text-[11px] text-[#D2CF9A]/75">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleFullscreen}
                    title="Fullscreen"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#D2CF9A]/70 hover:bg-[#323D25] hover:text-[#FAF9EE]"
                  >
                    <Maximize className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions for video */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <a
                href={fileUrl(project.finalVideoUrl)}
                onClick={downloadVideo}
                aria-disabled={downloading}
                download
                className="inline-flex items-center gap-2 rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-5 py-2.5 text-xs font-bold text-[#28301C] shadow-lg shadow-[#9A7E3B]/20 transition-all hover:scale-[1.02]"
              >
                <Download className="h-4 w-4 stroke-[2.5]" />
                <span>Download Video (.MP4)</span>
              </a>

              <button
                onClick={copyLink}
                className="inline-flex items-center gap-2 rounded-xl border border-[#D2CF9A]/20 bg-[#28301C] px-4 py-2.5 text-xs font-semibold text-[#FAF9EE] hover:bg-[#323D25] transition-all"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-[#9A7E3B]" /> : <Share2 className="h-3.5 w-3.5 text-[#9A7E3B]" />}
                <span>{copied ? "Link Copied!" : "Copy Direct URL"}</span>
              </button>
            </div>
          </div>

          {/* FEATURE 5: AUTO ASPECT RATIO SOCIAL FORMAT SWITCHER */}
          <div className="rounded-2xl border border-[#D2CF9A]/15 bg-[#28301C]/80 p-4 sm:p-5 backdrop-blur-md space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-[#FAF9EE]">Social Platform Auto-Adapt (Re-render in Any Format)</span>
                <p className="text-[11px] text-[#D2CF9A]/75">
                  Select a different aspect ratio to automatically re-frame, crop, and render this ad with FFmpeg:
                </p>
              </div>

              {selectedRatio !== project.aspectRatio && (
                <button
                  onClick={() => handleRenderVideo(selectedRatio)}
                  disabled={renderingVideo}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-4 py-2 text-xs font-bold text-[#28301C] shadow-md transition-all hover:opacity-95 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Re-render in {selectedRatio}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PLATFORM_RATIOS.map((r) => {
                const Icon = r.icon;
                const isCurrent = project.aspectRatio === r.id;
                const isSelected = selectedRatio === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedRatio(r.id);
                      if (r.id !== project.aspectRatio) {
                        handleRenderVideo(r.id);
                      }
                    }}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all ${
                      isSelected
                        ? "border-[#9A7E3B] bg-[#9A7E3B]/20 ring-1 ring-[#9A7E3B]/50 text-[#FAF9EE]"
                        : "border-[#D2CF9A]/15 bg-[#323D25] text-[#D2CF9A]/75 hover:border-[#D2CF9A]/30"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#9A7E3B]" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-[#FAF9EE] truncate">{r.name}</span>
                        {isCurrent && (
                          <span className="rounded bg-[#9A7E3B]/20 border border-[#9A7E3B]/30 px-1 text-[9px] font-bold text-[#FAF9EE]">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#D2CF9A]/60">{r.dim}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FEATURE 3: AI SCENE GENERATOR & TIMELINE EDITOR */}
      {!!editingScenes.length && (
        <div className="rounded-3xl border border-[#D2CF9A]/15 bg-[#323D25] p-5 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D2CF9A]/15 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#9A7E3B]" />
                <h2 className="text-lg font-bold text-[#FAF9EE]">Scene-Wise Timeline & Regeneration Editor</h2>
              </div>
              <p className="text-xs text-[#D2CF9A]/80 mt-0.5">
                Regenerate individual visuals, upload custom images, tweak script lines, and re-record voiceovers
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveScript}
                disabled={savingScript}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#9A7E3B]/40 bg-[#9A7E3B]/15 px-3.5 py-2 text-xs font-semibold text-[#FAF9EE] hover:bg-[#9A7E3B]/25 disabled:opacity-50"
              >
                {savingScript ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9A7E3B]" /> : <Save className="h-3.5 w-3.5 text-[#9A7E3B]" />}
                <span>Save Script Edits</span>
              </button>

              <button
                onClick={() => handleRenderVideo(project.aspectRatio)}
                disabled={renderingVideo}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-4 py-2 text-xs font-bold text-[#28301C] shadow-md hover:opacity-95 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Re-render Video with FFmpeg</span>
              </button>
            </div>
          </div>

          {/* Scene Cards Grid */}
          <div className="grid gap-6 sm:grid-cols-2">
            {editingScenes.map((scene, idx) => {
              const isImageLoading = actionLoading[`image-${idx}`];
              const isUploadLoading = actionLoading[`upload-${idx}`];
              const isAudioLoading = actionLoading[`audio-${idx}`];

              return (
                <div
                  key={idx}
                  className="overflow-hidden rounded-2xl border border-[#D2CF9A]/15 bg-[#28301C] backdrop-blur-md transition-all duration-300 hover:border-[#9A7E3B]/50 flex flex-col justify-between"
                >
                  {/* Scene Image Preview + Regeneration Actions */}
                  <div className="relative h-48 w-full bg-[#1E2515] overflow-hidden group">
                    {isVideoFile(scene.imageUrl) ? (
                      <video src={fileUrl(scene.imageUrl)} muted autoPlay loop playsInline className="h-full w-full object-cover" />
                    ) : (
                    <img
                      src={fileUrl(scene.imageUrl)}
                      alt={`Scene ${idx + 1}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="rounded-lg border border-[#D2CF9A]/20 bg-[#28301C]/80 px-2.5 py-0.5 text-xs font-bold text-[#FAF9EE] backdrop-blur-md">
                        Scene {idx + 1}
                      </span>

                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                        SECTION_BADGES[scene.sectionType] || SECTION_BADGES.content
                      }`}>
                        {scene.sectionType}
                      </span>
                    </div>

                    {/* Visual Overlay Buttons on hover */}
                    <div className="absolute inset-0 bg-[#28301C]/85 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity p-4">
                      <button
                        onClick={() => handleRegenerateSceneImage(idx)}
                        disabled={isImageLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#9A7E3B] hover:bg-[#856C31] px-3 py-1.5 text-xs font-bold text-[#28301C] shadow disabled:opacity-50"
                      >
                        {isImageLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3 stroke-[2.5]" />}
                        <span>Regenerate Visual</span>
                      </button>

                      <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#D2CF9A]/20 bg-[#323D25] px-3 py-1.5 text-xs font-semibold text-[#FAF9EE] shadow hover:bg-[#28301C] cursor-pointer">
                        {isUploadLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3 text-[#9A7E3B]" />}
                        <span>Replace Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadSceneImage(idx, e.target.files[0])}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Scene Content & Voiceover Audio */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-[#D2CF9A]/80 mb-1">
                        <span>Spoken Narration (Script)</span>
                        <span className="font-mono text-[#D2CF9A]/60">~{scene.duration || 5}s</span>
                      </div>
                      <textarea
                        value={scene.sceneText}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditingScenes((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, sceneText: val } : s))
                          );
                        }}
                        rows={2}
                        className="w-full rounded-lg border border-[#D2CF9A]/20 bg-[#323D25] px-3 py-2 text-xs text-[#FAF9EE] placeholder-[#D2CF9A]/40 transition-colors focus:border-[#9A7E3B] focus:outline-none leading-relaxed"
                      />
                    </div>

                    {/* Voiceover Player + Audio Regeneration */}
                    <div className="rounded-xl border border-[#D2CF9A]/15 bg-[#323D25] p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[#D2CF9A]/80">
                        <span className="flex items-center gap-1 font-semibold text-[#FAF9EE]">
                          <Volume2 className="h-3 w-3 text-[#9A7E3B]" /> Voiceover Clip
                        </span>
                        
                        <div className="flex items-center gap-2">
                          {scene.audioUrl && (
                            <a
                              href={fileUrl(scene.audioUrl)}
                              download={`scene-${idx + 1}-voiceover.mp3`}
                              className="text-[10px] text-[#9A7E3B] hover:underline"
                            >
                              Download MP3
                            </a>
                          )}
                          <button
                            onClick={() => handleRegenerateSceneAudio(idx)}
                            disabled={isAudioLoading}
                            className="inline-flex items-center gap-1 text-[10px] text-[#D2CF9A] hover:text-[#FAF9EE]"
                          >
                            {isAudioLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RotateCcw className="h-2.5 w-2.5 text-[#9A7E3B]" />}
                            <span>Re-record</span>
                          </button>
                        </div>
                      </div>

                      {scene.audioUrl && (
                        <audio
                          src={fileUrl(scene.audioUrl)}
                          controls
                          className="w-full h-7 rounded-lg"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SOURCE ASSETS GALLERY */}
      <div className="rounded-3xl border border-[#D2CF9A]/15 bg-[#323D25] p-5 sm:p-6 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-2 border-b border-[#D2CF9A]/15 pb-3 text-sm font-bold text-[#FAF9EE]">
          <Film className="h-4 w-4 text-[#9A7E3B]" />
          <span>Original Uploaded Assets</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(project.productImageUrls?.length ? project.productImageUrls : [project.productImageUrl].filter(Boolean)).map((productUrl, index) => (
            <div key={`${productUrl}-${index}`} className="rounded-2xl border border-[#D2CF9A]/15 bg-[#28301C] p-4">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#D2CF9A]/80">
                Product Reference {index + 1}
              </span>
              <div className="relative h-48 w-full overflow-hidden rounded-xl bg-[#1E2515] border border-[#D2CF9A]/15">
                {isVideoFile(productUrl) ? (
                  <video
                    src={fileUrl(productUrl)}
                    controls
                    muted
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <img
                    src={fileUrl(productUrl)}
                    alt="Product"
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
            </div>
          ))}

          {project.modelImageUrl && (
            <div className="rounded-2xl border border-[#D2CF9A]/15 bg-[#28301C] p-4">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#D2CF9A]/80">
                Model / Persona Reference
              </span>
              <div className="relative h-48 w-full overflow-hidden rounded-xl bg-[#1E2515] border border-[#D2CF9A]/15">
                {isVideoFile(project.modelImageUrl) ? (
                  <video
                    src={fileUrl(project.modelImageUrl)}
                    controls
                    muted
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <img
                    src={fileUrl(project.modelImageUrl)}
                    alt="Model"
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
