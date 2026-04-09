import { useEffect, useState } from "react"
import { useWebContentsView } from "../context/useWebContentsView"
import { Accordion, Alert, Box, Button, Center, Container, Flex, Group, Image, Stack, Stepper, Text, Timeline, Title, Tooltip } from "@mantine/core";

import logo from "../assets/logo.jpg"
import { IconCheck, IconFolder, IconGitBranch, IconGitCommit, IconGitPullRequest, IconMessageDots } from "@tabler/icons-react";
import { useElectronStream } from "../hooks/useElectronStream";

const selectSaveDir = async () => {
  const path = await window.electron.selectFolder();
  if (path) {
    window.electron.setExerciseDirectory(path);
  }

  return path;
}

export const Onboarding = ({ onCompleteOnboarding }: { onCompleteOnboarding: () => void }) => {

  // We need this section to hide the webcontentsview for GitMastery webpage whenever this Onboarding module gets loaded
  // Remmeber that the webcontentsview is separate from this React app.
  const { hide, show } = useWebContentsView();
  useEffect(() => {
    hide()
    return () => show()
  }, [])

  const [active, setActive] = useState(0);
  const nextStep = () => setActive((current) => (current < 4 ? current + 1 : current));
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  const [canGoStep2, setCanGoStep2] = useState(true);
  const [canGoStep3, setCanGoStep3] = useState(true);
  const [canGoStep4, setCanGoStep4] = useState(true);

  function canGoNext(active: number) {
    switch (active) {
      case 0:
        return true;
      case 1:
        return canGoStep2;
      case 2:
        return canGoStep3;
      case 3:
        return canGoStep4;
      default:
        return false;
    }
  }

  return <Flex bg="gm-bone" style={{

    width: "100%",
    height: "100vh",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    gap: '2rem'

  }}>
    <Flex style={{
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      gap: '2rem',
      width: "30%",
      minWidth: "800px"
    }}>
      {active != 0 &&
        <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}
          styles={{
            root: {
              display: "flex",
              flexDirection: "column-reverse"
            },
            content: {
              paddingTop: 0,
              paddingBottom: "4rem"
            }
          }}
          style={{
            width: "100%"
          }}
        >
          <Stepper.Step label={active == 0 ? "Overview" : "Start"} description={active == 0 ? "Welcome to GitMastery!" : ""}>
            <Step0 />
          </Stepper.Step>
          <Stepper.Step label={active == 1 ? "Setup save information" : "Save location"} description={active == 1 ? "Choose where to save your progress" : ""}>
            <Step1 setCanGoNext={setCanGoStep2} />
          </Stepper.Step>
          <Stepper.Step label={active == 2 ? "Setup Git" : "Git"} description={active == 2 ? "Set up Git & Github CLI" : ""}>
            <Step2 />
          </Stepper.Step>
          <Stepper.Step label={active == 3 ? "Setup GitMastery" : "GitMastery"} description={active == 3 ? "Install and configure GitMastery backbone" : ""}>
            <Step3 />
          </Stepper.Step>

          <Stepper.Completed>
            <Step4 />
          </Stepper.Completed>
        </Stepper>}
      {active == 0 && <Step0 />}

      <Group justify="center" mt="xl">
        {active != 0 && <Button variant="default" onClick={prevStep}>Back</Button>}
        {active == 4 ? <Button size="xl" onClick={onCompleteOnboarding}> Let's go! </Button> : <Button onClick={nextStep} disabled={!canGoNext(active)}>{active == 0 ? "Begin" : "Next step"}</Button>}
      </Group>
      {/* <Box size="xl" style={{
      gap: "2.5rem",
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'top',
      justifyContent: 'center',
      maxWidth: "75vw",
      minWidth: "500px",
      width: "100%"
    }}
    >


      <Box style={{
      }}>

        <Timeline active={1} bulletSize={24} lineWidth={2}>
          <Timeline.Item bullet={<IconGitBranch size={12} />} title="Git is installed">
            
            <Group>

              <Button variant="light"> Install </Button>
              <Button variant="subtle"> Check </Button>
            </Group>
            <Text size="xs" mt={4}>Last checked 5 mins ago</Text>
          </Timeline.Item>

          <Timeline.Item bullet={<IconGitCommit size={12} />} title="Github CLI is installed">
            <Group>

              <Button variant="light"> Install </Button>
              <Button variant="subtle"> Check </Button>
            </Group>
            <Text size="xs" mt={4}>Last checked 5 mins ago</Text>
          </Timeline.Item>
          <Timeline.Item title="Choose a save location" bullet={<IconMessageDots size={12} />}>
            <Group>

              <Button variant="light"> Choose folder </Button>
              <Button variant="subtle"> Check </Button>
            </Group>
            <Text size="xs" mt={4}>Last checked 5 mins ago</Text>
          </Timeline.Item>

          <Timeline.Item title="GitMastery is installed" bullet={<IconGitPullRequest size={12} />} lineVariant="dashed">
            <Group>

              <Button variant="light"> Install </Button>
              <Button variant="subtle"> Check </Button>
            </Group>
            <Text size="xs" mt={4}>Last checked 5 mins ago</Text>
          </Timeline.Item>

          <Timeline.Item title="GitMastery is set up" bullet={<IconMessageDots size={12} />}>
            <Group>

              <Button variant="light"> Setup </Button>
              <Button variant="subtle"> Check </Button>
            </Group>
            <Text size="xs" mt={4}>Last checked 5 mins ago</Text>
          </Timeline.Item>

        </Timeline>
      </Box>
    </Box>
    <Center>
      <Tooltip label="One or more steps not completed!">

        <Button size="xl" disabled> Let's go!</Button>
      </Tooltip>
    </Center> */}
    </Flex>
  </Flex>
}

