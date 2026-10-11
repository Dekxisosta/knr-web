import { useState, useRef, useEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

export default function DraggableIDE() {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });

  const ideRef = useRef<HTMLDivElement>(null);

  // Static code lines to display
  const staticCodeLines = [
    { line: 29, content: <span className="code-comment">  // TODO: Add error handling</span> },
    { line: 30, content: <>{'  '}<span className="code-keyword">async</span> <span className="code-function">getUserData</span>(): <span className="code-type">Promise</span>&lt;<span className="code-type">User</span>[]&gt; {'{'}</> },
    { line: 31, content: <>{'    '}<span className="code-keyword">try</span> {'{'}</> },
    { line: 32, content: <>{'      '}<span className="code-keyword">const</span> <span className="code-property">response</span> = <span className="code-keyword">await</span> <span className="code-keyword">this</span>.<span className="code-property">http</span>.<span className="code-function">get</span>(<span className="code-string">'/api/users'</span>);</> },
    { line: 33, content: <>{'      '}<span className="code-keyword">return</span> <span className="code-property">response</span>.<span className="code-property">data</span>;</> },
    { line: 34, content: <>{'    }'} <span className="code-keyword">catch</span> (<span className="code-property">error</span>) {'{'}</> },
    { line: 35, content: <>{'      '}<span className="code-property">console</span>.<span className="code-function">error</span>(<span className="code-string">'Failed to fetch users:'</span>, <span className="code-property">error</span>);</> },
    { line: 36, content: <>{'      '}<span className="code-keyword">throw</span> <span className="code-property">error</span>;</> },
    { line: 37, content: <>{'    }'}</> },
    { line: 38, content: <>{'  }'}</> },
  ];

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from the titlebar
    if ((e.target as HTMLElement).closest('.ide-titlebar')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && ideRef.current) {
        const ideElement = ideRef.current;
        const viewport = ideElement.closest('.ide-viewport') as HTMLElement;
        
        if (viewport) {
          const ideRect = ideElement.getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          
          // Calculate new position
          let newX = e.clientX - dragStart.x;
          let newY = e.clientY - dragStart.y;
          
          // Tighter collision detection - keep IDE mostly within bounds
          const padding = 40; // Increased padding from edges
          const minX = -ideRect.width * 0.1; // Allow only 10% off-screen left
          const minY = -ideRect.height * 0.05; // Allow only 5% off-screen top
          const maxX = viewportRect.width - ideRect.width * 0.9 - padding; // Keep 90% visible on right
          const maxY = viewportRect.height - ideRect.height * 0.95 - padding; // Keep 95% visible on bottom
          
          newX = Math.max(minX, Math.min(newX, maxX));
          newY = Math.max(minY, Math.min(newY, maxY));
          
          setPosition({ x: newX, y: newY });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  return (
    <div
      ref={ideRef}
      className="ide-window"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Titlebar */}
      <div className="ide-titlebar">
        <div className="ide-traffic-lights">
          <span className="traffic-light traffic-red"></span>
          <span className="traffic-light traffic-yellow"></span>
          <span className="traffic-light traffic-green"></span>
        </div>
        <div className="ide-title">angular-ecommerce</div>
        <div className="ide-actions">
          <button className="ide-action-btn">−</button>
          <button className="ide-action-btn">□</button>
          <button className="ide-action-btn">×</button>
        </div>
      </div>

      {/* Body */}
      <div className="ide-body">
        {/* Activity Bar */}
        <div className="ide-sidebar">
          <div className="sidebar-item active">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
          </div>
          <div className="sidebar-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <div className="sidebar-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
            </svg>
          </div>
        </div>

        {/* File Explorer */}
        <div className="ide-explorer">
          <div className="explorer-header">EXPLORER</div>
          <div className="explorer-tree">
            <div className="tree-item folder expanded">
              <span className="tree-icon">📁</span>
              <span className="tree-label">angular-ecommerce</span>
            </div>
            <div className="tree-item folder expanded" style={{ paddingLeft: '20px' }}>
              <span className="tree-icon">📁</span>
              <span className="tree-label">src</span>
            </div>
            <div className="tree-item folder expanded" style={{ paddingLeft: '40px' }}>
              <span className="tree-icon">📁</span>
              <span className="tree-label">app</span>
            </div>
            <div className="tree-item file active" style={{ paddingLeft: '60px' }}>
              <span className="tree-icon">🅰</span>
              <span className="tree-label">app.component.ts</span>
            </div>
            <div className="tree-item file" style={{ paddingLeft: '60px' }}>
              <span className="tree-icon">🅰</span>
              <span className="tree-label">app.component.html</span>
            </div>
            <div className="tree-item file" style={{ paddingLeft: '60px' }}>
              <span className="tree-icon">🎨</span>
              <span className="tree-label">app.component.css</span>
            </div>
            <div className="tree-item file" style={{ paddingLeft: '60px' }}>
              <span className="tree-icon">🅰</span>
              <span className="tree-label">app.module.ts</span>
            </div>
            <div className="tree-item folder" style={{ paddingLeft: '60px' }}>
              <span className="tree-icon">📁</span>
              <span className="tree-label">components</span>
            </div>
            <div className="tree-item folder" style={{ paddingLeft: '60px' }}>
              <span className="tree-icon">📁</span>
              <span className="tree-label">services</span>
            </div>
            <div className="tree-item folder" style={{ paddingLeft: '60px' }}>
              <span className="tree-icon">📁</span>
              <span className="tree-label">models</span>
            </div>
            <div className="tree-item file" style={{ paddingLeft: '40px' }}>
              <span className="tree-icon">🌐</span>
              <span className="tree-label">index.html</span>
            </div>
            <div className="tree-item file" style={{ paddingLeft: '40px' }}>
              <span className="tree-icon">📄</span>
              <span className="tree-label">main.ts</span>
            </div>
            <div className="tree-item file" style={{ paddingLeft: '20px' }}>
              <span className="tree-icon">⚙</span>
              <span className="tree-label">angular.json</span>
            </div>
            <div className="tree-item file" style={{ paddingLeft: '20px' }}>
              <span className="tree-icon">📦</span>
              <span className="tree-label">package.json</span>
            </div>
            <div className="tree-item file" style={{ paddingLeft: '20px' }}>
              <span className="tree-icon">📘</span>
              <span className="tree-label">tsconfig.json</span>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="ide-editor">
          <div className="editor-tabs">
            <div className="editor-tab active">
              <span className="tab-icon">🅰</span>
              <span className="tab-name">app.component.ts</span>
              <span className="tab-close">×</span>
            </div>
            <div className="editor-tab">
              <span className="tab-icon">🅰</span>
              <span className="tab-name">app.module.ts</span>
              <span className="tab-close">×</span>
            </div>
          </div>

          {/* Code content */}
          <div className="editor-content">
            <div className="code-line">
              <span className="line-number">1</span>
              <span className="code-text">
                <span className="code-keyword">import</span> {'{'} Component, OnInit {'}'} <span className="code-keyword">from</span> <span className="code-string">'@angular/core'</span>;
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">2</span>
              <span className="code-text">
                <span className="code-keyword">import</span> {'{'} Router {'}'} <span className="code-keyword">from</span> <span className="code-string">'@angular/router'</span>;
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">3</span>
              <span className="code-text">
                <span className="code-keyword">import</span> {'{'} HttpClient {'}'} <span className="code-keyword">from</span> <span className="code-string">'@angular/common/http'</span>;
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">4</span>
              <span className="code-text"></span>
            </div>
            <div className="code-line">
              <span className="line-number">5</span>
              <span className="code-text">
                <span className="code-decorator">@Component</span>({'{'}
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">6</span>
              <span className="code-text">
                {'  '}<span className="code-property">selector</span>: <span className="code-string">'app-root'</span>,
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">7</span>
              <span className="code-text">
                {'  '}<span className="code-property">templateUrl</span>: <span className="code-string">'./app.component.html'</span>,
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">8</span>
              <span className="code-text">
                {'  '}<span className="code-property">styleUrls</span>: [<span className="code-string">'./app.component.css'</span>]
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">9</span>
              <span className="code-text">{'}'})  </span>
            </div>
            <div className="code-line">
              <span className="line-number">10</span>
              <span className="code-text">
                <span className="code-keyword">export class</span> <span className="code-class">AppComponent</span> <span className="code-keyword">implements</span> <span className="code-type">OnInit</span> {'{'}
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">11</span>
              <span className="code-text">
                {'  '}<span className="code-property">title</span> = <span className="code-string">'angular-ecommerce'</span>;
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">12</span>
              <span className="code-text">
                {'  '}<span className="code-property">products</span>: <span className="code-type">Product</span>[] = [];
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">13</span>
              <span className="code-text">
                {'  '}<span className="code-property">isLoading</span> = <span className="code-keyword">true</span>;
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">14</span>
              <span className="code-text"></span>
            </div>
            <div className="code-line">
              <span className="line-number">15</span>
              <span className="code-text">
                {'  '}<span className="code-keyword">constructor</span>(<span className="code-keyword">private</span> <span className="code-property">router</span>: <span className="code-type">Router</span>, <span className="code-keyword">private</span> <span className="code-property">http</span>: <span className="code-type">HttpClient</span>) {'{}'}
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">16</span>
              <span className="code-text"></span>
            </div>
            <div className="code-line">
              <span className="line-number">17</span>
              <span className="code-text">
                {'  '}<span className="code-function">ngOnInit</span>(): <span className="code-type">void</span> {'{'}
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">18</span>
              <span className="code-text">
                {'    '}<span className="code-comment">// Initialize component and load products</span>
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">19</span>
              <span className="code-text">
                {'    '}<span className="code-keyword">this</span>.<span className="code-function">loadProducts</span>();
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">20</span>
              <span className="code-text">
                {'  }'}
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">21</span>
              <span className="code-text"></span>
            </div>
            <div className="code-line">
              <span className="line-number">22</span>
              <span className="code-text">
                {'  '}<span className="code-keyword">private</span> <span className="code-function">loadProducts</span>(): <span className="code-type">void</span> {'{'}
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">23</span>
              <span className="code-text">
                {'    '}<span className="code-comment">// Simulate API call</span>
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">24</span>
              <span className="code-text">
                {'    '}<span className="code-function">setTimeout</span>(() {'=> '}
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">25</span>
              <span className="code-text">
                {'      '}<span className="code-keyword">this</span>.<span className="code-property">isLoading</span> = <span className="code-keyword">false</span>;
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">26</span>
              <span className="code-text">
                {'    }'}, <span className="code-number">2000</span>);
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">27</span>
              <span className="code-text">
                {'  }'}
              </span>
            </div>
            <div className="code-line">
              <span className="line-number">28</span>
              <span className="code-text"></span>
            </div>
            {/* Static code lines - no animation */}
            {staticCodeLines.map((codeLine) => (
              <div key={codeLine.line} className="code-line">
                <span className="line-number">{codeLine.line}</span>
                <span className="code-text">{codeLine.content}</span>
              </div>
            ))}
            <div className="code-line">
              <span className="line-number">39</span>
              <span className="code-text">{'}'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="ide-statusbar">
        <div className="status-left">
          <span className="status-item">🅰 Angular</span>
          <span className="status-item">UTF-8</span>
        </div>
        <div className="status-right">
          <span className="status-item">Ln 18, Col 28</span>
        </div>
      </div>
    </div>
  );
}
