'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, Copy, Share2, Check, Sparkles, Loader2 } from 'lucide-react';
import { syncChatsFromDB, saveLocalChat } from '@/lib/supabase';

const QUICK_PROMPTS = {
  acupressure: [
    'कमर दर्द के लिए मुख्य पॉइंट्स बताएं',
    'गैस और एसिडिटी का तुरंत उपचार',
    'नींद न आने पर कौन सा पॉइंट दबाएं?',
  ],
  vastu: [
    'मुख्य द्वार दक्षिण दिशा में हो तो बिना तोड़-फोड़ उपाय',
    'घर के मंदिर की सही दिशा और नियम',
    'रसोई घर में रंग और वास्तु संतुलन',
  ],
};

export default function ChatAssistant({ userId, moduleConfig }) {
  const [chats, setChats] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (userId && moduleConfig?.slug) {
      syncChatsFromDB(userId, moduleConfig.slug).then(setChats);
    }
  }, [userId, moduleConfig?.slug]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, loading]);

  const handleSend = async (customText) => {
    const textToSend = (customText || query).trim();
    if (!textToSend || loading) return;

    setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          moduleSlug: moduleConfig.slug,
          query: textToSend,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Response error');

      const newEntry = {
        id: data.chatId || Date.now().toString(),
        user_query: textToSend,
        ai_response: data.answer,
        created_at: new Date().toISOString(),
      };

      const updated = saveLocalChat(userId, moduleConfig.slug, newEntry);
      setChats(updated);
    } catch (err) {
      alert('जवाब लाने में समस्या हुई: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const shareWhatsApp = (text) => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const suggestions = QUICK_PROMPTS[moduleConfig?.slug] || [];

  return (
    <div className="flex flex-col h-[calc(100vh-118px)] max-w-3xl mx-auto">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
        {chats.length === 0 && !loading && (
          <div className="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-xs text-center space-y-3 mt-4">
            <div className="text-3xl">{moduleConfig?.icon || '🤖'}</div>
            <h2 className="font-bold text-slate-800 text-base">
              {moduleConfig?.title} सहायक में स्वागत है
            </h2>
            <p className="text-xs text-slate-500">
              अपना प्रश्न नीचे लिखें या नीचे दिए गए सुझावों में से चुनें:
            </p>
            {suggestions.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s)}
                    className="text-left text-xs bg-amber-50/80 hover:bg-amber-100 text-amber-900 px-3.5 py-2.5 rounded-xl border border-amber-200/60 transition flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {chats.map((item) => (
          <div key={item.id} className="space-y-2.5">
            {/* User Question Bubble */}
            <div className="flex justify-end">
              <div className="bg-orange-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] text-sm shadow-xs">
                {item.user_query}
              </div>
            </div>

            {/* AI Response Bubble */}
            <div className="flex justify-start">
              <div className="bg-white border border-stone-200/90 text-slate-800 px-4 py-3.5 rounded-2xl rounded-tl-sm max-w-[94%] shadow-xs space-y-3">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {item.ai_response}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                  <button
                    onClick={() => copyText(item.id, item.ai_response)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-slate-700 flex items-center gap-1"
                  >
                    {copiedId === item.id ? (
                      <><Check className="w-3 h-3 text-emerald-600" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3" /> Copy</>
                    )}
                  </button>
                  <button
                    onClick={() => shareWhatsApp(item.ai_response)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center gap-1"
                  >
                    <Share2 className="w-3 h-3" /> WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white w-fit px-4 py-3 rounded-2xl border border-stone-200 shadow-xs">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            <span>ज्ञान भंडार से सटीक उत्तर खोजा जा रहा है...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Bottom Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3 bg-white border-t border-stone-200 flex items-center gap-2"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${moduleConfig?.title} से जुड़ा प्रश्न पूछें...`}
          className="flex-1 bg-stone-100 focus:bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="p-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white shadow-xs transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
