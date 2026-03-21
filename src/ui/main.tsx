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
              fontWeight: 800,
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

const queryClient = new QueryClient()
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <WebContentsViewProvider>
          <App />
          <Notifications />
        </WebContentsViewProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
)
