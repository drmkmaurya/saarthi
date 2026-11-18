let sbClient = null;
let currentProfile = null;
let allModules = [];
let currentFontSize = Number(localStorage.getItem('saarthi_font_size')) || 15;

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
    showToast('Config Error: ' + e.message);
  }
});

function showScreen(id) {
  ['loadingScreen', 'loginScreen', 'pendingScreen', 'mainApp'].forEach(s => {
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
}

function showToast(msg) {
  const box = document.getElementById('toastBox');
  document.getElementById('toastText').innerText = msg;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 4500);
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
  const res = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`);
  const { profile: prof, modules: mods } = await res.json();
  currentProfile = prof;

  if (!prof || prof.status !== 'approved') {
    document.getElementById('pendingTitle').innerText =
      prof?.status === 'blocked' ? 'अकाउंट ब्लॉक किया गया है' : 'एडमिन अप्रूवल प्रतीक्षारत';
    document.getElementById('pendingDesc').innerText =
      `नमस्ते ${prof?.full_name || ''} (${prof?.email || ''}), एडमिन द्वारा अनुमति मिलने के बाद ही आप प्रवेश कर सकेंगे।`;
    showScreen('pendingScreen');
    return;
  }

  document.getElementById('welcomeGreeting').innerText = `प्रणाम ${prof.full_name || ''} 🙏`;
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

  allModules = (mods || []).filter(m => (prof.allowed_modules || []).includes(m.slug));
  renderHomeCards();
  applyCurrentFontSize();
  showScreen('mainApp');
  goHome();
}

function renderHomeCards() {
  const grid = document.getElementById('homeCardsGrid');
  grid.innerHTML = allModules.map(m => {
    const meta = (window.SAARTHI_MODULES && window.SAARTHI_MODULES[m.slug]) || {};
    const desc = meta.cardDesc || (m.slug === 'morning'
      ? 'जौनपुर मौसम, 9:16 सुप्रभात कार्ड और 3 WhatsApp संदेश टेम्पलेट्स'
      : `${m.title} से जुड़े प्रश्नों के लिए विशेष AI सहायक`);
    const badge = meta.badge || (m.slug === 'morning' ? 'डेली स्टूडियो' : 'AI सहायक');

    return `
      <button onclick="openModuleCard('${m.slug}')"
        class="text-left bg-white hover:bg-emerald-50/40 active:scale-[0.99] rounded-2xl p-4 border border-slate-200/90 shadow-xs transition flex items-center justify-between gap-3.5">
        <div class="flex items-start gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-2xl shrink-0">
            ${m.icon || '🌿'}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-slate-800 text-base">${m.title}</h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100/80 text-[#075E54]">${badge}</span>
            </div>
            <p class="text-xs text-slate-500 leading-relaxed">${desc}</p>
          </div>
        </div>
        <span class="text-slate-400 font-bold text-lg">›</span>
      </button>
    `;
  }).join('');
}

function goHome() {
  document.getElementById('moduleView').classList.add('hidden');
  document.getElementById('homeView').classList.remove('hidden');
}

async function openModuleCard(slug) {
  const modObj = allModules.find(m => m.slug === slug);
  if (!modObj) return;

  document.getElementById('homeView').classList.add('hidden');
  document.getElementById('moduleView').classList.remove('hidden');

  document.getElementById('modHeaderIcon').innerText = modObj.icon || '🌿';
  document.getElementById('modHeaderTitle').innerText = modObj.title;

  const chatBox = document.getElementById('chatContainer');
  const morningBox = document.getElementById('morningContainer');

  if (slug === 'morning') {
    chatBox.classList.add('hidden');
    morningBox.classList.remove('hidden');
    document.getElementById('modHeaderSub').innerHTML = `<span>जौनपुर मौसम • 9:16 WhatsApp कार्ड</span>`;
    if (window.initMorningStudio) window.initMorningStudio();
  } else {
    morningBox.classList.add('hidden');
    chatBox.classList.remove('hidden');
    if (window.openWhatsAppChatUI) await window.openWhatsAppChatUI(modObj);
  }
}

function changeFontSize(delta) {
  currentFontSize = Math.min(22, Math.max(12, currentFontSize + delta));
  localStorage.setItem('saarthi_font_size', currentFontSize);
  applyCurrentFontSize();
}

function applyCurrentFontSize() {
  const lbl = document.getElementById('fontSizeLabel');
  const dLbl = document.getElementById('drawerFontVal');
  if (lbl) lbl.innerText = currentFontSize;
  if (dLbl) dLbl.innerText = `${currentFontSize} px`;

  document.querySelectorAll('.chat-dynamic-text').forEach(el => {
    el.style.fontSize = `${currentFontSize}px`;
  });
}

function clearLocalChatCache() {
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('saarthi_chats_')) localStorage.removeItem(k);
  });
  toggleDrawer(false);
  showToast('✅ इस डिवाइस की लोकल चैट हिस्ट्री साफ़ हो गई है।');
}

function toggleDrawer(open) {
  document.getElementById('drawerOverlay').classList.toggle('hidden', !open);
}

function toggleProfileMenu() {
  document.getElementById('profileDropdown').classList.toggle('hidden');
}

function openMorningSettings() {
  toggleDrawer(false);
  openModuleCard('morning').then(() => {
    document.getElementById('morningSettingsModal')?.classList.remove('hidden');
  });
}
