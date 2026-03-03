import { useState } from 'react'
import reactLogo from './assets/react.svg'
import { AppShell, Box, Button, Container, Title } from '@mantine/core'
import TerminalComponent from './components/Terminal/Terminal'

function App() {
  const [count, setCount] = useState(0)

  return (
    <AppShell

      padding="md"
      header={{ height: 64 }}
      navbar={{ width: 256, breakpoint: "md" }}
      aside={{ width: 512, breakpoint: "xs" }}
    >
      <AppShell.Header
      >
        <Box p="md" >
          <Title order={4}> GitMastery </Title>

        </Box>
      </AppShell.Header>
      <AppShell.Navbar>
        <AppShell.Section>
          <Box p='md'>

            <Title order={4}> GitMastery </Title>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main>
        {/* <Box p='md'> */}

        Hello this is some text
        <Title> Hlelo this is a header</Title>
        {/* </Box> */}
      </AppShell.Main>
      <AppShell.Aside>

        <TerminalComponent />

      </AppShell.Aside>
    </AppShell >
  )
}

export default App
