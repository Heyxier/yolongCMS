# YolongCMS Contact Server
# 轻量 HTTP 服务，接收官网 contact 表单提交并推送到 QQ
# 作为独立服务运行，不侵入 hermes-gateway 核心代码

"""
部署位置: /home/admin/yolongcms-contact/
运行方式: systemd 独立服务 (yolongcms-contact.service)
端口: 8125 (已有 8123 是 hermes 内置 HTTP Server，分开避免冲突)
"""

import json
import sqlite3
import os
import time
import httpx
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from datetime import datetime, timedelta

# ─── 配置 ───────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(__file__), "data", "contact.db")
HOST = "0.0.0.0"
PORT = 8123
RATE_LIMIT = 5        # 每小时每个 IP 允许的请求数
RATE_WINDOW = 3600    # 窗口时间（秒）

# QQ Bot 推送配置
QQ_APP_ID = os.environ.get("QQ_APP_ID", "1903939537")
QQ_CLIENT_SECRET = os.environ.get("QQ_CLIENT_SECRET", "lSwDH7k9LK5btxnP")
QQ_TARGET_USER = os.environ.get("QQ_TARGET_USER", "E53FF3D46D1FE4BECE8717A13827E31F")
QQ_API_BASE = "https://api.sgroup.qq.com"
QQ_TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken"
CORS_ORIGINS = [
    "https://heyxier.github.io",
    "https://yolongtec.com",
    "https://www.yolongtec.com",
    "http://localhost:8080",
    "http://localhost:4000",
]

