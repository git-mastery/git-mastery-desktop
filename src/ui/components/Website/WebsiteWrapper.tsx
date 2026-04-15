import { Alert, Badge, Box, Breadcrumbs, Center, Flex, Image, Text } from "@mantine/core"
import { useEffect, useRef } from "react"
import { useWebContentsView } from "../../context/useWebContentsView"
import { formatBreadcrumb } from "../../utils/format"
import logo from "../../assets/logo.png"

export const WebsiteWrapper = () => {

  const webViewRef = useRef<HTMLDivElement>(null)

  const { currentUrl, breadcrumbs, } = useWebContentsView()

  useEffect(() => {
    if (!webViewRef.current) return;

    /**
     * Converts the placeholder element's CSS-pixel bounds to physical pixels
     * and forwards them to the main process so the WebContentsView is
     * positioned correctly.
     *
     * Must be called both on resize AND whenever devicePixelRatio changes
     * (e.g. when the window is dragged to a monitor with different scaling).
     */
    function sendBounds() {
      if (!webViewRef.current) return;
      const { x, y, width, height } = webViewRef.current.getBoundingClientRect()

      const dpr = window.devicePixelRatio
      const physX = Math.round(x * dpr)
      const physY = Math.round(y * dpr)
      const physW = Math.round(width * dpr)
      const physH = Math.round(height * dpr)

      console.log({ css: { x, y, width, height }, dpr, physical: { x: physX, y: physY, width: physW, height: physH } })
      window.electron.setContentsViewSize(physX, physY, physW, physH)
    }

    // Re-send bounds whenever the element is resized.
    const resizeObserver = new ResizeObserver(sendBounds)
    resizeObserver.observe(webViewRef.current)

    // Re-send bounds when the window moves to a monitor with a different
    // pixel density. matchMedia fires a 'change' event when the media query
    // result flips, so we register a new listener every time the DPR changes
    // (the standard recursive pattern for cross-monitor DPR tracking).
    let dprCleanup: (() => void) | null = null

    function watchDpr() {
      dprCleanup?.()
      const mql = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      const onChange = () => {
        sendBounds()
        watchDpr() // re-register for the *next* DPR change
      }
      mql.addEventListener("change", onChange)
      dprCleanup = () => mql.removeEventListener("change", onChange)
    }

    watchDpr()

    return () => {
      resizeObserver.disconnect()
      dprCleanup?.()
    }
  }, [webViewRef])



  return <Flex direction={"column"} style={{ width: "100%", flexGrow: 1 }}>
    <Box p="md">

      <Breadcrumbs>
        {/* Map all except last one */}
        {breadcrumbs.slice(0, -1).map((breadcrumb, index) => (
          <Text variant="subheading" size="sm" key={index}>{formatBreadcrumb(breadcrumb).toUpperCase()}</Text>
        ))}

        {breadcrumbs.length > 0 ? <Badge>{formatBreadcrumb(breadcrumbs[breadcrumbs.length - 1])}</Badge> : <></>}
      </Breadcrumbs>
    </Box>
    <Flex ref={webViewRef} id="webcontentsview-placeholder" style={{ width: "100%", height: "100%", flexGrow: 1, justifyContent: "center", alignItems: "center" }}>
      {currentUrl ? <></> : <Alert style={{ transform: "scale(1.25)" }} variant="light" color="gm-green" icon={<Image src={logo} alt="Git Mastery" />} title="Get started with lessons or exercises">
        Choose a tour from the left sidebar, or download an exercise and start doing it!
      </Alert>}

    </Flex>
  </Flex>
}