import json
import os
import time
import urllib.request
import urllib.parse
import base64
import csv
import urllib.error
from flask import Flask, request, jsonify
import smtplib
from email.message import EmailMessage
import socket
import hashlib
import mimetypes

app = Flask(__name__)

def http_json(url, payload, headers):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def http_get_json(url, headers):
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

@app.after_request
def add_cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    resp.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
    return resp

@app.route("/generate", methods=["POST", "OPTIONS"])
def generate():
    if request.method == "OPTIONS":
        return ("", 200)
    try:
        body = request.get_json(silent=True) or {}
    except Exception:
        body = {}
    prompt = body.get("prompt", "")
    creds = {"apiKey": None, "model": "gpt-4o-mini", "assistantId": None}
    base_dir = os.path.dirname(os.path.abspath(__file__))
    secrets_path = os.path.join(base_dir, "secrets.json")
    try:
        with open(secrets_path, "r", encoding="utf-8") as f:
            obj = json.load(f)
            creds["apiKey"] = obj.get("apiKey") or obj.get("OPENAI_API_KEY")
            creds["assistantId"] = obj.get("assistantId") or obj.get("OPENAI_ASSISTANT_ID")
            creds["model"] = obj.get("model") or creds["model"]
    except Exception:
        pass
    env_api = os.environ.get("OPENAI_API_KEY")
    env_asst = os.environ.get("OPENAI_ASSISTANT_ID")
    env_model = os.environ.get("OPENAI_MODEL")
    api_key = env_api or creds["apiKey"]
    assistant_id = env_asst or creds["assistantId"]
    model = creds["model"]
    if env_model:
        model = env_model
    if not api_key:
        return jsonify({"error": "missing_key"}), 400
    try:
        if assistant_id:
            th = http_json(
                "https://api.openai.com/v1/threads",
                {"messages": [{"role": "user", "content": prompt}]},
                {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + api_key,
                    "OpenAI-Beta": "assistants=v2",
                },
            )
            thread_id = th["id"]
            run = http_json(
                f"https://api.openai.com/v1/threads/{thread_id}/runs",
                {"assistant_id": assistant_id},
                {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + api_key,
                    "OpenAI-Beta": "assistants=v2",
                },
            )
            run_id = run["id"]
            status = run.get("status")
            while status in ("queued", "in_progress", "requires_action"):
                time.sleep(1)
                run = http_get_json(
                    f"https://api.openai.com/v1/threads/{thread_id}/runs/{run_id}",
                    {
                        "Authorization": "Bearer " + api_key,
                        "OpenAI-Beta": "assistants=v2",
                    },
                )
                status = run.get("status")
            if status != "completed":
                raise RuntimeError("run_failed")
            msgs = http_get_json(
                f"https://api.openai.com/v1/threads/{thread_id}/messages",
                {
                    "Authorization": "Bearer " + api_key,
                    "OpenAI-Beta": "assistants=v2",
                },
            )
            text = ""
            for m in msgs.get("data", []):
                if m.get("role") == "assistant":
                    c = m.get("content", [])
                    if c and c[0] and c[0].get("text"):
                        text = c[0]["text"].get("value", "")
                        break
        else:
            resp = http_json(
                "https://api.openai.com/v1/chat/completions",
                {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": "Sei MusicLab, un paroliere e cantautore italiano per bambini. Rispondi solo con il testo completo della canzone."},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.7,
                },
                {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + api_key,
                },
            )
            text = resp.get("choices", [{}])[0].get("message", {}).get("content", "")
        return jsonify({"text": text}), 200
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "http_" + str(e.code), "detail": body}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _smtp_config():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    secrets_path = os.path.join(base_dir, "secrets.json")
    with open(secrets_path, "r", encoding="utf-8") as f:
        obj = json.load(f)
    host = obj.get("smtpHost")
    port = int(obj.get("smtpPort") or 465)
    user = obj.get("smtpUser")
    pwd = obj.get("smtpPass")
    use_ssl = bool(obj.get("smtpSSL", True))
    if not host or not user or not pwd:
        raise RuntimeError("smtp_missing_config")
    return host, port, user, pwd, use_ssl

