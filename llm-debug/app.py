import os
import json
import requests
from datetime import datetime
from flask import Flask, request, Response

app = Flask(__name__)

OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")

os.makedirs(LOG_DIR, exist_ok=True)


def log_request_response(req_data, resp_data, status_code):
    """Write request/response to datetime.json file."""
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S-%f")
    log_entry = {
        "request": req_data,
        "response": resp_data
    }
    log_path = os.path.join(LOG_DIR, f"{timestamp}.json")
    try:
        with open(log_path, "w") as f:
            json.dump(log_entry, f, indent=2, default=str)
    except Exception as e:
        print(f"Failed to write log: {e}")


@app.route("/v1/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def proxy(path):
    # Build upstream URL (OPENAI_BASE_URL already contains /v1)
    upstream_url = f"{OPENAI_BASE_URL.rstrip('/')}/{path}"

    # Capture request data
    req_data = {
        "method": request.method,
        "url": upstream_url,
        "headers": dict(request.headers),
        "body": None
    }

    try:
        req_data["body"] = request.get_json(silent=True) or request.data.decode("utf-8", errors="replace")
    except:
        req_data["body"] = None

    # Forward headers, including Authorization
    headers = {}
    for key, value in request.headers:
        if key.lower() not in ("host", "content-length"):
            headers[key] = value

    resp_data = {"status_code": None, "headers": None, "body": None, "error": None}

    try:
        # Make upstream request
        upstream_resp = requests.request(
            method=request.method,
            url=upstream_url,
            headers=headers,
            json=request.get_json(silent=True) if request.is_json else None,
            data=request.data if not request.is_json else None,
            params=request.args,
            timeout=120
        )

        resp_data["status_code"] = upstream_resp.status_code
        resp_data["headers"] = dict(upstream_resp.headers)

        try:
            resp_data["body"] = upstream_resp.json()
        except:
            resp_data["body"] = upstream_resp.text

        # Log request/response
        log_request_response(req_data, resp_data, upstream_resp.status_code)

        # Build response, excluding hop-by-hop headers
        excluded = {"content-encoding", "transfer-encoding", "connection"}
        resp_headers = {k: v for k, v in upstream_resp.headers.items() if k.lower() not in excluded}

        return Response(
            upstream_resp.content,
            status=upstream_resp.status_code,
            headers=resp_headers
        )

    except Exception as e:
        resp_data["error"] = str(e)
        # Best effort: still log even on error
        log_request_response(req_data, resp_data, 502)

        return Response(
            json.dumps({"error": "Upstream request failed", "detail": str(e)}),
            status=502,
            content_type="application/json"
        )


@app.route("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
