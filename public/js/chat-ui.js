let activeChatSlug = '';
let currentSourceMode = 'hybrid';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getLocalChats(slug) {
  const key = `saarthi_chats_${currentProfile.id}_${slug}`;
  const raw = JSON.parse(localStorage.getItem(key) || '[]');
  const now = Date.now();
  const valid = raw.filter(c => (now - new Date(c.created_at).getTime()) < THIRTY_DAYS_MS);
  if (valid.length !== raw.length) localStorage.setItem(key, JSON.stringify(valid));
  return valid;
}

async function syncChats(slug) {
  const local = getLocalChats(slug);
  if (local.length > 0) return local;

  const { data } = await sbClient
    .from('chat_logs')
    .select('id, user_query, ai_response, created_at')
    .eq('user_id', currentProfile.id)
    .eq('module_slug', slug)
    .order('created_at', { ascending: true });

  if (data && data.length > 0) {
    localStorage.setItem(`saarthi_chats_${currentProfile.id}_${slug}`, JSON.stringify(data));
    return data;
  }
  return [];
}

window.openWhatsAppChatUI = async function (modObj) {
  activeChatSlug = modObj.slug;
  const meta = (window.SAARTHI_MODULES && window.SAARTHI_MODULES[modObj.slug]) || {
    subtitle: 'AI सहायक • सक्रिय',
    welcomeMsg: `प्रणाम! 🙏 ${modObj.title} से जुड़ा कोई भी प्रश्न पूछें।`,
    suggestions: []
  };

  document.getElementById('modHeaderSub').innerHTML = `
    <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block"></span>
    <span>${meta.subtitle}</span>
  `;

  const chats = await syncChats(modObj.slug);
  const box = document.getElementById('chatContainer');

  box.innerHTML = `
    <!-- Source Mode Bar (Just like My Assistant screenshot) -->
    <div class="bg-[#064c44] px-3 py-1.5 flex items-center justify-between gap-2 text-xs shrink-0">
      <span class="text-emerald-100 font-semibold whitespace-nowrap">स्रोत मोड:</span>
      <select id="sourceModeSelect" onchange="currentSourceMode = this.value"
        class="flex-1 bg-white text-slate-800 font-semibold rounded-lg px-2.5 py-1 text-xs focus:outline-none">
        <option value="hybrid" ${currentSourceMode === 'hybrid' ? 'selected' : ''}>🌐 ग्रंथ + इंटरनेट (संपूर्ण उत्तर)</option>
        <option value="book_only" ${currentSourceMode === 'book_only' ? 'selected' : ''}>📚 केवल अपलोड किए गए ग्रंथ</option>
      </select>
    </div>

    <!-- WhatsApp Beige Dotted Canvas -->
    <div id="messagesList" class="wa-canvas flex-1 overflow-y-auto px-3 py-3.5 space-y-3">
      <div class="text-center">
        <span class="inline-block bg-white/90 text-slate-600 text-[10px] font-semibold px-3 py-1 rounded-lg shadow-2xs">आज</span>
      </div>

      <!-- Quick Suggestion Chips -->
      ${meta.suggestions?.length ? `
        <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          ${meta.suggestions.map(s => `
            <button onclick="sendChatQuery('${s.replace(/'/g, "\\'")}')"
              class="shrink-0 bg-white hover:bg-emerald-50 text-[#075E54] border border-emerald-200/80 text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-2xs transition">
              ✨ ${s}
            </button>
          `).join('')}
        </div>
      ` : ''}

      <!-- Initial Assistant Greeting Bubble -->
      <div class="flex justify-start">
        <div class="bg-white text-slate-800 px-3.5 py-2.5 rounded-2xl rounded-tl-xs max-w-[88%] shadow-xs chat-dynamic-text">
          <p class="text-[11px] font-bold text-[#075E54] mb-1">${modObj.title} AI</p>
          <p class="leading-relaxed">${meta.welcomeMsg}</p>
        </div>
      </div>

      <!-- Saved Chat Bubbles -->
      ${chats.map(c => buildWaBubble(c)).join('')}
    </div>

    <!-- Bottom WhatsApp Input Bar -->
    <form onsubmit="event.preventDefault(); sendChatQuery();" class="bg-[#F0F2F5] px-2.5 py-2 flex items-center gap-2 border-t border-slate-200 shrink-0">
      <input id="chatInput" type="text" placeholder="लक्षण या प्रश्न यहाँ लिखें..."
        class="flex-1 bg-white rounded-full px-4 py-2.5 text-sm text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#075E54]" />
      <button type="submit" class="w-10 h-10 rounded-full bg-[#075E54] hover:bg-[#064c44] active:scale-95 text-white flex items-center justify-center shadow-sm shrink-0">
        ➤
      </button>
    </form>
  `;

  applyCurrentFontSize();
  scrollChatBottom();
};