def send_email(to_addrs, subject: str, body_text: str, body_html: str | None = None, cc_addrs=None, bcc_addrs=None):
    host, port, user, pwd, use_ssl = _smtp_config()
    if not (user and pwd and host and port):
        raise RuntimeError("smtp_not_configured")
    if isinstance(to_addrs, str):
        to_list = [to_addrs]
    else:
        to_list = list(to_addrs or [])
    cc_list = list(cc_addrs or [])
    bcc_list = list(bcc_addrs or [])
    if not to_list and not cc_list and not bcc_list:
        raise RuntimeError("missing_recipients")
    msg = EmailMessage()
    msg["From"] = user
    if to_list:
        msg["To"] = ", ".join(to_list)
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)
    msg["Subject"] = subject
    if body_html:
        msg.set_content(body_text)
        msg.add_alternative(body_html, subtype="html")
    else:
        msg.set_content(body_text)
    all_rcpts = to_list + cc_list + bcc_list
    if use_ssl:
        with smtplib.SMTP_SSL(host, port) as s:
            s.login(user, pwd)
            s.send_message(msg, to_addrs=all_rcpts)
    else:
        with smtplib.SMTP(host, port) as s:
            s.starttls()
            s.login(user, pwd)
            s.send_message(msg, to_addrs=all_rcpts)

def _b2_config():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    secrets_path = os.path.join(base_dir, "secrets.json")
    obj = {}
    try:
        with open(secrets_path, "r", encoding="utf-8") as f:
            obj = json.load(f)
    except Exception:
        obj = {}
    key_id = str(obj.get("b2KeyId") or "").strip()
    app_key = str(obj.get("b2AppKey") or "").strip()
    bucket_id = str(obj.get("b2BucketId") or "").strip()
    bucket_name = str(obj.get("b2BucketName") or "").strip()
    if not key_id or not app_key or not bucket_id or not bucket_name:
        raise RuntimeError("b2_missing_config")
    return key_id, app_key, bucket_id, bucket_name

def _gdrive_config():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    secrets_path = os.path.join(base_dir, "secrets.json")
    obj = {}
    try:
        with open(secrets_path, "r", encoding="utf-8") as f:
            obj = json.load(f)
    except Exception:
        obj = {}
    cid = str(obj.get("googleClientId") or "").strip()
    csec = str(obj.get("googleClientSecret") or "").strip()
    rtok = str(obj.get("googleRefreshToken") or "").strip()
    folder_id = str(obj.get("googleDriveFolderId") or "").strip()
    if not cid or not csec or not rtok:
        raise RuntimeError("gdrive_missing_config")
    return cid, csec, rtok, folder_id

def gdrive_get_access_token(client_id: str, client_secret: str, refresh_token: str):
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode("utf-8")
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    url = "https://oauth2.googleapis.com/token"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        j = json.loads(raw)
        return j.get("access_token")

def gdrive_upload_file(access_token: str, file_name: str, content_type: str, data_bytes: bytes, folder_id: str | None):
    boundary = "MLBOUNDARY" + str(int(time.time()))
    meta = {"name": file_name}
    if folder_id:
        meta["parents"] = [folder_id]
    body = (
        "--" + boundary + "\r\n" +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        json.dumps(meta) + "\r\n" +
        "--" + boundary + "\r\n" +
        "Content-Type: " + (content_type or "application/octet-stream") + "\r\n\r\n"
    ).encode("utf-8") + data_bytes + ("\r\n--" + boundary + "--\r\n").encode("utf-8")
    headers = {
        "Authorization": "Bearer " + access_token,
        "Content-Type": "multipart/related; boundary=" + boundary,
    }
    url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        j = json.loads(raw)
        return j.get("id"), j

def gdrive_make_public(access_token: str, file_id: str):
    headers = {"Authorization": "Bearer " + access_token, "Content-Type": "application/json"}
    data = json.dumps({"role": "reader", "type": "anyone"}).encode("utf-8")
    url = f"https://www.googleapis.com/drive/v3/files/{file_id}/permissions"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {"raw": raw}

def gdrive_file_link(file_id: str):
    if not file_id:
        return None, None
    view = f"https://drive.google.com/file/d/{file_id}/view?usp=sharing"
    direct = f"https://drive.google.com/uc?id={file_id}&export=download"
    return view, direct

