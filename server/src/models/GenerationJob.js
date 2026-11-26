import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: String, userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  requestKey: { type: String, required: true }, fingerprint: String,
  activeKey: { type: String, unique: true, sparse: true },
  kind: { type: String, enum: ['image', 'video'], required: true }, model: String,
  status: { type: String, default: 'queued', enum: ['queued', 'submitting', 'running', 'processing', 'completed', 'failed', 'cancelled', 'interrupted'] },
  providerId: String, providerStatus: String, prompt: String, aspectRatio: String, duration: Number,
  file: String, mimeType: String, estimatedUSD: Number, reservedINR: Number,
  error: String, providerHTTPStatus: Number, usage: mongoose.Schema.Types.Mixed,
  remoteCancellation: { type: String, default: 'not_requested' },
}, { timestamps: true });
schema.index({ userId: 1, requestKey: 1 }, { unique: true });
export default mongoose.model('GenerationJob', schema);
