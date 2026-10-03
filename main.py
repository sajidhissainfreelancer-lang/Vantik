"""Rnexa backend: website + API (credits, Razorpay payments, Bolna calling). Secrets only in environment variables."""
import hashlib, hmac, io, json, os, threading
import pandas as pd, requests
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from core import Bolna, process_row, FAIL

SB = os.environ["SUPABASE_URL"].rstrip("/")
SKEY, ANON = os.environ["SUPABASE_SERVICE_KEY"], os.environ["SUPABASE_ANON_KEY"]
RZP_ID, RZP_SECRET = os.getenv("RAZORPAY_KEY_ID", ""), os.getenv("RAZORPAY_KEY_SECRET", "")
RZP_WEBHOOK = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
FREE_CALLS = int(os.getenv("FREE_CALLS", "2"))                    # free trial calls for each new client
MAX_CALLS = int(os.getenv("MAX_CALLS_PER_CAMPAIGN", "500"))
PACKS = [  # price in rupees. This is the only place prices live; the website reads them from /api/packs
    {"id": "starter", "name": "Starter", "calls": 50, "price": 1000},
    {"id": "growth", "name": "Growth", "calls": 100, "price": 1800},
    {"id": "business", "name": "Business", "calls": 500, "price": 8000},
]
H = {"apikey": SKEY, "Content-Type": "application/json", "Prefer": "return=representation"}
if not SKEY.startswith("sb_"):
    H["Authorization"] = f"Bearer {SKEY}"
app = FastAPI()


def _check(r, what):
    if not r.ok:
        raise HTTPException(500, f"Database error on '{what}' ({r.status_code}): {r.text[:160]}")
    return r.json() if r.text else []


def db(method, table, params=None, json=None):
    return _check(requests.request(method, f"{SB}/rest/v1/{table}", headers=H, params=params, json=json, timeout=30), table)


def rpc(fn, args):
    return _check(requests.post(f"{SB}/rest/v1/rpc/{fn}", headers=H, json=args, timeout=30), fn)


def current_user(auth):
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(401, "Please log in")
    r = requests.get(f"{SB}/auth/v1/user", headers={"apikey": ANON, "Authorization": auth}, timeout=15)
    if r.status_code != 200:
        raise HTTPException(401, "Session expired, please log in again")
    uid = r.json()["id"]
    if not db("GET", "profiles", {"id": f"eq.{uid}", "select": "id"}):
        raise HTTPException(403, "Complete your company details first")
    return uid


def credits_of(uid):
    return rpc("get_credits", {"p_user": uid, "p_free": FREE_CALLS})


def run_campaign(cid, uid):
    client = Bolna(os.environ["BOLNA_API_KEY"], os.environ["BOLNA_AGENT_ID"])
    db("PATCH", "campaigns", {"id": f"eq.{cid}"}, {"status": "running"})
    done = refund = 0
    for lead in db("GET", "leads", {"campaign_id": f"eq.{cid}", "order": "idx"}):
        try:
            res = process_row(client, pd.Series(lead["row"]), "phone_number")
        except Exception as e:
            res = {"call_status": f"error: {e}"}
        s = str(res.get("call_status"))
        if s in FAIL or s.startswith("error") or s in ("invalid phone number", "timeout"):
            refund += 1                       # calls that never connected are given back
        done += 1
        db("PATCH", "leads", {"id": f"eq.{lead['id']}"}, {"status": s, "result": res})
        db("PATCH", "campaigns", {"id": f"eq.{cid}"}, {"done": done})
    if refund:
        rpc("add_credits", {"p_user": uid, "p_n": refund})
    db("PATCH", "campaigns", {"id": f"eq.{cid}"}, {"status": "finished"})


@app.get("/api/packs")
def packs():
    return PACKS


@app.get("/api/me")
def me(authorization: str = Header(None)):
    return {"credits": credits_of(current_user(authorization))}


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
    have = credits_of(uid)
    if have <= 0:
        raise HTTPException(402, "You have no credits left. Please buy a pack.")
    n = min(len(df), have, MAX_CALLS)
    limited = n < len(df)
    df = df.head(n).fillna("").astype(str)
    if rpc("use_credits", {"p_user": uid, "p_n": n}) is None:
        raise HTTPException(402, "Not enough credits. Please buy a pack.")
    camp = db("POST", "campaigns", json={"user_id": uid, "name": file.filename, "total": n, "status": "queued"})[0]
    db("POST", "leads", json=[{"campaign_id": camp["id"], "user_id": uid, "idx": i, "row": r}
                              for i, r in enumerate(df.to_dict("records"))])
    threading.Thread(target=run_campaign, args=(camp["id"], uid), daemon=True).start()
    return {**camp, "limited": limited, "limit": n}


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


# ---------- payments (Razorpay) ----------
class OrderIn(BaseModel):
    pack: str


class VerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def credit_order(order_id, payment_id):
    """Add credits once per paid order (safe if called twice)."""
    rows = db("PATCH", "payments", {"razorpay_order_id": f"eq.{order_id}", "status": "eq.created"},
              {"status": "paid", "razorpay_payment_id": payment_id})
    if rows:
        rpc("add_credits", {"p_user": rows[0]["user_id"], "p_n": rows[0]["calls"]})
    return bool(rows)


@app.post("/api/orders")
def create_order(b: OrderIn, authorization: str = Header(None)):
    uid = current_user(authorization)
    p = next((x for x in PACKS if x["id"] == b.pack), None)
    if not p or not RZP_ID:
        raise HTTPException(400, "This pack is not available")
    r = requests.post("https://api.razorpay.com/v1/orders", auth=(RZP_ID, RZP_SECRET), timeout=30,
                      json={"amount": p["price"] * 100, "currency": "INR", "receipt": f"rx{uid[:8]}"})
    if not r.ok:
        raise HTTPException(502, "Could not start the payment. Please try again.")
    o = r.json()
    db("POST", "payments", json={"user_id": uid, "razorpay_order_id": o["id"], "pack": p["id"],
                                 "calls": p["calls"], "amount_paise": o["amount"]})
    return {"order_id": o["id"], "amount": o["amount"], "key_id": RZP_ID, "description": f'{p["name"]} - {p["calls"]} calls'}


@app.post("/api/payments/verify")
def verify_payment(b: VerifyIn, authorization: str = Header(None)):
    uid = current_user(authorization)
    sig = hmac.new(RZP_SECRET.encode(), f"{b.razorpay_order_id}|{b.razorpay_payment_id}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, b.razorpay_signature):
        raise HTTPException(400, "Payment verification failed")
    if not db("GET", "payments", {"razorpay_order_id": f"eq.{b.razorpay_order_id}", "user_id": f"eq.{uid}"}):
        raise HTTPException(404, "Order not found")
    credit_order(b.razorpay_order_id, b.razorpay_payment_id)
    return {"credits": credits_of(uid)}


@app.post("/api/razorpay-webhook")
async def razorpay_webhook(request: Request):
    """Backup: credits the account even if the client closed the browser after paying."""
    body = await request.body()
    expected = hmac.new(RZP_WEBHOOK.encode(), body, hashlib.sha256).hexdigest() if RZP_WEBHOOK else ""
    if not RZP_WEBHOOK or not hmac.compare_digest(expected, request.headers.get("x-razorpay-signature", "")):
        raise HTTPException(400, "Bad signature")
    ev = json.loads(body)
    if ev.get("event") in ("payment.captured", "order.paid"):
        pay = ev["payload"]["payment"]["entity"]
        credit_order(pay["order_id"], pay["id"])
    return {"ok": True}


app.mount("/", StaticFiles(directory="static", html=True), name="site")
