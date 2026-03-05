import { Badge, Box, Breadcrumbs, Flex, Text } from "@mantine/core"
import { useEffect, useRef } from "react"
import { useWebContentsView } from "../../context/useWebContentsView"
import { formatBreadcrumb } from "../../utils/format"

export const WebsiteWrapper = () => {

  const webViewRef = useRef<HTMLDivElement>(null)

  const { currentUrl, breadcrumbs, } = useWebContentsView()

  console.log({ currentUrl, breadcrumbs })
  useEffect(() => {

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const { x, y } = entry.target.getBoundingClientRect()
        window.electron.display(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
      }
    })

    if (!webViewRef.current) return;
    resizeObserver.observe(webViewRef.current)
    return () => {
      resizeObserver.disconnect()
    }
  }, [webViewRef])



  return <Flex direction={"column"} style={{
    width: "100%",
    flexGrow: 1
  }}>
    <Box p="md">

      <Breadcrumbs>
        {/* Map all except last one */}
        {breadcrumbs.slice(0, -1).map((breadcrumb, index) => (
          <Text variant="subheading" size="sm" key={index}>{formatBreadcrumb(breadcrumb).toUpperCase()}</Text>
        ))}

        <Badge>{formatBreadcrumb(breadcrumbs[breadcrumbs.length - 1])}</Badge>
      </Breadcrumbs>
    </Box>
    <Flex ref={webViewRef} id="webcontentsview-placeholder" style={{ width: "100%", height: "100%", flexGrow: 1 }}></Flex>
  </Flex>
}