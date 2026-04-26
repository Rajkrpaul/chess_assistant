import urllib.request
import json

req = {
    "fen_before": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "move_uci": "e2e4",
    "ply": 1,
    "depth": 10
}
data = json.dumps(req).encode('utf-8')
try:
    url = "http://localhost:8000/analyze-move"
    headers = {'Content-Type': 'application/json'}
    request = urllib.request.Request(url, data=data, headers=headers)
    response = urllib.request.urlopen(request)
    print("STATUS:", response.status)
    print("BODY:", response.read().decode('utf-8'))
except Exception as e:
    print("ERROR:", e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
