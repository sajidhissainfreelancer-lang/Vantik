"""Rnexa backend: website + API (credits, Razorpay payments, Bolna calling). Secrets only in environment variables."""
import hashlib, hmac, io, json, math, os, re, smtplib, threading
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Optional
import pandas as pd, requests
from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Request
from fastapi.responses import StreamingResponse, Response, HTMLResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.gzip import GZipMiddleware
import html as _html
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
DEFAULT_PACKS = [
    {"id": "num", "name": "AI phone number (per month)", "calls": 0, "price": 999, "mrp": 1500, "kind": "line"},
    {"id": "numplus", "name": "AI number + 60 minutes", "calls": 60, "price": 1499, "mrp": 2000, "kind": "line"},
    {"id": "m60", "name": "60 minutes", "calls": 60, "price": 900, "kind": "minutes"},
    {"id": "m100", "name": "1 hr 40 min", "calls": 100, "price": 1100, "kind": "minutes"},
    {"id": "mcustom", "name": "5 hours or more", "calls": 300, "price": 2700, "rate_per_min": 9, "kind": "custom"},
]
H = {"apikey": SKEY, "Content-Type": "application/json", "Prefer": "return=representation"}
if not SKEY.startswith("sb_"):
    H["Authorization"] = f"Bearer {SKEY}"
app = FastAPI()
app.add_middleware(GZipMiddleware, minimum_size=1000)


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
    return JSONResponse(load_packs(), headers={"Cache-Control": "no-store"})


@app.get("/api/me")
def me(authorization: str = Header(None)):
    uid = current_user(authorization)
    return {"credits": credits_of(uid), "minutes": rpc("get_minutes", {"p_user": uid}), "unread": unread_count(uid), "has_number": has_number(uid)}


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
    minutes: Optional[int] = None


class VerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def credit_order(order_id, payment_id):
    """Add credits once per paid order (safe if called twice)."""
    rows = db("PATCH", "payments", {"razorpay_order_id": f"eq.{order_id}", "status": "eq.created"},
              {"status": "paid", "razorpay_payment_id": payment_id})
    if rows:
        r0, kind = rows[0], rows[0].get("kind") or "calls"
        if kind == "calls":
            rpc("add_credits", {"p_user": r0["user_id"], "p_n": r0["calls"]})
        else:
            rpc("add_minutes", {"p_user": r0["user_id"], "p_n": r0["calls"]})
            if kind == "line":
                db("PATCH", "lines", {"user_id": f"eq.{r0['user_id']}"}, {"paid_until": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()})
                threading.Thread(target=provision, args=(r0["user_id"],), daemon=True).start()
            else:
                threading.Thread(target=relink, args=(r0["user_id"],), daemon=True).start()
        threading.Thread(target=email_invoice, args=(r0,), daemon=True).start()
        notify(r0["user_id"], "Payment received", f"We received Rs. {(r0['amount_paise'] or 0) / 100:,.2f}. Your invoice was sent to your email and is in Minutes & billing.", "message")
    return bool(rows)


@app.post("/api/orders")
def create_order(b: OrderIn, authorization: str = Header(None)):
    uid = current_user(authorization)
    p = next((x for x in load_packs() if x["id"] == b.pack), None)
    if not p or not RZP_ID:
        raise HTTPException(400, "This pack is not available")
    kind = p.get("kind", "calls")
    if kind == "line" and has_number(uid):
        raise HTTPException(400, "You already have an AI number. Please buy minutes instead.")
    if kind == "line" and not db("GET", "lines", {"user_id": f"eq.{uid}", "select": "id"}):
        raise HTTPException(400, "Please save your business details first")
    price, units = p["price"], p["calls"]
    if kind == "custom":                      # client chooses how many minutes (hours x 60) at a fixed rate per minute
        units = b.minutes or 0
        if units < p["calls"] or units > 20000:
            raise HTTPException(400, f"Please choose at least {p['calls'] // 60} hours")
        price = units * int(p.get("rate_per_min") or 0)
    if price < 1:
        raise HTTPException(400, "This pack is not available")
    r = requests.post("https://api.razorpay.com/v1/orders", auth=(RZP_ID, RZP_SECRET), timeout=30,
                      json={"amount": price * 100, "currency": "INR", "receipt": f"rx{uid[:8]}"})
    if not r.ok:
        raise HTTPException(502, "Could not start the payment. Please try again.")
    o = r.json()
    db("POST", "payments", json={"user_id": uid, "razorpay_order_id": o["id"], "pack": p["id"],
                                 "calls": units, "amount_paise": o["amount"], "kind": kind})
    return {"order_id": o["id"], "amount": o["amount"], "key_id": RZP_ID, "description": f'{p["name"]} - {units} minutes' if units else p["name"]}


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
                                  "select": "id,pack,calls,amount_paise,created_at,kind"})


