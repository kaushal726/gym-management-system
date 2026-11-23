import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/outfit";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/layout.css";
import { App } from "./App.tsx";
import { SessionProvider } from "./lib/session.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import { captureInstallPrompt } from "./lib/install.ts";
import { registerServiceWorker } from "./lib/push.ts";

captureInstallPrompt();
void registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </SessionProvider>
  </StrictMode>,
);
