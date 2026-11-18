import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from google import genai
from google.genai import types
from supabase import create_client, Client

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-3.5-flash-lite"

def get_admin_db() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_ai() -> genai.Client:
    return genai.Client(api_key=GEMINI_API_KEY)

class ChatReq(BaseModel):
    userId: str
    moduleSlug: str
    query: str
    sourceMode: Optional[str] = "hybrid"

class EmbedReq(BaseModel):
    adminId: str
    moduleSlug: str
    sourceName: str
    chunks: List[str]

@app.get("/api/config")
@app.get("/config")
def public_config():
    return {
        "supabaseUrl": SUPABASE_URL,
        "supabaseAnonKey": SUPABASE_ANON_KEY
    }

@app.get("/api/profile")
@app.get("/profile")
def get_user_profile(userId: str):
    db = get_admin_db()
    prof = db.table("profiles").select("*").eq("id", userId).single().execute().data
    mods = db.table("assistants_config").select("*").eq("is_active", True).order("sort_order").execute().data
    return {"profile": prof, "modules": mods or []}

@app.post("/api/chat")
@app.post("/chat")
def chat_endpoint(req: ChatReq):
    try:
        db = get_admin_db()
        ai = get_ai()

        prof = db.table("profiles").select("status, allowed_modules").eq("id", req.userId).single().execute().data
        if not prof or prof.get("status") != "approved":
            raise HTTPException(status_code=403, detail="आपका अकाउंट अभी एडमिन द्वारा अप्रूव नहीं है।")
        if req.moduleSlug not in (prof.get("allowed_modules") or []):
            raise HTTPException(status_code=403, detail="आपको इस असिस्टेंट का एक्सेस नहीं मिला है।")

        mod_data = db.table("assistants_config").select("system_prompt").eq("slug", req.moduleSlug).single().execute().data
        base_prompt = (mod_data or {}).get("system_prompt", "Aap ek sahayak AI hain.")

        emb_res = ai.models.embed_content(model="text-embedding-004", contents=req.query)
        q_vec = emb_res.embeddings[0].values

        match_res = db.rpc("match_knowledge", {
            "query_embedding": q_vec,
            "target_module": req.moduleSlug,
            "match_threshold": 0.45,
            "match_count": 5
        }).execute()

        chunks = match_res.data or []
        context = "\n\n---\n\n".join([f"[स्रोत: {c['source_name']}]\n{c['content']}" for c in chunks])

        if req.sourceMode == "book_only" and not context:
            return {
                "answer": "📚 संलग्न ग्रंथों (Knowledge Base) में इस विषय पर सीधा संदर्भ नहीं मिला। कृपया ऊपर स्रोत मोड को 'ग्रंथ + इंटरनेट (Hybrid)' पर बदलकर पुनः पूछें।",
                "chatId": ""
            }

        mode_note = (
            "केवल नीचे दिए गए 'संदर्भ ज्ञान' के आधार पर ही उत्तर दें।"
            if req.sourceMode == "book_only"
            else "नीचे दिए गए 'संदर्भ ज्ञान (Knowledge Base)' को सर्वोच्च प्राथमिकता दें। यदि उसमें पूरी जानकारी न हो, तो अपने विशेषज्ञ ज्ञान और वेब संदर्भ से प्रामाणिक एवं सुरक्षित उत्तर दें।"
        )

        sys_instruction = f"{base_prompt}\n\nस्रोत नियम: {mode_note}"
        user_prompt = f"संदर्भ ज्ञान:\n{context}\n\nप्रश्न: {req.query}" if context else f"प्रश्न: {req.query}"

        gen_config = types.GenerateContentConfig(
            system_instruction=sys_instruction,
            temperature=0.35,
            tools=[{"google_search": {}}] if req.sourceMode != "book_only" else None
        )

        gen_res = ai.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=gen_config
        )
        answer = gen_res.text or "क्षमा करें, अभी उत्तर तैयार नहीं हो सका।"

        ins_res = db.table("chat_logs").insert({
            "user_id": req.userId,
            "module_slug": req.moduleSlug,
            "user_query": req.query,
            "ai_response": answer
        }).execute()

        chat_id = ins_res.data[0]["id"] if ins_res.data else ""
        return {"answer": answer, "chatId": chat_id}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/embed")
@app.post("/embed")
def embed_endpoint(req: EmbedReq):
    try:
        db = get_admin_db()
        ai = get_ai()

        admin_data = db.table("profiles").select("role").eq("id", req.adminId).single().execute().data
        if not admin_data or admin_data.get("role") != "admin":
            raise HTTPException(status_code=403, detail="केवल एडमिन ही ज्ञान अपलोड कर सकते हैं।")

        rows = []
        for ch in req.chunks:
            if not ch.strip():
                continue
            emb = ai.models.embed_content(model="text-embedding-004", contents=ch)
            rows.append({
                "module_slug": req.moduleSlug,
                "source_name": req.sourceName,
                "content": ch,
                "embedding": emb.embeddings[0].values
            })

        if rows:
            db.table("knowledge_chunks").insert(rows).execute()

        return {"inserted": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