def b2_authorize(key_id: str, app_key: str):
    auth = base64.b64encode((key_id + ":" + app_key).encode("utf-8")).decode("ascii")
    headers = {"Authorization": "Basic " + auth}
    url = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)

def b2_get_upload_url(api_url: str, account_auth_token: str, bucket_id: str):
    headers = {"Authorization": account_auth_token, "Content-Type": "application/json"}
    data = json.dumps({"bucketId": bucket_id}).encode("utf-8")
    url = api_url + "/b2api/v2/b2_get_upload_url"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)

def b2_list_buckets(api_url: str, account_auth_token: str):
    headers = {"Authorization": account_auth_token, "Content-Type": "application/json"}
    # Backblaze requires accountId; we can derive from authorize response token not easily; use empty body as allowed
    data = json.dumps({}).encode("utf-8")
    url = api_url + "/b2api/v2/b2_list_buckets"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)

def b2_upload_file(upload_url: str, upload_auth_token: str, file_name: str, content_type: str, data_bytes: bytes):
    sha1 = hashlib.sha1(data_bytes).hexdigest()
    headers = {
        "Authorization": upload_auth_token,
        "X-Bz-File-Name": urllib.parse.quote(file_name),
        "Content-Type": content_type,
        "X-Bz-Content-Sha1": sha1,
    }
    req = urllib.request.Request(upload_url, data=data_bytes, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)

def b2_get_download_authorization(api_url: str, account_auth_token: str, bucket_id: str, prefix: str, seconds: int):
    headers = {"Authorization": account_auth_token, "Content-Type": "application/json"}
    data = json.dumps({"bucketId": bucket_id, "fileNamePrefix": prefix, "validDurationInSeconds": int(seconds)}).encode("utf-8")
    url = api_url + "/b2api/v2/b2_get_download_authorization"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)

@app.route("/send-email", methods=["POST", "OPTIONS"])
def send_email_route():
    if request.method == "OPTIONS":
        return ("", 200)
    body = request.get_json(silent=True) or {}
    if not body:
        try:
            f = request.form or {}
            body = {k: (f.getlist(k) if len(f.getlist(k)) > 1 else f.get(k)) for k in f.keys()}
        except Exception:
            body = {}
    to_any = body.get("to") or body.get("to_addrs") or body.get("toAddrs")
    cc_any = body.get("cc") or []
    bcc_any = body.get("bcc") or []
    subject = body.get("subject") or "MusicLab — Link download"
    text = body.get("text") or "Riceverai a breve il link per scaricare la tua canzone."
    html = body.get("html")
    if isinstance(to_any, str):
        to_list = [to_any]
    elif isinstance(to_any, list):
        to_list = to_any
    else:
        to_list = []
    if isinstance(cc_any, str):
        cc_list = [cc_any]
    elif isinstance(cc_any, list):
        cc_list = cc_any
    else:
        cc_list = []
    if isinstance(bcc_any, str):
        bcc_list = [bcc_any]
    elif isinstance(bcc_any, list):
        bcc_list = bcc_any
    else:
        bcc_list = []
    if not to_list and not cc_list and not bcc_list:
        return jsonify({"error": "missing_to"}), 400
    try:
        send_email(to_list, subject, text, html, cc_addrs=cc_list, bcc_addrs=bcc_list)
        return jsonify({"ok": True}), 200
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except smtplib.SMTPAuthenticationError as e:
        code = getattr(e, "smtp_code", None)
        err = getattr(e, "smtp_error", "")
        if isinstance(err, bytes):
            try:
                err = err.decode("utf-8")
            except Exception:
                err = str(err)
        return jsonify({"error": "smtp_auth_failed", "code": code, "detail": err}), 401
    except smtplib.SMTPConnectError as e:
        return jsonify({"error": "smtp_connect_error", "code": getattr(e, "smtp_code", None), "detail": str(e)}), 502
    except smtplib.SMTPRecipientsRefused as e:
        return jsonify({"error": "smtp_recipients_refused", "detail": {k: str(v) for k, v in (e.recipients or {}).items()}}), 400

