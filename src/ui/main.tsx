import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WebContentsViewProvider } from "./providers/WebContentsViewProvider";
import { ActivityProvider } from "./providers/ActivityProvider";
import { GitMasteryTaskProvider } from "./providers/GitMasteryTaskProvider";
import { ToastProvider } from "./providers/ToastProvider";

const queryClient = new QueryClient();

// Ordering matters: toasts are rendered by their provider, so ToastProvider
// sits inside every context its content reads from — and inside
// WebContentsViewProvider, whose suppression it claims while on screen.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GitMasteryTaskProvider>
        <WebContentsViewProvider>
          <ToastProvider>
            <ActivityProvider>
              <App />
            </ActivityProvider>
          </ToastProvider>
        </WebContentsViewProvider>
      </GitMasteryTaskProvider>
    </QueryClientProvider>
  </StrictMode>,
);