# ---------- support tickets ----------
class TicketIn(BaseModel):
    subject: str
    message: str


@app.post("/api/tickets")
def new_ticket(b: TicketIn, authorization: str = Header(None)):
    uid = current_user(authorization)
    t = db("POST", "tickets", json={"user_id": uid, "subject": b.subject[:80], "message": b.message[:2000]})[0]
    notify(uid, "You raised a ticket", f"'{t['subject']}' was received. Status: open. We will reply soon.", "ticket")
    return t


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
    reason: Optional[str] = None
    credits_delta: Optional[int] = None


class PackEdit(BaseModel):
    name: str
    calls: int
    price: int
    active: bool = True
    mrp: Optional[int] = None
    rate_per_min: Optional[int] = None
    sort: Optional[int] = None


class TicketEdit(BaseModel):
    status: str
    admin_reply: Optional[str] = None
    subject: Optional[str] = None
    message: Optional[str] = None


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
            "credits": sum(w["minutes"] for w in db("GET", "wallets")), "est_cost": est_cost, "est_profit": revenue - est_cost}


@app.get("/api/admin/clients")
def admin_clients(authorization: str = Header(None)):
    current_admin(authorization)
    st = {x["user_id"]: x for x in db("GET", "account_status")}
    wl = {x["user_id"]: x["minutes"] for x in db("GET", "wallets")}
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
    if b.suspended is not None:
        prof = db("GET", "profiles", {"id": f"eq.{uid}", "select": "company_name"})
        name = prof[0]["company_name"] if prof else "there"
        contact = "Email: ss@rnexa.in\nPhone / WhatsApp: +91 7358145522"
        if b.suspended:
            why = f"\nReason: {b.reason.strip()}\n" if b.reason and b.reason.strip() else ""
            subject, body = "Your Rnexa account has been suspended", f"Hello {name},\n\nYour Rnexa account has been suspended.{why}\nWhile it is suspended you cannot use the dashboard or your AI receptionist.\n\nTo sort this out, please contact us:\n{contact}\n\nRnexa"
        else:
            subject, body = "Your Rnexa account is active again", f"Hello {name},\n\nYour Rnexa account has been switched back on. You can log in and use the dashboard again at {SITE_URL}/login.\n\nIf you have any questions:\n{contact}\n\nRnexa"
        threading.Thread(target=send_mail, args=(email_of(uid), subject, body), daemon=True).start()
    if b.credits_delta:
        if rpc("add_minutes" if b.credits_delta > 0 else "use_minutes", {"p_user": uid, "p_n": abs(b.credits_delta)}) is None:
            raise HTTPException(400, "Client does not have that many minutes")
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
    return db("GET", "packs", {"order": "sort"})


@app.put("/api/admin/packs/{pid}")
def admin_edit_pack(pid: str, b: PackEdit, authorization: str = Header(None)):
    current_admin(authorization)
    if b.calls < 0 or b.price < 1:
        raise HTTPException(400, "Minutes cannot be negative and the price must be above zero")
    f = b.dict()
    if f.get("sort") is None:
        f.pop("sort", None)
    rows = db("PATCH", "packs", {"id": f"eq.{pid}"}, f)
    if not rows:
        raise HTTPException(404, "Pack not found")
    return {"ok": True, "pack": rows[0]}


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
    rows = db("GET", "tickets", {"id": f"eq.{tid}"})
    if not rows:
        raise HTTPException(404, "Ticket not found")
    old = rows[0]
    f = {"status": b.status, "admin_reply": b.admin_reply}
    if b.subject is not None:
        f["subject"] = b.subject[:80]
    if b.message is not None:
        f["message"] = b.message[:2000]
    db("PATCH", "tickets", {"id": f"eq.{tid}"}, f)
    if b.status != old.get("status") or (b.admin_reply or "") != (old.get("admin_reply") or ""):
        reply = f"\nReply from Rnexa: {b.admin_reply}" if b.admin_reply else ""
        notify(old["user_id"], f"Your ticket is now: {b.status}", f"'{f.get('subject', old['subject'])}'{reply}", "ticket")
    return {"ok": True}


@app.delete("/api/admin/tickets/{tid}")
def admin_delete_ticket(tid: str, authorization: str = Header(None)):
    current_admin(authorization)
    db("DELETE", "tickets", {"id": f"eq.{tid}"})
    return {"ok": True}


