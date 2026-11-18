import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getSupabaseAdmin } from '@/lib/supabase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    const { adminId, moduleSlug, sourceName, chunks } = await req.json();
    if (!adminId || !moduleSlug || !sourceName || !Array.isArray(chunks)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Verify Admin Role
    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin only' }, { status: 403 });
    }

    const rowsToInsert = [];

    for (const textChunk of chunks) {
      if (!textChunk.trim()) continue;
      const embedRes = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: textChunk,
      });
      const vector = embedRes.embeddings?.[0]?.values;
      if (vector) {
        rowsToInsert.push({
          module_slug: moduleSlug,
          source_name: sourceName,
          content: textChunk,
          embedding: vector,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error } = await supabaseAdmin.from('knowledge_chunks').insert(rowsToInsert);
      if (error) throw error;
    }

    return NextResponse.json({ inserted: rowsToInsert.length });
  } catch (err) {
    console.error('Embed API Error:', err);
    return NextResponse.json({ error: err.message || 'Embedding failed' }, { status: 500 });
  }
}
