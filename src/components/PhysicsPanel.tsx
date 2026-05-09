import { useEffect, useRef, useState, useCallback } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import type { Shape } from '@/types'
import Matter from 'matter-js'
import styles from './PhysicsPanel.module.css'

type SimState = 'idle' | 'running' | 'paused'

interface PhysicsBody {
  shapeId: string
  body: Matter.Body
  origX: number
  origY: number
}

const SLIDERS = [
  { label: 'Gravity',  key: 'gravity'  as const, min: 0, max: 3, step: 0.1  },
  { label: 'Bounce',   key: 'bounce'   as const, min: 0, max: 1, step: 0.05 },
  { label: 'Friction', key: 'friction' as const, min: 0, max: 1, step: 0.05 },
]

export default function PhysicsPanel() {
  const store = useCanvasStore()
  const [simState, setSimState] = useState<SimState>('idle')
  const [gravity,  setGravity]  = useState(1)
  const [bounce,   setBounce]   = useState(0.4)
  const [friction, setFriction] = useState(0.1)
  const [showSettings, setShowSettings] = useState(false)

  const engineRef   = useRef<Matter.Engine | null>(null)
  const bodiesRef   = useRef<PhysicsBody[]>([])
  const rafRef      = useRef<number>(0)
  const snapshotRef = useRef<Shape[]>([])

  const sliderValues = { gravity, bounce, friction }
  const sliderSetters: Record<string, (v: number) => void> = {
    gravity: setGravity, bounce: setBounce, friction: setFriction,
  }

  const startSim = useCallback(() => {
    const { shapes, viewport } = store
    snapshotRef.current = JSON.parse(JSON.stringify(shapes))

    const engine = Matter.Engine.create({ gravity: { x: 0, y: gravity } })
    engineRef.current = engine

    const canvasEl = document.querySelector('canvas') as HTMLCanvasElement
    const canvasH  = canvasEl?.height ?? window.innerHeight
    const canvasW  = canvasEl?.width  ?? window.innerWidth

    const worldFloorY  = (canvasH - viewport.y) / viewport.zoom
    const worldLeft    = (0        - viewport.x) / viewport.zoom
    const worldRight   = (canvasW  - viewport.x) / viewport.zoom
    const worldWidth   = worldRight - worldLeft
    const worldCenterX = (worldLeft + worldRight) / 2

    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(worldCenterX,  worldFloorY,        worldWidth * 3, 40,          { isStatic: true, restitution: bounce }),
      Matter.Bodies.rectangle(worldLeft - 20, worldFloorY / 2,   40,             worldFloorY * 4, { isStatic: true }),
      Matter.Bodies.rectangle(worldRight + 20, worldFloorY / 2,  40,             worldFloorY * 4, { isStatic: true }),
    ])

    const bodies: PhysicsBody[] = []

    for (const shape of shapes) {
      if (shape.hidden || shape.locked) continue
      let body: Matter.Body | null = null

      if (shape.type === 'ellipse') {
        const r = Math.max(Math.min(shape.w, shape.h) / 2, 4)
        body = Matter.Bodies.circle(shape.x + shape.w / 2, shape.y + shape.h / 2, r, { restitution: bounce, friction, label: shape.id })
      } else if (shape.type === 'line' || shape.type === 'arrow') {
        const len   = Math.hypot(shape.x2 - shape.x, shape.y2 - shape.y)
        const angle = Math.atan2(shape.y2 - shape.y, shape.x2 - shape.x)
        body = Matter.Bodies.rectangle((shape.x + shape.x2) / 2, (shape.y + shape.y2) / 2, Math.max(len, 4), 6, { restitution: bounce, friction, angle, label: shape.id })
      } else if ('w' in shape && 'h' in shape) {
        body = Matter.Bodies.rectangle(shape.x + shape.w / 2, shape.y + shape.h / 2, Math.max(shape.w, 4), Math.max(shape.h, 4), { restitution: bounce, friction, label: shape.id })
      }

      if (body) {
        Matter.Body.applyForce(body, body.position, { x: (Math.random() - 0.5) * 0.004, y: -Math.random() * 0.001 })
        Matter.Composite.add(engine.world, body)
        bodies.push({ shapeId: shape.id, body, origX: shape.x, origY: shape.y })
      }
    }

    bodiesRef.current = bodies
    setSimState('running')

    let lastTime = performance.now()
    const loop = (now: number) => {
      const delta = Math.min(now - lastTime, 50)
      lastTime = now
      Matter.Engine.update(engine, delta)
      for (const pb of bodiesRef.current) {
        const shape = store.shapes.find((s) => s.id === pb.shapeId)
        if (!shape) continue
        if (shape.type === 'line' || shape.type === 'arrow') {
          const len = Math.hypot(shape.x2 - shape.x, shape.y2 - shape.y)
          const a   = pb.body.angle
          store.updateShape(pb.shapeId, { x: pb.body.position.x - Math.cos(a) * len / 2, y: pb.body.position.y - Math.sin(a) * len / 2, x2: pb.body.position.x + Math.cos(a) * len / 2, y2: pb.body.position.y + Math.sin(a) * len / 2 } as Partial<Shape>)
        } else if ('w' in shape) {
          store.updateShape(pb.shapeId, { x: pb.body.position.x - (shape as { w: number }).w / 2, y: pb.body.position.y - (shape as { h: number }).h / 2 })
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [store, gravity, bounce, friction])

  const pauseSim = useCallback(() => {
    if (simState === 'running') {
      cancelAnimationFrame(rafRef.current)
      setSimState('paused')
    } else if (simState === 'paused') {
      let lastTime = performance.now()
      const loop = (now: number) => {
        const delta = Math.min(now - lastTime, 50)
        lastTime = now
        Matter.Engine.update(engineRef.current!, delta)
        for (const pb of bodiesRef.current) {
          const shape = store.shapes.find((s) => s.id === pb.shapeId)
          if (!shape || !('w' in shape)) continue
          store.updateShape(pb.shapeId, { x: pb.body.position.x - (shape as { w: number }).w / 2, y: pb.body.position.y - (shape as { h: number }).h / 2 })
        }
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
      setSimState('running')
    }
  }, [simState, store])

  const stopSim = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    if (engineRef.current) { Matter.Engine.clear(engineRef.current); engineRef.current = null }
    bodiesRef.current = []
    if (snapshotRef.current.length > 0) {
      store.setShapes(snapshotRef.current)
      store.pushHistory()
      snapshotRef.current = []
    }
    setSimState('idle')
  }, [store])

  const explode = useCallback(() => {
    if (simState !== 'running') return
    for (const pb of bodiesRef.current) {
      const a = Math.random() * Math.PI * 2
      const f = 0.05 + Math.random() * 0.1
      Matter.Body.applyForce(pb.body, pb.body.position, { x: Math.cos(a) * f, y: Math.sin(a) * f - 0.05 })
    }
  }, [simState])

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    if (engineRef.current) Matter.Engine.clear(engineRef.current)
  }, [])

  return (
    <div className={styles.wrapper}>

      {/* Settings panel */}
      {showSettings && simState === 'idle' && (
        <div className={styles.settings}>
          <div className={styles.settingsTitle}>Physics Settings</div>
          {SLIDERS.map(({ label, key, min, max, step }) => (
            <div key={key} className={styles.sliderRow}>
              <div className={styles.sliderHeader}>
                <span className={styles.sliderLabel}>{label}</span>
                <span className={styles.sliderValue}>{sliderValues[key].toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={min} max={max} step={step}
                value={sliderValues[key]}
                title={label}
                className={styles.slider}
                onChange={(e) => sliderSetters[key](parseFloat(e.target.value))}
              />
            </div>
          ))}
        </div>
      )}

      {/* Controls bar */}
      <div className={styles.bar}>

        {simState === 'idle' && (
          <button
            type="button"
            title="Physics settings"
            onClick={() => setShowSettings((v) => !v)}
            className={`${styles.btn} ${styles.btnSettings} ${showSettings ? styles.btnSettingsActive : ''}`}
          >⚙</button>
        )}

        {simState === 'idle' ? (
          <button type="button" title="Start physics simulation" onClick={startSim} className={`${styles.btn} ${styles.btnSimulate}`}>
            ▶ Simulate
          </button>
        ) : (
          <button type="button" onClick={pauseSim} className={`${styles.btn} ${styles.btnPause}`}>
            {simState === 'paused' ? '▶ Resume' : '⏸ Pause'}
          </button>
        )}

        {simState === 'running' && (
          <button type="button" title="Explode!" onClick={explode} className={`${styles.btn} ${styles.btnExplode}`}>
            💥 Explode
          </button>
        )}

        {simState !== 'idle' && (
          <button type="button" title="Stop and restore original layout" onClick={stopSim} className={`${styles.btn} ${styles.btnRestore}`}>
            ■ Restore
          </button>
        )}

        {simState === 'running' && (
          <div className={styles.liveWrapper}>
            <div className={styles.liveDot} />
            <span className={styles.liveText}>LIVE</span>
          </div>
        )}
      </div>
    </div>
  )
}