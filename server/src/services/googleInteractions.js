import axios from 'axios';
import { geminiConfig, problem } from '../config/gemini.config.js';
const baseURL = 'https://generativelanguage.googleapis.com/v1beta';
export function providerError(error) {
  const status = error.response?.status || error.status || 502;
  let message = error.response?.data?.error?.message || error.message || 'Google request failed';
  try { message = JSON.parse(message).error?.message || message; } catch { /* SDK plain text error */ }
  if (Number(status) === 429) {
    const zeroFreeTierQuota = /free[_ ]tier/i.test(message) && /limit:\s*0\b/i.test(message);
    message = zeroFreeTierQuota
      ? 'This model has zero free-tier quota on the configured Google project. Enable billing and confirm model quota at https://aistudio.google.com/rate-limit.'
      : 'Google generation quota is exhausted. Check project limits and availability at https://aistudio.google.com/rate-limit before retrying.';
  }
  // Never serialize the SDK/Axios error object: it contains request credentials.
  return Object.assign(problem(`Google API${status ? ` (${status})` : ''}: ${message}`, status >= 400 && status < 600 ? status : 502), { providerHTTPStatus: status });
}
async function request(method, endpoint, data, signal) {
  try {
    const response = await axios({ method, baseURL, url: endpoint, data, signal,
      headers: { 'x-goog-api-key': geminiConfig().apiKey, 'Api-Revision': '2026-05-20' },
      timeout: 120000, maxContentLength: 150 * 1024 * 1024, maxBodyLength: 15 * 1024 * 1024 });
    return response.data;
  } catch (error) { if (signal?.aborted) throw error; throw providerError(error); }
}
export const interactions = {
  create: (body, signal) => request('POST', '/interactions', body, signal),
  get: (id, signal) => request('GET', `/interactions/${encodeURIComponent(id)}`, undefined, signal),
  cancel: id => request('POST', `/interactions/${encodeURIComponent(id)}/cancel`),
};
export function outputMedia(interaction, type) {
  return interaction.steps?.filter(s => s.type === 'model_output').flatMap(s => s.content || [])
    .find(part => part.type === type && part.data);
}
export async function checkModelAccess() {
  const config = geminiConfig();
  const models = [];
  for (const model of [config.imageModel, config.videoModel]) {
    try { const data = await request('GET', `/models/${encodeURIComponent(model)}`); models.push({ model, accessible: true, methods: data.supportedGenerationMethods }); }
    catch (error) { models.push({ model, accessible: false, error: error.message, status: error.status }); }
  }
  return models;
}
