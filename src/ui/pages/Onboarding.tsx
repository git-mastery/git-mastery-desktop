import { useEffect, useState } from "react"
import { useWebContentsView } from "../context/useWebContentsView"
import { Accordion, Alert, Box, Button, Center, Container, Flex, Group, Image, Stack, Stepper, Text, Timeline, Title, Tooltip } from "@mantine/core";

import logo from "../assets/logo.png"
import { IconAlertCircle, IconCheck, IconCheckFilled, IconCircleCheck, IconCircleX, IconCross, IconExternalLink, IconFolder, IconGitBranch, IconGitCommit, IconGitPullRequest, IconMessageDots, IconX } from "@tabler/icons-react";
import { useElectronStream } from "../hooks/useElectronStream";
import { notifications } from "@mantine/notifications";
import { useGitMasteryTask } from "../contexts/GitMasteryTaskContext";

const selectSaveDir = async () => {
  const path = await window.electron.selectFolder();
  if (path) {
    window.electron.setDataDirectory(path);
  }

  return path;
}

export const Onboarding = ({ onCompleteOnboarding }: { onCompleteOnboarding: () => void }) => {

  // We need this section to hide the webcontentsview for GitMastery webpage whenever this Onboarding module gets loaded
  // Remember that the webcontentsview is separate from this React app.
  const { hide, show } = useWebContentsView();
  useEffect(() => {
    hide()
    return () => show()
  }, [])

  const [active, setActive] = useState(0);
  const nextStep = () => setActive((current) => (current < 4 ? current + 1 : current));
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  const [canGoStep2, setCanGoStep2] = useState(false);
  const [canGoStep3, setCanGoStep3] = useState(false);
  const [canGoStep4, setCanGoStep4] = useState(false);

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
          <Stepper.Step label={active == 2 ? "Setup Git" : "Git"} description={active == 2 ? "Set up Git & GitHub CLI" : ""}>
            <Step2 setCanGoNext={setCanGoStep3} />
          </Stepper.Step>
          <Stepper.Step label={active == 3 ? "Setup GitMastery" : "GitMastery"} description={active == 3 ? "Install and configure GitMastery backbone" : ""}>
            <Step3 setCanGoNext={setCanGoStep4} />
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
        <Text> GitMastery is an open-source tool for anyone looking to upgrade their mastery of Git.</Text>
        <Text> Compared to other apps, we use a real terminal and real Git interaction for an authentic experience.</Text>
        <Text> Follow the steps below to get started.</Text>
      </Stack>
    </Stack>
  </Group>

}

