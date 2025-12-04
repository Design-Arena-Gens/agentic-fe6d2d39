import SceneCanvas from "@/components/SceneCanvas";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Miniature Valley Chase</h1>
        <p className={styles.subtitle}>
          Follow Jax and Nino racing through a sunlit diorama, crafted for a
          Pixar-inspired short.
        </p>
      </div>
      <div className={styles.canvasWrapper}>
        <SceneCanvas />
      </div>
      <footer className={styles.footer}>
        <span>8 second cinematic render &bull; Morning valley ambience &bull; High realism</span>
      </footer>
    </main>
  );
}
