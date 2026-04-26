import asyncio
from ai_service import AIService
import os
from dotenv import load_dotenv

async def main():
    load_dotenv(".env")
    load_dotenv(".env.local", override=True)
    service = AIService()
    fen = "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
    print("Testing depth=20...")
    result = await service.analyze_position(fen, depth=20)
    print("Result:", result)

if __name__ == "__main__":
    asyncio.run(main())
