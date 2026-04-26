import type { AppProps } from "next/app";
import "../styles/globals.css";
import { ThemeProvider } from "../context/ThemeContext";
import { SettingsProvider } from "../context/SettingsContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <Component {...pageProps} />
      </SettingsProvider>
    </ThemeProvider>
  );
}