# ---------- inbound AI receptionist ----------
BOLNA = "https://api.bolna.ai"
TEMPLATE_AGENT = os.getenv("BOLNA_TEMPLATE_AGENT_ID", "")
HOOK_KEY = os.getenv("BOLNA_WEBHOOK_KEY", "")
SITE_URL = os.getenv("SITE_URL", "https://rnexa.in")
AUTO = os.getenv("AUTO_PROVISION", "on").lower() == "on"      # "off" = you approve every line yourself in the admin panel
MAX_LINES_PER_DAY = int(os.getenv("MAX_LINES_PER_DAY", "3"))   # safety limit on automatic number purchases
LOW_MIN = int(os.getenv("LOW_MINUTES", "20"))
NUM_PROVIDER = os.getenv("NUMBER_PROVIDER", "vobiz")
IST = timezone(timedelta(hours=5, minutes=30))


def bh():
    return {"Authorization": f"Bearer {os.environ['BOLNA_API_KEY']}", "Content-Type": "application/json"}


def send_mail(to, subject, body, html=None):
    host = os.getenv("SMTP_HOST")
    if not host or not to:
        return
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = os.getenv("MAIL_FROM", "Rnexa <ss@rnexa.in>"), to, subject
    msg.set_content(body)
    if html:
        msg.add_alternative(html, subtype="html")
    try:
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=20) as s:
            s.starttls()
            s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
            s.send_message(msg)
    except Exception as e:
        print("mail error:", e)


def email_of(uid):
    r = db("GET", "account_status", {"user_id": f"eq.{uid}"})
    return r[0]["email"] if r else None


def build_prompt(b):
    return f"""You are Riya, the friendly phone receptionist of {b.get('name')}. People call you with questions. Answer calmly, like a helpful person.

Business details:
- Industry: {b.get('industry') or 'Not specified'}
- Opening hours: {b.get('hours')}
- Address: {b.get('address')}
- Services, prices and common questions: {b.get('info') or 'Not provided'}

How to talk:
- Use short sentences and simple words. Ask one question at a time.
- Language: {b.get('language', 'English')}. Reply in the same language the caller uses.
- Answer only from the business details above. Never make up prices, offers or facts.
- If you do not know, say: "I will pass this to our team and they will call you back." Then take the caller's name and number.
- To book an appointment, ask the caller's name, the day and time they prefer, and the reason. Then say the team will confirm.
- If the caller asks for a person, take their name and number and promise a callback.
- If asked, honestly say you are an AI assistant.
- In an emergency, tell the caller to call 108 or go to the nearest hospital.
- End politely once the caller is satisfied."""


def clone_agent(b):
    r = requests.get(f"{BOLNA}/v2/agent/{TEMPLATE_AGENT}", headers=bh(), timeout=30)
    r.raise_for_status()
    t = r.json()
    cfg, pr = t.get("agent_config"), t.get("agent_prompts")
    if not cfg or not pr:
        raise RuntimeError("Template agent has an unexpected format")
    cfg["agent_name"] = f"Rnexa - {b.get('name', '')}"[:60]
    cfg["agent_welcome_message"] = f"Vanakkam! Welcome to {b.get('name')}. This call may be recorded. How can I help you today?"
    cfg["webhook_url"] = f"{SITE_URL}/api/bolna-webhook?key={HOOK_KEY}"
    pr["task_1"]["system_prompt"] = build_prompt(b)
    r = requests.post(f"{BOLNA}/v2/agent", headers=bh(), json={"agent_config": cfg, "agent_prompts": pr}, timeout=30)
    if not r.ok:
        raise RuntimeError(f"Create agent failed ({r.status_code}): {r.text[:150]}")
    return r.json()["agent_id"]


def find_number():
    r = requests.get(f"{BOLNA}/phone-numbers/search", headers=bh(), params={"country": "IN", "provider": NUM_PROVIDER}, timeout=30)
    if not r.ok:
        raise RuntimeError(f"Number search failed ({r.status_code}): {r.text[:150]}")
    d = r.json()
    items = d if isinstance(d, list) else (d.get("numbers") or d.get("data") or [])
    for it in items:
        n = it if isinstance(it, str) else (it.get("phone_number") or it.get("number"))
        if n:
            return n
    raise RuntimeError("No phone numbers available right now")


def link(agent_id, number_id):
    r = requests.post(f"{BOLNA}/inbound/setup", headers=bh(), json={"agent_id": agent_id, "phone_number_id": number_id}, timeout=30)
    if not r.ok:
        raise RuntimeError(f"Linking number failed ({r.status_code}): {r.text[:150]}")


