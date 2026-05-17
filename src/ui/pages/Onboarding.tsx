import { useEffect, useState } from "react"
import { useWebContentsView } from "../context/useWebContentsView"
import { Accordion, Alert, Button, Image, Stack, Stepper, Text, Title } from "@mantine/core";

import logo from "../assets/logo.png"
import { IconAlertCircle, IconCheck, IconCircleCheck, IconCircleX, IconExternalLink, IconFolder, IconGitBranch, IconX } from "@tabler/icons-react";
import { useElectronStream } from "../hooks/useElectronStream";
import { notifications } from "@mantine/notifications";

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

  return <div className="flex w-full h-screen justify-center items-center flex-col gap-8 bg-gm-bone">
    <div className="flex justify-center items-center flex-col gap-8 w-[30%] min-w-200">
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
          className="w-full"
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

      <div className="flex justify-center gap-2 mt-8">
        {active != 0 && <Button variant="default" onClick={prevStep}>Back</Button>}
        {active == 4 ? <Button size="xl" onClick={onCompleteOnboarding}> Let's go! </Button> : <Button onClick={nextStep} disabled={!canGoNext(active)}>{active == 0 ? "Begin" : "Next step"}</Button>}
      </div>
    </div>
  </div>
}

const Step0 = () => {
  return <div className="flex items-center justify-center gap-8">
    <div className="w-32 h-32">
      <Image width={128} height={128} src={logo} alt="Git Mastery Logo" />
    </div>
    <Stack>
      <Title> Welcome to GitMastery!</Title>
      <Stack gap={"xs"}>
        <Text> GitMastery is an open-source tool for anyone looking to upgrade their mastery of Git.</Text>
        <Text> Compared to other apps, we use a real terminal and real Git interaction for an authentic experience.</Text>
        <Text> Follow the steps below to get started.</Text>
      </Stack>
    </Stack>
  </div>
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
  return <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <Title order={3}> Choose a save location </Title>
      {saveLoc ? <IconCircleCheck color="green" /> : <IconCircleX color="red" />}
    </div>
    <Text> GitMastery needs to know where to save your in-progress exercises. These exercises are stored as folders on your hard drive.</Text>
    <div className="flex justify-center items-center gap-2 mt-8">
      <Button variant="light" onClick={async () => {
        const path = await selectSaveDir();
        setSaveLoc(path || "");
        setCanGoNext(path != "");
      }}> Choose save location </Button>
      <div className="flex items-center gap-1">
        <IconFolder />
        <Text> {saveLoc}</Text>
      </div>
    </div>
  </div>
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

  return <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <Title order={3}> Install Git </Title>
      {gitInstalled ? <IconCircleCheck color="green" /> : <IconCircleX color="red" />}
    </div>
    <Text> To fully understand Git, you must have Git on your local machine. GitMastery uses Git behind-the-hood to run all the lessons and exercises.</Text>
    <div className="flex justify-center items-center gap-2 my-4">
      <Button leftSection={<IconExternalLink size="1rem" />} variant="light" onClick={() => {
        window.electron.openExternal("https://git-scm.com/install/");
      }}> Download Git </Button>
      <Button variant="subtle" onClick={checkGit} loading={checkingGit} disabled={checkingGit}> Check </Button>
    </div>
    <div className="flex items-center gap-2">
      <Title order={3}> Install GitHub CLI </Title>
      {githubCliInstalled ? <IconCircleCheck color="green" /> : <IconCircleX color="red" />}
    </div>
    <Text> This tool lets GitMastery sync your progress to your GitHub account.</Text>
    <div className="flex justify-center items-center gap-2 my-4">
      <Button leftSection={<IconExternalLink size="1rem" />} variant="light" onClick={() => {
        window.electron.openExternal('https://github.com/cli/cli/releases')
      }}> Download GitHub CLI </Button>
      <Button variant="subtle" onClick={checkGithubCli} loading={checkingGithubCli} disabled={checkingGithubCli}> Check </Button>
    </div>
    <Accordion variant="separated" >
      <Accordion.Item key="iframe" value="iframe">
        <Accordion.Control icon={<IconGitBranch size={12} />}>Installation help</Accordion.Control>
        <Accordion.Panel><iframe src="https://git-mastery.org/companion-app/index.html#1-setting-up-git" className="w-full h-125"> </iframe></Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  </div>
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
    statusComponent = <div className="flex items-center gap-1.5"> <IconAlertCircle color="yellow" /> <Text className="leading-normal">{`Update available ${versionData.version} —> ${versionData.latest}`}</Text> </div>
  } else if (versionData?.version) {
    statusComponent = <div className="flex items-center gap-1.5"> <IconCircleCheck color="green" /> <Text className="leading-normal">{`Version ${versionData.version}`}</Text> </div>
  } else {
    statusComponent = <IconCircleX color="red" />
  }

  return <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <Title order={3}> Download Git Parser </Title>
      {statusComponent}
    </div>
    <Text> This is a custom in-house command line tool that GitMastery uses to check the correctness of your answers.</Text>
    <div className="flex justify-center items-center gap-2 my-4">
      <Button variant="light" onClick={downloadGitMasteryApp} loading={downloadingGitMastery} disabled={downloadingGitMastery || checkingGitMastery}> Download </Button>
      <Button variant="subtle" onClick={checkGitMastery} loading={checkingGitMastery} disabled={checkingGitMastery || downloadingGitMastery}> Check </Button>
    </div>
    <div className="flex items-center gap-2">
      <Title order={3}> Setup Git Mastery </Title>
      {gitMasterySetup ? <IconCircleCheck color="green" /> : <IconCircleX color="red" />}
    </div>
    <Text> Configure your system for GitMastery. </Text>
    <div className="flex justify-center items-center gap-2 my-4">
      <Button variant="light" onClick={setupGitMastery} loading={settingUpGitMastery} disabled={settingUpGitMastery}> Setup </Button>
    </div>
    <Accordion variant="separated" >
      <Accordion.Item key="iframe" value="iframe">
        <Accordion.Control icon={<IconGitBranch size={12} />}>Installation help</Accordion.Control>
        <Accordion.Panel><iframe src="https://git-mastery.org/companion-app/index.html#1-setting-up-git" className="w-full h-125"> </iframe></Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  </div>
}

const Step4 = () => {
  return <div className="flex flex-col gap-4">
    <div className="flex justify-center items-center m-6">
      <Alert className="scale-150" variant="outline" color="gm-green" title="Setup complete" icon={<IconCheck />}>
        You are now ready to use GitMastery!
      </Alert>
    </div>
  </div>
}
