import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import SphereScene from './components/SphereScene'
import BloomEffect from './components/BloomEffect'
import './App.css'

function App() {
  const [isListening, setIsListening] = useState(false)

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="nav">
        <button type="button" className="nav__back" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="nav__title">Voice Assessment</h1>
        <span className="nav__spacer" aria-hidden />
      </nav>

      {/* Main content */}
      <main className="main">
        <p className="main__hint">
          {isListening ? 'Listening...' : 'Go ahead, I\'m listening2...'}
        </p>

        <div className={`visualizer ${isListening ? 'visualizer--listening' : ''}`}>
          <div className="visualizer__canvas-wrap">
            <Canvas
              gl={{
                alpha: false,
                antialias: false,
                premultipliedAlpha: false,
              }}
              onCreated={({ gl: renderer }) => {
                renderer.setClearColor(0xFF0000, 0.4)
                // const canvas = renderer.domElement
                // canvas.style.setProperty('background-color', 'transparent', 'important')
              }}
              camera={{ position: [0, 0, 3.2], fov: 50 }}
              dpr={[1, 2]}
            >
              <SphereScene isListening={isListening} />
              <BloomEffect />
            </Canvas>
          </div>
        </div>

        <p className="main__description">
          Flowing, natural forms sweep across
          <br />
          the design, reflecting balance and
          <br />
          <span className="main__description--muted">abstract elegance.</span>
        </p>
      </main>

      {/* Footer / Input area */}
      <footer className="footer">
        <button type="button" className="footer__btn" aria-label="Edit">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>

        <button
          type="button"
          className={`footer__mic ${isListening ? 'footer__mic--active' : ''}`}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
          aria-pressed={isListening}
          onClick={() => setIsListening(!isListening)}
        >
          <span className="footer__mic-inner">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </span>
        </button>

        <button type="button" className="footer__btn" aria-label="Bookmark">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </footer>
    </div>
  )
}

export default App
