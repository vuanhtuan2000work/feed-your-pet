import { PetWidget } from '../pet/PetWidget'
import { MouseCursor } from '../pet/MouseCursor'

export default function App() {
  return (
    <main className="demo-page">
      <MouseCursor />
      <PetWidget />
    </main>
  )
}
