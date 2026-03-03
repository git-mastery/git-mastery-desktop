import { useState } from 'react'
import reactLogo from './assets/react.svg'
import { AppShell, Box, Button, Container, Title } from '@mantine/core'
import TerminalComponent from './components/Terminal/Terminal'
import { LeftBarWrapper } from './components/Navigation/LeftBarWrapper'

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

        <Box p='md' h="100%">

          <LeftBarWrapper />
        </Box>

      </AppShell.Navbar>
      <AppShell.Main>
        {/* <Box p='md'> */}


        {/* </Box> */}
      </AppShell.Main>
      <AppShell.Aside>


        <TerminalComponent />

      </AppShell.Aside>
    </AppShell >
  )
}

export default App
