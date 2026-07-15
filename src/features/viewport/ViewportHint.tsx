import { motion } from 'framer-motion';

/** Floating control hint shown over the viewport while the scene is empty. */
export function ViewportHint() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.35, ease: 'easeOut' }}
      className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2"
    >
      <div className="glass-panel flex items-center gap-3 rounded-full px-4 py-1.5 text-[11px] text-secondary shadow-panel">
        <span>Drag to orbit</span>
        <span className="text-muted">·</span>
        <span>Scroll to zoom</span>
        <span className="text-muted">·</span>
        <span>Right-drag to pan</span>
      </div>
    </motion.div>
  );
}