@app.route("/upload-to-b2", methods=["POST", "OPTIONS"])
def upload_to_b2_route():
    if request.method == "OPTIONS":
        return ("", 200)
    body = request.get_json(silent=True) or {}
    file_name = str(body.get("fileName") or "").strip()
    content_b64 = body.get("contentBase64")
    content_type = str(body.get("contentType") or "application/octet-stream").strip()
    expires = int(body.get("expiresSec") or 86400)
    if not file_name or not content_b64:
        return jsonify({"error": "missing_params"}), 400
    try:
        key_id, app_key, bucket_id, bucket_name = _b2_config()
        auth = b2_authorize(key_id, app_key)
        api_url = auth.get("apiUrl")
        account_token = auth.get("authorizationToken")
        download_url = auth.get("downloadUrl")
        data_bytes = base64.b64decode(content_b64)
        up = b2_get_upload_url(api_url, account_token, bucket_id)
        upload_url = up.get("uploadUrl")
        upload_token = up.get("authorizationToken")
        b2_upload_file(upload_url, upload_token, file_name, content_type, data_bytes)
        dl = b2_get_download_authorization(api_url, account_token, bucket_id, file_name, expires)
        token = dl.get("authorizationToken")
        url = f"{download_url}/file/{bucket_name}/{urllib.parse.quote(file_name)}?Authorization={token}"
        return jsonify({"ok": True, "url": url}), 200
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "b2_http_" + str(e.code), "detail": body}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/publish-codiciapp", methods=["POST", "OPTIONS"])
def publish_codiciapp_route():
    if request.method == "OPTIONS":
        return ("", 200)
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(base_dir, "CodiciAPP.csv"),
            os.path.join(base_dir, "CodiciApp.csv"),
            os.path.join(base_dir, "CodiciAPP.txt"),
            os.path.join(base_dir, "CodiciAPP"),
        ]
        path = None
        for p in candidates:
            if os.path.exists(p):
                path = p
                break
        if not path:
            return jsonify({"error": "missing_file"}), 404
        with open(path, "rb") as f:
            data_bytes = f.read()
        file_name = os.path.basename(path)
        try:
            key_id, app_key, bucket_id, bucket_name = _b2_config()
            auth = b2_authorize(key_id, app_key)
            api_url = auth.get("apiUrl")
            account_token = auth.get("authorizationToken")
            download_url = auth.get("downloadUrl")
            up = b2_get_upload_url(api_url, account_token, bucket_id)
            upload_url = up.get("uploadUrl")
            upload_token = up.get("authorizationToken")
            up_res = b2_upload_file(upload_url, upload_token, file_name, "text/csv", data_bytes)
            dl = None
            url = f"{download_url}/file/{bucket_name}/{urllib.parse.quote(file_name)}"
            proxy_url = "/download-codiciapp?name=" + urllib.parse.quote(file_name)
            try:
                dl = b2_get_download_authorization(api_url, account_token, bucket_id, file_name, int(86400))
            except Exception:
                dl = None
            return jsonify({"ok": True, "url": url, "proxyUrl": proxy_url, "file": file_name, "upload": up_res}), 200
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8")
            except Exception:
                body = ""
            return jsonify({"error": "b2_http_" + str(e.code), "detail": body, "stage": "upload_or_auth"}), e.code
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/upload-to-drive", methods=["POST", "OPTIONS"])
def upload_to_drive_route():
    if request.method == "OPTIONS":
        return ("", 200)
    body = request.get_json(silent=True) or {}
    file_name = str(body.get("fileName") or "").strip()
    content_b64 = body.get("contentBase64")
    content_type = str(body.get("contentType") or "application/octet-stream").strip()
    if not file_name or not content_b64:
        return jsonify({"error": "missing_params"}), 400
    try:
        cid, csec, rtok, folder_id = _gdrive_config()
        token = gdrive_get_access_token(cid, csec, rtok)
        if not token:
            return jsonify({"error": "gdrive_token_failed"}), 401
        data_bytes = base64.b64decode(content_b64)
        fid, meta = gdrive_upload_file(token, file_name, content_type, data_bytes, folder_id or None)
        if not fid:
            return jsonify({"error": "gdrive_upload_failed", "detail": meta}), 500
        gdrive_make_public(token, fid)
        view, direct = gdrive_file_link(fid)
        return jsonify({"ok": True, "fileId": fid, "viewUrl": view, "downloadUrl": direct, "meta": meta}), 200
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "gdrive_http_" + str(e.code), "detail": body}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/publish-codiciapp-drive", methods=["POST", "OPTIONS"])
def publish_codiciapp_drive_route():
    if request.method == "OPTIONS":
        return ("", 200)
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(base_dir, "CodiciAPP.csv"),
            os.path.join(base_dir, "CodiciApp.csv"),
            os.path.join(base_dir, "CodiciAPP.txt"),
            os.path.join(base_dir, "CodiciAPP"),
        ]
        path = None
        for p in candidates:
            if os.path.exists(p):
                path = p
                break
        if not path:
            return jsonify({"error": "missing_file"}), 404
        with open(path, "rb") as f:
            data_bytes = f.read()
        file_name = os.path.basename(path)
        cid, csec, rtok, folder_id = _gdrive_config()
        token = gdrive_get_access_token(cid, csec, rtok)
        if not token:
            return jsonify({"error": "gdrive_token_failed"}), 401
        fid, meta = gdrive_upload_file(token, file_name, "text/csv", data_bytes, folder_id or None)
        if not fid:
            return jsonify({"error": "gdrive_upload_failed", "detail": meta}), 500
        gdrive_make_public(token, fid)
        view, direct = gdrive_file_link(fid)
        return jsonify({"ok": True, "fileId": fid, "viewUrl": view, "downloadUrl": direct, "file": file_name, "meta": meta}), 200
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "gdrive_http_" + str(e.code), "detail": body}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/download-codiciapp", methods=["GET"])
def download_codiciapp_route():
    name = request.args.get("name") or "CodiciAPP.csv"
    try:
        key_id, app_key, bucket_id, bucket_name = _b2_config()
        auth = b2_authorize(key_id, app_key)
        download_url = auth.get("downloadUrl")
        account_token = auth.get("authorizationToken")
        url = f"{download_url}/file/{bucket_name}/{urllib.parse.quote(name)}"
        headers = {"Authorization": account_token}
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            # Return raw CSV
            return data, 200, {
                "Content-Type": "text/csv",
                "Content-Disposition": f"attachment; filename=\"{name}\"",
            }
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "b2_http_" + str(e.code), "detail": body}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    except smtplib.SMTPSenderRefused as e:
        return jsonify({"error": "smtp_sender_refused", "code": getattr(e, "smtp_code", None), "detail": str(e)}), 400
    except smtplib.SMTPDataError as e:
        return jsonify({"error": "smtp_data_error", "code": getattr(e, "smtp_code", None), "detail": str(e)}), 500
    except smtplib.SMTPHeloError as e:
        return jsonify({"error": "smtp_helo_error", "detail": str(e)}), 500
    except socket.timeout as e:
        return jsonify({"error": "smtp_timeout", "detail": str(e)}), 504
    except socket.gaierror as e:
        return jsonify({"error": "smtp_dns_error", "detail": str(e)}), 502
    except smtplib.SMTPException as e:
        return jsonify({"error": "smtp_error", "detail": str(e)}), 500
    except Exception as e:
        return jsonify({"error": "unknown_error", "detail": str(e)}), 500