function formatRichText(raw) {
  let safe = String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  safe = safe.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  return safe;
}

function buildWaBubble(c) {
  const safeId = 'msg_' + String(c.id).replace(/[^a-zA-Z0-9]/g, '');
  const timeStr = new Date(c.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `
    <div class="space-y-2">
      <!-- User Green Bubble -->
      <div class="flex justify-end">
        <div class="bg-[#D9FDD3] text-slate-800 px-3.5 py-2 rounded-2xl rounded-tr-xs max-w-[84%] shadow-xs chat-dynamic-text">
          <p class="leading-relaxed">${formatRichText(c.user_query)}</p>
          <p class="text-[9px] text-slate-500 text-right mt-0.5">${timeStr} ✓✓</p>
        </div>
      </div>

      <!-- Assistant White Bubble -->
      <div class="flex justify-start">
        <div class="bg-white text-slate-800 px-3.5 py-3 rounded-2xl rounded-tl-xs max-w-[94%] shadow-xs space-y-2 chat-dynamic-text">
          <div id="${safeId}" class="leading-relaxed whitespace-pre-wrap">${formatRichText(c.ai_response)}</div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-100">
            <div class="flex items-center gap-2">
              <button onclick="copyMsg('${safeId}', this)" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700">📋 कॉपी करें</button>
              <button onclick="shareWaMsg('${safeId}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#075E54]">📲 WhatsApp</button>
            </div>
            <span class="text-[9px] text-slate-400">${timeStr}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function sendChatQuery(presetText) {
  const input = document.getElementById('chatInput');
  const query = (presetText || input?.value || '').trim();
  if (!query) return;

  if (input) input.value = '';
  const list = document.getElementById('messagesList');
  const loaderId = 'loader_' + Date.now();

  list.insertAdjacentHTML('beforeend', `
    <div class="flex justify-end">
      <div class="bg-[#D9FDD3] text-slate-800 px-3.5 py-2 rounded-2xl rounded-tr-xs max-w-[84%] shadow-xs chat-dynamic-text">
        <p>${formatRichText(query)}</p>
      </div>
    </div>
    <div id="${loaderId}" class="flex justify-start">
      <div class="bg-white px-4 py-2.5 rounded-2xl rounded-tl-xs shadow-xs text-xs text-slate-500 flex items-center gap-2">
        <span class="w-3.5 h-3.5 border-2 border-[#075E54] border-t-transparent rounded-full animate-spin"></span>
        <span>सहायक उत्तर तैयार कर रहा है...</span>
      </div>
    </div>
  `);
  applyCurrentFontSize();
  scrollChatBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentProfile.id,
        moduleSlug: activeChatSlug,
        query,
        sourceMode: currentSourceMode
      })
    });
    const data = await res.json();
    document.getElementById(loaderId)?.remove();

    if (!res.ok) throw new Error(data.detail || `Server Error (${res.status})`);

    const entry = {
      id: data.chatId || Date.now().toString(),
      user_query: query,
      ai_response: data.answer,
      created_at: new Date().toISOString()
    };

    const key = `saarthi_chats_${currentProfile.id}_${activeChatSlug}`;
    localStorage.setItem(key, JSON.stringify([...getLocalChats(activeChatSlug), entry]));

    list.insertAdjacentHTML('beforeend', buildWaBubble(entry));
    applyCurrentFontSize();
    scrollChatBottom();
  } catch (err) {
    document.getElementById(loaderId)?.remove();
    list.insertAdjacentHTML('beforeend', `
      <div class="flex justify-start">
        <div class="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-3 rounded-2xl max-w-[90%] text-xs space-y-2 shadow-xs">
          <p class="font-bold">⚠️ त्रुटि: ${err.message}</p>
          <button onclick="sendChatQuery('${query.replace(/'/g, "\\'")}')"
            class="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold">🔄 पुनः प्रयास करें</button>
        </div>
      </div>
    `);
    scrollChatBottom();
  }
}

function copyMsg(elId, btn) {
  const text = document.getElementById(elId)?.innerText || '';
  navigator.clipboard.writeText(text);
  btn.innerText = '✅ कॉपी हो गया';
  setTimeout(() => (btn.innerText = '📋 कॉपी करें'), 1500);
}

function shareWaMsg(elId) {
  const text = document.getElementById(elId)?.innerText || '';
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function scrollChatBottom() {
  const list = document.getElementById('messagesList');
  if (list) list.scrollTop = list.scrollHeight;
}
