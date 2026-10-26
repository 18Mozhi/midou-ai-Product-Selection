"""Synthetic stdio transport fixture only; never requests any network."""
import base64
import json
import sys

request = json.load(sys.stdin)
assert request["method"] == "GET"
assert request["url"] == "https://www.amazon.com/dp/B000000001/"
assert request["timeout_ms"] == 1000
print(json.dumps({
    "status": 503,
    "headers": [["content-type", "text/html"],
                ["set-cookie", "fixture-a=1; Path=/; Secure; SameSite=Lax"],
                ["set-cookie", "fixture-b=2; Path=/; Secure; SameSite=Lax"]],
    "body_base64": base64.b64encode(b'<form action="/errors/validateCaptcha"><input id="captchacharacters"></form>').decode(),
}))
