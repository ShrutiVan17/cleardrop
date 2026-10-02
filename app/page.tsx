import Link from 'next/link'
import { Header } from './components/Header'

export default function Home() {
  return <>
    <Header connected={false} enabledCount={0} simpleMode />
    <main id="main-content" className="cd-shell" tabIndex={-1}>
      <section className="cd-hero cd-home-hero">
        <p className="cd-eyebrow">A LITTLE MORE ROOM AT YOUR DOOR</p>
        <h1>A delivery shouldn’t block your way.</h1>
        <p>A delivery photo shows what arrived. ClearDrop helps you check whether your doorway’s keep-clear area has changed — and whether it still needs your attention.</p>
        <div className="cd-home-actions">
          <Link className="cd-button cd-primary" href="/test">Try the working demo</Link>
          <Link className="cd-button" href="/phone">Use my phone camera</Link>
        </div>
        <p className="cd-help">No account, Ring camera or token needed to try it.</p>
      </section>
      <section className="cd-home-cases" aria-labelledby="cases-heading">
        <h2 id="cases-heading">Three checks. One clear question: can I pass?</h2>
        <div className="cd-home-grid">
          <article><span className="cd-home-number" aria-hidden="true">1</span><h3>A parcel beside the path</h3><p>A change outside your marked area should not trigger a doorway review.</p></article>
          <article><span className="cd-home-number" aria-hidden="true">2</span><h3>A parcel in the way</h3><p>A lasting change inside the area asks you to review it. Removal still needs your confirmation.</p></article>
          <article><span className="cd-home-number" aria-hidden="true">3</span><h3>The camera disconnects</h3><p>Lost video means unknown — not “all clear.” The previous concern stays visible.</p></article>
        </div>
        <p className="cd-help">The working demo processes generated video through the real monitoring component. It is not live Ring footage or proof of parcel-recognition accuracy. <Link className="cd-text-link" href="/demo">See the guided walkthrough</Link>.</p>
      </section>
      <section className="cd-home-private">
        <div><h2>Have a Ring camera?</h2><p>Your camera stays private. Sign in only when you want to connect your own Ring preview.</p></div>
        <Link className="cd-text-link" href="/doorway">Sign in to connect Ring</Link>
      </section>
      <footer className="cd-footer">Local-first video review. Always check the doorway yourself. Not a safety system. <Link className="cd-text-link" href="/privacy">Privacy information</Link></footer>
    </main>
  </>
}
