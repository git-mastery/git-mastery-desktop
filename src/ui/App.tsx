import { useState } from 'react'
import reactLogo from './assets/react.svg'
import { AppShell, Box, Button, Container, Group, Space, Title } from '@mantine/core'
import TerminalComponent from './components/Terminal/Terminal'
import { LeftBarWrapper } from './components/Navigation/LeftBarWrapper'
import { WebsiteWrapper } from './components/Website/WebsiteWrapper'

function App() {

  return (
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
            <Button> Set Exercise Directory </Button>
            <Button> Set EXE location </Button>
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
          SOME TEXT
        </Box>
      </AppShell.Footer>
    </AppShell >
  )
}

export default App
