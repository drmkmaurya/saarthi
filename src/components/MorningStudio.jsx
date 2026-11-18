'use client';
import { useState, useEffect, useRef } from 'react';
import { Download, Image as ImageIcon, Share2, Save, Check, MapPin } from 'lucide-react';

const DEFAULT_MESSAGES = {
  1: 'सुप्रभात! 🌅 आपका आज का दिन शुभ, मंगलमय और खुशियों से भरा हो।',
  2: 'Good Morning! ☀️ नई सुबह, नई उम्मीदें और ढेर सारी खुशियाँ आपके नाम।',
  3: 'नमस्कार एवं सुप्रभात 🙏 ईश्वर से प्रार्थना है कि आपका आज का दिन सफल और स्वस्थ रहे।',
};

const QUOTES = [
  ['हरी-भरी खेतों पर सुबह की', 'सुनहरी धूप,', 'मिट्टी की सौंधी खुशबू', 'मन को ताज़ा कर देती है।'],
  ['नई सुबह की पहली किरण,', 'आपके जीवन में सुख, शांति', 'और उत्तम स्वास्थ्य की', 'नई ऊर्जा भर दे।'],
  ['उम्मीदों से भरी यह प्यारी सुबह,', 'आपके हर सपने को', 'सच करने की नई ताकत', 'और मुस्कान दे जाती है।'],
  ['ओस की बूंदों सी पावन हो', 'आपकी हर सुबह,', 'खुशियों की महक से', 'महकता रहे आपका जीवन।'],
];

