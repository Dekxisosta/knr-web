import './IDEViewport.css';

/**
 * IDEViewport: a minimal code card shown below the hero.
 * Just a window bar and a short snippet: no explorer, tabs, status bar or dragging.
 * Monochrome, so it sits with the rest of the black-and-white design.
 */

type Token = { t: string; c?: 'k' | 's' | 'm' };

// Each line is a list of tokens: k = keyword, s = string, m = muted (comments)
const lines: Token[][] = [
  [{ t: 'import', c: 'k' }, { t: ' { Component } ' }, { t: 'from', c: 'k' }, { t: ' ' }, { t: "'@angular/core'", c: 's' }, { t: ';' }],
  [{ t: 'import', c: 'k' }, { t: ' { HttpClient } ' }, { t: 'from', c: 'k' }, { t: ' ' }, { t: "'@angular/common/http'", c: 's' }, { t: ';' }],
  [],
  [{ t: '@Component', c: 'k' }, { t: '({' }],
  [{ t: '  selector: ' }, { t: "'app-root'", c: 's' }, { t: ',' }],
  [{ t: '  templateUrl: ' }, { t: "'./app.component.html'", c: 's' }],
  [{ t: '})' }],
  [{ t: 'export class', c: 'k' }, { t: ' AppComponent {' }],
  [{ t: '  products: Product[] = [];' }],
  [],
  [{ t: '  constructor(', }, { t: 'private', c: 'k' }, { t: ' http: HttpClient) {}' }],
  [],
  [{ t: '  ' }, { t: 'ngOnInit', c: 'k' }, { t: '() {' }],
  [{ t: '    // Load products, then render', c: 'm' }],
  [{ t: '    ' }, { t: 'this', c: 'k' }, { t: '.loadProducts();' }],
  [{ t: '  }' }],
  [{ t: '}' }],
];

export default function IDEViewport() {
  return (
    <figure className="code-card" aria-label="Code editor preview">
      <figcaption className="code-bar">
        <span className="code-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="code-file">app.component.ts</span>
      </figcaption>

      <pre className="code-body" tabIndex={0} aria-label="app.component.ts">
        <code>
          {lines.map((tokens, i) => (
            <span className="code-row" key={i}>
              <span className="code-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="code-text">
                {tokens.map((tok, j) => (
                  <span key={j} className={tok.c ? `tok-${tok.c}` : undefined}>
                    {tok.t}
                  </span>
                ))}
                {i === lines.length - 1 && <span className="code-caret" aria-hidden="true" />}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