const Step0 = () => {
  return <Group align="center" justify="center" gap="2rem">
    <Box style={{
      width: "128px",
      height: "128px"
    }}>


      <Image width={128} height={128} src={logo} alt="Git Mastery Logo" />

    </Box>


    <Stack>

      <Title> Welcome to GitMastery!</Title>
      <Stack gap={"xs"}>
        <Text> GitMastery is an open-source tool blah blah blah.</Text>
        <Text> This Electron app streamlines the experience blah blah bah.</Text>
        <Text> Follow the steps below to get started.</Text>
      </Stack>
    </Stack>
  </Group>

}

const Step1 = ({ setCanGoNext }: {
  setCanGoNext: (canGoNext: boolean) => void
}) => {
  // TODO: should load the save location from backend. But as we only do this once during onboarding, just assume it is empty for now
  const [saveLoc, setSaveLoc] = useState("")
  return <Stack gap={"0.25rem"}>
    <Title order={3}> Choose a save location </Title>
    <Text> GitMastery needs to know where to save your in-progress exercises. These exercises are stored as folders on your hard drive.</Text>
    <Group mt="xl" justify="center" align="center">

      <Button variant="light" onClick={async () => {
        const path = await selectSaveDir();
        setSaveLoc(path || "");
        setCanGoNext(path != "");
      }}> Choose save location </Button>

      <Group gap={'xs'}>

        <IconFolder />
        <Text> {saveLoc}</Text>
      </Group>
    </Group>


  </Stack>
}

// If windows, open https://git-scm.com/install/windows
// if mac, Install homebrew if you don't already have it, and then, run brew install git
// if linux, Use your Linux distribution's package manager to install Git. Examples:

// Debian/Ubuntu, run sudo apt-get update and then sudo apt-get install git.
// Fedora: run sudo dnf update and then sudo dnf install git.
const Step2 = () => {
  // const { } = useElectronStream({
  //   condition: (cmd) => cmd.startsWith("check git"),
  //   onData: (originalCommand, data) => {

  //   }

  // })

  return <Stack gap={"0.25rem"}>
    <Title order={3}> Install Git </Title>
    <Text> To fully understand Git, you must have Git on your local machine</Text>
    <Group my={"md"} justify="center" align="center">

      <Button variant="light" onClick={() => { }}> Download Git </Button>
      <Button variant="subtle"> Check </Button>


    </Group>
    <Title order={3}> Install Github CLI </Title>
    <Text> Blah Blah github CLI </Text>
    <Group my={"md"} justify="center" align="center">

      <Button variant="light" onClick={() => { }}> Download Github CLI </Button>
      <Button variant="subtle"> Check </Button>


    </Group>

    <Accordion variant="separated" >
      <Accordion.Item key="iframe" value="iframe">
        <Accordion.Control icon={<IconGitBranch size={12} />}>Installation help</Accordion.Control>
        <Accordion.Panel><iframe src="https://git-mastery.org/companion-app/index.html#1-setting-up-git" style={{ "width": "100%", height: "500px" }}> </iframe></Accordion.Panel>
      </Accordion.Item>
    </Accordion>



  </Stack>
}

const Step3 = () => {
  return <Stack gap={"0.25rem"}>
    <Title order={3}> Download Git Mastery </Title>
    <Text> Blah blah Lorem Ipsum</Text>
    <Group my={"md"} justify="center" align="center">

      <Button variant="light" onClick={() => { }}> Download </Button>
      <Button variant="subtle"> Check </Button>


    </Group>
    <Title order={3}> Setup Git Mastery </Title>
    <Text> Blah Blah check all </Text>
    <Group my={"md"} justify="center" align="center">

      <Button variant="light" onClick={() => { }}> Setup </Button>
      <Button variant="subtle"> Check </Button>


    </Group>

    <Accordion variant="separated" >
      <Accordion.Item key="iframe" value="iframe">
        <Accordion.Control icon={<IconGitBranch size={12} />}>Installation help</Accordion.Control>
        <Accordion.Panel><iframe src="https://git-mastery.org/companion-app/index.html#1-setting-up-git" style={{ "width": "100%", height: "500px" }}> </iframe></Accordion.Panel>
      </Accordion.Item>
    </Accordion>



  </Stack>
}

const Step4 = () => {
  return <Stack gap={"lg"}>
    <Title style={{ textAlign: "center" }} order={1}> Setup complete </Title>
    <Center>
      <Alert variant="outline" color="gm-green" title="Setup complete" icon={<IconCheck />}>
        You are now ready to use GitMastery! Lorem ipsum lorem ipsum
      </Alert>
    </Center></Stack>
}
