"""Rnexa backend: website + API (credits, Razorpay payments, Bolna calling). Secrets only in environment variables."""
import hashlib, hmac, io, json, os, threading
from typing import Optional
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
ADMINS = {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "syedshahid3533@gmail.com").split(",") if e.strip()}
COST_PER_CALL = float(os.getenv("COST_PER_CALL_INR", "8"))   # your estimated cost per call, for the profit estimate
DEFAULT_PACKS = [  # used only if the packs table is empty; real prices are edited in the admin panel
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


def auth_user(auth):
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(401, "Please log in")
    r = requests.get(f"{SB}/auth/v1/user", headers={"apikey": ANON, "Authorization": auth}, timeout=15)
    if r.status_code != 200:
        raise HTTPException(401, "Session expired, please log in again")
    return r.json()


def current_user(auth):
    u = auth_user(auth)
    uid = u["id"]
    st = db("GET", "account_status", {"user_id": f"eq.{uid}"})
    if not st:
        db("POST", "account_status", json={"user_id": uid, "email": u.get("email")})
    elif st[0]["suspended"]:
        raise HTTPException(403, "Your account is suspended. Please contact support.")
    if not db("GET", "profiles", {"id": f"eq.{uid}", "select": "id"}):
        raise HTTPException(403, "Complete your company details first")
    return uid


def current_admin(auth):
    u = auth_user(auth)
    if (u.get("email") or "").lower() not in ADMINS or not u.get("email_confirmed_at"):
        raise HTTPException(403, "Admin only")
    return u


def load_packs(everything=False):
    try:
        rows = db("GET", "packs", {"order": "sort"} if everything else {"order": "sort", "active": "eq.true"})
        return rows or DEFAULT_PACKS
    except HTTPException:
        return DEFAULT_PACKS


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
    return load_packs()


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
    p = next((x for x in load_packs() if x["id"] == b.pack), None)
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


@app.get("/api/payments")
def my_payments(authorization: str = Header(None)):
    uid = current_user(authorization)
    return db("GET", "payments", {"user_id": f"eq.{uid}", "status": "eq.paid", "order": "created_at.desc", "limit": "50",
                                  "select": "pack,calls,amount_paise,created_at"})


# ---------- support tickets ----------
class TicketIn(BaseModel):
    subject: str
    message: str


@app.post("/api/tickets")
def new_ticket(b: TicketIn, authorization: str = Header(None)):
    uid = current_user(authorization)
    return db("POST", "tickets", json={"user_id": uid, "subject": b.subject[:80], "message": b.message[:2000]})[0]


@app.get("/api/tickets")
def my_tickets(authorization: str = Header(None)):
    uid = current_user(authorization)
    return db("GET", "tickets", {"user_id": f"eq.{uid}", "order": "created_at.desc", "limit": "20"})


# ---------- admin ----------
class ClientEdit(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None
    city: Optional[str] = None
    suspended: Optional[bool] = None
    credits_delta: Optional[int] = None


class PackEdit(BaseModel):
    name: str
    calls: int
    price: int
    active: bool = True


class TicketEdit(BaseModel):
    status: str
    admin_reply: Optional[str] = None


@app.get("/api/admin/me")
def admin_me(authorization: str = Header(None)):
    return {"email": current_admin(authorization).get("email")}


@app.get("/api/admin/overview")
def admin_overview(authorization: str = Header(None)):
    current_admin(authorization)
    calls = sum(c["total"] or 0 for c in db("GET", "campaigns", {"select": "total"}))
    revenue = sum(p["amount_paise"] or 0 for p in db("GET", "payments", {"status": "eq.paid", "select": "amount_paise"})) / 100
    est_cost = round(calls * COST_PER_CALL)
    return {"clients": len(db("GET", "profiles", {"select": "id"})), "calls": calls, "revenue": revenue,
            "credits": sum(w["credits"] for w in db("GET", "wallets")), "est_cost": est_cost, "est_profit": revenue - est_cost}


@app.get("/api/admin/clients")
def admin_clients(authorization: str = Header(None)):
    current_admin(authorization)
    st = {x["user_id"]: x for x in db("GET", "account_status")}
    wl = {x["user_id"]: x["credits"] for x in db("GET", "wallets")}
    return [{**p, "email": st.get(p["id"], {}).get("email"), "suspended": st.get(p["id"], {}).get("suspended", False),
             "credits": wl.get(p["id"], 0)} for p in db("GET", "profiles", {"order": "created_at.desc"})]


@app.patch("/api/admin/clients/{uid}")
def admin_edit_client(uid: str, b: ClientEdit, authorization: str = Header(None)):
    current_admin(authorization)
    f = {k: getattr(b, k) for k in ("company_name", "contact_name", "phone", "industry", "city") if getattr(b, k) is not None}
    if f:
        db("PATCH", "profiles", {"id": f"eq.{uid}"}, f)
    if b.suspended is not None and not db("PATCH", "account_status", {"user_id": f"eq.{uid}"}, {"suspended": b.suspended}):
        db("POST", "account_status", json={"user_id": uid, "suspended": b.suspended})
    if b.credits_delta:
        credits_of(uid)
        if rpc("add_credits" if b.credits_delta > 0 else "use_credits", {"p_user": uid, "p_n": abs(b.credits_delta)}) is None:
            raise HTTPException(400, "Client does not have that many credits")
    return {"ok": True}


@app.delete("/api/admin/clients/{uid}")
def admin_delete_client(uid: str, authorization: str = Header(None)):
    current_admin(authorization)
    r = requests.delete(f"{SB}/auth/v1/admin/users/{uid}", headers=H, timeout=30)
    if not r.ok:
        raise HTTPException(502, f"Could not delete the account: {r.text[:120]}")
    return {"ok": True}


@app.get("/api/admin/packs")
def admin_packs(authorization: str = Header(None)):
    current_admin(authorization)
    return load_packs(True)


@app.put("/api/admin/packs/{pid}")
def admin_edit_pack(pid: str, b: PackEdit, authorization: str = Header(None)):
    current_admin(authorization)
    if b.calls < 1 or b.price < 1:
        raise HTTPException(400, "Calls and price must be above zero")
    db("PATCH", "packs", {"id": f"eq.{pid}"}, b.dict())
    return {"ok": True}


@app.get("/api/admin/payments")
def admin_payments(authorization: str = Header(None)):
    current_admin(authorization)
    em = {x["user_id"]: x["email"] for x in db("GET", "account_status")}
    return [{**p, "email": em.get(p["user_id"])} for p in db("GET", "payments", {"order": "created_at.desc", "limit": "100"})]


@app.get("/api/admin/tickets")
def admin_tickets(authorization: str = Header(None)):
    current_admin(authorization)
    em = {x["user_id"]: x["email"] for x in db("GET", "account_status")}
    return [{**t, "email": em.get(t["user_id"])} for t in db("GET", "tickets", {"order": "created_at.desc", "limit": "100"})]


@app.patch("/api/admin/tickets/{tid}")
def admin_edit_ticket(tid: str, b: TicketEdit, authorization: str = Header(None)):
    current_admin(authorization)
    db("PATCH", "tickets", {"id": f"eq.{tid}"}, {"status": b.status, "admin_reply": b.admin_reply})
    return {"ok": True}


app.mount("/", StaticFiles(directory="static", html=True), name="site")
