import asyncio
import aiohttp

async def fetch(session, fen):
    async with session.post("http://127.0.0.1:8000/analyze", json={"fen": fen, "depth": 20}) as resp:
        return await resp.json()

async def main():
    fens = [
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        "rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1R b KQkq - 1 1",
    ]
    async with aiohttp.ClientSession() as session:
        tasks = [fetch(session, fen) for fen in fens]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for r in results:
            print(r)

if __name__ == "__main__":
    asyncio.run(main())