def provision(uid, force=False):
    """Create the client's agent, buy a number, link them. Safe to run again after a failure."""
    rows = db("GET", "lines", {"user_id": f"eq.{uid}"})
    if not rows or rows[0]["status"] in ("active", "provisioning"):
        return
    line = rows[0]
    if not AUTO and not force:
        db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"status": "pending", "error": "Waiting for admin approval"})
        return
    if not line["phone_number_id"] and not force:
        start = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        if len(db("GET", "lines", {"provisioned_at": f"gte.{start}", "select": "id"})) >= MAX_LINES_PER_DAY:
            db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"status": "pending", "error": "Daily limit reached - waiting for admin"})
            return
    db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"status": "provisioning", "error": None})
    try:
        agent = line["agent_id"] or clone_agent(line["business"])
        db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"agent_id": agent})
        pid, num = line["phone_number_id"], line["phone_number"]
        if not pid:
            num = find_number()
            r = requests.post(f"{BOLNA}/phone-numbers/buy", headers=bh(), json={"country": "IN", "phone_number": num, "provider": NUM_PROVIDER}, timeout=45)
            if not r.ok:
                raise RuntimeError(f"Buying number failed ({r.status_code}): {r.text[:150]}")
            pid, num = r.json()["id"], r.json().get("phone_number", num)
            db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"phone_number_id": pid, "phone_number": num, "provisioned_at": datetime.now(timezone.utc).isoformat()})
        if rpc("get_minutes", {"p_user": uid}) <= 0:       # number reserved, but the AI stays off until minutes are bought
            db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"status": "paused", "error": None})
            send_mail(email_of(uid), "Your Rnexa AI number is reserved", f"Your AI number is {num}.\nIt is switched off until you buy minutes. Buy minutes at {SITE_URL}/app/billing and it turns on by itself.\n\nRnexa")
            return
        link(agent, pid)
        db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"status": "active", "error": None})
        send_mail(email_of(uid), "Your Rnexa AI phone number is ready", f"Your AI receptionist number is {num}.\nSet call forwarding from your business phone to this number, then test it by calling.\n\nRnexa")
    except Exception as e:
        db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"status": "failed", "error": str(e)[:300]})


def relink(uid):
    """Switch a paused line back on after the client buys minutes."""
    rows = db("GET", "lines", {"user_id": f"eq.{uid}", "status": "eq.paused"})
    if rows and rpc("get_minutes", {"p_user": uid}) > 0:
        try:
            link(rows[0]["agent_id"], rows[0]["phone_number_id"])
            db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"status": "active"})
        except Exception as e:
            db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"error": str(e)[:300]})


@app.post("/api/bolna-webhook")
async def bolna_webhook(request: Request, key: str = ""):
    if not HOOK_KEY or not hmac.compare_digest(key, HOOK_KEY):
        raise HTTPException(403, "Forbidden")
    ev = await request.json()
    if ev.get("status") != "completed":
        return {"ok": True}
    lines = db("GET", "lines", {"agent_id": f"eq.{ev.get('agent_id')}"})
    eid = ev.get("id")
    if not lines or not eid or db("GET", "calls", {"execution_id": f"eq.{eid}", "select": "execution_id"}):
        return {"ok": True}
    line = lines[0]
    uid = line["user_id"]
    dur = int(float(ev.get("conversation_duration") or 0))
    mins = max(1, math.ceil(dur / 60)) if dur > 0 else 0
    td = ev.get("telephony_data") or {}
    ext = ev.get("extracted_data") or {}
    summary = ext.get("General", {}).get("Call Summary", {}).get("subjective") if isinstance(ext.get("General"), dict) else None
    db("POST", "calls", json={"execution_id": eid, "user_id": uid, "line_id": line["id"], "from_number": td.get("from_number"),
                              "status": "completed", "duration_sec": dur, "minutes": mins, "transcript": ev.get("transcript"),
                              "summary": summary or ev.get("summary"), "extracted": ext, "recording_url": td.get("recording_url")})
    if mins:
        left = rpc("use_minutes", {"p_user": uid, "p_n": mins})
        if left is not None and left <= LOW_MIN < left + mins:
            send_mail(email_of(uid), "Your Rnexa minutes are running low",
                      f"You have {left} minutes left on your AI receptionist.\nBuy more at {SITE_URL}/#/app so your customers keep getting answers.\n\nRnexa")
        if left == 0:
            try:
                requests.post(f"{BOLNA}/inbound/unlink", headers=bh(), json={"phone_number_id": line["phone_number_id"]}, timeout=20)
                db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"status": "paused"})
                send_mail(email_of(uid), "Your Rnexa AI receptionist is paused", f"Your minutes have run out, so the AI stopped answering calls.\nBuy minutes at {SITE_URL}/#/app to switch it back on.\n\nRnexa")
            except Exception as e:
                print("unlink error:", e)
    return {"ok": True}


class BizIn(BaseModel):
    name: str
    hours: str
    address: str
    info: str = ""
    language: str = "English"
    industry: str = ""


@app.get("/api/line")
def my_line(authorization: str = Header(None)):
    uid = current_user(authorization)
    rows = db("GET", "lines", {"user_id": f"eq.{uid}"})
    line = rows[0] if rows else None
    start = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    n = len(db("GET", "calls", {"user_id": f"eq.{uid}", "created_at": f"gte.{start}", "select": "execution_id"}))
    return {"business": line["business"] if line else None, "minutes": rpc("get_minutes", {"p_user": uid}), "calls_today": n,
            "line": {k: line[k] for k in ("status", "phone_number", "paid_until")} if line else None, "has_number": line_has_number(line)}


