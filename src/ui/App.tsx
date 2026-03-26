import { AppShell, Box, Button, Group, Space, Title } from '@mantine/core'
import TerminalComponent from './components/Terminal/Terminal'
import { LeftBarWrapper } from './components/Navigation/LeftBarWrapper'
import { WebsiteWrapper } from './components/Website/WebsiteWrapper'
import { InfoBar } from './components/InfoBar/InfoBar'
import { GitMasteryTaskProvider } from './contexts/GitMasteryTaskContext'
import { Header } from './components/Header/Header'

function App() {

  return (
    <GitMasteryTaskProvider>
      <AppShell

        padding="md"
        header={{ height: 64 }}
        navbar={{ width: 256, breakpoint: "md" }}
        aside={{ width: 512, breakpoint: "xs" }}
        footer={{ height: 32 }}
      >
        <AppShell.Header
          bg="gm-bone"
        >
          <Header />
        </AppShell.Header>
        <AppShell.Navbar bg="gm-bone">

          <Box p='md' h="100%">

            <LeftBarWrapper />
          </Box>

        </AppShell.Navbar>
        <AppShell.Main style={{ display: "flex", height: "100%" }}>
          <WebsiteWrapper />
        </AppShell.Main>
        <AppShell.Aside>


          <TerminalComponent />

        </AppShell.Aside>

        <AppShell.Footer bg="gm-dark-green">
          <Box>
            <InfoBar
            ></InfoBar>
          </Box>
        </AppShell.Footer>
      </AppShell >
    </GitMasteryTaskProvider>
  )
}

export default App
