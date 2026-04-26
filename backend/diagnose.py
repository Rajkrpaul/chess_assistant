"""
Run this in your backend folder with venv active:
  python diagnose.py

It will tell you exactly what's wrong.
"""
import os
import sys
import shutil
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.local", override=True)

raw = os.getenv("STOCKFISH_PATH", "")
cleaned = raw.strip().strip('"').strip("'")

print(f"\n{'='*60}")
print(f"STOCKFISH_PATH raw value : {repr(raw)}")
print(f"STOCKFISH_PATH cleaned   : {repr(cleaned)}")
print(f"{'='*60}")

if not cleaned:
    print("❌ STOCKFISH_PATH is empty in your .env file!")
    sys.exit(1)

print(f"\nChecking if file exists at that path...")
if os.path.isfile(cleaned):
    print(f"✅ File EXISTS at: {cleaned}")
else:
    print(f"❌ File NOT FOUND at: {cleaned}")
    # Try to find it
    print(f"\nSearching for stockfish on your system...")
    found = shutil.which("stockfish") or shutil.which("stockfish.exe")
    if found:
        print(f"✅ Found via PATH: {found}")
    else:
        # Search common user folders
        import glob
        username = os.environ.get("USERNAME") or os.environ.get("USER") or "raj02"
        patterns = [
            f"C:/Users/{username}/stockfish*/**/*.exe",
            f"C:/Users/{username}/Downloads/**/*.exe",
            "C:/stockfish/**/*.exe",
        ]
        for pat in patterns:
            matches = glob.glob(pat, recursive=True)
            for m in matches:
                if "stockfish" in m.lower():
                    print(f"✅ Found at: {m}")
        print("\nIf found above, update STOCKFISH_PATH in .env to that path.")
    sys.exit(1)

print(f"\nTesting if it can actually launch...")
try:
    import chess.engine
    engine = chess.engine.SimpleEngine.popen_uci(cleaned)
    print(f"✅ Stockfish launched successfully!")
    print(f"   Engine id: {engine.id}")
    engine.quit()
except Exception as e:
    print(f"❌ Launch failed: {type(e).__name__}: {e}")
    print(f"\nPossible causes:")
    print(f"  - Wrong architecture (need x86-64, not ARM)")
    print(f"  - File is corrupted")
    print(f"  - Missing Visual C++ redistributable (Windows)")
