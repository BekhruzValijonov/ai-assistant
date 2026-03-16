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

/**
 * Копирует текстуру в writeBuffer (чтобы следующий pass мог её прочитать из readBuffer после swap).
 */
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

  render(renderer, writeBuffer, readBuffer) {
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
 * Bloom только по точкам: точки на layer 1, рендер слоя в RT → bloom → аддитивное наложение на кадр.
 */
export default function BloomEffect() {
  const { gl, scene, camera, size } = useThree()
  const store = useStore()
  const composerRef = useRef(null)
  const rtPointsRef = useRef(null)
  const rtBloomRef = useRef(null)
  const quadAdditiveRef = useRef(null)
  const texturePassRef = useRef(null)

  useEffect(() => {
    gl.setClearColor(0x000000, 0)
    if (gl.domElement) gl.domElement.style.setProperty('background-color', 'transparent', 'important')

    const w = size.width * gl.getPixelRatio()
    const h = size.height * gl.getPixelRatio()

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
    const bloomPass = new UnrealBloomPass(resolution, 0.28, 0.3, 0.45)
    composer.addPass(bloomPass)

    const quadMaterial = new MeshBasicMaterial({
      map: RT_BLOOM.texture,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: AdditiveBlending,
    })
    const quad = new FullScreenQuad(quadMaterial)
    quadAdditiveRef.current = { quad, material: quadMaterial }

    composerRef.current = { composer, bloomPass }

    gl.setAnimationLoop((time) => {
      const state = store.getState()
      state.advance(time)

      // 1) Полный кадр (все слои) на экран — прозрачный фон
      camera.layers.enable(0)
      camera.layers.enable(1)
      gl.setRenderTarget(null)
      gl.setClearColor(0x000000, 0)
      gl.clear()
      gl.render(scene, camera)

      // 2) Только точки (layer 1) в RT
      camera.layers.set(1)
      gl.setRenderTarget(RT_POINTS)
      gl.clear()
      gl.render(scene, camera)
      camera.layers.enable(0)
      camera.layers.enable(1)

      // 3) Bloom только по буферу с точками
      texturePass.setRenderTarget(RT_POINTS)
      composer.render()

      // 4) Аддитивно накладываем свечение на экран
      quadMaterial.map = composer.readBuffer.texture
      gl.setRenderTarget(null)
      quad.render(gl)
    })

    return () => {
      const s = store.getState()
      gl.setAnimationLoop((time) => {
        s.advance(time)
        gl.render(s.scene, s.camera)
      })
      composer.dispose()
      RT_POINTS.dispose()
      RT_BLOOM.dispose()
      texturePass.dispose()
      quadMaterial.dispose()
      quad.dispose()
      composerRef.current = null
      rtPointsRef.current = null
      rtBloomRef.current = null
      quadAdditiveRef.current = null
    }
  }, [gl, scene, camera, store])

  useEffect(() => {
    const pr = gl.getPixelRatio()
    const w = size.width * pr
    const h = size.height * pr
    const rtPoints = rtPointsRef.current
    const rtBloom = rtBloomRef.current
    const data = composerRef.current
    if (rtPoints) {
      rtPoints.setSize(w, h)
    }
    if (rtBloom) {
      rtBloom.setSize(w, h)
    }
    if (data?.bloomPass) {
      data.bloomPass.resolution.set(w, h)
    }
  }, [gl, size.width, size.height])

  return null
}