export default function MorningStudio({ showSettingsModal, onCloseSettingsModal }) {
  const [weather, setWeather] = useState({ temp: 22, condition: 'Clear Morning', emoji: '🌅' });
  const [cardUrl, setCardUrl] = useState('');
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [authorName, setAuthorName] = useState('महेंद्र कुमार मौर्या');
  const [authorTitle, setAuthorTitle] = useState('Wellness Advisor');
  const [savedNotice, setSavedNotice] = useState(false);
  const canvasRef = useRef(null);

  const getHindiDate = () =>
    new Date().toLocaleDateString('hi-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  useEffect(() => {
    const savedMsgs = JSON.parse(localStorage.getItem('gm_app_messages_v2') || 'null');
    if (savedMsgs) setMessages(savedMsgs);

    const savedSettings = JSON.parse(localStorage.getItem('gm_app_settings_v2') || 'null');
    if (savedSettings) {
      if (savedSettings.authorName) setAuthorName(savedSettings.authorName);
      if (savedSettings.authorTitle) setAuthorTitle(savedSettings.authorTitle);
    }

    fetch('https://api.open-meteo.com/v1/forecast?latitude=25.7464&longitude=82.6837&current_weather=true')
      .then((r) => r.json())
      .then((data) => {
        if (data?.current_weather) {
          const t = Math.round(data.current_weather.temperature);
          setWeather({
            temp: t,
            condition: t <= 18 ? 'Cool Winter Morning' : 'Pleasant Morning',
            emoji: t <= 18 ? '❄️' : '🌅',
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    generateCard();
  }, [weather, authorName, authorTitle]);

  const generateCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 1080, H = 1920;
    const lines = QUOTES[Math.floor(Math.random() * QUOTES.length)];

    // Sky & Sunrise Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.56);
    sky.addColorStop(0, '#FCD34D');
    sky.addColorStop(0.5, '#FEF3C7');
    sky.addColorStop(1, '#D9F99D');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sun Glow
    const sun = ctx.createRadialGradient(830, 380, 25, 830, 380, 580);
    sun.addColorStop(0, '#FFFFFF');
    sun.addColorStop(0.25, 'rgba(253,224,71,0.85)');
    sun.addColorStop(1, 'rgba(251,191,36,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H * 0.7);

    // Green Fields
    const field = ctx.createLinearGradient(0, 600, 0, H);
    field.addColorStop(0, '#84A98C');
    field.addColorStop(0.4, '#3F6212');
    field.addColorStop(1, '#1A2E05');
    ctx.fillStyle = field;
    ctx.fillRect(0, 600, W, H - 600);

    // Center Soft Mist Card
    const mist = ctx.createRadialGradient(W / 2, 1180, 140, W / 2, 1220, 680);
    mist.addColorStop(0, 'rgba(255,253,245,0.96)');
    mist.addColorStop(0.7, 'rgba(255,253,245,0.86)');
    mist.addColorStop(1, 'rgba(255,253,245,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 660, W, 1160);

    // Header Title + Date Pill
    ctx.textAlign = 'center';
    ctx.fillStyle = '#78350F';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('सुप्रभात', W / 2, 120);

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 340, 150, 680, 58, 29);
    ctx.fill();

    ctx.fillStyle = '#92400E';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`📅 ${getHindiDate()}  •  ${weather.emoji} ${weather.temp}°C`, W / 2, 188);

    // Quote Text
    ctx.fillStyle = '#1C1917';
    ctx.font = 'bold 54px sans-serif';
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 970 + i * 86));

    // Signature
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText(authorName, W / 2, 1525);
    ctx.fillStyle = '#57534E';
    ctx.font = '600 32px sans-serif';
    ctx.fillText(authorTitle, W / 2, 1585);

    setCardUrl(canvas.toDataURL('image/png'));
  };

  const handleMessageChange = (idx, val) => {
    const updated = { ...messages, [idx]: val };
    setMessages(updated);
    localStorage.setItem('gm_app_messages_v2', JSON.stringify(updated));
  };

  const shareCardAndMessage = async (idx) => {
    const text = messages[idx] || '';
    if (cardUrl && navigator.canShare) {
      try {
        const blob = await (await fetch(cardUrl)).blob();
        const file = new File([blob], 'Suprabhat_Card.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      } catch {}
    }
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const saveCardSettings = () => {
    localStorage.setItem('gm_app_settings_v2', JSON.stringify({ authorName, authorTitle }));
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
    if (onCloseSettingsModal) onCloseSettingsModal();
  };

  return (
    <div className="max-w-3xl mx-auto px-3.5 py-4 space-y-5 pb-12">
      {/* Jaunpur Weather Bar */}
      <div className="bg-white rounded-2xl px-4 py-3 border border-amber-200/70 shadow-xs flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-slate-700">
          <MapPin className="w-4 h-4 text-rose-500" />
          Jaunpur, UP: <strong>{weather.temp}°C</strong> ({weather.emoji} {weather.condition})
        </span>
        <button
          onClick={generateCard}
          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold flex items-center gap-1.5"
        >
          <ImageIcon className="w-3.5 h-3.5" /> New Card
        </button>
      </div>

      {/* 9:16 Card Preview */}
      <div className="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-xs text-center space-y-3">
        {cardUrl && (
          <img
            src={cardUrl}
            alt="Suprabhat Card"
            className="w-full max-w-[300px] mx-auto aspect-[9/16] rounded-2xl object-cover border border-stone-200 shadow-sm"
          />
        )}
        <a
          href={cardUrl}
          download="Suprabhat_Jaunpur.png"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5" /> Save Image
        </a>
      </div>

      {/* 3 WhatsApp Message Templates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {[
          { id: 1, label: '1 • Family' },
          { id: 2, label: '2 • Friends' },
          { id: 3, label: '3 • VIP / Work' },
        ].map((t) => (
          <div key={t.id} className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-2.5">
            <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800">
              {t.label}
            </span>
            <textarea
              rows={3}
              value={messages[t.id] || ''}
              onChange={(e) => handleMessageChange(t.id, e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <button
              onClick={() => shareCardAndMessage(t.id)}
              className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Share2 className="w-4 h-4" /> WhatsApp Share (Card + Text)
            </button>
          </div>
        ))}
      </div>

      <canvas ref={canvasRef} width={1080} height={1920} className="hidden" />

      {/* Card Signature Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-800 text-base">Morning Card Signature</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Card Name</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Designation</label>
                <input
                  type="text"
                  value={authorTitle}
                  onChange={(e) => setAuthorTitle(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCloseSettingsModal}
                className="px-4 py-2 rounded-xl bg-stone-100 text-xs font-semibold"
              >
                Close
              </button>
              <button
                onClick={saveCardSettings}
                className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold flex items-center gap-1"
              >
                {savedNotice ? <><Check className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
