const DEFAULT_GM_MSGS = {
  1: 'सुप्रभात! 🌅 आपका आज का दिन शुभ, मंगलमय और खुशियों से भरा हो।',
  2: 'Good Morning! ☀️ नई सुबह, नई उम्मीदें और ढेर सारी खुशियाँ आपके नाम।',
  3: 'नमस्कार एवं सुप्रभात 🙏 ईश्वर से प्रार्थना है कि आपका आज का दिन सफल और स्वस्थ रहे।'
};

const GM_QUOTES = [
  ['हरी-भरी खेतों पर सुबह की', 'सुनहरी धूप,', 'मिट्टी की सौंधी खुशबू', 'मन को ताज़ा कर देती है।'],
  ['नई सुबह की पहली किरण,', 'आपके जीवन में सुख, शांति', 'और उत्तम स्वास्थ्य की', 'नई ऊर्जा भर दे।'],
  ['उम्मीदों से भरी यह प्यारी सुबह,', 'आपके हर सपने को', 'सच करने की नई ताकत', 'और मुस्कान दे जाती है।'],
  ['ओस की बूंदों सी पावन हो', 'आपकी हर सुबह,', 'खुशियों की महक से', 'महकता रहे आपका जीवन।']
];

let gmWeather = { temp: 22, condition: 'Pleasant Morning', emoji: '🌅' };
let gmCardDataUrl = '';

window.initMorningStudio = async function () {
  const box = document.getElementById('morningContainer');
  const msgs = JSON.parse(localStorage.getItem('gm_app_messages_v2') || 'null') || DEFAULT_GM_MSGS;
  const settings = JSON.parse(localStorage.getItem('gm_app_settings_v2') || 'null') || {
    authorName: 'महेंद्र कुमार मौर्या',
    authorTitle: 'Naturopathy & Acupressure Expert'
  };

  box.innerHTML = `
    <!-- Jaunpur Weather Bar -->
    <div class="bg-white rounded-2xl px-4 py-3 border border-amber-200/70 shadow-xs flex items-center justify-between text-xs">
      <span id="gmWeatherText" class="font-medium text-slate-700">📍 Jaunpur, UP: <strong>${gmWeather.temp}°C</strong> (${gmWeather.emoji})</span>
      <button onclick="drawSuprabhatCard()" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold">🖼️ New Card</button>
    </div>

    <!-- 9:16 Card Preview -->
    <div class="bg-white rounded-3xl p-4 border border-stone-200/80 shadow-xs text-center space-y-3">
      <img id="gmCardPreview" class="w-full max-w-[290px] mx-auto aspect-[9/16] rounded-2xl object-cover border border-stone-200 shadow-sm" />
      <div>
        <a id="gmDownloadBtn" download="Suprabhat_Jaunpur.png" class="inline-block px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 text-xs font-semibold cursor-pointer">⬇️ Save Image</a>
      </div>
    </div>

    <!-- 3 WhatsApp Templates -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
      ${[
        { id: 1, label: '1 • Family' },
        { id: 2, label: '2 • Friends' },
        { id: 3, label: '3 • VIP / Work' }
      ].map(t => `
        <div class="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-xs space-y-2.5">
          <span class="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800">${t.label}</span>
          <textarea id="gmMsg_${t.id}" rows="3" oninput="saveGmMsg(${t.id}, this.value)"
            class="w-full rounded-xl border border-stone-200 bg-stone-50 p-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none">${msgs[t.id] || ''}</textarea>
          <button onclick="shareGmCard(${t.id})" class="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-xs shadow-xs">📲 WhatsApp Share (Card + Text)</button>
        </div>
      `).join('')}
    </div>

    <canvas id="gmCanvas" width="1080" height="1920" class="hidden"></canvas>

    <!-- Signature Settings Modal -->
    <div id="morningSettingsModal" class="hidden fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
        <h3 class="font-bold text-slate-800 text-base">Morning Card Signature</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Card Name</label>
            <input id="gmAuthorName" type="text" value="${settings.authorName}" class="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1">Designation</label>
            <input id="gmAuthorTitle" type="text" value="${settings.authorTitle}" class="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button onclick="document.getElementById('morningSettingsModal').classList.add('hidden')" class="px-4 py-2 rounded-xl bg-stone-100 text-xs font-semibold">Close</button>
          <button onclick="saveGmSettings()" class="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold">💾 Save</button>
        </div>
      </div>
    </div>
  `;

  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=25.7464&longitude=82.6837&current_weather=true');
    const d = await r.json();
    if (d?.current_weather) {
      const t = Math.round(d.current_weather.temperature);
      gmWeather = { temp: t, condition: t <= 18 ? 'Cool Morning' : 'Pleasant Morning', emoji: t <= 18 ? '❄️' : '🌅' };
      const wEl = document.getElementById('gmWeatherText');
      if (wEl) wEl.innerHTML = `📍 Jaunpur, UP: <strong>${t}°C</strong> (${gmWeather.emoji} ${gmWeather.condition})`;
    }
  } catch {}

  drawSuprabhatCard();
};

