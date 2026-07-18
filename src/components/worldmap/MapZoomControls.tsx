type MapZoomControlsProps = {
  scale: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFitToView: () => void;
};

export function MapZoomControls({ scale, canZoomIn, canZoomOut, onZoomIn, onZoomOut, onReset, onFitToView }: MapZoomControlsProps) {
  return (
    <div className="map-zoom-controls" role="group" aria-label="Map zoom and view controls">
      <button type="button" className="map-zoom-controls__btn" onClick={onZoomIn} disabled={!canZoomIn} aria-label="Zoom in" title="Zoom in">
        +
      </button>
      <button type="button" className="map-zoom-controls__btn" onClick={onZoomOut} disabled={!canZoomOut} aria-label="Zoom out" title="Zoom out">
        −
      </button>
      <span className="map-zoom-controls__level" aria-hidden>{Math.round(scale * 100)}%</span>
      <button type="button" className="map-zoom-controls__btn map-zoom-controls__btn--wide" onClick={onReset} aria-label="Reset zoom and position" title="Reset view">
        Reset
      </button>
      <button type="button" className="map-zoom-controls__btn map-zoom-controls__btn--wide" onClick={onFitToView} aria-label="Fit entire map to view" title="Fit to view">
        Fit
      </button>
    </div>
  );
}