@app.route("/verify-code", methods=["POST", "OPTIONS"])
def verify_code_route():
    if request.method == "OPTIONS":
        return ("", 200)
    body = request.get_json(silent=True) or {}
    code = str(body.get("code") or "").strip()
    if not code:
        return jsonify({"error": "missing_code"}), 400
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, "CodiciAPP.csv"),
        os.path.join(base_dir, "CodiciAPP.txt"),
        os.path.join(base_dir, "CodiciAPP"),
    ]
    path = None
    for p in candidates:
        if os.path.exists(p):
            path = p
            break
    if not path:
        return jsonify({"error": "missing_file"}), 500
    try:
        def parse_rows(fp):
            txt = fp.read()
            if isinstance(txt, bytes):
                try:
                    txt = txt.decode("utf-8")
                except Exception:
                    txt = txt.decode("latin-1")
            txt = txt.replace("\r\n", "\n").replace("\r", "\n")
            # Try CSV with comma and semicolon
            for delim in (",", ";"):
                fp2 = txt
                lines = [l for l in fp2.split("\n") if l.strip()]
                reader = csv.reader(lines, delimiter=delim)
                rows = list(reader)
                if rows and len(rows[0]) >= 2:
                    yield rows
        with open(path, "rb") as f:
            found = False
            used = False
            for rows in parse_rows(f):
                headers = [h.strip().lower() for h in (rows[0] or [])]
                # Find indices
                try:
                    i_code = headers.index("codice")
                except ValueError:
                    try:
                        i_code = headers.index("code")
                    except ValueError:
                        i_code = 0
                try:
                    i_used = headers.index("utilizzato")
                except ValueError:
                    i_used = None
                for r in rows[1:]:
                    if len(r) <= i_code:
                        continue
                    c = str(r[i_code]).strip()
                    if not c:
                        continue
                    if c == code:
                        found = True
                        if i_used is not None and len(r) > i_used:
                            u = str(r[i_used]).strip().upper()
                            used = (u == "Y")
                        break
                if found:
                    break
            return jsonify({"found": found, "used": used}), 200
    except Exception as e:
        return jsonify({"error": "parse_error", "detail": str(e)}), 500

