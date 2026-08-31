import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WebContentsViewProvider } from "./providers/WebContentsViewProvider";
import { ActivityProvider } from "./providers/ActivityProvider";
import { GitMasteryTaskProvider } from "./providers/GitMasteryTaskProvider";
import { ToastProvider } from "./providers/ToastProvider";
import { ChatPanel } from "./pages/ChatPanel";
import { ThemeProvider } from "./providers/ThemeProvider";

const queryClient = new QueryClient();
const root = document.getElementById("root")!;

if (location.hash === "#chat") {
  document.documentElement.classList.add("gm-chat-overlay");
  createRoot(root).render(
    <StrictMode>
      <ChatPanel />
    </StrictMode>,
  );
} else {
  // Ordering matters: toasts are rendered by their provider, so ToastProvider
  // sits inside every context its content reads from — and inside
  // WebContentsViewProvider, whose suppression it claims while on screen.
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <GitMasteryTaskProvider>
            <WebContentsViewProvider>
              <ToastProvider>
                <ActivityProvider>
                  <App />
                </ActivityProvider>
              </ToastProvider>
            </WebContentsViewProvider>
          </GitMasteryTaskProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
