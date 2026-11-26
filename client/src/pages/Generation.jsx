import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Loader2, Download, Image, Film } from 'lucide-react';
import api from '../api.js';
const activeStates = ['queued', 'submitting', 'running', 'processing'];
const button = 'rounded-xl bg-[#9A7E3B] px-5 py-3 font-semibold text-white disabled:opacity-50';
const field = 'mt-2 w-full rounded-xl border border-[#D2CF9A] bg-white p-3 text-[#28301C]';
export default function Generation() {
  const [kind, setKind] = useState('image');
  const [config, setConfig] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [duration, setDuration] = useState(8);
  const [reference, setReference] = useState(null);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [sceneIndex, setSceneIndex] = useState(0);
  const [notice, setNotice] = useState('');
  const submitLock = useRef(false);
  const request = useRef(null);
  const isActive = job && activeStates.includes(job.status);
  const refresh = async () => {
    const [settings, jobs] = await Promise.all([api.get('/generate/config'), api.get('/generate/jobs')]);
    setConfig(settings.data); setHistory(jobs.data);
    return jobs.data;
  };
  useEffect(() => {
    let mounted = true;
    refresh().then(jobs => { if (mounted) setJob(jobs.find(j => activeStates.includes(j.status)) || jobs[0] || null); })
      .catch(e => setError(e.response?.data?.message || 'Could not load generation settings'));
    api.get('/projects').then(r => { if (mounted) setProjects(r.data); }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!isActive) return;
    let alive = true, timer;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const { data } = await api.get(`/generate/${job.kind}/${job.id}`, { signal: controller.signal });
        if (!alive) return;
        setJob(data);
        if (activeStates.includes(data.status)) timer = setTimeout(poll, 4000);
        else { request.current = null; refresh().catch(() => {}); }
      } catch (e) {
        if (!alive) return;
        setError(e.response?.data?.message || 'Status connection interrupted. Retrying without submitting another generation.');
        timer = setTimeout(poll, 10000);
      }
    };
    poll();
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [job?.id, Boolean(isActive)]);
  useEffect(() => {
    setPreview('');
    if (job?.status !== 'completed') return;
    let alive = true, url;
    const controller = new AbortController();
    api.get(`/generate/media/${job.id}`, { responseType: 'blob', signal: controller.signal }).then(({ data }) => {
      if (!alive) return;
      url = URL.createObjectURL(data); setPreview(url);
    }).catch(e => { if (alive) setError(e.response?.data?.message || 'Could not load generated media'); });
    return () => { alive = false; controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [job?.id, job?.status]);
  const submit = async e => {
    e.preventDefault();
    if (submitLock.current || isActive) return;
    submitLock.current = true; setBusy(true); setError(''); setNotice('');
    const signature = JSON.stringify({ kind, prompt, ratio, duration, reference: reference && [reference.name, reference.size, reference.lastModified] });
    if (!request.current || request.current.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    const body = new FormData();
    body.append('prompt', prompt); body.append('aspectRatio', ratio); body.append('duration', duration);
    if (reference) body.append('referenceImage', reference);
    try {
      const { data } = await api.post(`/generate/${kind}`, body, { headers: { 'Idempotency-Key': request.current.key } });
      setJob(data); refresh().catch(() => {});
      if (!activeStates.includes(data.status)) request.current = null;
    } catch (e) { setError(e.response?.data?.message || 'Submission response was lost. Retry uses the same request key to prevent duplicate charges.'); }
    finally { setBusy(false); submitLock.current = false; }
  };
  const cancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try { const { data } = await api.post(`/generate/${job.kind}/${job.id}/cancel`); setJob(data); request.current = null; }
    catch (e) { setError(e.response?.data?.message || 'Cancellation failed'); }
    finally { setCancelling(false); }
  };
  const download = async () => {
    try {
      const { data, headers } = await api.get(`/generate/media/${job.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(data), link = document.createElement('a');
      link.href = url; link.download = `generated-${job.id}.${job.kind === 'video' ? 'mp4' : headers['content-type']?.includes('jpeg') ? 'jpg' : headers['content-type']?.includes('webp') ? 'webp' : 'png'}`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Download failed. Please retry.'); }
  };
  const apply = async () => {
    try { const { data } = await api.post(`/generate/media/${job.id}/use-in-scene`, { projectId, sceneIndex }); setNotice(data.message); }
    catch (e) { setError(e.response?.data?.message || 'Could not replace scene'); }
  };
  const outputUSD = config ? kind === 'image' ? config.pricing.imageOutputUSD : config.pricing.videoSecondUSD * duration : 0;
  return <div className="space-y-6">
    <div><Link to="/" className="text-sm text-[#9A7E3B]">← Projects</Link><h1 className="mt-3 text-3xl font-bold">Generate media</h1>
      <p className="mt-2 text-[#323D25]">Create a standalone image or clip, then use it in your scene-based advertisement.</p></div>
    <div className="flex gap-2" role="tablist" aria-label="Media type">{['image', 'video'].map(type => <button key={type} role="tab" aria-selected={kind === type}
      disabled={busy || isActive} className={`rounded-xl px-5 py-3 ${kind === type ? 'bg-[#28301C] text-[#D2CF9A]' : 'bg-white'}`}
      onClick={() => { setKind(type); setRatio(type === 'image' ? '1:1' : '16:9'); }}>
      {type === 'image' ? <Image className="mr-2 inline h-4 w-4" /> : <Film className="mr-2 inline h-4 w-4" />}{type === 'image' ? 'Image generation' : 'Video generation'}</button>)}</div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-[#D2CF9A]/40 p-4">{notice}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[#D2CF9A] bg-white/80 p-5 sm:p-7">
        <p className="break-all text-sm font-semibold text-[#9A7E3B]">{config?.[`${kind}Model`] || 'Loading configuration…'}</p>
        <label className="block font-medium">Prompt<textarea className={field} rows={6} required maxLength={6000} value={prompt} onChange={e => setPrompt(e.target.value)}
          placeholder={kind === 'image' ? 'Describe the subject, setting, composition, lighting and style…' : 'Describe the subject, action, camera movement, lighting and sound…'} /></label>
        <label className="block text-sm font-medium">Optional reference image (PNG, JPEG, WebP · up to 8 MB)
          <input className={field} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => {
            const file = e.target.files[0]; if (file?.size > 8 * 1024 * 1024) { setError('Reference image must be under 8 MB'); e.target.value = ''; setReference(null); } else setReference(file || null);
          }} /></label>
        <div className="grid grid-cols-2 gap-4"><label>Aspect ratio<select className={field} value={ratio} onChange={e => setRatio(e.target.value)}>
          {(config?.[`${kind}Ratios`] || [ratio]).map(value => <option key={value}>{value}</option>)}</select></label>
          {kind === 'video' ? <label>Duration<select className={field} value={duration} onChange={e => setDuration(Number(e.target.value))}>
            {Array.from({ length: 13 }, (_, i) => i + 3).map(n => <option value={n} key={n}>{n} seconds</option>)}</select></label> : <p className="self-end py-3 text-sm">1K output</p>}</div>
        {kind === 'video' && <p className="text-sm">720p · Native scene audio</p>}
        {config && <div className="rounded-xl bg-[#D2CF9A]/30 p-4 text-sm space-y-2">
          <p>Estimated output: <strong>${outputUSD.toFixed(3)} USD</strong>, plus input/thinking. Reservation: ₹{((outputUSD + 0.30) * config.usage.usdToINR).toFixed(2)}.</p>
          <p>Application reservations: ₹{config.usage.reservedINR.toFixed(2)} / ₹{config.usage.limitINR}. {config.usage.requests} / {config.usage.maxRequests} requests.</p>
          <p>Conversion uses a planning rate of ₹{config.usage.usdToINR}/USD. Taxes and external API usage are excluded. Cancelled requests may still be billed.</p>
          <a className="underline" href={config.pricing.source} target="_blank" rel="noreferrer">Google pricing</a>
        </div>}
        <button className={button} disabled={busy || isActive || !config?.configured || !config?.[`${kind}Enabled`]}>
          {busy ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 inline h-4 w-4" />}Generate {kind}</button>
        {config && !config.configured && <p className="text-sm">Configure GEMINI_API_KEY on the server to generate media.</p>}
      </form>
      <section className="rounded-2xl bg-[#28301C] p-5 text-[#D2CF9A] sm:p-7" aria-label="Generated media">
        <h2 className="text-xl font-semibold">Your result</h2>
        {!job && <p className="py-20 text-center">Your generated media will appear here.</p>}
        {job && <><p className="mt-3" role="status">{isActive && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}Status: {job.status}{job.providerStatus ? ` · Google: ${job.providerStatus}` : ''}</p>
          {job.error && <p className="my-3 text-sm">{job.error}</p>}
          {job.status === 'cancelled' && <p className="my-3 text-sm">Remote cancellation: {job.remoteCancellation}. Local processing has stopped; this does not guarantee a refund.</p>}
          {isActive && <button type="button" className="my-4 rounded-xl border border-[#D2CF9A] px-4 py-2 disabled:opacity-50" disabled={cancelling} onClick={cancel}>{cancelling ? 'Cancelling…' : 'Cancel Generation'}</button>}
          {preview && (job.kind === 'image' ? <img src={preview} className="mt-5 max-h-[520px] w-full rounded-xl object-contain" alt="AI generated result" /> : <video src={preview} controls playsInline className="mt-5 max-h-[520px] w-full rounded-xl" />)}
          {job.status === 'completed' && <><button type="button" onClick={download} className={`${button} mt-4`}><Download className="mr-2 inline h-4 w-4" />Download {job.kind}</button>
            <div className="mt-6 border-t border-[#D2CF9A]/30 pt-4"><p>Use in an existing scene</p>
              <select aria-label="Project" value={projectId} onChange={e => { setProjectId(e.target.value); setSceneIndex(0); }} className={field}><option value="">Choose a project</option>{projects.filter(p => p.status !== 'processing' && p.script.length).map(p => <option value={p._id} key={p._id}>{p.productName}</option>)}</select>
              <select aria-label="Scene" value={sceneIndex} onChange={e => setSceneIndex(Number(e.target.value))} className={field}>{projects.find(p => p._id === projectId)?.script.map((_, i) => <option value={i} key={i}>Scene {i + 1}</option>)}</select>
              <button type="button" disabled={!projectId} onClick={apply} className={`${button} mt-3`}>Replace scene media</button>
              {projectId && <Link className="ml-3 underline" to={`/projects/${projectId}`}>Open project</Link>}
              <p className="mt-3 text-xs">Re-render the project to apply. Its narration, captions, music, and chosen export format are retained.</p>
            </div></>}
        </>}
      </section>
    </div>
    {history.length > 0 && <section><h2 className="mb-3 text-lg font-bold">Recent generations</h2><div className="flex flex-wrap gap-2">{history.map(item => <button key={item.id} disabled={isActive} className="rounded-xl border border-[#D2CF9A] bg-white p-3 text-sm disabled:opacity-50" onClick={() => setJob(item)}>{item.kind} · {item.status} · {item.id.slice(0, 8)}</button>)}</div></section>}
  </div>;
}
