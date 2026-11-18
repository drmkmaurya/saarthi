let sbClient = null;
let currentProfile = null;
let allModules = [];
let activeSlug = '';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const QUICK_PROMPTS = {
  acupressure: [
    'कमर दर्द के लिए मुख्य पॉइंट्स बताएं',
    'गैस और एसिडिटी का तुरंत उपचार',
    'नींद न आने पर कौन सा पॉइंट दबाएं?'
  ],
  vastu: [
    'मुख्य द्वार दक्षिण दिशा में हो तो बिना तोड़-फोड़ उपाय',
    'घर के मंदिर की सही दिशा और नियम',
    'रसोई घर में रंग और वास्तु संतुलन'
  ]
};

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const cfg = await (await fetch('/api/config')).json();
    sbClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

    const { data: { session } } = await sbClient.auth.getSession();
    if (session?.user) await loadUserDashboard(session.user.id);
    else showScreen('loginScreen');

    sbClient.auth.onAuthStateChange(async (_evt, sess) => {
      if (sess?.user) await loadUserDashboard(sess.user.id);
      else showScreen('loginScreen');
    });
  } catch (e) {
    alert('Config Error: ' + e.message);
  }
});

function showScreen(id) {
  ['loadingScreen', 'loginScreen', 'pendingScreen', 'mainApp'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

async function loginWithGoogle() {
  await sbClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' }
    }
  });
}

async function logoutUser() {
  await sbClient.auth.signOut();
  showScreen('loginScreen');
}

async function loadUserDashboard(userId) {
  const { data: prof } = await sbClient.from('profiles').select('*').eq('id', userId).single();
  currentProfile = prof;

  if (!prof || prof.status !== 'approved') {
    document.getElementById('pendingTitle').innerText =
      prof?.status === 'blocked' ? 'अकाउंट ब्लॉक किया गया है' : 'एडमिन अप्रूवल प्रतीक्षारत';
    document.getElementById('pendingDesc').innerText =
      `नमस्ते ${prof?.full_name || ''} (${prof?.email || ''}), आपका लॉगिन दर्ज हो गया है। एडमिन द्वारा अनुमति मिलने के बाद ही आप प्रवेश कर सकेंगे।`;
    showScreen('pendingScreen');
    return;
  }

  // Fill Header Profile Info
  document.getElementById('userFirstName').innerText = (prof.full_name || 'User').split(' ')[0];
  document.getElementById('menuFullName').innerText = prof.full_name || 'User';
  document.getElementById('menuEmail').innerText = prof.email || '';
  document.getElementById('drawerLimitInfo').innerText = `DB Chat Limit: ${prof.max_db_chats || 10} chats`;

  if (prof.avatar_url) {
    const img = document.getElementById('userAvatar');
    img.src = prof.avatar_url;
    img.classList.remove('hidden');
    document.getElementById('userInitial').classList.add('hidden');
  } else {
    document.getElementById('userInitial').innerText = (prof.full_name?.[0] || 'U').toUpperCase();
  }

  if (prof.role === 'admin') {
    document.getElementById('adminMenuLink').classList.remove('hidden');
  }

  // Load Allowed Modules
  const { data: mods } = await sbClient
    .from('assistants_config')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  allModules = (mods || []).filter(m => (prof.allowed_modules || []).includes(m.slug));
  renderModuleTabs();

  const savedTab = localStorage.getItem('saarthi_last_tab');
  const initialSlug = allModules.some(m => m.slug === savedTab)
    ? savedTab
    : (allModules[0]?.slug || '');

  showScreen('mainApp');
  if (initialSlug) selectModule(initialSlug);
}

function renderModuleTabs() {
  const container = document.getElementById('moduleTabs');
  container.innerHTML = allModules.map(m => `
    <button onclick="selectModule('${m.slug}')" id="tab_${m.slug}"
      class="flex-1 min-w-[105px] py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap bg-white/15 text-white hover:bg-white/25">
      <span>${m.icon || '🤖'}</span>
      <span>${m.title}</span>
    </button>
  `).join('');
}

async function selectModule(slug) {
  activeSlug = slug;
  localStorage.setItem('saarthi_last_tab', slug);

  allModules.forEach(m => {
    const btn = document.getElementById(`tab_${m.slug}`);
    if (!btn) return;
    btn.className = m.slug === slug
      ? 'flex-1 min-w-[105px] py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap bg-white text-orange-600 shadow-sm'
      : 'flex-1 min-w-[105px] py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap bg-white/15 text-white hover:bg-white/25';
  });

  const chatBox = document.getElementById('chatContainer');
  const morningBox = document.getElementById('morningContainer');

  if (slug === 'morning') {
    chatBox.classList.add('hidden');
    morningBox.classList.remove('hidden');
    if (window.initMorningStudio) window.initMorningStudio();
  } else {
    morningBox.classList.add('hidden');
    chatBox.classList.remove('hidden');
    const modObj = allModules.find(m => m.slug === slug);
    await renderUniversalChat(modObj);
  }
}

// --- 30-Day Local Chat Retention + DB Sync ---
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

