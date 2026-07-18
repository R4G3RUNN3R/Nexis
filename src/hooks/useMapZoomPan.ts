// ─────────────────────────────────────────────────────────────────────────────
// Nexis — Map Zoom/Pan Hook
//
// Small, dependency-free zoom/pan controller for the World Map. Applies a
// single CSS transform (scale + translate) to a content element inside a
// fixed-size, overflow-hidden viewport. Every marker inside the content
// element keeps its existing percent-based left/top positioning untouched —
// the transform moves the whole frame as one unit, so labels never drift
// relative to their pins during zoom or pan.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// The "natural" 1:1 scale, and the default/reset target. The true minimum
// is dynamic (see minZoomFor below): on a viewport shorter than the map's
// natural height, 1 alone couldn't show the full map, so fit-to-view and
// zoom-out must be able to go below it.
export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 4;
const ZOOM_STEP = 1.4;
const WHEEL_ZOOM_SENSITIVITY = 0.0018;
const DRAG_CLICK_THRESHOLD_PX = 6;

type Transform = { scale: number; x: number; y: number };
type Sizes = { viewport: { width: number; height: number }; content: { width: number; height: number } } | null;

const DEFAULT_TRANSFORM: Transform = { scale: MAP_MIN_ZOOM, x: 0, y: 0 };

function fitScaleFor(sizes: Sizes) {
  if (!sizes || sizes.content.width === 0 || sizes.content.height === 0) return MAP_MIN_ZOOM;
  return Math.min(sizes.viewport.width / sizes.content.width, sizes.viewport.height / sizes.content.height);
}

function minZoomFor(sizes: Sizes) {
  return Math.min(MAP_MIN_ZOOM, fitScaleFor(sizes));
}

function clampScale(scale: number, sizes: Sizes = null) {
  return Math.min(MAP_MAX_ZOOM, Math.max(minZoomFor(sizes), scale));
}

// Clamps translate so the content can't be dragged entirely out of view -
// at least a sliver of the frame must remain reachable from any edge.
function clampTranslate(transform: Transform, viewportSize: { width: number; height: number }, contentSize: { width: number; height: number }): Transform {
  const scaledWidth = contentSize.width * transform.scale;
  const scaledHeight = contentSize.height * transform.scale;
  const minX = Math.min(0, viewportSize.width - scaledWidth);
  const minY = Math.min(0, viewportSize.height - scaledHeight);
  const maxX = Math.max(0, viewportSize.width - scaledWidth) > 0 ? viewportSize.width - scaledWidth : 0;
  const maxY = Math.max(0, viewportSize.height - scaledHeight) > 0 ? viewportSize.height - scaledHeight : 0;
  return {
    scale: transform.scale,
    x: Math.min(Math.max(transform.x, minX), maxX),
    y: Math.min(Math.max(transform.y, minY), maxY),
  };
}

