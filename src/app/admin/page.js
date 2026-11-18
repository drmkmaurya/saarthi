'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { extractAndChunkPDF } from '@/lib/pdfChunker';
import { ArrowLeft, Users, Bot, UploadCloud, Save, Plus, Loader2, CheckCircle2 } from 'lucide-react';

export default function AdminPanel() {
  const [adminUser, setAdminUser] = useState(null);
  const [tab, setTab] = useState('users'); // 'users' | 'prompts' | 'knowledge'
  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Assistant Form
  const [newMod, setNewMod] = useState({ slug: '', title: '', icon: '🤖', system_prompt: '' });

  // Knowledge Upload State
  const [selectedSlug, setSelectedSlug] = useState('vastu');
  const [sourceTitle, setSourceTitle] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [manualText, setManualText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    initAdmin();
  }, []);

  const initAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      setLoading(false);
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (prof?.role !== 'admin') {
      setLoading(false);
      return;
    }

    setAdminUser(prof);
    await refreshAll();
    setLoading(false);
  };

  const refreshAll = async () => {
    const [{ data: uList }, { data: mList }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('assistants_config').select('*').order('sort_order', { ascending: true }),
    ]);
    setUsers(uList || []);
    setModules(mList || []);
  };

  const updateUser = async (id, patch) => {
    await supabase.from('profiles').update(patch).eq('id', id);
    await refreshAll();
  };

  const toggleUserModule = (userObj, slug) => {
    const current = userObj.allowed_modules || [];
    const updated = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    updateUser(userObj.id, { allowed_modules: updated });
  };

  const savePrompt = async (mod) => {
    await supabase
      .from('assistants_config')
      .update({
        title: mod.title,
        icon: mod.icon,
        system_prompt: mod.system_prompt,
        is_active: mod.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', mod.slug);
    alert(`"${mod.title}" का Prompt सेव हो गया!`);
  };

  const addNewModule = async (e) => {
    e.preventDefault();
    if (!newMod.slug || !newMod.title) return;
    await supabase.from('assistants_config').insert({
      ...newMod,
      slug: newMod.slug.toLowerCase().replace(/\s+/g, '_'),
      sort_order: modules.length + 1,
    });
    setNewMod({ slug: '', title: '', icon: '🤖', system_prompt: '' });
    await refreshAll();
    alert('नया Assistant जुड़ गया!');
  };

  const handleEmbedUpload = async (e) => {
    e.preventDefault();
    if (!pdfFile && !manualText.trim()) return;
    setUploading(true);
    setUploadProgress(5);

    try {
      let chunks = [];
      const finalSourceName = sourceTitle.trim() || pdfFile?.name || 'Manual Notes';

      if (pdfFile) {
        chunks = await extractAndChunkPDF(pdfFile, setUploadProgress);
      } else {
        const cleaned = manualText.replace(/\s+/g, ' ').trim();
        for (let i = 0; i < cleaned.length; i += 1000) {
          chunks.push(cleaned.slice(i, i + 1000));
        }
        setUploadProgress(40);
      }

      // Send in batches of 8 chunks to avoid Vercel timeout
      const batchSize = 8;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const res = await fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminId: adminUser.id,
            moduleSlug: selectedSlug,
            sourceName: finalSourceName,
            chunks: batch,
          }),
        });
        if (!res.ok) throw new Error('Batch upload failed');
        const pct = 40 + Math.round(((i + batch.length) / chunks.length) * 60);
        setUploadProgress(Math.min(pct, 100));
      }

      alert(`सफल! कुल ${chunks.length} ज्ञान खंड (Vector Chunks) डेटाबेस में जुड़ गए हैं।`);
      setPdfFile(null);
      setManualText('');
      setSourceTitle('');
    } catch (err) {
      alert('Upload Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-3">
        <p className="font-bold text-slate-800">Access Denied: सिर्फ Admin के लिए</p>
        <Link href="/" className="text-xs text-orange-600 underline">होम पेज पर वापस जाएं</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-12">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-3.5 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs font-semibold bg-white/10 px-3 py-1.5 rounded-xl hover:bg-white/20">
            <ArrowLeft className="w-4 h-4" /> App पर जाएं
          </Link>
          <h1 className="font-bold text-sm sm:text-base">सारथी Admin Control</h1>
          <span className="text-[11px] text-amber-400 font-mono">ADMIN</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3.5 mt-5 space-y-5">
        {/* Admin Navigation Tabs */}
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-stone-200 shadow-xs">
          {[
            { id: 'users', label: 'Users & Access', icon: Users },
            { id: 'prompts', label: 'Prompts & Modules', icon: Bot },
            { id: 'knowledge', label: 'Upload PDF / Knowledge', icon: UploadCloud },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  tab === t.id ? 'bg-orange-500 text-white shadow-xs' : 'text-slate-600 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: USERS & ACCESS CONTROL */}
        {tab === 'users' && (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-sm text-slate-800">{u.full_name || 'No Name'}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Dropdown */}
                    <select
                      value={u.status}
                      onChange={(e) => updateUser(u.id, { status: e.target.value })}
                      className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border ${
                        u.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="blocked">Blocked</option>
                    </select>

                    {/* Role Dropdown */}
                    <select
                      value={u.role}
                      onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {/* Allowed Modules Checkboxes + Per-User DB Chat Limit */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-slate-400 font-semibold">Access:</span>
                    {modules.map((m) => (
                      <label key={m.slug} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={u.allowed_modules?.includes(m.slug) || false}
                          onChange={() => toggleUserModule(u, m.slug)}
                          className="rounded text-orange-500"
                        />
                        <span>{m.title}</span>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">DB Chat Limit:</span>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      defaultValue={u.max_db_chats}
                      onBlur={(e) => updateUser(u.id, { max_db_chats: Number(e.target.value) || 10 })}
                      className="w-16 px-2 py-1 rounded-lg border border-stone-300 text-center font-bold"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: PROMPTS & MODULES */}
        {tab === 'prompts' && (
          <div className="space-y-4">
            {modules.map((mod, idx) => (
              <div key={mod.slug} className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={mod.icon}
                      onChange={(e) => {
                        const copy = [...modules];
                        copy[idx].icon = e.target.value;
                        setModules(copy);
                      }}
                      className="w-10 text-center border border-stone-200 rounded-lg py-1"
                    />
                    <input
                      type="text"
                      value={mod.title}
                      onChange={(e) => {
                        const copy = [...modules];
                        copy[idx].title = e.target.value;
                        setModules(copy);
                      }}
                      className="font-bold text-sm border border-stone-200 rounded-lg px-2.5 py-1"
                    />
                    <span className="text-[11px] font-mono text-slate-400">({mod.slug})</span>
                  </div>

                  <button
                    onClick={() => savePrompt(mod)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                </div>

                {mod.slug !== 'morning' && (
                  <textarea
                    rows={3}
                    value={mod.system_prompt}
                    onChange={(e) => {
                      const copy = [...modules];
                      copy[idx].system_prompt = e.target.value;
                      setModules(copy);
                    }}
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed"
                  />
                )}
              </div>
            ))}

            {/* Add New Plug-and-Play Assistant */}
            <form onSubmit={addNewModule} className="bg-amber-50/70 rounded-2xl p-4 border border-amber-200 space-y-3">
              <h3 className="font-bold text-sm text-amber-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> नया Assistant जोड़ें (Plug & Play)
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Slug (e.g. ayurveda)"
                  value={newMod.slug}
                  onChange={(e) => setNewMod({ ...newMod, slug: e.target.value })}
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs"
                  required
                />
                <input
                  type="text"
                  placeholder="Title (e.g. Ayurveda)"
                  value={newMod.title}
                  onChange={(e) => setNewMod({ ...newMod, title: e.target.value })}
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs"
                  required
                />
                <input
                  type="text"
                  placeholder="Emoji (🌿)"
                  value={newMod.icon}
                  onChange={(e) => setNewMod({ ...newMod, icon: e.target.value })}
                  className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-center"
                />
              </div>
              <textarea
                rows={2}
                placeholder="System Prompt likhein..."
                value={newMod.system_prompt}
                onChange={(e) => setNewMod({ ...newMod, system_prompt: e.target.value })}
                className="w-full rounded-xl border border-amber-200 bg-white p-2.5 text-xs"
                required
              />
              <button type="submit" className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold">
                Add Assistant
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: UPLOAD PDF / VIDEO TRANSCRIPT TO VECTOR DB */}
        {tab === 'knowledge' && (
          <form onSubmit={handleEmbedUpload} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
            <h2 className="font-bold text-base text-slate-800">
              PDF या Video Notes से Vector Embedding जोड़ें
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">किस Assistant के लिए?</label>
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm bg-stone-50"
                >
                  {modules
                    .filter((m) => m.slug !== 'morning')
                    .map((m) => (
                      <option key={m.slug} value={m.slug}>
                        {m.icon} {m.title}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">स्रोत का नाम (Source Name)</label>
                <input
                  type="text"
                  placeholder="जैसे: Vastu Complete Guide PDF"
                  value={sourceTitle}
                  onChange={(e) => setSourceTitle(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                विकल्प 1: PDF फाइल चुनें (Browser me automatic chunk hogi)
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-amber-100 file:text-amber-800 file:font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                विकल्प 2: Video Transcript / Hindi Notes सीधे पेस्ट करें
              </label>
              <textarea
                rows={4}
                placeholder="11 minute video ka Hindi transcript ya vishesh notes yahan paste karein..."
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                className="w-full rounded-xl border border-stone-300 p-3 text-xs"
              />
            </div>

            {uploading && (
              <div className="space-y-1.5">
                <div className="w-full bg-stone-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-orange-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Embedding और Supabase में सेव हो रहा है: {uploadProgress}% (कृपया टैब बंद न करें)
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || (!pdfFile && !manualText.trim())}
              className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{uploading ? 'Processing...' : 'Embed & Save to Knowledge Base'}</span>
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
