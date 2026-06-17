import { PetWidget } from '../pet/PetWidget'
import { MouseCursor } from '../pet/MouseCursor'

export default function App() {
  return (
    <main className="demo-page">
      <section className="demo-panel">
        <p className="eyebrow">Mini Floating Pet Companion</p>
        <h1>Feed Your Pet</h1>
        <p>
          A tiny Phaser-powered companion lives in the corner, reacts to care
          actions, saves locally, and syncs through the Cloudflare API when it is
          available.
        </p>
        <input
          aria-label="Typing test"
          placeholder="Type here: pet should not follow the cursor while typing"
        />
      </section>
      <MouseCursor />
      <PetWidget />
    </main>
  )
}
