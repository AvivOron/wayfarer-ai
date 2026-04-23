'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (pathname === prevPathname.current) return
    prevPathname.current = pathname

    // Page has loaded — complete the bar
    setProgress(100)
    timerRef.current = setTimeout(() => {
      setVisible(false)
      setProgress(0)
    }, 300)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [pathname])

  // Expose a way for nav clicks to start the bar
  useEffect(() => {
    function handleNavigationStart() {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)

      setProgress(10)
      setVisible(true)

      let current = 10
      intervalRef.current = setInterval(() => {
        // Ease toward 85% but never reach 100 until page loads
        current = current + (85 - current) * 0.12
        setProgress(current)
      }, 100)
    }

    window.addEventListener('wayfarer:navigation-start', handleNavigationStart)
    return () => {
      window.removeEventListener('wayfarer:navigation-start', handleNavigationStart)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-sky-500 transition-all duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
