import { motion, useReducedMotion } from 'motion/react';
import { ease, duration } from '../../lib/motion';
import './IDEViewport.css';

/**
 * AuditTerminal: second window beside the code card. Monochrome, decorative,
 * mirrors the "knr audit" readout in the hero (no figures, no claims).
 * Inherits "hidden" / "visible" from its parent motion element, then prints
 * its lines one after another.
 */

type Line = { kind: 'cmd' | 'ok' | 'run' | 'gap'; text?: string };

const lines: Line[] = [
  { kind: 'cmd', text: 'knr audit --deep' },
  { kind: 'gap' },
  { kind: 'ok', text: 'dependencies validated' },
  { kind: 'ok', text: 'auth flows reviewed' },
  { kind: 'ok', text: 'input handling tested' },
  { kind: 'ok', text: 'headers and CORS hardened' },
  { kind: 'ok', text: 'secrets scan clean' },
  { kind: 'gap' },
  { kind: 'run', text: 'reporting findings' },
];

export default function AuditTerminal() {
  const reduced = useReducedMotion();

  const container = {
    hidden: {},
    visible: { transition: { delayChildren: reduced ? 0 : 0.6, staggerChildren: reduced ? 0 : 0.16 } },
  };
  const row = {
    hidden: { opacity: 0, x: reduced ? 0 : -8 },
    visible: { opacity: 1, x: 0, transition: { duration: duration.base, ease } },
  };

  return (
    <figure className="code-card audit-terminal" aria-label="Terminal preview">
      <figcaption className="code-bar">
        <span className="code-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="code-file">terminal</span>
      </figcaption>

      <pre className="code-body" aria-label="knr audit output">
        <motion.code variants={container}>
          {lines.map((l, i) => (
            <motion.span className="code-row" key={i} variants={row}>
              <span className="code-text">
                {l.kind === 'cmd' && (
                  <>
                    <span className="tok-m">$ </span>
                    <span className="tok-k">{l.text}</span>
                  </>
                )}
                {l.kind === 'ok' && (
                  <>
                    <span className="tok-k">{'  ✓ '}</span>
                    {l.text}
                  </>
                )}
                {l.kind === 'run' && (
                  <>
                    <span className="tok-k">{'  › '}</span>
                    {l.text}
                    <span className="code-caret" aria-hidden="true" />
                  </>
                )}
              </span>
            </motion.span>
          ))}
        </motion.code>
      </pre>
    </figure>
  );
}
