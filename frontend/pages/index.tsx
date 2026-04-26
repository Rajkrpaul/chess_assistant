import dynamic from "next/dynamic";
import Head from "next/head";

const ChessAssistant = dynamic(() => import("../components/ChessAssistant"), {
  ssr: false,
});

export default function Home() {
  return (
    <>
      <Head>
        <title>Chess Strategy Assistant</title>
        <meta name="description" content="AI-powered chess analysis with Stockfish + GPT" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <ChessAssistant />
    </>
  );
}