const Step1 = ({ setCanGoNext }: {
  setCanGoNext: (canGoNext: boolean) => void
}) => {

  const [saveLoc, setSaveLoc] = useState("")
  useEffect(() => {
    window.electron.getDataDirectory().then((dataDirectory) => {
      setSaveLoc(dataDirectory || "");
      setCanGoNext(dataDirectory != "");
    });

  }, [])
  return <Stack gap={"0.25rem"}>
    <Group align="center">
      <Title order={3}> Choose a save location </Title>
      {saveLoc ? <IconCircleCheck color="green" /> : <IconCircleX color="red" />}
    </Group>
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
const Step2 = ({
  setCanGoNext
}: {
  setCanGoNext: (canGoNext: boolean) => void
}) => {
  // const { } = useElectronStream({
  //   condition: (cmd) => cmd.startsWith("check git"),
  //   onData: (originalCommand, data) => {

  //   }

  // })

  const [gitInstalled, setGitInstalled] = useState(false);
  const [githubCliInstalled, setGithubCliInstalled] = useState(false);
  const [checkingGit, setCheckingGit] = useState(false);
  const [checkingGithubCli, setCheckingGithubCli] = useState(false);

  const checkGit = () => {
    setCheckingGit(true);
    notifications.show({
      id: "check-git",
      title: "Checking for Git",
      message: "Please wait...",
      loading: true,
      autoClose: false,

    })

    window.electron.checkGit().then((installed) => {
      setGitInstalled(installed);
      setCheckingGit(false);
      if (installed) {
        notifications.update({
          id: "check-git",
          title: "Git is installed",
          message: "You can now proceed to the next step",
          color: "green",
          autoClose: 5000,

          loading: false,
          icon: <IconCheck />
        })
      } else {
        notifications.update({
          id: "check-git",
          title: "Git is not installed",
          message: "Please install Git and try again",
          color: "red",
          loading: false,
          autoClose: 5000,

          icon: <IconX />

        })
      }
    })
  }
  const checkGithubCli = () => {
    setCheckingGithubCli(true);
    notifications.show({
      id: "check-github-cli",
      title: "Checking for GitHub CLI",
      message: "Please wait...",
      loading: true,
      autoClose: false,

    })
    window.electron.checkGithubCli().then((installed) => {
      setGithubCliInstalled(installed);
      setCheckingGithubCli(false);
      if (installed) {
        notifications.update({
          id: "check-github-cli",
          title: "GitHub CLI is installed",
          message: "You can now proceed to the next step",
          color: "green",
          loading: false,
          autoClose: 5000,

          icon: <IconCheck />
        })
      } else {
        notifications.update({
          id: "check-github-cli",
          title: "GitHub CLI is not installed",
          message: "Please install GitHub CLI and try again",
          color: "red",
          loading: false,
          autoClose: 5000,

          icon: <IconX />

        })
      }
    })
  }

  useEffect(() => {
    checkGit();
    checkGithubCli();
  }, []);

  useEffect(() => {
    setCanGoNext(gitInstalled && githubCliInstalled);
  }, [gitInstalled, githubCliInstalled]);

  return <Stack gap={"0.25rem"}>
    <Group align="center">
      <Title order={3}> Install Git </Title>
      {gitInstalled ? <IconCircleCheck color="green" /> : <IconCircleX color="red" />}
    </Group>
    <Text> To fully understand Git, you must have Git on your local machine. GitMastery uses Git behind-the-hood to run all the lessons and exercises.</Text>
    <Group my={"md"} justify="center" align="center">

      <Button leftSection={<IconExternalLink size="1rem" />} variant="light" onClick={() => {
        // open https://git-scm.com/install/ in browser
        window.electron.openExternal("https://git-scm.com/install/");
      }}> Download Git </Button>
      <Button variant="subtle" onClick={checkGit} loading={checkingGit} disabled={checkingGit}> Check </Button>


    </Group>
    <Group align="center">
      <Title order={3}> Install GitHub CLI </Title>
      {githubCliInstalled ? <IconCircleCheck color="green" /> : <IconCircleX color="red" />}
    </Group>
    <Text> This tool lets GitMastery sync your progress to your GitHub account.</Text>
    <Group my={"md"} justify="center" align="center">

      <Button leftSection={<IconExternalLink size="1rem" />} variant="light" onClick={() => {
        window.electron.openExternal('https://github.com/cli/cli/releases')
      }}> Download GitHub CLI </Button>
      <Button variant="subtle" onClick={checkGithubCli} loading={checkingGithubCli} disabled={checkingGithubCli}> Check </Button>


    </Group>

    <Accordion variant="separated" >
      <Accordion.Item key="iframe" value="iframe">
        <Accordion.Control icon={<IconGitBranch size={12} />}>Installation help</Accordion.Control>
        <Accordion.Panel><iframe src="https://git-mastery.org/companion-app/index.html#1-setting-up-git" style={{ "width": "100%", height: "500px" }}> </iframe></Accordion.Panel>
      </Accordion.Item>
    </Accordion>



  </Stack>
}

const Step3 = ({
  setCanGoNext
}: {
  setCanGoNext: (canGoNext: boolean) => void
}) => {

  const [gitMasteryInstalled, setGitMasteryInstalled] = useState(false);
  const [gitMasterySetup, setGitMasterySetup] = useState(false);

  const [versionData, setVersionData] = useState<{ version: string, latest?: string } | null>(null);
  const [checkingGitMastery, setCheckingGitMastery] = useState(false);
  const [downloadingGitMastery, setDownloadingGitMastery] = useState(false);
  const [settingUpGitMastery, setSettingUpGitMastery] = useState(false);

  useEffect(() => {
    setCanGoNext(gitMasteryInstalled && gitMasterySetup);
  }, [gitMasteryInstalled, gitMasterySetup]);

  useEffect(() => {
    checkGitMastery();
  }, []);

  const downloadGitMasteryApp = () => {
    setDownloadingGitMastery(true);
    notifications.show({
      id: "download-gitmastery-app",
      title: "Downloading Git Mastery",
      message: "Please wait...",
      loading: true,
      autoClose: false
    })
    window.electron.downloadGitMasteryApp().then((installed) => {
      setGitMasteryInstalled(installed);
      setDownloadingGitMastery(false);
      if (installed) {
        notifications.update({
          id: "download-gitmastery-app",
          title: "Git Mastery is installed",
          message: "You can now proceed to the next step",
          color: "green",
          loading: false,
          autoClose: 5000,
          icon: <IconCheck />
        })
      } else {
        notifications.update({
          id: "download-gitmastery-app",
          title: "Git Mastery is not installed",
          message: "Please install Git Mastery and try again",
          color: "red",
          loading: false,
          autoClose: 5000,

          icon: <IconX />

        })
      }
    })
  }

  const checkGitMastery = () => {
    setCheckingGitMastery(true);
    notifications.show({
      id: "check-gitmastery-downloaded",
      title: "Checking if Git Mastery is downloaded",
      message: "Please wait...",
      loading: true,
      autoClose: false
    })
    window.electron.getGitMasteryVersion().then((versionData) => {
      setGitMasteryInstalled(versionData.version !== "");
      setVersionData(versionData);
      setCheckingGitMastery(false);
      if (versionData.version !== "") {
        if (versionData.latest) {
          notifications.update({
            id: "check-gitmastery-downloaded",
            title: "Update for GitMastery available",
            message: `Version ${versionData.version} is installed. Latest is ${versionData.latest} – please download the latest update`,
            color: "yellow",
            loading: false,
            autoClose: 5000,
            icon: <IconCheck />
          })
        } else {

          notifications.update({
            id: "check-gitmastery-downloaded",
            title: "Git Mastery is downloaded",
            message: `Version ${versionData.version} is installed`,
            color: "green",
            loading: false,
            autoClose: 5000,
            icon: <IconCheck />
          })
        }
      } else {
        notifications.update({
          id: "check-gitmastery-downloaded",
          title: "Git Mastery is not downloaded",
          message: "Please install Git Mastery and try again",
          color: "red",
          loading: false,
          autoClose: 5000,

          icon: <IconX />

        })
      }
    })
  }


  const setupGitMastery = async () => {
    setSettingUpGitMastery(true);
    const result = await window.electron.startGitMasteryTask("setup");
    notifications.show({
      id: "setup-gitmastery",
      title: "Setting up Git Mastery",
      message: "Please wait...",
      loading: true,
      autoClose: false
    })




  }

  const { } = useElectronStream({
    condition: (cmd) => cmd.startsWith("setup"),
    onData: (originalCommand, data) => {

    },
    onSuccessExit: (originalCommand, data) => {
      console.log("setup success", data)
      const success = data.completed?.status === "success"
      setGitMasterySetup(success)
      setSettingUpGitMastery(false);

      // need a timeout, else it's too fast if the user has already set up
      setTimeout(() => {
        notifications.update({
          id: "setup-gitmastery",
          title: "Git Mastery setup completed successfully",
          message: "You can now proceed to the next step",
          color: "green",
          loading: false,
          autoClose: 5000,
          icon: <IconCheck />
        })
      }, 100)

    },
    onFailedExit: (originalCommand, data) => {
      setGitMasterySetup(false)
      setSettingUpGitMastery(false);
      notifications.update({
        id: "setup-gitmastery",
        title: "Git Mastery setup failed",
        message: "Please try again",
        color: "red",
        loading: false,
        autoClose: 5000,
        icon: <IconX />
      })
    }
  })

  let statusComponent = <></>
  if (versionData?.latest && versionData.version !== versionData.latest) {
    statusComponent = <Group gap={"6px"}> <IconAlertCircle color="yellow" /> <Text style={{ lineHeight: 'normal' }}>{`Update available ${versionData.version} —> ${versionData.latest}`}</Text> </Group>
  } else if (versionData?.version) {
    statusComponent = <Group gap={"6px"}> <IconCircleCheck color="green" /> <Text style={{ lineHeight: 'normal' }}>{`Version ${versionData.version}`}</Text> </Group>
  } else {
    statusComponent = <IconCircleX color="red" />
  }

  return <Stack gap={"0.25rem"}>
    <Group align="center">
      <Title order={3}> Download Git Parser </Title>
      {statusComponent}
      {/* {gitMasteryInstalled ? <IconCircleCheck color="green" /> : <IconCircleX color="red" />} */}

    </Group>
    <Text> This is a custom in-house command line tool that GitMastery uses to check the correctness of your answers.</Text>
    <Group my={"md"} justify="center" align="center">

      <Button variant="light" onClick={downloadGitMasteryApp} loading={downloadingGitMastery} disabled={downloadingGitMastery || checkingGitMastery}> Download </Button>
      <Button variant="subtle" onClick={checkGitMastery} loading={checkingGitMastery} disabled={checkingGitMastery || downloadingGitMastery}> Check </Button>


    </Group>
    <Group align="center">
      <Title order={3}> Setup Git Mastery </Title>
      {gitMasterySetup ? <IconCircleCheck color="green" /> : <IconCircleX color="red" />}
    </Group>
    <Text> Configure your system for GitMastery. </Text>
    <Group my={"md"} justify="center" align="center">

      <Button variant="light" onClick={setupGitMastery} loading={settingUpGitMastery} disabled={settingUpGitMastery}> Setup </Button>
      {/* <Button variant="subtle"> Check </Button> */}


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
    {/* <Title style={{ textAlign: "center" }} order={1}> Setup complete </Title> */}
    <Center style={{ margin: "1.5rem" }}>
      <Alert style={{ transform: "scale(1.5)" }} variant="outline" color="gm-green" title="Setup complete" icon={<IconCheck />}>
        You are now ready to use GitMastery!
      </Alert>
    </Center></Stack>
}