export function useMapZoomPan() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM);
  const [isDragging, setIsDragging] = useState(false);

  // Refs (not state) for values only needed inside event handlers, so
  // handlers don't need to be re-bound on every render.
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  const getSizes = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return null;
    const viewportRect = viewport.getBoundingClientRect();
    // Measure the content's un-transformed size via its own layout box
    // (offsetWidth/offsetHeight ignore the CSS transform entirely).
    return {
      viewport: { width: viewportRect.width, height: viewportRect.height },
      content: { width: content.offsetWidth, height: content.offsetHeight },
    };
  }, []);

  const applyClamped = useCallback((next: Transform) => {
    const sizes = getSizes();
    setTransform(sizes ? clampTranslate({ ...next, scale: clampScale(next.scale, sizes) }, sizes.viewport, sizes.content) : { ...next, scale: clampScale(next.scale) });
  }, [getSizes]);

  const zoomAt = useCallback((factor: number, anchor?: { x: number; y: number }) => {
    setTransform((current) => {
      const sizes = getSizes();
      const nextScale = clampScale(current.scale * factor, sizes);
      if (nextScale === current.scale) return current;
      const anchorPoint = anchor ?? (sizes ? { x: sizes.viewport.width / 2, y: sizes.viewport.height / 2 } : { x: 0, y: 0 });
      // Keep the point under the anchor stationary while scaling.
      const scaleRatio = nextScale / current.scale;
      const nextX = anchorPoint.x - (anchorPoint.x - current.x) * scaleRatio;
      const nextY = anchorPoint.y - (anchorPoint.y - current.y) * scaleRatio;
      const next = { scale: nextScale, x: nextX, y: nextY };
      return sizes ? clampTranslate(next, sizes.viewport, sizes.content) : next;
    });
  }, [getSizes]);

  const zoomIn = useCallback(() => zoomAt(ZOOM_STEP), [zoomAt]);
  const zoomOut = useCallback(() => zoomAt(1 / ZOOM_STEP), [zoomAt]);

  const reset = useCallback(() => {
    applyClamped(DEFAULT_TRANSFORM);
  }, [applyClamped]);

  const fitToView = useCallback(() => {
    const sizes = getSizes();
    if (!sizes || sizes.content.width === 0 || sizes.content.height === 0) {
      applyClamped(DEFAULT_TRANSFORM);
      return;
    }
    const fitScale = Math.min(MAP_MAX_ZOOM, fitScaleFor(sizes));
    const x = (sizes.viewport.width - sizes.content.width * fitScale) / 2;
    const y = (sizes.viewport.height - sizes.content.height * fitScale) / 2;
    setTransform(clampTranslate({ scale: fitScale, x, y }, sizes.viewport, sizes.content));
  }, [applyClamped, getSizes]);

  // ── Pointer drag panning (mouse + single-finger touch + pen) ────────────
  //
  // Deliberately NOT using setPointerCapture here. Capturing the pointer on
  // the viewport (an ancestor of every pin/link/button on the map) retargets
  // the browser's mouseup hit-test to the capturing element - which silently
  // breaks native click synthesis on the actual pressed element in Chromium,
  // for *any* zero-movement press, not just ones that turn into a real drag.
  // A synthetic `el.click()` call still "works" (it bypasses hit-testing
  // entirely), which is what made this look fine in a quick manual check but
  // fail for every real mouse/touch interaction. Tracking movement via
  // window-level listeners (attached only while a pointer is actually down)
  // gets the same "keep tracking outside the element" behavior without ever
  // retargeting anything, so native clicks on pins and buttons are untouched.
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.pointerType === "touch" && pinchRef.current) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y,
      moved: false,
    };
  }, [transform.x, transform.y]);

  useEffect(() => {
    function onWindowPointerMove(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD_PX) {
        drag.moved = true;
        setIsDragging(true);
      }
      if (!drag.moved) return;
      setTransform((current) => {
        const sizes = getSizes();
        const next = { scale: current.scale, x: drag.originX + dx, y: drag.originY + dy };
        return sizes ? clampTranslate(next, sizes.viewport, sizes.content) : next;
      });
    }

    function onWindowPointerUp(event: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.moved) {
        suppressNextClickRef.current = true;
        // The browser normally fires the drag's own trailing "click" event
        // synchronously right after pointerup, which is what actually
        // consumes this flag. If the pointer was released outside the
        // document (no click gets synthesized at all), clear it after a
        // short delay so a later, unrelated click is never eaten.
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 400);
      }
      dragRef.current = null;
      setIsDragging(false);
    }

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
  }, [getSizes]);

  // A drag that ended on top of a pin/link must not also trigger its click.
  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  // ── Wheel zoom + touch pinch zoom: attached via raw DOM listeners with
  // { passive: false } so preventDefault reliably stops page scroll / the
  // browser's native pinch-to-zoom, which React's synthetic onWheel/onTouch
  // handlers cannot guarantee (they may be registered as passive). ────────
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = viewport!.getBoundingClientRect();
      const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
      zoomAt(factor, anchor);
    }

    function distanceBetween(touches: TouchList) {
      const [a, b] = [touches[0], touches[1]];
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function onTouchStart(event: TouchEvent) {
      if (event.touches.length === 2) {
        pinchRef.current = { distance: distanceBetween(event.touches), scale: transform.scale };
      }
    }

    function onTouchMove(event: TouchEvent) {
      if (event.touches.length === 2 && pinchRef.current) {
        event.preventDefault();
        const newDistance = distanceBetween(event.touches);
        const factor = newDistance / pinchRef.current.distance;
        const rect = viewport!.getBoundingClientRect();
        const midpoint = {
          x: (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left,
          y: (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top,
        };
        zoomAt(factor / (transform.scale / pinchRef.current.scale), midpoint);
        pinchRef.current.distance = newDistance;
        pinchRef.current.scale = transform.scale;
      }
    }

    function onTouchEnd(event: TouchEvent) {
      if (event.touches.length < 2) pinchRef.current = null;
    }

    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    viewport.addEventListener("touchmove", onTouchMove, { passive: false });
    viewport.addEventListener("touchend", onTouchEnd, { passive: true });
    viewport.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("touchstart", onTouchStart);
      viewport.removeEventListener("touchmove", onTouchMove);
      viewport.removeEventListener("touchend", onTouchEnd);
      viewport.removeEventListener("touchcancel", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transform.scale, zoomAt]);

  const cssTransform = useMemo(
    () => `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
    [transform.x, transform.y, transform.scale],
  );

  return {
    viewportRef,
    contentRef,
    scale: transform.scale,
    cssTransform,
    isDragging,
    canZoomIn: transform.scale < MAP_MAX_ZOOM - 1e-6,
    canZoomOut: transform.scale > minZoomFor(getSizes()) + 1e-6,
    zoomIn,
    zoomOut,
    reset,
    fitToView,
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onClickCapture: handleClickCapture,
    },
  };
}
