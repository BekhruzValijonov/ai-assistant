import { useRef, useEffect } from 'react'
import { useThree, useStore } from '@react-three/fiber'
import {
  Vector2,
  WebGLRenderTarget,
  HalfFloatType,
  MeshBasicMaterial,
  AdditiveBlending,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

// Простой pass: берём RT_POINTS и передаём его в композер bloom
class TextureToBufferPass extends Pass {
  constructor(renderTarget) {
    super()
    this.needsSwap = true
    this._rt = renderTarget
    this._material = new MeshBasicMaterial({
      map: renderTarget.texture,
      depthTest: false,
      depthWrite: false,
    })
    this._fsQuad = new FullScreenQuad(this._material)
  }

  setRenderTarget(rt) {
    this._rt = rt
    this._material.map = rt?.texture ?? null
  }

  render(renderer, writeBuffer) {
    if (!this._rt) return
    this._material.map = this._rt.texture
    renderer.setRenderTarget(writeBuffer)
    if (this.clear) renderer.clear()
    this._fsQuad.render(renderer)
  }

  dispose() {
    this._material.dispose()
    this._fsQuad.dispose()
  }
}

/**
 * Простой bloom только по точкам:
 * 1) рендерим точки (layer 1) в RT_POINTS
 * 2) считаем bloom в RT_BLOOM
 * 3) каждый кадр чуть затемняем экран полупрозрачным quad
 * 4) поверх рисуем bloom → мягкий glow без сложного feedback.
 */
export default function BloomEffect() {
  const { gl, scene, camera, size } = useThree()
  const store = useStore()

  const rtPointsRef = useRef(null)
  const rtBloomRef = useRef(null)
  const composerRef = useRef(null)
  const texturePassRef = useRef(null)
  const bloomQuadRef = useRef(null)
  const fadeQuadRef = useRef(null)

  useEffect(() => {
    gl.autoClear = false
    gl.setClearColor(0x000000, 0)
    if (gl.domElement) {
      gl.domElement.style.setProperty('background-color', 'transparent', 'important')
    }

    const pr = gl.getPixelRatio()
    const w = size.width * pr
    const h = size.height * pr

    const RT_POINTS = new WebGLRenderTarget(w, h, { type: HalfFloatType })
    const RT_BLOOM = new WebGLRenderTarget(w, h, { type: HalfFloatType })

    rtPointsRef.current = RT_POINTS
    rtBloomRef.current = RT_BLOOM

    const texturePass = new TextureToBufferPass(RT_POINTS)
    texturePassRef.current = texturePass

    const composer = new EffectComposer(gl, RT_BLOOM)
    composer.renderToScreen = false
    composer.addPass(texturePass)

    const resolution = new Vector2(w, h)
    const bloomPass = new UnrealBloomPass(resolution, 0.32, 0.4, 0.42)
    composer.addPass(bloomPass)

    composerRef.current = { composer, bloomPass }

    // Quad, который выводит bloom на экран
    const bloomMaterial = new MeshBasicMaterial({
      map: RT_BLOOM.texture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: AdditiveBlending,
    })
    const bloomQuad = new FullScreenQuad(bloomMaterial)
    bloomQuadRef.current = { quad: bloomQuad, material: bloomMaterial }

    // Quad для лёгкого затемнения/смазывания предыдущего кадра
    const fadeMaterial = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.12, // регулирует длину «хвоста»
      depthTest: false,
      depthWrite: false,
    })
    const fadeQuad = new FullScreenQuad(fadeMaterial)
    fadeQuadRef.current = { quad: fadeQuad, material: fadeMaterial }

    gl.setAnimationLoop((time) => {
      const state = store.getState()
      state.advance(time)

      // 1) Плавно затухаем предыдущий кадр (простое temporal blur)
      gl.setRenderTarget(null)
      if (fadeQuadRef.current) {
        fadeQuadRef.current.quad.render(gl)
      }

      // 2) Рендерим точки в RT_POINTS
      camera.layers.enable(0)
      camera.layers.enable(1)
      camera.layers.set(1)
      gl.setRenderTarget(RT_POINTS)
      gl.clear()
      gl.render(scene, camera)
      camera.layers.enable(0)
      camera.layers.enable(1)

      // 3) Считаем bloom в RT_BLOOM
      texturePass.setRenderTarget(RT_POINTS)
      composer.render()

      // 4) Рисуем bloom поверх текущего кадра
      if (bloomQuadRef.current) {
        bloomQuadRef.current.material.map = composer.readBuffer.texture
        gl.setRenderTarget(null)
        bloomQuadRef.current.quad.render(gl)
      }
    })

    return () => {
      const state = store.getState()
      gl.setAnimationLoop((time) => {
        state.advance(time)
        gl.render(state.scene, state.camera)
      })

      composer.dispose()
      RT_POINTS.dispose()
      RT_BLOOM.dispose()
      texturePass.dispose()
      if (bloomQuadRef.current) {
        bloomQuadRef.current.material.dispose()
        bloomQuadRef.current.quad.dispose()
      }
      if (fadeQuadRef.current) {
        fadeQuadRef.current.material.dispose()
        fadeQuadRef.current.quad.dispose()
      }

      rtPointsRef.current = null
      rtBloomRef.current = null
      composerRef.current = null
      texturePassRef.current = null
      bloomQuadRef.current = null
      fadeQuadRef.current = null
    }
  }, [gl, scene, camera, size.width, size.height, store])

  return null
}
