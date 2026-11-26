import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  Sparkles, 
  UploadCloud, 
  Film, 
  Smartphone, 
  Monitor, 
  Square, 
  Layers, 
  Users, 
  Tag, 
  Clock, 
  Volume2, 
  X, 
  Check, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Wand2,
  Image as ImageIcon,
  Play,
  RotateCcw,
  Sliders,
  CheckCircle2,
  FileEdit,
  ArrowRight
} from "lucide-react";
import api, { fileUrl } from "../api.js";

const MAX_SIZE = 100 * 1024 * 1024;
const MAX_REFERENCE_SIZE = 8 * 1024 * 1024;
const REFERENCE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/avi"];

const CATEGORIES = [
  "Electronics & Gadgets",
  "Fashion & Apparel",
  "Jewellery & Luxury",
  "Restaurant & Food",
  "Real Estate & Property",
  "Health & Fitness",
  "Beauty & Skincare",
  "Automotive & Vehicles",
  "SaaS & Digital Products",
  "Education & Courses",
  "General Retail",
  "Other"
];

const TONES = [
  { id: "Professional", label: "Professional", desc: "Authoritative, trustworthy, corporate" },
  { id: "Emotional", label: "Emotional", desc: "Heartfelt, evocative, storytelling" },
  { id: "Funny", label: "Funny", desc: "Humorous, playful, witty" },
  { id: "Promotional", label: "Promotional", desc: "Direct response, urgency, discount-driven" },
  { id: "Luxury", label: "Luxury", desc: "Sophisticated, exclusive, premium aesthetic" },
  { id: "Energetic", label: "Energetic", desc: "High-paced, viral, upbeat rhythm" },
];

const DURATIONS = [
  { sec: 15, label: "15s", scenes: "3 Scenes", badge: "Short & Punchy" },
  { sec: 30, label: "30s", scenes: "4 Scenes", badge: "Most Popular" },
  { sec: 45, label: "45s", scenes: "6 Scenes", badge: "Detailed Pitch" },
  { sec: 60, label: "60s", scenes: "8 Scenes", badge: "Full Explainer" },
];

const ASPECT_RATIOS = [
  { id: "9:16", name: "Reels & Shorts", ratio: "9:16", dim: "1080×1920", icon: Smartphone },
  { id: "16:9", name: "YouTube Landscape", ratio: "16:9", dim: "1920×1080", icon: Monitor },
  { id: "1:1", name: "Instagram Post", ratio: "1:1", dim: "1080×1080", icon: Square },
  { id: "4:5", name: "Facebook Feed", ratio: "4:5", dim: "1080×1350", icon: Layers },
];

const VOICES = [
  { id: "adam", name: "Adam", gender: "male", style: "Deep & Confident", desc: "Electronics, luxury, tech" },
  { id: "rachel", name: "Rachel", gender: "female", style: "Warm & Engaging", desc: "Fashion, food, lifestyle" },
  { id: "marcus", name: "Marcus", gender: "male", style: "Energetic & Modern", desc: "Fitness, retail, flash sales" },
  { id: "bella", name: "Bella", gender: "female", style: "Luxury & Elegant", desc: "Jewellery, cosmetics, property" },
  { id: "josh", name: "Josh", gender: "male", style: "Corporate & Clear", desc: "B2B, SaaS, education" },
  { id: "sophia", name: "Sophia", gender: "female", style: "Upbeat & Viral", desc: "TikTok, Reels, youth brands" },
];

const LANGUAGES = [
  { code: "en", name: "English (Global)" },
  { code: "es", name: "Spanish (Español)" },
  { code: "fr", name: "French (Français)" },
  { code: "de", name: "German (Deutsch)" },
  { code: "hi", name: "Hindi (हिंदी)" },
  { code: "it", name: "Italian (Italiano)" },
  { code: "ja", name: "Japanese (日本語)" },
  { code: "pt", name: "Portuguese (Português)" },
];

const SECTION_BADGES = {
  hook: "bg-[#9A7E3B]/15 text-[#1E2515] border-[#9A7E3B]/40",
  content: "bg-[#28301C]/10 text-[#1E2515] border-[#28301C]/20",
  benefit: "bg-[#3E4C2E]/15 text-[#1E2515] border-[#3E4C2E]/30",
  cta: "bg-[#9A7E3B]/25 text-[#1E2515] border-[#9A7E3B]/50",
};

function ProductReferencePreview({ file }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url ? <img src={url} alt={file.name} className="h-28 w-full rounded-lg object-contain" /> : null;
}

