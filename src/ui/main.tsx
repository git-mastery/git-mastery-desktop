import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import App from './App.tsx'
import { colorsTuple, createTheme, MantineProvider, Text } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const theme = createTheme({
  primaryColor: 'gm-green',
  colors: {
    'gm-green': colorsTuple('#2D864E'),
    "gm-bone": colorsTuple("#F8F8F8"),
    "gm-dark-green": colorsTuple("#717c4d"),
  },
  headings: {
    fontFamily: "Noto Serif, serif",
  },
  fontFamily: 'Inter, system-ui, sans-serif',
  components: {
    Text: Text.extend({
      styles: (theme, props) => {
        if (props.variant === 'subheading') {
          return {
            root: {
              fontWeight: 600,
              color: theme.colors.gray[5],
              // fontFamily: theme.headings.fontFamily,
            },
          };
        }
        return {};
      },
    }),
  },
})

import { WebContentsViewProvider } from './context/useWebContentsView';
import { Notifications } from '@mantine/notifications';
import { ActivityProvider } from './context/useActivity.tsx';
import { ModalsProvider } from '@mantine/modals';
import { GitMasteryTaskProvider } from './contexts/GitMasteryTaskContext.tsx';

const queryClient = new QueryClient()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <ModalsProvider>
          <GitMasteryTaskProvider>
            <WebContentsViewProvider>
              <ActivityProvider>
                <App />
                <Notifications />
              </ActivityProvider>
            </WebContentsViewProvider>
          </GitMasteryTaskProvider>
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
)