@app.route("/mark-code-used", methods=["POST", "OPTIONS"])
def mark_code_used_route():
    if request.method == "OPTIONS":
        return ("", 200)
    body = request.get_json(silent=True) or {}
    code = str(body.get("code") or "").strip()
    email = str(body.get("email") or "").strip()
    date_iso = str(body.get("date") or "").strip()
    voice = str(body.get("voice") or "").strip()
    otp = str(body.get("otp") or "").strip()
    if not code:
        return jsonify({"error": "missing_code"}), 400
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, "CodiciAPP.csv"),
        os.path.join(base_dir, "CodiciAPP.txt"),
        os.path.join(base_dir, "CodiciAPP"),
    ]
    path = None
    for p in candidates:
        if os.path.exists(p):
            path = p
            break
    if not path:
        return jsonify({"error": "missing_file"}), 500
    try:
        with open(path, "rb") as f:
            raw = f.read()
        try:
            text = raw.decode("utf-8")
        except Exception:
            text = raw.decode("latin-1")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        sample = text.split("\n", 5)
        sample_txt = "\n".join(sample)
        try:
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample_txt, delimiters=[",", ";", "\t"]) 
            delimiter = dialect.delimiter
        except Exception:
            delimiter = ","
        lines = [l for l in text.split("\n") if l.strip()]
        reader = csv.reader(lines, delimiter=delimiter)
        rows = list(reader)
        if not rows:
            return jsonify({"error": "empty_file"}), 500
        headers = [h.strip().lower() for h in (rows[0] or [])]
        def idx(name, default=None):
            try:
                return headers.index(name)
            except ValueError:
                return default
        i_code = idx("codice", 0)
        i_used = idx("utilizzato", None)
        i_date = idx("data utilizzo", None)
        i_email = idx("indirizzo mail", None)
        i_voice = idx("generazionevoce", None)
        i_otp = idx("codice otp", None)
        if i_otp is None and otp:
            rows[0].append("Codice OTP")
            headers = [h.strip().lower() for h in (rows[0] or [])]
            i_otp = len(rows[0]) - 1
        found = False
        for i in range(1, len(rows)):
            r = rows[i]
            if i_code is not None and len(r) > i_code and str(r[i_code]).strip() == code:
                found = True
                if i_used is not None:
                    if len(r) <= i_used:
                        r.extend([""] * (i_used - len(r) + 1))
                    r[i_used] = "Y"
                if i_date is not None and date_iso:
                    if len(r) <= i_date:
                        r.extend([""] * (i_date - len(r) + 1))
                    r[i_date] = date_iso
                if i_email is not None and email:
                    if len(r) <= i_email:
                        r.extend([""] * (i_email - len(r) + 1))
                    r[i_email] = email
                if i_voice is not None and voice:
                    if len(r) <= i_voice:
                        r.extend([""] * (i_voice - len(r) + 1))
                    r[i_voice] = voice
                if i_otp is not None and otp:
                    if len(r) <= i_otp:
                        r.extend([""] * (i_otp - len(r) + 1))
                    r[i_otp] = otp
                rows[i] = r
                break
        if not found:
            return jsonify({"error": "not_found"}), 404
        max_len = len(rows[0])
        for i in range(len(rows)):
            if len(rows[i]) < max_len:
                rows[i].extend([""] * (max_len - len(rows[i])))
        with open(path, "w", encoding="utf-8", newline="") as wf:
            writer = csv.writer(wf, delimiter=delimiter)
            for r in rows:
                writer.writerow(r)
        return jsonify({"ok": True}), 200
    except Exception as e:
        return jsonify({"error": "write_error", "detail": str(e)}), 500

