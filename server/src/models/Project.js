import mongoose from "mongoose";

const sceneSchema = new mongoose.Schema(
  {
    sceneNumber: { type: Number },
    sectionType: { 
      type: String, 
      enum: ["hook", "content", "benefit", "cta"], 
      default: "content" 
    },
    sceneText: { type: String, required: true },
    imagePrompt: { type: String },
    imageUrl: { type: String },
    audioUrl: { type: String },
    duration: { type: Number, default: 5 },
  },
  { _id: false }
);

const voiceSettingsSchema = new mongoose.Schema(
  {
    voiceId: { type: String, default: "adam" },
    voiceName: { type: String, default: "Adam (Male - Deep & Confident)" },
    gender: { type: String, enum: ["male", "female"], default: "male" },
    style: { type: String, default: "Professional & Modern" },
    language: { type: String, default: "en" },
    speed: { type: Number, default: 1.0 },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  productName: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    default: "Electronics",
    enum: [
      "Restaurant & Food",
      "Fashion & Apparel",
      "Jewellery & Luxury",
      "Electronics & Gadgets",
      "Real Estate & Property",
      "Health & Fitness",
      "Beauty & Skincare",
      "Automotive & Vehicles",
      "SaaS & Digital Products",
      "Education & Courses",
      "General Retail",
      "Other"
    ]
  },
  audience: { type: String, required: true },
  tone: { 
    type: String, 
    default: "Professional",
    enum: ["Professional", "Emotional", "Funny", "Promotional", "Luxury", "Energetic"]
  },
  duration: { type: Number, enum: [15, 30, 45, 60], default: 30 },
  style: { type: String, default: "Energetic and modern" },
  ctaText: { type: String, required: true },
  aspectRatio: { 
    type: String, 
    enum: ["9:16", "16:9", "1:1", "4:5"], 
    default: "9:16" 
  },
  productImageUrl: { type: String, required: true }, // legacy primary reference
  productImageUrls: { type: [String], default: [] }, // ordered references for each scene
  modelImageUrl: { type: String },
  voiceSettings: { type: voiceSettingsSchema, default: () => ({}) },
  script: { type: [sceneSchema], default: [] },
  finalVideoUrl: { type: String },
  errorMessage: { type: String },
  warnings: { type: [String], default: [] },
  generationStage: { type: String, default: "Queued" },
  status: { 
    type: String, 
    enum: ["draft", "script_generated", "processing", "completed", "failed", "cancelled"], 
    default: "processing" 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

projectSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Project", projectSchema);