@app.post("/api/line")
def save_business(b: BizIn, authorization: str = Header(None)):
    uid = current_user(authorization)
    biz = {"name": b.name.strip()[:80], "hours": b.hours.strip()[:120], "address": b.address.strip()[:200],
           "info": b.info.strip()[:3000], "language": b.language, "industry": b.industry.strip()[:60]}
    if not biz["name"]:
        raise HTTPException(400, "Business name is required")
    if db("GET", "lines", {"user_id": f"eq.{uid}", "select": "id"}):
        db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"business": biz})
    else:
        db("POST", "lines", json={"user_id": uid, "business": biz})
    return {"ok": True}


@app.get("/api/calls")
def my_calls(authorization: str = Header(None)):
    uid = current_user(authorization)
    return db("GET", "calls", {"user_id": f"eq.{uid}", "order": "created_at.desc", "limit": "50"})


@app.get("/api/admin/lines")
def admin_lines(authorization: str = Header(None)):
    current_admin(authorization)
    em = {x["user_id"]: x["email"] for x in db("GET", "account_status")}
    return [{**l, "email": em.get(l["user_id"]), "company": (l["business"] or {}).get("name")} for l in db("GET", "lines", {"order": "created_at.desc"})]


@app.post("/api/admin/lines/{uid}/retry")
def admin_retry_line(uid: str, authorization: str = Header(None)):
    current_admin(authorization)
    db("PATCH", "lines", {"user_id": f"eq.{uid}", "status": "in.(failed,pending)"}, {"status": "pending"})
    threading.Thread(target=provision, args=(uid, True), daemon=True).start()
    return {"ok": True}


@app.post("/api/admin/lines/{uid}/release")
def admin_release_line(uid: str, authorization: str = Header(None)):
    current_admin(authorization)
    rows = db("GET", "lines", {"user_id": f"eq.{uid}"})
    if rows and rows[0]["phone_number_id"]:
        r = requests.delete(f"{BOLNA}/phone-numbers/{rows[0]['phone_number_id']}", headers=bh(), timeout=30)
        if not r.ok:
            raise HTTPException(502, f"Bolna could not delete the number: {r.text[:120]}")
    db("PATCH", "lines", {"user_id": f"eq.{uid}"}, {"status": "cancelled", "phone_number_id": None})
    return {"ok": True}


@app.get("/api/whoami")
def whoami(authorization: str = Header(None)):
    u = auth_user(authorization)
    return {"email": u.get("email"), "is_admin": (u.get("email") or "").lower() in ADMINS and bool(u.get("email_confirmed_at"))}


@app.get("/api/invoice/{pid}")
def invoice(pid: str, authorization: str = Header(None)):
    uid = current_user(authorization)
    rows = db("GET", "payments", {"id": f"eq.{pid}", "user_id": f"eq.{uid}", "status": "eq.paid"})
    if not rows:
        raise HTTPException(404, "Invoice not found")
    return Response(content=invoice_html(rows[0]), media_type="text/html")


@app.get("/api/admin/invoice/{pid}")
def admin_invoice(pid: str, authorization: str = Header(None)):
    current_admin(authorization)
    rows = db("GET", "payments", {"id": f"eq.{pid}"})
    if not rows:
        raise HTTPException(404, "Invoice not found")
    return Response(content=invoice_html(rows[0]), media_type="text/html")


# ---------- clean URLs, per-page search tags, 404 ----------
SEO = {"/": ["Rnexa | AI Receptionist and Websites for Local Businesses in Chennai", "Rnexa builds fast websites and runs an AI receptionist that answers your missed calls, takes bookings and shows every call in your dashboard."], "/login": ["Log in | Rnexa", "Log in to your Rnexa dashboard to manage your AI receptionist, call history, minutes and invoices."], "/signup": ["Create your account | Rnexa", "Create a Rnexa account to set up your AI receptionist, get an AI phone number and see every call in your dashboard."], "/reset": ["Set a new password | Rnexa", "Choose a new password for your Rnexa account."], "/terms": ["Terms & Conditions | Rnexa", "Read the Rnexa terms for the AI receptionist service: accounts, call forwarding, minutes, invoices and the emails we send."], "/privacy": ["Privacy Policy | Rnexa", "How Rnexa collects, uses and protects your business details, call data and payment records."], "/refund": ["Refund & Cancellation Policy | Rnexa", "Rnexa refund and cancellation rules for minutes, AI phone lines and wrong or double payments."], "/contact": ["Contact Rnexa | Tondiarpet, Chennai", "Contact Rnexa by email, phone or WhatsApp, or visit us at Tondiarpet, Chennai."], "/app": ["Dashboard | Rnexa", "Your Rnexa client dashboard."], "/admin": ["Admin | Rnexa", "Rnexa admin panel."], "404": ["Page not found | Rnexa", "This page does not exist."]}
PRIVATE = {"/login", "/reset", "/app", "/admin"}
LEGAL = {"/terms", "/privacy", "/refund", "/contact"}
try:
    INDEX = open("static/index.html", encoding="utf-8").read()
    NOTFOUND = open("notfound.html", encoding="utf-8").read()
