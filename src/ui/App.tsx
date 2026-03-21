import { AppShell, Box, Button, Group, Space, Title } from '@mantine/core'
import TerminalComponent from './components/Terminal/Terminal'
import { LeftBarWrapper } from './components/Navigation/LeftBarWrapper'
import { WebsiteWrapper } from './components/Website/WebsiteWrapper'
import { InfoBar } from './components/InfoBar/InfoBar'
import { GitMasteryTaskProvider } from './contexts/GitMasteryTaskContext'

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
        >
          <Box p="md" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} >
            <Title order={4}> GitMastery </Title>
            <Space />
            <Group>
              {/* <Button> Set Exercise Directory </Button>
            <Button> Set EXE location </Button> */}
              <Button onClick={() => window.electron.startGitMasteryTask("verify")}> Submit answer </Button>
            </Group>
          </Box>
        </AppShell.Header>
        <AppShell.Navbar>

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

        <AppShell.Footer>
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