# ─── 初始化数据库 ───────────────────────────────
def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            site_id     TEXT NOT NULL,
            name        TEXT NOT NULL,
            company     TEXT DEFAULT '',
            email       TEXT NOT NULL,
            phone       TEXT DEFAULT '',
            message     TEXT NOT NULL,
            ip_address  TEXT DEFAULT '',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            read        INTEGER DEFAULT 0
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_site
        ON messages(site_id, created_at)
    """)
    conn.commit()
    conn.close()

# ─── 频率限制 ───────────────────────────────────
rate_store = {}  # {ip: [timestamp, ...]}

def check_rate_limit(ip):
    now = time.time()
    cutoff = now - RATE_WINDOW
    if ip in rate_store:
        # 清理过期记录
        rate_store[ip] = [t for t in rate_store[ip] if t > cutoff]
        if len(rate_store[ip]) >= RATE_LIMIT:
            return False
        rate_store[ip].append(now)
    else:
        rate_store[ip] = [now]
    return True

# ─── 字段校验 ───────────────────────────────────
def validate_contact(data):
    errors = []
    if not data.get("name") or len(data["name"].strip()) < 1:
        errors.append("name is required")
    elif len(data["name"]) > 100:
        errors.append("name too long (max 100)")
    
    if not data.get("email") or "@" not in data.get("email", ""):
        errors.append("valid email is required")
    elif len(data["email"]) > 200:
        errors.append("email too long (max 200)")
    
    if not data.get("message") or len(data["message"].strip()) < 1:
        errors.append("message is required")
    elif len(data["message"]) > 5000:
        errors.append("message too long (max 5000)")
    
    return errors


# ─── 日志 ───────────────────────────────────────
import logging
LOG_PATH = os.path.join(os.path.dirname(__file__), "data", "contact.log")
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

# ─── QQ Bot 推送 (同步版) ────────────────────────
_token_cache = {"token": None, "expires_at": 0}

def send_qq_notification(site_id, data):
    """发送客户留言通知到 QQ（同步调用）"""
    now = time.time()
    if not _token_cache["token"] or now >= _token_cache["expires_at"] - 60:
        resp = httpx.post(
            QQ_TOKEN_URL,
            json={"appId": QQ_APP_ID, "clientSecret": QQ_CLIENT_SECRET},
        )
        resp.raise_for_status()
        body = resp.json()
        _token_cache["token"] = body["access_token"]
        _token_cache["expires_at"] = now + int(body.get("expires_in", 7200))

    msg = (
        f"📬 **新客户留言**\n"
        f"站点: {site_id}\n"
        f"姓名: {data['name']}\n"
    )
    if data.get("company"):
        msg += f"公司: {data['company']}\n"
    msg += f"邮箱: {data['email']}\n"
    if data.get("phone"):
        msg += f"电话: {data['phone']}\n"
    msg += f"---\n{data['message'][:200]}{'...' if len(data['message']) > 200 else ''}"

    resp = httpx.post(
        f"{QQ_API_BASE}/v2/users/{QQ_TARGET_USER}/messages",
        json={"content": msg, "msg_type": 0},
        headers={
            "Authorization": f"QQBot {_token_cache['token']}",
            "X-Union-Appid": QQ_APP_ID,
        },
    )
    if resp.status_code != 200:
        logging.error(f"[QQ] 推送失败 status={resp.status_code} body={resp.text}")
        raise RuntimeError(f"QQ push failed: {resp.status_code}")
    else:
        logging.info(f"[QQ] 推送成功 → {QQ_TARGET_USER}")


# ─── HTTP Handler ──────────────────────────────
class ContactHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._send_cors()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
    
    def _send_cors(self):
        origin = self.headers.get("Origin", "")
        if origin in CORS_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
    
    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()
    
    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        
        # POST /api/contact/{site_id}
        if path.startswith("/api/contact/"):
            site_id = path.split("/api/contact/")[-1]
            if not site_id:
                self._send_json(400, {"error": "missing site_id"})
                return
            
            # 读取请求体
            content_len = int(self.headers.get("Content-Length", 0))
            if content_len == 0:
                self._send_json(400, {"error": "empty body"})
                return
            
            body = self.rfile.read(content_len)
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                self._send_json(400, {"error": "invalid JSON"})
                return
            
            # 校验字段
            errors = validate_contact(data)
            if errors:
                self._send_json(422, {"error": "validation failed", "details": errors})
                return
            
            # 频率限制
            client_ip = self.client_address[0]
            if not check_rate_limit(client_ip):
                self._send_json(429, {"error": "too many requests, try later"})
                return
            
            # 写入数据库
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.execute(
                "INSERT INTO messages (site_id, name, company, email, phone, message, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (site_id, data["name"].strip(), data.get("company", "").strip(),
                 data["email"].strip(), data.get("phone", "").strip(),
                 data["message"].strip(), client_ip)
            )
            msg_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            # 返回成功
            self._send_json(200, {"status": "ok", "message_id": msg_id})
            
            # 打印日志 + 推送 QQ
            print(f"\n📬 [新留言] site={site_id} id={msg_id}")
            print(f"   姓名: {data['name']}")
            print(f"   公司: {data.get('company', '-')}")
            print(f"   邮箱: {data['email']}")
            print(f"   电话: {data.get('phone', '-')}")
            print(f"   内容: {data['message'][:100]}...\n")
            
            # 推送到 QQ
            try:
                send_qq_notification(site_id, data)
            except Exception as e:
                logging.error(f"[QQ] 推送异常: {e}")
        
        else:
            self._send_json(404, {"error": "not found"})
    
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        
        # GET /api/messages/{site_id}
        if path.startswith("/api/messages/"):
            site_id = path.split("/api/messages/")[-1]
            if not site_id:
                self._send_json(400, {"error": "missing site_id"})
                return
            
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM messages WHERE site_id = ? ORDER BY created_at DESC LIMIT 100",
                (site_id,)
            )
            rows = cursor.fetchall()
            conn.close()
            
            items = []
            for row in rows:
                items.append({
                    "id": row["id"],
                    "name": row["name"],
                    "company": row["company"],
                    "email": row["email"],
                    "phone": row["phone"],
                    "message": row["message"],
                    "created_at": row["created_at"],
                    "read": bool(row["read"]),
                })
            
            self._send_json(200, {"total": len(items), "items": items})
        
        # GET /health
        elif path == "/health":
            self._send_json(200, {"status": "ok", "service": "yolongcms-contact"})
        
        else:
            self._send_json(404, {"error": "not found"})
    
    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        
        # DELETE /api/messages/{id}
        if path.startswith("/api/messages/"):
            msg_id = path.split("/api/messages/")[-1]
            try:
                msg_id = int(msg_id)
            except ValueError:
                self._send_json(400, {"error": "invalid id"})
                return
            
            conn = sqlite3.connect(DB_PATH)
            conn.execute("DELETE FROM messages WHERE id = ?", (msg_id,))
            conn.commit()
            conn.close()
            
            self._send_json(200, {"status": "ok"})
        else:
            self._send_json(404, {"error": "not found"})
    
    def log_message(self, format, *args):
        # 静默日志（不打印每次请求）
        pass


# ─── 启动 ───────────────────────────────────────
if __name__ == "__main__":
    init_db()
    server = HTTPServer((HOST, PORT), ContactHandler)
    print(f"✅ YolongCMS Contact Server running on http://{HOST}:{PORT}")
    print(f"   POST   /api/contact/<site_id>  — 接收联系表单")
    print(f"   GET    /api/messages/<site_id>  — 拉取留言列表")
    print(f"   DELETE /api/messages/<id>       — 删除留言")
    print(f"   GET    /health                  — 健康检查")
    print(f"   DB: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
        server.server_close()