def _twilio_config():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    secrets_path = os.path.join(base_dir, "secrets.json")
    obj = {}
    try:
        with open(secrets_path, "r", encoding="utf-8") as f:
            obj = json.load(f)
    except Exception:
        obj = {}
    sid = os.environ.get("TWILIO_ACCOUNT_SID") or obj.get("twilioSid")
    token = os.environ.get("TWILIO_AUTH_TOKEN") or obj.get("twilioToken")
    from_number = os.environ.get("TWILIO_FROM") or obj.get("twilioFrom")
    if not sid or not token or not from_number:
        raise RuntimeError("twilio_missing_config")
    return sid, token, from_number

def send_sms(to_number: str, body: str):
    sid, token, from_number = _twilio_config()
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    auth = base64.b64encode((sid + ":" + token).encode("utf-8")).decode("ascii")
    headers = {
        "Authorization": "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    payload = {"To": to_number, "Body": body, "From": from_number}
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {"raw": raw}

def _twilio_verify_config():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    secrets_path = os.path.join(base_dir, "secrets.json")
    obj = {}
    try:
        with open(secrets_path, "r", encoding="utf-8") as f:
            obj = json.load(f)
    except Exception:
        obj = {}
    sid = os.environ.get("TWILIO_ACCOUNT_SID") or obj.get("twilioSid")
    token = os.environ.get("TWILIO_AUTH_TOKEN") or obj.get("twilioToken")
    verify_sid = os.environ.get("TWILIO_VERIFY_SID") or obj.get("twilioVerifySid") or obj.get("twilioMessagingServiceSid")
    # Se l'utente ha fornito un SID che inizia con VA..., consideralo Verify SID
    if verify_sid and not str(verify_sid).startswith("VA"):
        # Non è un Verify SID
        pass
    if not sid or not token or not verify_sid:
        raise RuntimeError("twilio_verify_missing_config")
    return sid, token, verify_sid

def twilio_verify_start(to_number: str):
    sid, token, service_sid = _twilio_verify_config()
    url = f"https://verify.twilio.com/v2/Services/{service_sid}/Verifications"
    data = urllib.parse.urlencode({
        "To": to_number,
        "Channel": "sms",
    }).encode("utf-8")
    auth = base64.b64encode((sid + ":" + token).encode("utf-8")).decode("ascii")
    headers = {
        "Authorization": "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {"raw": raw}

def twilio_verify_check(to_number: str, code: str):
    sid, token, service_sid = _twilio_verify_config()
    url = f"https://verify.twilio.com/v2/Services/{service_sid}/VerificationCheck"
    data = urllib.parse.urlencode({
        "To": to_number,
        "Code": code,
    }).encode("utf-8")
    auth = base64.b64encode((sid + ":" + token).encode("utf-8")).decode("ascii")
    headers = {
        "Authorization": "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {"raw": raw}

@app.route("/send-otp", methods=["POST", "OPTIONS"])
def send_otp_route():
    if request.method == "OPTIONS":
        return ("", 200)
    body = request.get_json(silent=True) or {}
    to = body.get("to")
    code = body.get("code")
    if not to or not code:
        return jsonify({"error": "missing_params"}), 400
    try:
        # Invia sempre OTP personalizzato via SMS
        msg = f"Il tuo codice OTP è: {code}"
        res = send_sms(to, msg)
        sid = (res or {}).get("sid")
        return jsonify({"ok": True, "sid": sid}), 200
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "twilio_http_" + str(e.code), "detail": body}), e.code
    except socket.timeout as e:
        return jsonify({"error": "twilio_timeout", "detail": str(e)}), 504
    except socket.gaierror as e:
        return jsonify({"error": "twilio_dns_error", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "twilio_error", "detail": str(e)}), 500

@app.route("/check-otp", methods=["POST", "OPTIONS"])
def check_otp_route():
    if request.method == "OPTIONS":
        return ("", 200)
    body = request.get_json(silent=True) or {}
    to = body.get("to")
    code = body.get("code")
    if not to or not code:
        return jsonify({"error": "missing_params"}), 400
    try:
        res = twilio_verify_check(to, code)
        approved = bool((res or {}).get("valid"))
        return jsonify({"ok": approved}), 200
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "twilio_http_" + str(e.code), "detail": body}), e.code
    except socket.timeout as e:
        return jsonify({"error": "twilio_timeout", "detail": str(e)}), 504
    except socket.gaierror as e:
        return jsonify({"error": "twilio_dns_error", "detail": str(e)}), 502
    except Exception as e:
        return jsonify({"error": "twilio_error", "detail": str(e)}), 500

