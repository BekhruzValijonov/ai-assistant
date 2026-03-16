import { useRef, useEffect, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { pointsVertexShader } from '../shaders/blobVertex.glsl.js'
import { pointsFragmentShader } from '../shaders/pointsFragment.glsl.js'

function TransparentBackground() {
  const { scene, gl } = useThree()

  useEffect(() => {
    scene.background = null
    gl.setClearColor(0x000000, 0)
  }, [scene, gl])

  return null
}

export default function SphereScene({ isListening }) {
  const pointsRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef = useRef(null)
  const audioContextRef = useRef(null)
  const dataArrayRef = useRef(null)
  const frameCounterRef = useRef(0)

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_frequency: { value: 0 },
      u_pointSize: { value: 7.0 },
      u_red: { value: 0.48 },
      u_green: { value: 0.83 },
      u_blue: { value: 0.75 },
    }),
    []
  )

  // Микрофон включаем только в режиме listening
  useEffect(() => {
    if (!isListening) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      analyserRef.current = null
      dataArrayRef.current = null
      return
    }

    let cancelled = false
    const setupMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        const audioContext = new (window.AudioContext || window.webkitAudioContext)()
        audioContextRef.current = audioContext
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 128                 // меньше частот → дешевле
        analyser.smoothingTimeConstant = 0.85
        source.connect(analyser)
        analyserRef.current = analyser
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
      } catch (err) {
        console.warn('Microphone access:', err)
      }
    }

    setupMic()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
      analyserRef.current = null
      dataArrayRef.current = null
    }
  }, [isListening])

  // Плавная анимация + реакция на звук, с пропуском кадров для экономии
  useFrame((state) => {
    if (!pointsRef.current) return

    const t = state.clock.getElapsedTime()
    uniforms.u_time.value = t

    // Плавучее движение всегда
    if (isListening) {
      pointsRef.current.rotation.y = t * 0.22
      pointsRef.current.rotation.x = Math.sin(t * 0.18) * 0.12
      pointsRef.current.rotation.z = Math.sin(t * 0.12) * 0.04
      pointsRef.current.scale.setScalar(1)
    } else {
      const slow = t * 0.07
      pointsRef.current.rotation.y = slow
      pointsRef.current.rotation.x = Math.sin(t * 0.12) * 0.06
      pointsRef.current.rotation.z = Math.sin(t * 0.08) * 0.04
      const breathe = 1 + Math.sin(t * 0.35) * 0.025
      pointsRef.current.scale.setScalar(breathe)
    }

    // Аудио читаем не каждый кадр
    frameCounterRef.current += 1
    const shouldSampleAudio = frameCounterRef.current % 2 === 0

    if (isListening && analyserRef.current && dataArrayRef.current && shouldSampleAudio) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current)
      let sum = 0
      const len = dataArrayRef.current.length
      for (let i = 0; i < len; i += 2) {      // берём каждую вторую частоту
        sum += dataArrayRef.current[i]
      }
      const average = sum / (len / 2)
      const boosted = average * 0.7
      uniforms.u_frequency.value = Math.min(boosted, 40)
      uniforms.u_pointSize.value = 8.5 + boosted * 0.05
    } else if (!isListening) {
      uniforms.u_frequency.value = 0
      uniforms.u_pointSize.value = 9.0
    }
  })

  // Слой для селективного bloom — только точки получают свечение
  useEffect(() => {
    if (pointsRef.current) pointsRef.current.layers.set(1)
  }, [])

  return <>
      <TransparentBackground />

      <points ref={pointsRef}>
        <icosahedronGeometry args={[1, 30]} />
        
        <shaderMaterial
          vertexShader={pointsVertexShader}
          fragmentShader={pointsFragmentShader}
          uniforms={uniforms}
          transparent
          depthTest
          depthWrite
        />
      </points>
    </>
}