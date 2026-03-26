import { Button } from "@mantine/core"

export const NavigationButton = ({ onClick, title, isActive }: { onClick: () => void, title: string, isActive?: boolean }) => {
  return <Button variant="subtle" color="dark" size="sm" w="100%"
    onClick={onClick}
    styles={
      {
        label: { whiteSpace: "pre-wrap", textAlign: "left", width: "100%" },
        root: {
          height: 'auto',
          padding: "8px",
          lineHeight: "1.5em"
        },
      }

    } > {title} </Button>
}