function drawSuprabhatCard() {
  const canvas = document.getElementById('gmCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 1080, H = 1920;
  const lines = GM_QUOTES[Math.floor(Math.random() * GM_QUOTES.length)];
  const settings = JSON.parse(localStorage.getItem('gm_app_settings_v2') || 'null') || {
    authorName: 'महेंद्र कुमार मौर्या',
    authorTitle: 'Naturopathy & Acupressure Expert'
  };

  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.56);
  sky.addColorStop(0, '#FCD34D');
  sky.addColorStop(0.5, '#FEF3C7');
  sky.addColorStop(1, '#D9F99D');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const sun = ctx.createRadialGradient(830, 380, 25, 830, 380, 580);
  sun.addColorStop(0, '#FFFFFF');
  sun.addColorStop(0.25, 'rgba(253,224,71,0.85)');
  sun.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H * 0.7);

  const field = ctx.createLinearGradient(0, 600, 0, H);
  field.addColorStop(0, '#84A98C');
  field.addColorStop(0.4, '#3F6212');
  field.addColorStop(1, '#1A2E05');
  ctx.fillStyle = field;
  ctx.fillRect(0, 600, W, H - 600);

  const mist = ctx.createRadialGradient(W / 2, 1180, 140, W / 2, 1220, 680);
  mist.addColorStop(0, 'rgba(255,253,245,0.96)');
  mist.addColorStop(0.7, 'rgba(255,253,245,0.86)');
  mist.addColorStop(1, 'rgba(255,253,245,0)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, 660, W, 1160);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#78350F';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('सुप्रभात', W / 2, 120);

  const hindiDate = new Date().toLocaleDateString('hi-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.beginPath();
  ctx.roundRect(W / 2 - 340, 150, 680, 58, 29);
  ctx.fill();

  ctx.fillStyle = '#92400E';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`📅 ${hindiDate}  •  ${gmWeather.emoji} ${gmWeather.temp}°C`, W / 2, 188);

  ctx.fillStyle = '#1C1917';
  ctx.font = 'bold 54px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, 970 + i * 86));

  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(settings.authorName, W / 2, 1525);
  ctx.fillStyle = '#57534E';
  ctx.font = '600 32px sans-serif';
  ctx.fillText(settings.authorTitle, W / 2, 1585);

  gmCardDataUrl = canvas.toDataURL('image/png');
  document.getElementById('gmCardPreview').src = gmCardDataUrl;
  document.getElementById('gmDownloadBtn').href = gmCardDataUrl;
}

function saveGmMsg(id, val) {
  const msgs = JSON.parse(localStorage.getItem('gm_app_messages_v2') || 'null') || { ...DEFAULT_GM_MSGS };
  msgs[id] = val;
  localStorage.setItem('gm_app_messages_v2', JSON.stringify(msgs));
}

function saveGmSettings() {
  const authorName = document.getElementById('gmAuthorName').value.trim();
  const authorTitle = document.getElementById('gmAuthorTitle').value.trim();
  localStorage.setItem('gm_app_settings_v2', JSON.stringify({ authorName, authorTitle }));
  document.getElementById('morningSettingsModal').classList.add('hidden');
  drawSuprabhatCard();
}

async function shareGmCard(id) {
  const text = document.getElementById(`gmMsg_${id}`)?.value || '';
  if (gmCardDataUrl && navigator.canShare) {
    try {
      const blob = await (await fetch(gmCardDataUrl)).blob();
      const file = new File([blob], 'Suprabhat_Card.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch {}
  }
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}