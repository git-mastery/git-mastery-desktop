import { AppShell, Box, Button, Group, Space, Title } from '@mantine/core'
import TerminalComponent from './components/Terminal/Terminal'
import { LeftBarWrapper } from './components/Navigation/LeftBarWrapper'
import { WebsiteWrapper } from './components/Website/WebsiteWrapper'
import { InfoBar } from './components/InfoBar/InfoBar'
import { GitMasteryTaskProvider } from './contexts/GitMasteryTaskContext'
import { Header } from './components/Header/Header'
import { useEffect, useState } from 'react'
import { useLocalStorage } from '@mantine/hooks'
import { Onboarding } from './pages/Onboarding'

// enum Page { 
//   Onboarding,
//   Main
// }

/**
 * Note for future development
 * 
 * >> As there are only two "pages" planned:
 *   1. Onboarding
 *   2. Actual work page
 * 
 * the routing system uses a simple `enum` to control what page is shown.
 * 
 * in the future, explore options such as Tanstack Router
 * 
 * @returns 
 */
function App() {

  // const [page, setPage] = useState<Page>(Page.Main)
  const [onboardingCompleted, setOnboardingCompleted] = useLocalStorage({
    key: 'onboarding-completed',
    defaultValue: false,
  })

  console.log({ onboardingCompleted })

  // useEffect(() => { 

  // }, []);

  if (!onboardingCompleted) return <Onboarding onCompleteOnboarding={() => setOnboardingCompleted(true)} />

  return (

    <AppShell

      padding="md"
      header={{ height: 64 }}
      navbar={{ width: 256, breakpoint: "md" }}
      aside={{ width: 512, breakpoint: "xs" }}
    // footer={{ height: 32 }}
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
      <AppShell.Main className="flex h-full">
        <WebsiteWrapper />
      </AppShell.Main>
      <AppShell.Aside>


        <TerminalComponent />

      </AppShell.Aside>

      {/* <AppShell.Footer bg="gm-dark-green">
        <Box>
          <InfoBar
          ></InfoBar>
        </Box>
      </AppShell.Footer> */}
    </AppShell >

  )
}

export default App
