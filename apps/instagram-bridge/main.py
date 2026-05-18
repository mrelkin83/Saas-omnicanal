from __future__ import annotations
import json
import time
import threading
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from instagrapi import Client
from instagrapi.exceptions import (
    TwoFactorRequired,
    LoginRequired,
    BadPassword,
    ChallengeRequired,
)

app = FastAPI(title="Instagram Bridge")

SESSIONS_DIR = Path("/tmp/ig_sessions")
SESSIONS_DIR.mkdir(exist_ok=True)

# In-memory session registry: session_id -> Client
_sessions: dict[str, Client] = {}

# ── Models ────────────────────────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    tenant_id: str
    username: str
    password: str
    two_factor_code: Optional[str] = None

class SendMessageRequest(BaseModel):
    thread_id: str
    text: str

class CreateSessionResponse(BaseModel):
    session_id: str
    status: str
    requires_2fa: bool = False

# ── Helpers ───────────────────────────────────────────────────────────────────

def session_path(session_id: str) -> Path:
    return SESSIONS_DIR / f"{session_id}.json"

def load_session(session_id: str) -> Optional[Client]:
    if session_id in _sessions:
        return _sessions[session_id]
    path = session_path(session_id)
    if not path.exists():
        return None
    cl = Client()
    try:
        cl.load_settings(path)
        cl.login(cl.username, cl.password)
        _sessions[session_id] = cl
        return cl
    except Exception:
        return None

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/sessions/create", response_model=CreateSessionResponse)
def create_session(req: CreateSessionRequest):
    session_id = req.tenant_id
    cl = Client()
    cl.delay_range = [1, 3]

    saved = session_path(session_id)
    if saved.exists():
        try:
            cl.load_settings(saved)
        except Exception:
            pass

    try:
        cl.login(req.username, req.password, verification_code=req.two_factor_code or "")
    except TwoFactorRequired:
        return CreateSessionResponse(session_id=session_id, status="requires_2fa", requires_2fa=True)
    except (BadPassword, LoginRequired) as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    except ChallengeRequired:
        raise HTTPException(status_code=400, detail="Instagram challenge required — solve it manually first")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    cl.dump_settings(saved)
    _sessions[session_id] = cl
    return CreateSessionResponse(session_id=session_id, status="connected")

@app.post("/sessions/{session_id}/logout")
def logout(session_id: str):
    cl = _sessions.pop(session_id, None)
    if cl:
        try:
            cl.logout()
        except Exception:
            pass
    path = session_path(session_id)
    if path.exists():
        path.unlink()
    return {"ok": True}

@app.get("/sessions/{session_id}/status")
def status(session_id: str):
    cl = load_session(session_id)
    if not cl:
        return {"status": "disconnected"}
    return {"status": "connected", "username": cl.username}

@app.get("/sessions/{session_id}/inbox")
def inbox(session_id: str, since: Optional[float] = None):
    cl = load_session(session_id)
    if not cl:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        threads = cl.direct_threads(amount=20)
        messages = []
        since_ts = since or 0.0
        for thread in threads:
            for msg in thread.messages:
                msg_ts = msg.timestamp.timestamp() if msg.timestamp else 0
                if msg_ts <= since_ts:
                    continue
                if msg.user_id == cl.user_id:
                    continue
                user = thread.users[0] if thread.users else None
                messages.append({
                    "id": str(msg.id),
                    "thread_id": str(thread.id),
                    "from_user_id": str(msg.user_id),
                    "from_username": user.username if user else "unknown",
                    "text": msg.text or "",
                    "timestamp": msg_ts,
                })
        return {"messages": messages}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/sessions/{session_id}/messages/send")
def send_message(session_id: str, req: SendMessageRequest):
    cl = load_session(session_id)
    if not cl:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        cl.direct_send(req.text, thread_ids=[req.thread_id])
        return {"ok": True}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
