import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from google import genai
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

def get_admin_db() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_ai() -> genai.Client:
    return genai.Client(api_key=GEMINI_API_KEY)

class ChatReq(BaseModel):
    userId: str
    moduleSlug: str
    query: str

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
def chat_endpoint(req: ChatReq):
    try:
        db = get_admin_db()
        ai = get_ai()

        # 1. Verify User Approval & Allowed Modules
        prof_res = db.table("profiles").select("status, allowed_modules").eq("id", req.userId).single().execute()
        prof = prof_res.data
        if not prof or prof.get("status") != "approved":
            raise HTTPException(status_code=403, detail="Account not approved by Admin.")
        if req.moduleSlug not in (prof.get("allowed_modules") or []):
            raise HTTPException(status_code=403, detail="Module access denied.")

        # 2. Fetch Dynamic System Prompt from DB
        mod_res = db.table("assistants_config").select("system_prompt").eq("slug", req.moduleSlug).single().execute()
        base_prompt = (mod_res.data or {}).get("system_prompt", "Aap ek sahayak AI hain.")

        # 3. Generate Query Embedding (768 dimensions)
        emb_res = ai.models.embed_content(model="text-embedding-004", contents=req.query)
        q_vec = emb_res.embeddings[0].values

        # 4. Vector Search in Supabase Knowledge Base
        match_res = db.rpc("match_knowledge", {
            "query_embedding": q_vec,
            "target_module": req.moduleSlug,
            "match_threshold": 0.50,
            "match_count": 5
        }).execute()

        chunks = match_res.data or []
        context = "\n\n---\n\n".join([f"[स्रोत: {c['source_name']}]\n{c['content']}" for c in chunks])

        # 5. Generate Hindi Answer + Smart Follow-up Tip
        sys_instruction = f"""{base_prompt}

महत्वपूर्ण निर्देश:
1. जवाब हमेशा स्पष्ट, सम्मानजनक और सरल हिंदी (Devanagari) में दें।
2. नीचे दिए गए "संदर्भ ज्ञान (Reference Knowledge)" को प्राथमिकता दें। यदि संदर्भ ज्ञान में सटीक जानकारी न हो, तो अपने सामान्य शास्त्रीय/विशेषज्ञ ज्ञान से सुरक्षित और व्यावहारिक उत्तर दें।
3. उत्तर के अंत में एक अलग पैराग्राफ में "💡 बेहतर परिणाम के लिए सुझाव:" लिखकर 1-2 लाइन में बताएं कि अगली बार प्रश्न पूछते समय कौन सी अतिरिक्त जानकारी (जैसे दिशा, समय, या लक्षण) जोड़ने से और भी सटीक उत्तर मिलेगा।"""

        user_prompt = f"संदर्भ ज्ञान:\n{context}\n\nयूजर का प्रश्न: {req.query}" if context else f"यूजर का प्रश्न: {req.query}"

        gen_res = ai.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_prompt,
            config={"system_instruction": sys_instruction, "temperature": 0.4}
        )
        answer = gen_res.text or "क्षमा करें, अभी उत्तर तैयार नहीं हो सका।"

        # 6. Save Chat Log (SQL Trigger auto-enforces user's max_db_chats limit)
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
def embed_endpoint(req: EmbedReq):
    try:
        db = get_admin_db()
        ai = get_ai()

        # Verify Admin Role
        admin_res = db.table("profiles").select("role").eq("id", req.adminId).single().execute()
        if not admin_res.data or admin_res.data.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")

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
