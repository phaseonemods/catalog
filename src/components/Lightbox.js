import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLang } from "../context/LanguageContext";
import "./Lightbox.css";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.6;

export default function Lightbox({ watch, onClose, watchIndex, total, shopUrl }) {
  const [imgIdx,     setImgIdx]     = useState(0);
  const [zoom,       setZoom]       = useState(1);
  const [pos,        setPos]        = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile,   setIsMobile]   = useState(() => window.innerWidth <= 767);
  const { lang, t } = useLang();
  // Resolve bilingual description — supports both string and { en, th } object
  const description = watch.description
    ? (typeof watch.description === "object" ? (watch.description[lang] || watch.description.en || "") : watch.description)
    : "";

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const dragStart   = useRef(null);
  const imgWrapRef  = useRef(null);
  const zoomRef     = useRef(1);
  const posRef      = useRef({ x: 0, y: 0 });

  const images = (watch.images && watch.images.length > 0)
    ? watch.images
    : [{ url: watch.thumb, caption: "" }];
  const currentImg  = images[imgIdx];
  const hasMultiple = images.length > 1;
  const isZoomed    = zoom > 1;

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { posRef.current  = pos;  }, [pos]);

  const clampPos = useCallback((x, y, z) => {
    const wrap = imgWrapRef.current;
    if (!wrap) return { x, y };
    const maxX = (wrap.offsetWidth  * (z - 1)) / 2;
    const maxY = (wrap.offsetHeight * (z - 1)) / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, []);

  const applyZoom = useCallback((nextZ) => {
    nextZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +nextZ.toFixed(2)));
    if (nextZ === 1) {
      setZoom(1); setPos({ x: 0, y: 0 });
    } else {
      setZoom(nextZ);
      setPos((p) => clampPos(p.x, p.y, nextZ));
    }
    zoomRef.current = nextZ;
  }, [clampPos]);

  const resetZoom = useCallback(() => applyZoom(1), [applyZoom]);

  useEffect(() => { setImgIdx(0); resetZoom(); }, [watchIndex]); // eslint-disable-line
  useEffect(() => { resetZoom(); }, [imgIdx]);                   // eslint-disable-line

  const prevImg = useCallback(() => setImgIdx((i) => (i - 1 + images.length) % images.length), [images.length]);
  const nextImg = useCallback(() => setImgIdx((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e) => {
      const z = zoomRef.current;
      if (e.key === "Escape")      { z > 1 ? resetZoom() : onClose(); }
      // Arrow keys only navigate within this watch's images
      if (e.key === "ArrowLeft"  && z <= 1 && hasMultiple) prevImg();
      if (e.key === "ArrowRight" && z <= 1 && hasMultiple) nextImg();
      if (e.key === "+" || e.key === "=") applyZoom(zoomRef.current + ZOOM_STEP);
      if (e.key === "-")           applyZoom(zoomRef.current - ZOOM_STEP);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prevImg, nextImg, hasMultiple, resetZoom, applyZoom]);

  useEffect(() => {
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const handler = (e) => {
      e.preventDefault();
      applyZoom(zoomRef.current + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    };
    wrap.addEventListener("wheel", handler, { passive: false });
    return () => wrap.removeEventListener("wheel", handler);
  }, [applyZoom]);

  const handleDoubleClick = useCallback((e) => {
    const z = zoomRef.current;
    if (z > 1) { resetZoom(); return; }
    const wrap = imgWrapRef.current;
    if (!wrap) { applyZoom(2.5); return; }
    const rect   = wrap.getBoundingClientRect();
    const clickX = e.clientX - (rect.left + rect.width  / 2);
    const clickY = e.clientY - (rect.top  + rect.height / 2);
    const targetZ = 2.5;
    const np = clampPos(clickX * (targetZ - 1), clickY * (targetZ - 1), targetZ);
    setZoom(targetZ);
    setPos(np);
    zoomRef.current = targetZ;
  }, [resetZoom, applyZoom, clampPos]);

  const handleMouseDown = useCallback((e) => {
    if (zoomRef.current <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragStart.current) return;
    const clamped = clampPos(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y, zoomRef.current);
    setPos(clamped);
    posRef.current = clamped;
  }, [clampPos]);

  const handleMouseUp = useCallback(() => { setIsDragging(false); dragStart.current = null; }, []);

  const lastPinchDist = useRef(null);
  const touchStartPos = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      lastPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1 && zoomRef.current > 1) {
      touchStartPos.current = { x: e.touches[0].clientX - posRef.current.x, y: e.touches[0].clientY - posRef.current.y };
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastPinchDist.current) applyZoom(zoomRef.current * (dist / lastPinchDist.current));
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && touchStartPos.current) {
      const clamped = clampPos(e.touches[0].clientX - touchStartPos.current.x, e.touches[0].clientY - touchStartPos.current.y, zoomRef.current);
      setPos(clamped);
      posRef.current = clamped;
    }
  }, [applyZoom, clampPos]);

  const handleTouchEnd = useCallback(() => { lastPinchDist.current = null; touchStartPos.current = null; }, []);

  const hasDesc    = description && description.trim().length > 0;
  const hasCaption = currentImg.caption && currentImg.caption.trim().length > 0;
  const hasMeta    = hasDesc || hasCaption;

  return (
    <div className="lb-backdrop" onClick={isZoomed ? undefined : onClose}>
      <div
        className={`lb-panel${hasMeta ? " has-meta" : " no-meta"}`}
        onClick={(e) => e.stopPropagation()}
      >

        <button className="lb-close" onClick={onClose} aria-label="Close">✕</button>

        {/* No catalog prev/next — only within-image navigation via strip/arrows */}

        <div
          ref={imgWrapRef}
          className={`lb-img-wrap ${isZoomed ? "zoomed" : ""} ${isDragging ? "dragging" : ""} ${isMobile && isZoomed ? "mobile-fullscreen" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
        >
          <img
            key={`${watchIndex}-${imgIdx}`}
            className="lb-img"
            src={currentImg.url}
            alt={watch.title}
            style={{
              transform: `scale(${zoom}) translate(${pos.x / zoom}px, ${pos.y / zoom}px)`,
              transition: isDragging ? "none" : "transform 0.15s ease",
            }}
            draggable={false}
          />

          {/* Within-image prev/next arrows — only shown when multiple images exist */}
          {hasMultiple && !isZoomed && (
            <>
              <button className="lb-img-prev" onClick={(e) => { e.stopPropagation(); prevImg(); }} onDoubleClick={(e) => e.stopPropagation()} aria-label="Previous image">
                <svg viewBox="0 0 16 16" fill="none" width="24" height="24">
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="lb-img-next" onClick={(e) => { e.stopPropagation(); nextImg(); }} onDoubleClick={(e) => e.stopPropagation()} aria-label="Next image">
                <svg viewBox="0 0 16 16" fill="none" width="24" height="24">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          )}
        </div>

        {!(isMobile && isZoomed) && (
          <div className="lb-zoom-bar">
            <button className="lb-zoom-btn" onClick={() => applyZoom(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} title="Zoom out (-)">
              <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M10.5 10.5l3 3M5 7h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
            <span className="lb-zoom-level" onClick={resetZoom} title="Reset zoom">{Math.round(zoom * 100)}%</span>
            <button className="lb-zoom-btn" onClick={() => applyZoom(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} title="Zoom in (+)">
              <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/><path d="M10.5 10.5l3 3M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}

        {isMobile && isZoomed && (
          <div className="lb-mobile-zoom-hint" onClick={resetZoom}>
            Double-tap to exit zoom
          </div>
        )}

        {hasMultiple && !isZoomed && (
          <div className="lb-strip">
            {images.map((img, i) => (
              <button key={i} className={`lb-strip-thumb ${i === imgIdx ? "active" : ""}`} onClick={() => setImgIdx(i)}>
                <img src={img.url} alt="" />
              </button>
            ))}
          </div>
        )}

        {!isZoomed && (
          <div className="lb-meta">
            <div className="lb-meta-left">
              <div className="lb-title-row">
                <span className="lb-title">{watch.title}</span>
                <span className="lb-info">{watch.category} · {watch.year}</span>
                <div className="lb-title-actions">
                  {shopUrl && (
                    <a href={shopUrl} target="_blank" rel="noreferrer" className="lb-buy-btn">
                      <svg viewBox="0 0 20 20" fill="none" width="13" height="13">
                        <path d="M3 5h14l-1.5 8H4.5L3 5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
                        <circle cx="7.5" cy="16" r="1" fill="currentColor"/>
                        <circle cx="13.5" cy="16" r="1" fill="currentColor"/>
                        <path d="M1 2h2.5l.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      {t.buyNow}
                    </a>
                  )}

                </div>
              </div>
              {(hasDesc || hasCaption) && (
                <div className="lb-desc-block">
                  {hasDesc    && <p className="lb-desc-text">{description}</p>}
                  {hasCaption && <p className="lb-caption-text">{currentImg.caption}</p>}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
