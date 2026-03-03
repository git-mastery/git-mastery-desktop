import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@mantine/core/styles.css';
import App from './App.tsx'
import { colorsTuple, createTheme, MantineProvider } from '@mantine/core'

const theme = createTheme({
  primaryColor: 'gm-green',
  colors: {
    'gm-green': colorsTuple('#2D864E'),
  },
  headings: {
    fontFamily: "Noto Serif, serif",
  },
  fontFamily: 'Inter, system-ui, sans-serif',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </StrictMode>,
)
