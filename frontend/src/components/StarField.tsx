/* StarField - Breathing star background */
import { useEffect, useRef } from 'react'
import { useTheme } from './ThemeContext'

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || theme === 'light') return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let stars: { x: number; y: number; r: number; speed: number; phase: number }[] = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initStars()
    }

    const initStars = () => {
      const count = Math.floor((canvas.width * canvas.height) / 6000)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.0008 + 0.0002,
        phase: Math.random() * Math.PI * 2,
      }))
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const star of stars) {
        const opacity = 0.3 + 0.7 * Math.abs(Math.sin(time * star.speed + star.phase))
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200, 210, 240, ${opacity})`
        ctx.fill()
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    animId = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [theme])

  if (theme === 'light') return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  )
}