@app.route("/b2-status", methods=["GET", "OPTIONS"])
def b2_status_route():
    if request.method == "OPTIONS":
        return ("", 200)
    try:
        key_id, app_key, bucket_id, bucket_name = _b2_config()
        try:
            auth = b2_authorize(key_id, app_key)
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8")
            except Exception:
                body = ""
            return jsonify({"ok": False, "stage": "authorize", "error": "b2_http_" + str(e.code), "detail": body}), e.code
        api_url = auth.get("apiUrl")
        account_token = auth.get("authorizationToken")
        try:
            up = b2_get_upload_url(api_url, account_token, bucket_id)
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode("utf-8")
            except Exception:
                body = ""
            return jsonify({"ok": False, "stage": "get_upload_url", "error": "b2_http_" + str(e.code), "detail": body}), e.code
        return jsonify({"ok": True, "bucket": {"id": bucket_id, "name": bucket_name}, "auth": {"apiUrl": auth.get("apiUrl"), "downloadUrl": auth.get("downloadUrl")}, "upload": {"uploadUrl": up.get("uploadUrl")}}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

def _aimusic_config():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    secrets_path = os.path.join(base_dir, "secrets.json")
    obj = {}
    try:
        with open(secrets_path, "r", encoding="utf-8") as f:
            obj = json.load(f)
    except Exception:
        obj = {}
    key = os.environ.get("AIMUSIC_KEY") or obj.get("aimusicKey") or "sk_78e667c1055a48ada090a92d33eddecf"
    url = os.environ.get("AIMUSIC_URL") or obj.get("aimusicUrl") or "https://api.aimusicapi.ai/api/v1/producer/create"
    if not key:
        raise RuntimeError("aimusic_missing_key")
    return key, url

def _aimusic_headers(key: str):
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
        "x-api-key": key,
    }

@app.route("/aimusic-producer-create", methods=["POST", "OPTIONS"])
def aimusic_producer_create_route():
    if request.method == "OPTIONS":
        return ("", 200)
    body = request.get_json(silent=True) or {}
    payload = body.get("payload") or {}
    try:
        key_body = body.get("aimusic_key") or body.get("key")
        url_body = body.get("aimusic_url") or body.get("url")
        if key_body and url_body:
            key, url = key_body, url_body
        else:
            key, url = _aimusic_config()
        headers = _aimusic_headers(key)
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            j = json.loads(raw)
            return jsonify({"result": j, "endpoint": url}), 200
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "aimusic_http_" + str(e.code), "detail": body}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/aimusic-task", methods=["POST", "OPTIONS"])
def aimusic_task_route():
    if request.method == "OPTIONS":
        return ("", 200)
    body = request.get_json(silent=True) or {}
    task_id = str(body.get("task_id") or "").strip()
    if not task_id:
        return jsonify({"error": "missing_task_id"}), 400
    try:
        key_body = body.get("aimusic_key") or body.get("key")
        url_body = body.get("aimusic_url") or body.get("url")
        if key_body and url_body:
            key, create_url = key_body, url_body
        else:
            key, create_url = _aimusic_config()
        parsed = urllib.parse.urlparse(create_url)
        base = parsed.scheme + "://" + parsed.netloc
        url = base + "/api/v1/producer/task/" + urllib.parse.quote(task_id)
        headers = _aimusic_headers(key)
        req = urllib.request.Request(url, headers=headers, method="GET")
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            j = json.loads(raw)
            return jsonify({"result": j, "endpoint": url}), 200
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return jsonify({"error": "aimusic_http_" + str(e.code), "detail": body}), e.code
    except Exception as e:
        return jsonify({"error": str(e)}), 500