// --- Common Universal Chat UI Renderer ---
async function renderUniversalChat(modObj) {
  const box = document.getElementById('chatContainer');
  const chats = await syncChats(modObj.slug);
  const suggestions = QUICK_PROMPTS[modObj.slug] || [];

  box.innerHTML = `
    <!-- Assistant Sub-Header -->
    <div class="bg-white/90 border-b border-stone-200 px-4 py-2 flex items-center justify-between text-xs">
      <span class="font-bold text-slate-700 flex items-center gap-1.5">
        <span class="text-base">${modObj.icon || '🤖'}</span>
        <span>${modObj.title} सहायक</span>
      </span>
      <span class="text-[11px] text-slate-400">30-Day Local History</span>
    </div>

    <!-- Messages Scroll Area -->
    <div id="messagesList" class="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
      ${chats.length === 0 ? `
        <div class="bg-white rounded-3xl p-5 border border-stone-200/80 shadow-xs text-center space-y-3 mt-4">
          <div class="text-3xl">${modObj.icon || '🤖'}</div>
          <h2 class="font-bold text-slate-800 text-base">${modObj.title} सहायक में स्वागत है</h2>
          <p class="text-xs text-slate-500">अपना प्रश्न नीचे लिखें या सुझाव चुनें:</p>
          <div class="flex flex-col gap-2 pt-2">
            ${suggestions.map(s => `
              <button onclick="sendChatQuery('${s.replace(/'/g, "\\'")}')"
                class="text-left text-xs bg-amber-50/80 hover:bg-amber-100 text-amber-900 px-3.5 py-2.5 rounded-xl border border-amber-200/60 transition">
                ✨ ${s}
              </button>
            `).join('')}
          </div>
        </div>
      ` : chats.map(c => buildMessageBubble(c)).join('')}
    </div>

    <!-- Bottom Input Bar -->
    <form onsubmit="event.preventDefault(); sendChatQuery();" class="p-3 bg-white border-t border-stone-200 flex items-center gap-2">
      <input id="chatInput" type="text" placeholder="${modObj.title} से जुड़ा प्रश्न पूछें..."
        class="flex-1 bg-stone-100 focus:bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
      <button id="sendBtn" type="submit" class="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-xs">भेजें ➤</button>
    </form>
  `;

  scrollChatBottom();
}

function buildMessageBubble(c) {
  const safeId = 'msg_' + String(c.id).replace(/[^a-zA-Z0-9]/g, '');
  return `
    <div class="space-y-2.5">
      <div class="flex justify-end">
        <div class="bg-orange-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] text-sm shadow-xs">${escapeHtml(c.user_query)}</div>
      </div>
      <div class="flex justify-start">
        <div class="bg-white border border-stone-200/90 text-slate-800 px-4 py-3.5 rounded-2xl rounded-tl-sm max-w-[94%] shadow-xs space-y-3">
          <div id="${safeId}" class="text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(c.ai_response)}</div>
          <div class="flex items-center gap-2 pt-2 border-t border-stone-100">
            <button onclick="copyMsg('${safeId}', this)" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-slate-700">📋 Copy</button>
            <button onclick="shareWaMsg('${safeId}')" class="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700">📲 WhatsApp</button>
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

  // If welcome box is visible, clear it
  if (getLocalChats(activeSlug).length === 0) list.innerHTML = '';

  // Append User Question + Loader
  const loaderId = 'loader_' + Date.now();
  list.insertAdjacentHTML('beforeend', `
    <div class="flex justify-end">
      <div class="bg-orange-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] text-sm">${escapeHtml(query)}</div>
    </div>
    <div id="${loaderId}" class="text-xs text-slate-500 bg-white w-fit px-4 py-3 rounded-2xl border border-stone-200">
      ⏳ ज्ञान भंडार से सटीक उत्तर खोजा जा रहा है...
    </div>
  `);
  scrollChatBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentProfile.id,
        moduleSlug: activeSlug,
        query
      })
    });
    const data = await res.json();
    document.getElementById(loaderId)?.remove();

    if (!res.ok) throw new Error(data.detail || 'Server Error');

    const entry = {
      id: data.chatId || Date.now().toString(),
      user_query: query,
      ai_response: data.answer,
      created_at: new Date().toISOString()
    };

    const key = `saarthi_chats_${currentProfile.id}_${activeSlug}`;
    const updated = [...getLocalChats(activeSlug), entry];
    localStorage.setItem(key, JSON.stringify(updated));

    const modObj = allModules.find(m => m.slug === activeSlug);
    await renderUniversalChat(modObj);
  } catch (err) {
    document.getElementById(loaderId)?.remove();
    alert('उत्तर लाने में समस्या: ' + err.message);
  }
}

function copyMsg(elId, btn) {
  const text = document.getElementById(elId)?.innerText || '';
  navigator.clipboard.writeText(text);
  btn.innerText = '✅ Copied';
  setTimeout(() => (btn.innerText = '📋 Copy'), 1500);
}

function shareWaMsg(elId) {
  const text = document.getElementById(elId)?.innerText || '';
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
}

function scrollChatBottom() {
  const list = document.getElementById('messagesList');
  if (list) list.scrollTop = list.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toggleDrawer(open) {
  document.getElementById('drawerOverlay').classList.toggle('hidden', !open);
}

function toggleProfileMenu() {
  document.getElementById('profileDropdown').classList.toggle('hidden');
}

function openMorningSettings() {
  toggleDrawer(false);
  selectModule('morning').then(() => {
    document.getElementById('morningSettingsModal')?.classList.remove('hidden');
  });
}