except OSError:
    INDEX = NOTFOUND = ""


def page_for(key):
    title, desc = SEO[key]
    url = "https://rnexa.in" + key
    h = re.sub(r"<title>.*?</title>", lambda _: f"<title>{_html.escape(title)}</title>", INDEX, count=1, flags=re.S)
    h = re.sub(r'(<meta name="description" content=")[^"]*', lambda x: x.group(1) + _html.escape(desc, True), h, count=1)
    h = h.replace('<link rel="canonical" href="https://rnexa.in/">', f'<link rel="canonical" href="{url}">')
    h = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda x: x.group(1) + _html.escape(title, True), h, count=1)
    h = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda x: x.group(1) + _html.escape(desc, True), h, count=1)
    h = h.replace('<meta property="og:url" content="https://rnexa.in/">', f'<meta property="og:url" content="{url}">')
    graph = [{"@type": "Organization", "name": "Rnexa", "url": "https://rnexa.in/", "logo": "https://rnexa.in/logo.png"}]
    if key in LEGAL:
        graph.append({"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://rnexa.in/"},
            {"@type": "ListItem", "position": 2, "name": title.split(" | ")[0], "item": url}]})
    ld = '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@graph": graph}) + "</script>"
    h = re.sub(r'<script type="application/ld\+json">.*?</script>', lambda _: ld, h, count=1, flags=re.S)
    if key in PRIVATE:
        h = h.replace("<link rel=\"canonical\"", '<meta name="robots" content="noindex,nofollow"><link rel="canonical"', 1)
    return h


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, exc: StarletteHTTPException):
    path = request.url.path.rstrip("/") or "/"
    if exc.status_code == 404 and request.method == "GET" and not path.startswith("/api/") and INDEX:
        key = "/" + path.split("/")[1] if path != "/" else "/"
        if key in SEO and key != "404" and (path == key or key in ("/app", "/admin")):
            return HTMLResponse(page_for(key))
        return HTMLResponse(NOTFOUND, status_code=404)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


# ---------- settings store, company details, invoices ----------
DEFAULT_COMPANY = {"name": "Rnexa", "owner": "Sajid Hussain", "address": "162/80 Nethaji Nagar 5th Street, Tondiarpet, Chennai, Tamil Nadu 600081, India",
                   "email": "ss@rnexa.in", "phone": "+91 7358145522", "gstin": "", "pan": ""}


def get_setting(key, default=None):
    try:
        r = db("GET", "app_settings", {"key": f"eq.{key}"})
        return r[0]["value"] if r else default
    except HTTPException:
        return default


def set_setting(key, value):
    if db("GET", "app_settings", {"key": f"eq.{key}"}):
        db("PATCH", "app_settings", {"key": f"eq.{key}"}, {"value": value})
    else:
        db("POST", "app_settings", json={"key": key, "value": value})


def company():
    return {**DEFAULT_COMPANY, **(get_setting("company", {}) or {})}


