import { Avatar, Box, Divider, Flex, Group, Menu, Stack, Text, UnstyledButton } from "@mantine/core"
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
  return <Stack justify="space-between" h="100%">
    {/* Tours */}
    <Stack style={{ overflowY: "scroll" }}>
      <TourList />
      {/* Lessons (scrollable) */}
      <Flex flex={1}>
        <ExerciseList />
      </Flex>
    </Stack>

    {/* User profile (fixed)*/}
    <Divider />
    <Flex style={{ flexShrink: 0 }} w="100%">
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
    </Flex>
  </Stack>
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
      style={{ padding: 0, color: 'var(--mantine-color-text)', borderRadius: 'var(--mantine-radius-sm)', width: "100%" }}
      {...others}
    >
      <Group>
        <Avatar src={image} radius="xl" />
        <Box style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            {name}
          </Text>
          <Text c="dimmed" size="xs">
            {email}
          </Text>
        </Box>
        {icon || <IconChevronRight size={16} />}
      </Group>
    </UnstyledButton>
  )
);
