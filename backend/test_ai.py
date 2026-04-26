import asyncio
import os
from ai_service import AIService
from dotenv import load_dotenv

async def main():
    load_dotenv()
    print(f"Loaded STOCKFISH_PATH: {os.getenv('STOCKFISH_PATH')}")
    service = AIService()
    print(f"Service ready? {service.is_ready()}")
    
    fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    result = await service.analyze_position(fen, depth=5)
    print("Result:")
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