def invoice_inner(p):
    e = _html.escape
    prof = (db("GET", "profiles", {"id": f"eq.{p['user_id']}"}) or [{}])[0]
    pk = db("GET", "packs", {"id": f"eq.{p['pack']}"})
    item = p.get("item_text") or (pk[0]["name"] if pk else p["pack"])
    if not p.get("item_text") and p.get("calls") and p.get("kind") != "line":
        item += f" ({p['calls']} minutes)"
    co = company()
    when = datetime.fromisoformat(p["created_at"].replace("Z", "+00:00")).astimezone(IST)
    no = f"RNX-{when:%Y%m}-{p['id'][:6].upper()}"
    amt = f"{(p['amount_paise'] or 0) / 100:,.2f}"
    buyer = "<br>".join(e(x) for x in [prof.get("company_name"), prof.get("contact_name"), prof.get("billing_address"), prof.get("city")] if x)
    ids = "".join(f"<br>{k}: {e(v)}" for k, v in (("PAN", prof.get("pan")), ("GSTIN", prof.get("gstin"))) if v)
    sid = f"<br>GSTIN: {e(co['gstin'])}" if co.get("gstin") else "<br>GSTIN: Not registered"
    if co.get("pan"):
        sid += f"<br>PAN: {e(co['pan'])}"
    note = "" if co.get("gstin") else "GST: not applicable, the seller is not registered under GST. "
    th = "border-bottom:1px solid #dde2cc;padding:10px;text-align:left"
    inner = (f'<div style="font-family:Segoe UI,Arial,sans-serif;color:#192307;max-width:720px;margin:auto">'
             f'<h1 style="color:#506022;margin:0">{e(co["name"])}</h1><p><b>INVOICE</b> {no}<br>Date: {when:%d %b %Y}</p>'
             f'<table width="100%" style="margin-top:14px"><tr><td valign="top"><small style="color:#5b6648">From</small><br><b>{e(co["name"])}</b><br>{e(co["owner"])}<br>{e(co["address"])}<br>{e(co["email"])} &middot; {e(co["phone"])}{sid}</td>'
             f'<td valign="top"><small style="color:#5b6648">Billed to</small><br>{buyer}{ids}</td></tr></table>'
             f'<table width="100%" style="border-collapse:collapse;margin:22px 0"><tr><th style="{th}">Description</th><th style="{th};text-align:right">Qty</th><th style="{th};text-align:right">Amount (INR)</th></tr>'
             f'<tr><td style="{th}">{e(item)}</td><td style="{th};text-align:right">1</td><td style="{th};text-align:right">{amt}</td></tr>'
             f'<tr><td colspan="2" style="{th};text-align:right"><b>Total paid</b></td><td style="{th};text-align:right"><b>{amt}</b></td></tr></table>'
             f'<p style="font-size:12px;color:#5b6648">{note}Paid online through Razorpay (payment {e(p.get("razorpay_payment_id") or "")}). This is a computer-generated invoice and needs no signature.</p></div>')
    return inner, no, amt, prof


def invoice_html(p):
    inner, no, _, _ = invoice_inner(p)
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice {no}</title><style>body{{margin:30px 20px}}'
            f'button{{background:#506022;color:#fff;border:0;padding:10px 18px;border-radius:8px;cursor:pointer;margin-bottom:14px}}@media print{{button{{display:none}}}}</style></head>'
            f'<body><div style="max-width:720px;margin:auto;text-align:right"><button onclick="window.print()">Print / Save as PDF</button></div>{inner}</body></html>')


def email_invoice(p):
    try:
        to = email_of(p["user_id"])
        inner, no, amt, prof = invoice_inner(p)
        name = _html.escape(prof.get("contact_name") or "there")
        html = (f'<div style="background:#f4f6ee;padding:24px 10px;font-family:Segoe UI,Arial,sans-serif"><div style="max-width:720px;margin:auto;background:#fff;border-radius:16px;padding:26px;border:1px solid #dde2cc">'
                f'<img src="{SITE_URL}/logo-mark.png" width="48" alt="Rnexa logo"><h2 style="color:#192307;margin:12px 0 4px">Thank you for your purchase</h2>'
                f'<p style="color:#5b6648">Hello {name}, we received your payment of Rs. {amt}. Your invoice is below. You can download it again any time from Minutes &amp; billing in your dashboard.</p>'
                f'<hr style="border:0;border-top:1px solid #dde2cc;margin:18px 0">{inner}</div></div>')
        send_mail(to, f"Your Rnexa invoice {no} (Rs. {amt})", f"Thank you for your purchase. We received Rs. {amt}. Invoice {no}. Download it from Minutes & billing in your dashboard.\n\nRnexa", html)
    except Exception as ex:
        print("invoice email error:", ex)


class CompanyIn(BaseModel):
    name: str
    owner: str = ""
    address: str = ""
    email: str = ""
    phone: str = ""
    gstin: str = ""
    pan: str = ""


@app.get("/api/admin/company")
def admin_get_company(authorization: str = Header(None)):
    current_admin(authorization)
    return company()


@app.put("/api/admin/company")
def admin_set_company(b: CompanyIn, authorization: str = Header(None)):
    current_admin(authorization)
    g = b.gstin.strip().upper()
    if g and not re.fullmatch(r"[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]", g):
        raise HTTPException(400, "GSTIN looks wrong. It must be 15 characters.")
    set_setting("company", {**b.dict(), "gstin": g, "pan": b.pan.strip().upper()})
    return {"ok": True}


class PayEdit(BaseModel):
    item_text: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None


@app.patch("/api/admin/payments/{pid}")
def admin_edit_payment(pid: str, b: PayEdit, authorization: str = Header(None)):
    current_admin(authorization)
    f = {}
    if b.item_text is not None:
        f["item_text"] = b.item_text.strip()[:200] or None
    if b.amount is not None:
        if b.amount < 0:
            raise HTTPException(400, "Amount cannot be negative")
        f["amount_paise"] = int(round(b.amount * 100))
    if b.date:
        try:
            f["created_at"] = datetime.fromisoformat(b.date).replace(hour=12, tzinfo=IST).isoformat()
        except ValueError:
            raise HTTPException(400, "Date must look like 2026-10-05")
    if f:
        db("PATCH", "payments", {"id": f"eq.{pid}"}, f)
    return {"ok": True}


