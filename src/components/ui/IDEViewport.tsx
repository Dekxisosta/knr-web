import DraggableIDE from './DraggableIDE';
import './IDEViewport.css';

export default function IDEViewport() {
  return (
    <div className="ide-viewport">
      <div className="viewport-grid">
        {/* Grid background */}
        <svg className="grid-pattern" width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      <div className="viewport-content">
        <DraggableIDE />
      </div>
      
      {/* Subtle hint */}
      <div className="viewport-hint">
        <span className="hint-icon">↕</span>
        <span className="hint-text">Drag to move</span>
      </div>
    </div>
  );
}
