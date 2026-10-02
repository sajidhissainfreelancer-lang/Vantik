"""Rnexa backend: serves the website and the API. Secrets live only in environment variables."""
import io, os, threading
import pandas as pd, requests
from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from core import Bolna, process_row

SB = os.environ["SUPABASE_URL"].rstrip("/")
SKEY, ANON = os.environ["SUPABASE_SERVICE_KEY"], os.environ["SUPABASE_ANON_KEY"]
MAX_CALLS = int(os.getenv("MAX_CALLS_PER_CAMPAIGN", "5"))   # safety limit while testing
H = {"apikey": SKEY, "Content-Type": "application/json", "Prefer": "return=representation"}
if not SKEY.startswith("sb_"):          # old-style JWT service_role keys also need the Authorization header
    H["Authorization"] = f"Bearer {SKEY}"
app = FastAPI()


def db(method, table, params=None, json=None):
    r = requests.request(method, f"{SB}/rest/v1/{table}", headers=H, params=params, json=json, timeout=30)
    if not r.ok:
        raise HTTPException(500, f"Database error on '{table}' ({r.status_code}): {r.text[:160]}")
    return r.json() if r.text else []


def current_user(auth):
    """Check the Supabase login token, return user id. Client must also have accepted the terms."""
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(401, "Please log in")
    r = requests.get(f"{SB}/auth/v1/user", headers={"apikey": ANON, "Authorization": auth}, timeout=15)
    if r.status_code != 200:
        raise HTTPException(401, "Session expired, please log in again")
    uid = r.json()["id"]
    if not db("GET", "profiles", {"id": f"eq.{uid}", "select": "id"}):
        raise HTTPException(403, "Complete your company details first")
    return uid


def run_campaign(cid):
    client = Bolna(os.environ["BOLNA_API_KEY"], os.environ["BOLNA_AGENT_ID"])
    db("PATCH", "campaigns", {"id": f"eq.{cid}"}, {"status": "running"})
    done = 0
    for lead in db("GET", "leads", {"campaign_id": f"eq.{cid}", "order": "idx"}):
        try:
            res = process_row(client, pd.Series(lead["row"]), "phone_number")
        except Exception as e:
            res = {"call_status": f"error: {e}"}
        done += 1
        db("PATCH", "leads", {"id": f"eq.{lead['id']}"}, {"status": str(res.get("call_status")), "result": res})
        db("PATCH", "campaigns", {"id": f"eq.{cid}"}, {"done": done})
    db("PATCH", "campaigns", {"id": f"eq.{cid}"}, {"status": "finished"})


@app.post("/api/campaigns")
async def create_campaign(file: UploadFile = File(...), authorization: str = Header(None)):
    uid = current_user(authorization)
    raw = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw)) if file.filename.lower().endswith(".csv") else pd.read_excel(io.BytesIO(raw))
    except Exception:
        raise HTTPException(400, "Could not read this file")
    if "phone_number" not in df.columns:
        raise HTTPException(400, "Your file needs a column named phone_number")
    total_in_file = len(df)
    df = df.head(MAX_CALLS).fillna("").astype(str)
    camp = db("POST", "campaigns", json={"user_id": uid, "name": file.filename, "total": len(df), "status": "queued"})[0]
    db("POST", "leads", json=[{"campaign_id": camp["id"], "user_id": uid, "idx": i, "row": r}
                              for i, r in enumerate(df.to_dict("records"))])
    threading.Thread(target=run_campaign, args=(camp["id"],), daemon=True).start()
    return {**camp, "limited": total_in_file > len(df), "limit": MAX_CALLS}


@app.get("/api/campaigns")
def list_campaigns(authorization: str = Header(None)):
    uid = current_user(authorization)
    return db("GET", "campaigns", {"user_id": f"eq.{uid}", "order": "created_at.desc", "limit": "30"})


@app.get("/api/campaigns/{cid}/download")
def download(cid: str, authorization: str = Header(None)):
    uid = current_user(authorization)
    if not db("GET", "campaigns", {"id": f"eq.{cid}", "user_id": f"eq.{uid}"}):
        raise HTTPException(404, "Not found")
    leads = db("GET", "leads", {"campaign_id": f"eq.{cid}", "order": "idx"})
    df = pd.DataFrame([{**l["row"], **(l["result"] or {})} for l in leads])
    buf = io.BytesIO()
    df.to_excel(buf, index=False)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": 'attachment; filename="rnexa_results.xlsx"'})


app.mount("/", StaticFiles(directory="static", html=True), name="site")