@app.delete("/api/admin/payments/{pid}")
def admin_delete_payment(pid: str, authorization: str = Header(None)):
    current_admin(authorization)
    db("DELETE", "payments", {"id": f"eq.{pid}"})
    return {"ok": True}


# ---------- website text the admin can edit ----------
class ContentIn(BaseModel):
    key: str
    text: str
    reaccept: bool = False


@app.get("/api/content")
def public_content():
    c = get_setting("content", {}) or {}
    return JSONResponse({"pages": {k: c[k] for k in ("terms", "privacy", "refund", "contact") if c.get(k)}, "faq": c.get("faq"),
                         "terms_version": c.get("terms_version")}, headers={"Cache-Control": "no-store"})


@app.put("/api/admin/content")
def admin_set_content(b: ContentIn, authorization: str = Header(None)):
    current_admin(authorization)
    if b.key not in ("terms", "privacy", "refund", "contact", "faq") or not b.text.strip():
        raise HTTPException(400, "Nothing to save")
    c = get_setting("content", {}) or {}
    c[b.key] = b.text.strip()[:30000]
    if b.key == "terms" and b.reaccept:
        c["terms_version"] = "v" + datetime.now(IST).strftime("%Y%m%d%H%M")
    set_setting("content", c)
    return {"ok": True}


@app.delete("/api/admin/content/{key}")
def admin_reset_content(key: str, authorization: str = Header(None)):
    current_admin(authorization)
    c = get_setting("content", {}) or {}
    c.pop(key, None)
    set_setting("content", c)
    return {"ok": True}


# ---------- notifications ----------
def notify(uid, title, body="", kind="message"):
    try:
        db("POST", "notifications", json={"user_id": uid, "title": title[:120], "body": body[:1000], "kind": kind})
    except Exception as ex:
        print("notify error:", ex)


def visible_notifs(uid):
    return db("GET", "notifications", {"or": f"(user_id.eq.{uid},user_id.is.null)", "order": "created_at.desc", "limit": "60"})


def read_ids(uid):
    return {r["notif_id"] for r in db("GET", "notif_reads", {"user_id": f"eq.{uid}", "select": "notif_id"})}


def unread_count(uid):
    try:
        rd = read_ids(uid)
        return sum(1 for n in visible_notifs(uid) if n["id"] not in rd)
    except Exception:
        return 0


def line_has_number(line):
    return bool(line and (line.get("phone_number") or line.get("paid_until") or line.get("status") in ("active", "paused", "provisioning")))


def has_number(uid):
    rows = db("GET", "lines", {"user_id": f"eq.{uid}"})
    return line_has_number(rows[0] if rows else None)


@app.get("/api/notifications")
def my_notifications(authorization: str = Header(None)):
    uid = current_user(authorization)
    rd = read_ids(uid)
    return [{**n, "read": n["id"] in rd} for n in visible_notifs(uid)]


@app.post("/api/notifications/read")
def read_notifications(authorization: str = Header(None)):
    uid = current_user(authorization)
    rd = read_ids(uid)
    new = [{"user_id": uid, "notif_id": n["id"]} for n in visible_notifs(uid) if n["id"] not in rd]
    if new:
        db("POST", "notif_reads", json=new)
    return {"ok": True}


class NotifIn(BaseModel):
    title: str
    body: str = ""
    kind: str = "message"
    target: str = "all"


@app.post("/api/admin/notifications")
def admin_send_notification(b: NotifIn, authorization: str = Header(None)):
    current_admin(authorization)
    if not b.title.strip():
        raise HTTPException(400, "Please write a title")
    db("POST", "notifications", json={"user_id": None if b.target == "all" else b.target, "kind": b.kind if b.kind in ("event", "offer", "message") else "message",
                                      "title": b.title.strip()[:120], "body": b.body.strip()[:1000]})
    return {"ok": True}


@app.get("/api/admin/notifications")
def admin_list_notifications(authorization: str = Header(None)):
    current_admin(authorization)
    em = {x["user_id"]: x["email"] for x in db("GET", "account_status")}
    return [{**n, "to": em.get(n["user_id"], "Unknown") if n["user_id"] else "All clients"} for n in db("GET", "notifications", {"order": "created_at.desc", "limit": "100"})]


@app.delete("/api/admin/notifications/{nid}")
def admin_delete_notification(nid: str, authorization: str = Header(None)):
    current_admin(authorization)
    db("DELETE", "notifications", {"id": f"eq.{nid}"})
    return {"ok": True}


app.mount("/", StaticFiles(directory="static", html=True), name="site")
