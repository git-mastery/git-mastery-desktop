import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css';
import App from './App.tsx'
import { colorsTuple, createTheme, MantineProvider, Text } from '@mantine/core'

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
            },
          };
        }
        return {};
      },
    }),
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </StrictMode>,
)
