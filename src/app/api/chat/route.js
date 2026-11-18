import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSupabaseAdmin } from '@/lib/supabase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    const { userId, moduleSlug, query } = await req.json();
    if (!userId || !moduleSlug || !query) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Verify User Status & Allowed Modules
    const { data: profile, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('status, allowed_modules')
      .eq('id', userId)
      .single();

    if (profErr || !profile || profile.status !== 'approved') {
      return NextResponse.json({ error: 'Account not approved by Admin.' }, { status: 403 });
    }
    if (!profile.allowed_modules?.includes(moduleSlug)) {
      return NextResponse.json({ error: 'Access denied for this module.' }, { status: 403 });
    }

    // 2. Fetch Dynamic System Prompt from DB
    const { data: modConfig } = await supabaseAdmin
      .from('assistants_config')
      .select('title, system_prompt')
      .eq('slug', moduleSlug)
      .single();

    // 3. Generate Query Embedding (768 dimensions)
    const embedRes = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: query,
    });
    const queryEmbedding = embedRes.embeddings?.[0]?.values;

    // 4. Vector Search in Supabase Knowledge Base
    let contextText = '';
    if (queryEmbedding) {
      const { data: chunks } = await supabaseAdmin.rpc('match_knowledge', {
        query_embedding: queryEmbedding,
        target_module: moduleSlug,
        match_threshold: 0.50,
        match_count: 5,
      });

      if (chunks && chunks.length > 0) {
        contextText = chunks
          .map((c, idx) => `[स्रोत ${idx + 1}: ${c.source_name}]\n${c.content}`)
          .join('\n\n---\n\n');
      }
    }

    // 5. Generate Hindi Response + Smart Guidance Tip via Gemini
    const systemInstruction = `${modConfig?.system_prompt || 'Aap ek sahayak AI hain.'}

महत्वपूर्ण निर्देश:
1. जवाब हमेशा स्पष्ट, सम्मानजनक और सरल हिंदी (Devanagari) में दें।
2. नीचे दिए गए "संदर्भ ज्ञान (Reference Knowledge)" को प्राथमिकता दें। यदि संदर्भ ज्ञान में सटीक जानकारी न हो, तो अपने सामान्य शास्त्रीय/विशेषज्ञ ज्ञान से सुरक्षित और व्यावहारिक उत्तर दें।
3. उत्तर के अंत में एक अलग पैराग्राफ में "💡 बेहतर परिणाम के लिए सुझाव:" लिखकर 1-2 लाइन में बताएं कि अगली बार प्रश्न पूछते समय कौन सी अतिरिक्त जानकारी (जैसे दिशा, समय, या लक्षण) जोड़ने से और भी सटीक उत्तर मिलेगा।`;

    const userPrompt = contextText
      ? `संदर्भ ज्ञान (Reference Knowledge):\n${contextText}\n\nयूजर का प्रश्न: ${query}`
      : `यूजर का प्रश्न: ${query}`;

    const chatRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    const answer = chatRes.text || 'क्षमा करें, अभी उत्तर तैयार नहीं हो सका।';

    // 6. Save to DB (SQL Trigger automatically enforces user's max_db_chats limit)
    const { data: inserted } = await supabaseAdmin
      .from('chat_logs')
      .insert({
        user_id: userId,
        module_slug: moduleSlug,
        user_query: query,
        ai_response: answer,
      })
      .select('id')
      .single();

    return NextResponse.json({ answer, chatId: inserted?.id });
  } catch (err) {
    console.error('Chat API Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
