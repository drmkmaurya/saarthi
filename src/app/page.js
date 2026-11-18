'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import HeaderDrawer from '@/components/HeaderDrawer';
import ChatAssistant from '@/components/ChatAssistant';
import MorningStudio from '@/components/MorningStudio';
import { Loader2, Clock, ShieldAlert, LogOut } from 'lucide-react';

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [modules, setModules] = useState([]);
  const [activeModule, setActiveModule] = useState('');
  const [loading, setLoading] = useState(true);
  const [morningSettingsOpen, setMorningSettingsOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadUserData(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadUserData(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    setLoading(true);
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    setProfile(prof);

    if (prof?.status === 'approved') {
      const { data: mods } = await supabase
        .from('assistants_config')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const allowed = (mods || []).filter((m) => prof.allowed_modules?.includes(m.slug));
      setModules(allowed);

      const savedTab = localStorage.getItem('saarthi_last_tab');
      if (savedTab && allowed.some((m) => m.slug === savedTab)) {
        setActiveModule(savedTab);
      } else if (allowed.length > 0) {
        setActiveModule(allowed[0].slug);
      }
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSelectModule = (slug) => {
    setActiveModule(slug);
    localStorage.setItem('saarthi_last_tab', slug);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <p className="text-sm font-medium">सारथी लोड हो रहा है...</p>
      </div>
    );
  }

  // 1. Not Logged In -> Google Sign In Screen
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-amber-50 via-stone-50 to-orange-50">
        <div className="bg-white max-w-sm w-full rounded-3xl p-7 shadow-xl border border-amber-200/60 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 text-white text-3xl flex items-center justify-center shadow-md">
            🌅
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">सारथी (Saarthi)</h1>
            <p className="text-xs text-slate-500 mt-1">
              एक्यूप्रेशर, वास्तु शास्त्र एवं सुप्रभात सहायक
            </p>
          </div>
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-md transition"
          >
            <img src="https://www.google.com/favicon.ico" alt="G" className="w-4 h-4" />
            <span>Google से लॉगिन करें</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Pending or Blocked Approval Screen
  if (profile?.status !== 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-stone-50">
        <div className="bg-white max-w-sm w-full rounded-3xl p-7 shadow-lg border border-stone-200 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            {profile?.status === 'blocked' ? <ShieldAlert className="w-7 h-7 text-rose-600" /> : <Clock className="w-7 h-7" />}
          </div>
          <h2 className="text-lg font-bold text-slate-800">
            {profile?.status === 'blocked' ? 'अकाउंट ब्लॉक किया गया है' : 'एडमिन अप्रूवल प्रतीक्षारत'}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            नमस्ते <strong>{profile?.full_name}</strong> ({profile?.email}), आपका लॉगिन सफलतापूर्वक दर्ज हो गया है। एडमिन द्वारा अनुमति मिलने के बाद ही आप अंदर प्रवेश कर सकेंगे।
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" /> दूसरे अकाउंट से लॉगिन करें
          </button>
        </div>
      </div>
    );
  }

  const currentModObj = modules.find((m) => m.slug === activeModule);

  // 3. Approved User Dashboard
  return (
    <div className="min-h-screen bg-stone-50">
      <HeaderDrawer
        profile={profile}
        modules={modules}
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        onLogout={handleLogout}
        onOpenMorningSettings={() => {
          setActiveModule('morning');
          setMorningSettingsOpen(true);
        }}
      />

      {activeModule === 'morning' ? (
        <MorningStudio
          showSettingsModal={morningSettingsOpen}
          onCloseSettingsModal={() => setMorningSettingsOpen(false)}
        />
      ) : currentModObj ? (
        <ChatAssistant userId={profile.id} moduleConfig={currentModObj} />
      ) : (
        <div className="p-8 text-center text-sm text-slate-500">
          कोई मॉड्यूल सक्रिय नहीं है।
        </div>
      )}
    </div>
  );
}
