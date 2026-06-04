/* StarField — Breathing stars, nebula glow, and shooting stars */
import { useEffect, useRef } from 'react'
import { useTheme } from './ThemeContext'

interface Star {
  x: number
  y: number
  r: number
  speed: number
  phase: number
  hue: number // subtle color variation
}

interface ShootingStar {
  x: number
  y: number
  len: number
  speed: number
  angle: number
  opacity: number
  life: number
  maxLife: number
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || theme !== 'cosmos') return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let stars: Star[] = []
    let shootingStars: ShootingStar[] = []
    let lastShootTime = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initStars()
    }

    const initStars = () => {
      const count = Math.floor((canvas.width * canvas.height) / 5500)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.0008 + 0.0002,
        phase: Math.random() * Math.PI * 2,
        hue: Math.random() * 40 - 20, // -20 to +20 offset from base blue-white
      }))
    }

    const spawnShootingStar = () => {
      const angle = Math.PI / 6 + Math.random() * Math.PI / 4 // 30-75 degrees
      shootingStars.push({
        x: Math.random() * canvas.width * 0.8,
        y: Math.random() * canvas.height * 0.3,
        len: 60 + Math.random() * 80,
        speed: 4 + Math.random() * 4,
        angle,
        opacity: 0.6 + Math.random() * 0.4,
        life: 0,
        maxLife: 40 + Math.random() * 30,
      })
    }

    const drawNebula = () => {
      // Soft nebula glow patches
      const nebulae = [
        { x: canvas.width * 0.15, y: canvas.height * 0.25, r: 200, color: 'rgba(59,130,246,0.012)' },
        { x: canvas.width * 0.75, y: canvas.height * 0.6, r: 250, color: 'rgba(167,139,250,0.01)' },
        { x: canvas.width * 0.5, y: canvas.height * 0.8, r: 180, color: 'rgba(34,211,238,0.008)' },
      ]
      for (const n of nebulae) {
        const grad = ctx!.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r)
        grad.addColorStop(0, n.color)
        grad.addColorStop(1, 'transparent')
        ctx!.fillStyle = grad
        ctx!.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2)
      }
    }

    const draw = (time: number) => {
      ctx!.clearRect(0, 0, canvas.width, canvas.height)

      // Draw nebula glow
      drawNebula()

      // Draw stars with subtle color variation
      for (const star of stars) {
        const opacity = 0.3 + 0.7 * Math.abs(Math.sin(time * star.speed + star.phase))
        const baseHue = 220 + star.hue // blue-white range
        ctx!.beginPath()
        ctx!.arc(star.x, star.y, star.r, 0, Math.PI * 2)
        ctx!.fillStyle = `hsla(${baseHue}, 60%, 85%, ${opacity})`
        ctx!.fill()
      }

      // Shooting stars
      if (time - lastShootTime > 4000 + Math.random() * 6000) {
        spawnShootingStar()
        lastShootTime = time
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]
        s.life++
        s.x += Math.cos(s.angle) * s.speed
        s.y += Math.sin(s.angle) * s.speed

        const progress = s.life / s.maxLife
        const fadeOut = progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1
        const fadeIn = progress < 0.1 ? progress / 0.1 : 1
        const alpha = s.opacity * fadeOut * fadeIn

        // Draw trail
        const tailX = s.x - Math.cos(s.angle) * s.len * (1 - progress * 0.5)
        const tailY = s.y - Math.sin(s.angle) * s.len * (1 - progress * 0.5)

        const grad = ctx!.createLinearGradient(tailX, tailY, s.x, s.y)
        grad.addColorStop(0, `rgba(200, 215, 255, 0)`)
        grad.addColorStop(0.7, `rgba(200, 215, 255, ${alpha * 0.4})`)
        grad.addColorStop(1, `rgba(255, 255, 255, ${alpha})`)

        ctx!.beginPath()
        ctx!.moveTo(tailX, tailY)
        ctx!.lineTo(s.x, s.y)
        ctx!.strokeStyle = grad
        ctx!.lineWidth = 1.5
        ctx!.stroke()

        // Bright head
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, 1.5, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx!.fill()

        if (s.life >= s.maxLife) {
          shootingStars.splice(i, 1)
        }
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

  if (theme !== 'cosmos') return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.7 }}
    />
  )
}
