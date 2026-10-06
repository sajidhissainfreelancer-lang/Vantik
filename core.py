"""Rnexa AI Caller - core logic (Bolna API + Excel handling)."""
import re
import time
import requests
import pandas as pd

BASE = "https://api.bolna.ai"
FAIL = {"failed", "busy", "no-answer", "canceled", "stopped", "balance-low", "error"}
RESULT_COLS = ["interest_level", "requirement", "callback_time", "has_domain", "next_step"]


def clean_phone(p):
    """Return +91XXXXXXXXXX style number, or None if invalid."""
    s = re.sub(r"[^\d+]", "", str(p).replace(".0", "") if str(p).endswith(".0") else str(p))
    if s.startswith("+"):
        return s if len(s) >= 11 else None
    if len(s) == 10:
        return "+91" + s
    if len(s) == 12 and s.startswith("91"):
        return "+" + s
    return None


def flatten_extracted(data):
    """Find every {'subjective': ...} block and return {field_name: value}."""
    out = {}

    def walk(node, name=None):
        if isinstance(node, dict):
            if "subjective" in node and name:
                out[name] = node["subjective"]
                return
            for k, v in node.items():
                walk(v, k)

    walk(data or {})
    return out


def make_remark(r):
    level = str(r.get("interest_level") or "").lower()
    if level in ("", "none") and not r.get("summary"):
        return "No result"
    parts = [f"Interest: {level or 'unknown'}"]
    if r.get("requirement"):
        parts.append(f"Needs: {r['requirement']}")
    if r.get("callback_time") and str(r["callback_time"]).lower() != "none":
        parts.append(f"Callback: {r['callback_time']}")
    if r.get("next_step"):
        parts.append(f"Next: {r['next_step']}")
    return " | ".join(parts)


class Bolna:
    def __init__(self, api_key, agent_id):
        self.h = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        self.agent_id = agent_id

    def start_call(self, phone, user_data):
        r = requests.post(f"{BASE}/call", headers=self.h, timeout=30, json={
            "agent_id": self.agent_id,
            "recipient_phone_number": phone,
            "user_data": user_data,
        })
        r.raise_for_status()
        return r.json()["execution_id"]

    def wait_result(self, execution_id, timeout=600, every=5):
        end = time.time() + timeout
        while time.time() < end:
            r = requests.get(f"{BASE}/executions/{execution_id}", headers=self.h, timeout=30)
            r.raise_for_status()
            ex = r.json()
            status = ex.get("status", "")
            if status == "completed" or status in FAIL:
                return ex
            time.sleep(every)
        return {"status": "timeout"}


def process_row(client, row, phone_col, on_status=None, extra=None):
    """Call one lead, return dict of result columns."""
    phone = clean_phone(row[phone_col])
    if not phone:
        return {"call_status": "invalid phone number"}
    user_data = {k: ("" if pd.isna(v) else str(v)) for k, v in row.items() if k != phone_col}
    for k, v in (extra or {}).items():
        user_data.setdefault(k, v)
    if not user_data.get("customer_name"):
        user_data["customer_name"] = "there"
    try:
        eid = client.start_call(phone, user_data)
        ex = client.wait_result(eid)
    except Exception as e:  # network / API error: keep going with other rows
        return {"call_status": f"error: {e}"}
    res = {"call_status": ex.get("status"), "execution_id": eid}
    res["duration_sec"] = ex.get("conversation_duration")
    fields = flatten_extracted(ex.get("extracted_data"))
    for c in RESULT_COLS:
        res[c] = fields.get(c)
    res["summary"] = fields.get("Call Summary") or ex.get("summary")
    res["remark"] = make_remark(res)
    return res


def process_dataframe(df, client, phone_col="phone_number", max_calls=1, progress=None):
    out = []
    for i, (_, row) in enumerate(df.iterrows()):
        if i >= max_calls:
            res = {"call_status": "skipped (call limit)"}
        else:
            res = process_row(client, row, phone_col)
        out.append(res)
        if progress:
            progress(i + 1, len(df), res)
    return pd.concat([df.reset_index(drop=True), pd.DataFrame(out)], axis=1)