export default function NewProject() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    productName: "",
    description: "",
    category: "Electronics & Gadgets",
    audience: "Tech enthusiasts, creators and everyday users",
    tone: "Professional",
    duration: 30,
    style: "Energetic and modern",
    ctaText: "Shop now",
    aspectRatio: "9:16",
  });

  const [voiceSettings, setVoiceSettings] = useState({
    voiceId: "adam",
    voiceName: "Adam",
    gender: "male",
    style: "Deep & Confident",
    language: "en",
    speed: 1.0,
  });

  const [productImages, setProductImages] = useState([]);
  const [modelImage, setModelImage] = useState(null);

  // Script preview & edit stage
  const [scriptScenes, setScriptScenes] = useState([]);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptGenerated, setScriptGenerated] = useState(false);

  // Voice preview state
  const [previewAudioUrl, setPreviewAudioUrl] = useState("");
  const [previewingVoice, setPreviewingVoice] = useState(false);
  const audioRef = useRef(null);

  // Pipeline loading
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addProductImages = (files) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;
    if (productImages.length + incoming.length > 5) {
      return setError("You can upload a maximum of 5 product images.");
    }
    for (const file of incoming) {
      if (!REFERENCE_TYPES.includes(file.type)) {
        return setError("Product references must be JPG, PNG or WebP.");
      }
      if (!file.size || file.size > MAX_REFERENCE_SIZE) {
        return setError("Each product reference must be at most 8 MB.");
      }
    }
    setProductImages(prev => [...prev, ...incoming]);
    setError("");
  };

  const isVideoFile = (file) =>
    file && (file.type?.startsWith("video/") || file.name?.match(/\.(mp4|webm|mov|mkv)$/i));

  const validateFile = (file) => {
    if (!file) return "";
    const isImage = IMAGE_TYPES.includes(file.type) || file.type.startsWith("image/");
    const isVideo = VIDEO_TYPES.includes(file.type) || file.type.startsWith("video/");
    if (!isImage && !isVideo) return "Files must be JPG, PNG, WEBP images or MP4, WebM, MOV videos";
    if (file.size > MAX_SIZE) return "Files must be under 100MB";
    return "";
  };

  // Test voice preview
  const handleVoicePreview = async () => {
    setPreviewingVoice(true);
    setError("");
    try {
      const sampleText = form.productName
        ? `Meet ${form.productName}. Take a closer look and discover the details.`
        : "Welcome. This sample lets you hear the voice, pacing, and pronunciation.";

      const { data } = await api.post("/projects/voice-preview", {
        text: sampleText,
        voiceSettings,
      });

      setPreviewAudioUrl(fileUrl(data.audioUrl));
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      console.warn("Voice preview error:", err);
      setError("Could not generate voice preview");
    } finally {
      setPreviewingVoice(false);
    }
  };

  // Generate Script Only (Step 1 Review)
  const handleGenerateScript = async () => {
    if (!form.productName.trim()) {
      return setError("Please enter a product or service name first.");
    }
    setError("");
    setGeneratingScript(true);

    try {
      const { data } = await api.post("/projects/generate-script", {
        ...form,
        duration: Number(form.duration),
        language: voiceSettings.language,
      });

      setScriptScenes(data.script || []);
      if (data.warnings?.length) setError(data.warnings.join(" "));
      setScriptGenerated(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to generate AI script");
    } finally {
      setGeneratingScript(false);
    }
  };

  // Update scene text in editable script
  const handleSceneTextChange = (index, newText) => {
    setScriptScenes((prev) =>
      prev.map((s, i) => (i === index ? { ...s, sceneText: newText } : s))
    );
  };

  // Full Project Launch
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError("");

    if (productImages.length < 3 || productImages.length > 5) {
      return setError("Please upload 3–5 photos of the same product.");
    }
    const fileError = validateFile(modelImage);
    if (fileError) return setError(fileError);
    if (modelImage && !REFERENCE_TYPES.includes(modelImage.type)) {
      return setError("The model reference must be JPG, PNG or WebP.");
    }
    if (modelImage && modelImage.size > MAX_REFERENCE_SIZE) {
      return setError("The model reference must be at most 8 MB.");
    }

    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, String(v).trim()));
    body.append("voiceSettings", JSON.stringify(voiceSettings));
    if (scriptScenes.length) {
      body.append("script", JSON.stringify(scriptScenes));
    }
    productImages.forEach(file => body.append("productImages", file));
    if (modelImage) body.append("modelImage", modelImage);

    setLoading(true);
    try {
      const { data } = await api.post("/projects", body);
      navigate(`/projects/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not launch generation pipeline");
      setLoading(false);
    }
  };

  // Full-screen Loading State
  if (loading) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center animate-fade-in text-[#28301C]">
        <div className="relative mx-auto mb-8 flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#9A7E3B]/20 blur-xl opacity-60 animate-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#9A7E3B]/40 bg-white shadow-xl backdrop-blur-xl">
            <Wand2 className="h-10 w-10 text-[#9A7E3B] animate-bounce" />
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-[#1E2515]">Synthesizing Your AI Ad Video</h2>
        <p className="mt-2 text-sm text-[#4A5737]">
          Our multi-modal pipeline is generating visual scenes, synthesizing voiceover audio, and rendering FFmpeg Ken-Burns video effects.
        </p>

        {/* Pipeline steps HUD */}
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-[#28301C]/10 bg-white p-5 text-left shadow-lg space-y-3">
          <div className="flex items-center gap-3 text-xs text-[#1E2515]">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9A7E3B]/20 text-[#9A7E3B]">
              <Check className="h-3 w-3 stroke-[2.5]" />
            </div>
            <span>Asset uploaded & initialized</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#1E2515]">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9A7E3B]/20 text-[#9A7E3B]">
              <Check className="h-3 w-3 stroke-[2.5]" />
            </div>
            <span>Structured commercial script generated</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#28301C] font-medium">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9A7E3B]/25 text-[#9A7E3B] animate-spin">
              <Loader2 className="h-3 w-3" />
            </div>
            <span>Generating scene visuals in {form.aspectRatio} & voiceover ({voiceSettings.voiceName})...</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#28301C]/50">
            <div className="h-5 w-5 rounded-full border border-[#28301C]/20 flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full bg-[#28301C]/40" />
            </div>
            <span>FFmpeg stitching Ken-Burns motion & sound mix</span>
          </div>
        </div>

        <p className="mt-6 text-xs text-[#4A5737]">
          Rendering takes ~1-3 minutes. Redirecting you automatically to the studio view...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-in pb-16 text-[#28301C]">
      {/* Top Breadcrumb & Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A5737] hover:text-[#1E2515] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Projects</span>
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1E2515]">
                AI Advertisement Studio
              </h1>
              <span className="rounded-full border border-[#9A7E3B]/30 bg-[#9A7E3B]/10 px-2.5 py-0.5 text-xs font-semibold text-[#9A7E3B]">
                End-to-End Pipeline
              </span>
            </div>
            <p className="mt-1 text-sm text-[#4A5737]">
              Transform product assets into professional video ads tailored for Reels, Shorts, Instagram, and YouTube.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Product Assets Upload */}
        <div className="rounded-2xl border border-[#28301C]/10 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[#28301C]/10 pb-3 text-sm font-bold text-[#1E2515]">
            <UploadCloud className="h-4 w-4 text-[#9A7E3B]" />
            <span>1. Product Media Assets</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Multiple product photographs of the same product */}
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#1E2515]">
                <span>Product References <span className="text-[#9A7E3B]">*</span></span>
                <span className="text-[10px] text-[#4A5737]">{productImages.length}/5 • 3 minimum</span>
              </label>
              {productImages.length < 5 && (
                <label className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#28301C]/20 bg-[#F7F6EC]/50 p-5 text-center cursor-pointer hover:border-[#9A7E3B]">
                  <UploadCloud className="mb-2 h-6 w-6 text-[#9A7E3B]" />
                  <span className="text-xs font-bold text-[#1E2515]">Add product photos</span>
                  <span className="mt-1 text-[11px] text-[#4A5737]">3–5 JPG, PNG or WebP • 8 MB each</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={e => { addProductImages(e.target.files); e.target.value = ""; }}
                    className="hidden"
                  />
                </label>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                {productImages.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} className="relative rounded-xl border border-[#28301C]/10 bg-[#F7F6EC] p-2">
                    <ProductReferencePreview file={file} />
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="truncate text-[11px] text-[#1E2515]">{index + 1}. {file.name}</span>
                      <button type="button" aria-label={`Remove image ${index + 1}`}
                        onClick={() => setProductImages(prev => prev.filter((_, i) => i !== index))}
                        className="rounded p-1 text-red-600 hover:bg-red-500/10">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

                        {/* Optional Model / Persona Asset */}
            <div>
              <label className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#1E2515]">
                <span>Model / Persona <span className="text-[#4A5737]">(Optional)</span></span>
                <span className="text-[10px] text-[#4A5737]">Image or Video</span>
              </label>

              {!modelImage ? (
                <label className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#28301C]/20 bg-[#F7F6EC]/50 p-6 text-center cursor-pointer transition-all hover:border-[#9A7E3B] hover:bg-[#9A7E3B]/5">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-[#9A7E3B]/30 text-[#9A7E3B] transition-transform group-hover:scale-110 shadow-sm">
                    <Users className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-[#1E2515]">Upload Model / Persona</span>
                  <span className="mt-1 text-[11px] text-[#4A5737]">Actor, influencer, or testimonial</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => setModelImage(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative overflow-hidden rounded-xl border border-[#28301C]/10 bg-[#F7F6EC] p-2">
                  <div className="relative h-40 w-full overflow-hidden rounded-lg bg-black/5">
                    {isVideoFile(modelImage) ? (
                      <video
                        src={URL.createObjectURL(modelImage)}
                        controls
                        muted
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <img
                        src={URL.createObjectURL(modelImage)}
                        alt="Model preview"
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between px-1">
                    <span className="truncate text-xs font-semibold text-[#1E2515] max-w-[170px]">
                      {modelImage.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setModelImage(null)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-[#4A5737] hover:bg-red-500/10 hover:text-red-600 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 2: AI Script Parameters (Category, Audience, Tone, Duration) */}
        <div className="rounded-2xl border border-[#28301C]/10 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-[#28301C]/10 pb-3 text-sm font-bold text-[#1E2515]">
            <Tag className="h-4 w-4 text-[#9A7E3B]" />
            <span>2. Advertisement Campaign Details</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
                Product / Service Name <span className="text-[#9A7E3B]">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-[#28301C]/15 bg-[#F7F6EC]/60 px-4 py-2.5 text-sm text-[#1E2515] placeholder-[#28301C]/40 transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9A7E3B]/20"
                name="productName"
                placeholder="e.g. Lumina Pulse Wireless Earbuds"
                value={form.productName}
                onChange={change}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
                Industry / Category <span className="text-[#9A7E3B]">*</span>
              </label>
              <select
                className="w-full rounded-xl border border-[#28301C]/15 bg-[#F7F6EC]/60 px-4 py-2.5 text-sm text-[#1E2515] transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9A7E3B]/20"
                name="category"
                value={form.category}
                onChange={change}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-white text-[#1E2515]">
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
              Product Description & Key Selling Points <span className="text-[#9A7E3B]">*</span>
            </label>
            <textarea
              className="w-full rounded-xl border border-[#28301C]/15 bg-[#F7F6EC]/60 px-4 py-2.5 text-sm text-[#1E2515] placeholder-[#28301C]/40 transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9A7E3B]/20 leading-relaxed"
              name="description"
              rows={3}
              placeholder="Highlight key benefits, materials, unique features, problem solved, or promotional discount..."
              value={form.description}
              onChange={change}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
                Target Audience <span className="text-[#9A7E3B]">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-[#28301C]/15 bg-[#F7F6EC]/60 px-4 py-2.5 text-sm text-[#1E2515] placeholder-[#28301C]/40 transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9A7E3B]/20"
                name="audience"
                placeholder="e.g. Busy professionals, fitness lovers, college students"
                value={form.audience}
                onChange={change}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
                Call to Action (CTA End Card) <span className="text-[#9A7E3B]">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-[#28301C]/15 bg-[#F7F6EC]/60 px-4 py-2.5 text-sm text-[#1E2515] placeholder-[#28301C]/40 transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#9A7E3B]/20"
                name="ctaText"
                placeholder="e.g. Shop now and save 20%"
                value={form.ctaText}
                onChange={change}
                required
              />
            </div>
          </div>

          {/* Tone Selector */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
              Advertisement Tone
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm({ ...form, tone: t.id })}
                  className={`flex flex-col rounded-xl border p-3 text-left transition-all ${
                    form.tone === t.id
                      ? "border-[#9A7E3B] bg-[#9A7E3B]/10 ring-1 ring-[#9A7E3B]/40 text-[#1E2515] shadow-sm"
                      : "border-[#28301C]/10 bg-[#F7F6EC]/50 text-[#28301C] hover:border-[#9A7E3B]/40 hover:bg-[#F7F6EC]"
                  }`}
                >
                  <span className="text-xs font-bold text-[#1E2515]">{t.label}</span>
                  <span className="mt-0.5 text-[10px] text-[#4A5737] line-clamp-1">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Video Duration Selector */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
              Target Video Duration
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DURATIONS.map((d) => (
                <button
                  key={d.sec}
                  type="button"
                  onClick={() => setForm({ ...form, duration: d.sec })}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3.5 transition-all ${
                    form.duration === d.sec
                      ? "border-[#9A7E3B] bg-[#9A7E3B]/10 ring-1 ring-[#9A7E3B]/40 text-[#1E2515] shadow-sm"
                      : "border-[#28301C]/10 bg-[#F7F6EC]/50 text-[#28301C] hover:border-[#9A7E3B]/40 hover:bg-[#F7F6EC]"
                  }`}
                >
                  <span className="text-lg font-extrabold text-[#1E2515]">{d.label}</span>
                  <span className="text-xs font-medium text-[#4A5737]">{d.scenes}</span>
                  <span className="mt-1 rounded bg-white border border-[#28301C]/10 px-1.5 py-0.2 text-[10px] text-[#4A5737]">
                    {d.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: Auto Aspect Ratio Selector */}
        <div className="rounded-2xl border border-[#28301C]/10 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#28301C]/10 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1E2515]">
              <Film className="h-4 w-4 text-[#9A7E3B]" />
              <span>3. Auto Aspect Ratio (Social Media Platform)</span>
            </div>
            <span className="text-xs text-[#4A5737]">Smart FFmpeg Auto-Crop & Framing</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ASPECT_RATIOS.map((r) => {
              const Icon = r.icon;
              const isSelected = form.aspectRatio === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setForm({ ...form, aspectRatio: r.id })}
                  className={`flex flex-col rounded-xl border p-4 text-left transition-all ${
                    isSelected
                      ? "border-[#9A7E3B] bg-[#9A7E3B]/10 ring-1 ring-[#9A7E3B]/40 shadow-sm text-[#1E2515]"
                      : "border-[#28301C]/10 bg-[#F7F6EC]/50 hover:border-[#9A7E3B]/40 text-[#28301C]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isSelected ? "bg-[#9A7E3B] text-white" : "bg-[#F7F6EC] border border-[#9A7E3B]/30 text-[#9A7E3B]"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-bold text-[#1E2515]">{r.ratio}</span>
                  </div>
                  <span className="text-xs font-bold text-[#1E2515]">{r.name}</span>
                  <span className="text-[10px] text-[#4A5737]">{r.dim}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 4: AI Voiceover Generator & Voice Preview */}
        <div className="rounded-2xl border border-[#28301C]/10 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#28301C]/10 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1E2515]">
              <Volume2 className="h-4 w-4 text-[#9A7E3B]" />
              <span>4. AI Voiceover Generator & Realistic Preview</span>
            </div>

            {/* Instant Voice Preview Button */}
            <button
              type="button"
              onClick={handleVoicePreview}
              disabled={previewingVoice}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#9A7E3B]/40 bg-[#9A7E3B]/10 px-3 py-1.5 text-xs font-bold text-[#1E2515] transition-all hover:bg-[#9A7E3B]/20 disabled:opacity-50"
            >
              {previewingVoice ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9A7E3B]" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current text-[#9A7E3B]" />
                  <span>Preview Voice Sample</span>
                </>
              )}
            </button>
          </div>

          {/* Voice Preview Player Bar (if generated) */}
          {previewAudioUrl && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#9A7E3B]/30 bg-[#F7F6EC] p-3">
              <div className="flex items-center gap-2 text-xs text-[#28301C]">
                <Volume2 className="h-4 w-4 text-[#9A7E3B] animate-pulse" />
                <span>Voice Preview: <strong className="text-[#1E2515]">{voiceSettings.voiceName}</strong> ({voiceSettings.language.toUpperCase()}, {voiceSettings.speed}x)</span>
              </div>
              <audio ref={audioRef} src={previewAudioUrl} controls className="h-8 max-w-xs" />
            </div>
          )}

          {/* Voice Profiles Grid */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
              Select Voice Actor (Male / Female)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {VOICES.map((v) => {
                const isSelected = voiceSettings.voiceId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() =>
                      setVoiceSettings({
                        ...voiceSettings,
                        voiceId: v.id,
                        voiceName: v.name,
                        gender: v.gender,
                        style: v.style,
                      })
                    }
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-[#9A7E3B] bg-[#9A7E3B]/10 ring-1 ring-[#9A7E3B]/40 shadow-sm"
                        : "border-[#28301C]/10 bg-[#F7F6EC]/50 hover:border-[#9A7E3B]/40"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      v.gender === "male"
                        ? "bg-white border border-[#9A7E3B]/30 text-[#9A7E3B]"
                        : "bg-white border border-[#28301C]/15 text-[#28301C]"
                    }`}>
                      {v.gender === "male" ? "M" : "F"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#1E2515]">{v.name}</span>
                        <span className="rounded bg-white border border-[#28301C]/10 px-1.5 py-0.2 text-[10px] text-[#4A5737]">
                          {v.style}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#4A5737] truncate">{v.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
                Language
              </label>
              <select
                className="w-full rounded-xl border border-[#28301C]/15 bg-[#F7F6EC]/60 px-4 py-2.5 text-sm text-[#1E2515] transition-all focus:border-[#9A7E3B] focus:bg-white focus:outline-none"
                value={voiceSettings.language}
                onChange={(e) => setVoiceSettings({ ...voiceSettings, language: e.target.value })}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-white text-[#1E2515]">
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E2515]">
                  Speaking Speed
                </label>
                <span className="text-xs font-bold text-[#9A7E3B]">{voiceSettings.speed}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.4"
                step="0.05"
                value={voiceSettings.speed}
                onChange={(e) => setVoiceSettings({ ...voiceSettings, speed: Number(e.target.value) })}
                className="w-full accent-[#9A7E3B] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#4A5737] mt-1">
                <span>0.8x (Dramatic)</span>
                <span>1.0x (Natural)</span>
                <span>1.4x (Fast Pace)</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: AI Script Review & Editor (Hook, Content, Benefits, CTA) */}
        <div className="rounded-2xl border border-[#28301C]/10 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#28301C]/10 pb-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1E2515]">
              <FileEdit className="h-4 w-4 text-[#9A7E3B]" />
              <span>5. AI Script Generator & Scene-Wise Editor</span>
            </div>

            <button
              type="button"
              onClick={handleGenerateScript}
              disabled={generatingScript}
              className="inline-flex items-center gap-2 rounded-xl bg-[#9A7E3B] hover:bg-[#856C31] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#9A7E3B]/20 transition-all hover:opacity-95 disabled:opacity-50"
            >
              {generatingScript ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  <span>Composing Script...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{scriptGenerated ? "Regenerate AI Script" : "Generate & Review Script"}</span>
                </>
              )}
            </button>
          </div>

          {!scriptGenerated ? (
            <div className="rounded-xl border border-[#28301C]/10 bg-[#F7F6EC]/60 p-6 text-center">
              <p className="text-xs text-[#28301C]">
                Want to customize the narration before generating video? Click <strong>"Generate & Review Script"</strong> above to inspect and edit your Hook, Content, Benefits, and CTA scenes.
              </p>
              <p className="mt-1 text-[11px] text-[#4A5737]">
                Or launch the pipeline directly below to generate script and video in one go!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#4A5737]">
                <span>{scriptScenes.length} Scenes Generated ({form.duration}s target)</span>
                <span>You can edit the voiceover narration for any scene</span>
              </div>

              <div className="space-y-3">
                {scriptScenes.map((scene, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#28301C]/10 bg-[#F7F6EC]/50 p-4 transition-all hover:border-[#9A7E3B]/40"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white border border-[#9A7E3B]/30 text-[11px] font-bold text-[#9A7E3B]">
                          {idx + 1}
                        </span>
                        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          SECTION_BADGES[scene.sectionType] || SECTION_BADGES.content
                        }`}>
                          {scene.sectionType}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#4A5737]">~{scene.duration || 5}s</span>
                    </div>

                    <textarea
                      value={scene.sceneText}
                      onChange={(e) => handleSceneTextChange(idx, e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-[#28301C]/15 bg-white px-3 py-2 text-xs text-[#1E2515] placeholder-[#28301C]/40 transition-colors focus:border-[#9A7E3B] focus:outline-none"
                    />

                    {scene.imagePrompt && (
                      <p className="mt-1 text-[11px] text-[#4A5737] italic truncate">
                        Visual Concept: {scene.imagePrompt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-50 p-3.5 text-xs text-red-800 animate-slide-up">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={loading}
          className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#9A7E3B] hover:bg-[#856C31] py-4 text-base font-extrabold text-white shadow-xl shadow-[#9A7E3B]/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        >
          <Sparkles className="h-5 w-5 stroke-[2.5]" />
          <span>Launch AI Video Generator Pipeline</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 stroke-[2.5]" />
        </button>
      </form>
    </div>
  );
}
