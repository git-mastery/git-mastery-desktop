import { Avatar, Divider, Menu, Text, UnstyledButton } from "@mantine/core"
import { TourList } from "./TourList"
import { ExerciseList } from "./ExerciseList"
import { IconChevronRight, IconSettings } from "@tabler/icons-react"
import { forwardRef } from "react"
import { useLocalStorage } from "@mantine/hooks"

export const LeftBarWrapper = () => {

  const [onboardingCompleted, setOnboardingCompleted] = useLocalStorage({
    key: 'onboarding-completed',
    defaultValue: false,
  })
  return <div className="flex flex-col justify-between h-full">
    {/* Tours */}
    <div className="flex flex-col overflow-y-scroll">
      <TourList />
      {/* Lessons (scrollable) */}
      <div className="flex flex-1">
        <ExerciseList />
      </div>
    </div>

    {/* User profile (fixed)*/}
    <Divider />
    <div className="shrink-0 w-full">
      <Menu shadow="md" width={200}>
        <Menu.Target>
          <UserButton
            image="https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/avatars/avatar-8.png"
            name="Git Learner"
            email="Level 0 / 50"
          />
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Setup</Menu.Label>
          <Menu.Item leftSection={<IconSettings size={14} />} onClick={() => setOnboardingCompleted(false)}>
            Setup GitMastery
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  </div>
}

interface UserButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  image: string;
  name: string;
  email: string;
  icon?: React.ReactNode;
}

const UserButton = forwardRef<HTMLButtonElement, UserButtonProps>(
  ({ image, name, email, icon, ...others }: UserButtonProps, ref) => (
    <UnstyledButton
      ref={ref}
      className="p-0 w-full rounded-(--mantine-radius-sm) text-(--mantine-color-text)"
      {...others}
    >
      <div className="flex items-center gap-2">
        <Avatar src={image} radius="xl" />
        <div className="flex-1">
          <Text size="sm" fw={500}>
            {name}
          </Text>
          <Text c="dimmed" size="xs">
            {email}
          </Text>
        </div>
        {icon || <IconChevronRight size={16} />}
      </div>
    </UnstyledButton>
  )
);
