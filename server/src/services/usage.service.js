import mongoose from 'mongoose';
import { geminiConfig, PRICING, problem } from '../config/gemini.config.js';
const budgetSchema = new mongoose.Schema({ _id: String, reservedINR: { type: Number, default: 0 }, requests: { type: Number, default: 0 } });
const Budget = mongoose.model('GenerationBudget', budgetSchema);
export function estimateCost(kind, duration = 8) {
  const c = geminiConfig();
  const outputUSD = kind === 'image' ? PRICING.imageOutputUSD : kind === 'video' ? PRICING.videoSecondUSD * duration : 0;
  // Conservative allowance for input and thinking; reservation is NOT an invoice.
  const reservedUSD = kind === 'script' ? 0.10 : outputUSD + 0.30;
  return { outputUSD, reservedINR: Math.ceil(reservedUSD * c.usdToINR * 100) / 100 };
}
export async function usageSummary() {
  const c = geminiConfig();
  const state = await Budget.findById('application').lean();
  return { reservedINR: state?.reservedINR || 0, requests: state?.requests || 0,
    limitINR: c.budgetINR, maxRequests: c.maxRequests, usdToINR: c.usdToINR };
}
export async function reserveUsage(kind, duration) {
  const c = geminiConfig();
  const cost = estimateCost(kind, duration);
  try { await Budget.updateOne({ _id: 'application' }, { $setOnInsert: { reservedINR: 0, requests: 0 } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const result = await Budget.findOneAndUpdate({ _id: 'application',
    reservedINR: { $lte: c.budgetINR - cost.reservedINR }, requests: { $lt: c.maxRequests } },
  { $inc: { reservedINR: cost.reservedINR, requests: 1 } }, { new: true });
  if (!result) throw problem('Application generation budget or request limit reached. Review usage before increasing it.', 429);
  // Retain reservations on failure/cancellation: remote charges may still occur.
  return cost;
}
