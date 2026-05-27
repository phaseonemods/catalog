// src/components/WatchReveal.jsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { useSectionScroll } from '../hooks/useSectionScroll';
import MarqueeText from './MarqueeText';

const easeInOut = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
const easeOut   = (t) => 1 - Math.pow(1 - t, 3);
const easeIn    = (t) => t * t * t;

const rangeEased = (p, start, end, easeFn = easeInOut) => {
  const t = Math.max(0, Math.min(1, (p - start) / (end - start)));
  return easeFn(t);
};

export default function WatchReveal({
  image,
  images,
  title = '',
  siteName = '',
  siteNameMobile,
  flashText,
  logoImage,
  logoImages,
  marqueeItems = [],
}) {
  const slideImages = images && images.length > 0 ? images : (image ? [image] : []);
  const hasMultiple = slideImages.length > 1;

  const logoSlides = logoImages && logoImages.length > 0
    ? logoImages
    : (logoImage ? [logoImage] : []);
  const logoHasMultiple = logoSlides.length > 1;

  const sectionRef = useRef(null);
  const { progress } = useSectionScroll(sectionRef);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Split-layer slideshow state ──
  const [slideIdx,    setSlideIdx]    = useState(0);
  const [imgHovered,  setImgHovered]  = useState(false);
  const [hoveredDot,  setHoveredDot]  = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const autoRef = useRef(null);

  // ── Layer 4 logo slideshow state ──
  const [l4Idx,     setL4Idx]     = useState(0);
  const [l4Hovered, setL4Hovered] = useState(false);
  const l4AutoRef = useRef(null);

  // ── Swipe tracking for mobile split layer ──
  const swipeTouchRef = useRef(null); // { startX, startY }

  const handleSplitTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    swipeTouchRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY };
  }, []);

  const handleSplitTouchEnd = useCallback((e) => {
    if (!swipeTouchRef.current || !hasMultiple) return;
    const dx = e.changedTouches[0].clientX - swipeTouchRef.current.startX;
    const dy = e.changedTouches[0].clientY - swipeTouchRef.current.startY;
    swipeTouchRef.current = null;
    // Only treat as horizontal swipe if horizontal dominates
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) {
      goTo((slideIdx + 1) % slideImages.length, 1);
    } else {
      goTo((slideIdx - 1 + slideImages.length) % slideImages.length, -1);
    }
  }, [hasMultiple, slideIdx, slideImages.length]); // goTo added below via ref trick

  const goTo = useCallback((nextIdx, dir = 1) => {
    if (isAnimating || !hasMultiple) return;
    setIsAnimating(true);
    setTimeout(() => {
      setSlideIdx(nextIdx);
      setIsAnimating(false);
    }, 420);
  }, [isAnimating, hasMultiple]);

  // Keep swipe handler's goTo in sync without re-creating it every render
  const goToRef = useRef(goTo);
  useEffect(() => { goToRef.current = goTo; }, [goTo]);

  const handleSplitTouchEndStable = useCallback((e) => {
    if (!swipeTouchRef.current || !hasMultiple) return;
    const dx = e.changedTouches[0].clientX - swipeTouchRef.current.startX;
    const dy = e.changedTouches[0].clientY - swipeTouchRef.current.startY;
    swipeTouchRef.current = null;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) {
      goToRef.current((slideIdx + 1) % slideImages.length, 1);
    } else {
      goToRef.current((slideIdx - 1 + slideImages.length) % slideImages.length, -1);
    }
  }, [hasMultiple, slideIdx, slideImages.length]);

  const prevSlide = useCallback((e) => {
    e?.stopPropagation();
    goTo((slideIdx - 1 + slideImages.length) % slideImages.length, -1);
  }, [slideIdx, slideImages.length, goTo]);

  const nextSlide = useCallback((e) => {
    e?.stopPropagation();
    goTo((slideIdx + 1) % slideImages.length, 1);
  }, [slideIdx, slideImages.length, goTo]);

  // Auto-advance split layer
  useEffect(() => {
    if (!hasMultiple) return;
    if (imgHovered || splitOpacity < 0.5) { // eslint-disable-line
      clearInterval(autoRef.current);
      return;
    }
    autoRef.current = setInterval(() => {
      setSlideIdx(i => (i + 1) % slideImages.length);
    }, 3500);
    return () => clearInterval(autoRef.current);
  });

  // Auto-advance Layer 4 logo
  useEffect(() => {
    if (!logoHasMultiple) return;
    if (l4Hovered || phase1Vis < 0.1) { // eslint-disable-line
      clearInterval(l4AutoRef.current);
      return;
    }
    l4AutoRef.current = setInterval(() => {
      setL4Idx(i => (i + 1) % logoSlides.length);
    }, 3500);
    return () => clearInterval(l4AutoRef.current);
  });

  const l4Prev = useCallback((e) => {
    e?.stopPropagation();
    setL4Idx(i => (i - 1 + logoSlides.length) % logoSlides.length);
  }, [logoSlides.length]);

  const l4Next = useCallback((e) => {
    e?.stopPropagation();
    setL4Idx(i => (i + 1) % logoSlides.length);
  }, [logoSlides.length]);

  const lineTop    = 56;
  const lineBottom = 47;

  // ── Phase 1 ──
  const phase1FadeOut = rangeEased(progress, 0.38, 0.415, easeIn);
  const phase1Vis     = 1 - phase1FadeOut;

  // ── Flash ──
  const flashIn      = rangeEased(progress, 0.40, 0.44, easeInOut);
  const flashOut     = rangeEased(progress, 0.50, 0.60, easeOut);
  const flashOpacity = flashIn * (1 - flashOut);
  const siteNameIn   = rangeEased(progress, 0.40, 0.445, easeOut);

  // ── Slash ──
  const slashDraw    = rangeEased(progress, 0.44, 0.54, easeInOut);
  const slashOpacity = slashDraw > 0 ? Math.max(0, 1 - rangeEased(progress, 0.50, 0.56, easeIn)) : 0;
  const stripeBottomY = slashDraw * 100;
  const stripeBottomL = lineTop + (lineBottom - lineTop) * slashDraw;

  // ── Text split ──
  const splitTrigger    = Math.max(0, Math.min(1, (slashDraw - 0.5) / 0.5));
  const splitExitP      = easeOut(splitTrigger);
  const splitExitOpacity = 1 - splitExitP;
  const leftExitX  = -splitExitP * 130;
  const leftExitY  = -splitExitP * 90;
  const rightExitX =  splitExitP * 130;
  const rightExitY =  splitExitP * 90;

  // ── Split reveal ──
  const splitOpacity = rangeEased(progress, 0.54, 0.66, easeOut);
  const leftClip     = `polygon(0% 0%, ${lineTop}% 0%, ${lineBottom}% 100%, 0% 100%)`;
  const rightClip    = `polygon(${lineTop}% 0%, 100% 0%, 100% 100%, ${lineBottom}% 100%)`;

  // ── Settle ──
  const settleP    = rangeEased(progress, 0.66, 0.82, easeOut);
  const textOpacity = settleP;
  const textSlideX  = (1 - settleP) * 50;

  // ── Curtain ──
  const curtainP      = rangeEased(progress, 0.82, 1.00, easeInOut);
  const curtainHeight = curtainP * 100;
  const stickyOpacity = curtainP > 0.88 ? Math.max(0, 1 - rangeEased(progress, 0.94, 1.00, easeIn)) : 1;

  const displayName = (isMobile && siteNameMobile) ? siteNameMobile : siteName;

  return (
    <section
      ref={sectionRef}
      style={{ minHeight: isMobile ? '300vh' : '320vh', position: 'relative' }}
    >
      <div style={{
        position: 'sticky', top: 0,
        height: '100vh', overflow: 'hidden',
        background: '#0a0a0a',
        opacity: stickyOpacity,
      }}>

        {/* ════ LAYER 1: Split layout ════ */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, opacity: splitOpacity }}>

          {/* Backgrounds */}
          {isMobile ? (
            <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a' }} />
          ) : (
            <>
              <div style={{ position: 'absolute', inset: 0, background: '#f0ebe3', clipPath: leftClip }} />
              <div style={{ position: 'absolute', inset: 0, background: '#0a0a0a', clipPath: rightClip }} />
            </>
          )}

          {/* ── Mobile image panel ── */}
          {isMobile ? (
            <div
              style={{ position: 'absolute', inset: 0, zIndex: 2 }}
              onTouchStart={handleSplitTouchStart}
              onTouchEnd={handleSplitTouchEndStable}
            >
              {/* Image layer */}
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0a0a0a' }}>
                {slideImages.map((src, i) => (
                  <img key={i} src={src} alt="Watch" style={{
                    display: 'block',
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover', objectPosition: 'center',
                    filter: 'saturate(1) contrast(1.08) brightness(0.95)',
                    opacity: i === slideIdx ? 1 : 0,
                    transition: 'opacity 0.42s ease',
                    zIndex: i === slideIdx ? 2 : 1,
                  }} />
                ))}

                {/* Arrows — always visible on mobile when multiple images */}
                {hasMultiple && (
                  <>
                    <button
                      onClick={prevSlide}
                      style={{ ...navBtnStyle('left', true), zIndex: 10 }}
                      aria-label="Previous"
                    >‹</button>
                    <button
                      onClick={nextSlide}
                      style={{ ...navBtnStyle('right', true), zIndex: 10 }}
                      aria-label="Next"
                    >›</button>
                  </>
                )}
              </div>

              {/* Dots — always visible on mobile when multiple images */}
              {hasMultiple && (
                <div style={{
                  position: 'fixed', bottom: 24, left: 0, right: 0,
                  display: 'flex', justifyContent: 'center', gap: 8,
                  zIndex: 100, pointerEvents: 'auto',
                }}>
                  {slideImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); goTo(i, i > slideIdx ? 1 : -1); }}
                      style={{
                        ...dotStyle,
                        background: i === slideIdx ? '#d40000' : 'rgba(180,180,180,0.5)',
                        transform: i === slideIdx ? 'scale(1.35)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

          ) : (
            /* ── Desktop image panel ── */
            <div
              style={{ position: 'absolute', top: 0, left: 0, width: `${lineBottom}%`, height: '100%', zIndex: 2 }}
              onMouseEnter={() => setImgHovered(true)}
              onMouseLeave={() => setImgHovered(false)}
            >
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                {slideImages.map((src, i) => (
                  <img key={i} src={src} alt="Watch" style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover', objectPosition: 'center 30%',
                    filter: 'saturate(1) contrast(1.08) brightness(0.95)',
                    opacity: i === slideIdx ? 1 : 0,
                    transition: 'opacity 0.42s ease',
                    zIndex: i === slideIdx ? 2 : 1,
                  }} />
                ))}
                {hasMultiple && imgHovered && (
                  <>
                    <button onClick={prevSlide} style={navBtnStyle('left', false)}>‹</button>
                    <button onClick={nextSlide} style={navBtnStyle('right', false)}>›</button>
                  </>
                )}
              </div>
              {imgHovered && (
                <div style={{
                  position: 'fixed', bottom: 24,
                  left: 0, right: `${100 - lineBottom}%`,
                  display: 'flex', justifyContent: 'center', gap: 8,
                  zIndex: 100, pointerEvents: 'auto',
                }}>
                  {slideImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); goTo(i, i > slideIdx ? 1 : -1); }}
                      onMouseEnter={() => setHoveredDot(i)}
                      onMouseLeave={() => setHoveredDot(null)}
                      style={{
                        ...dotStyle,
                        background: i === slideIdx ? '#d40000' : hoveredDot === i ? 'rgba(240,235,227,0.75)' : 'rgba(180,180,180,0.5)',
                        transform: i === slideIdx ? 'scale(1.35)' : hoveredDot === i ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Desktop text panel */}
          {!isMobile && (
            <div style={{
              position: 'absolute', top: 0,
              left: `${lineTop + 2}%`, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
              padding: '0 4rem',
              opacity: textOpacity,
              transform: `translateX(${textSlideX}px)`,
              willChange: 'opacity, transform',
            }}>
              <span style={{
                fontFamily: '"Barlow Condensed", sans-serif',
                fontSize: '0.75rem', fontWeight: 700,
                letterSpacing: '0.5em', textTransform: 'uppercase',
                color: '#d40000', marginBottom: '0.5rem',
              }}>Collection</span>
              <h1 style={{
                fontFamily: '"Bebas Neue", "Arial Black", sans-serif',
                fontSize: 'clamp(3.5rem, 6vw, 7rem)', fontWeight: 400,
                color: '#f0ebe3', margin: 0,
                letterSpacing: '0.06em', lineHeight: 0.9,
                textTransform: 'uppercase',
              }}>{title}</h1>
              <div style={{ width: '60px', height: '3px', background: '#d40000', margin: '1.5rem 0' }} />
              <div style={{
                position: 'absolute', bottom: '3.5rem',
                left: '4rem', right: '2rem',
                borderTop: '1px solid rgba(240,235,227,0.12)', paddingTop: '1rem',
              }}>
                <MarqueeText items={marqueeItems} speed={35} isActive={splitOpacity > 0.5} dark={false} />
              </div>
            </div>
          )}
        </div>

        {/* ════ LAYER 2: Flash ════ */}
        {flashOpacity > 0.005 && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 8,
            pointerEvents: 'none',
            background: '#f0ebe3',
            opacity: flashOpacity,
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              clipPath: `polygon(0% 0%, ${lineTop}% 0%, ${lineBottom}% 100%, 0% 100%)`,
              opacity: siteNameIn * splitExitOpacity,
              transform: `translate(${leftExitX}px, ${leftExitY}px)`,
            }}>
              <span style={{
                fontFamily: '"Bebas Neue", "Arial Black", sans-serif',
                fontSize: isMobile ? 'clamp(2rem, 14vw, 6rem)' : 'clamp(3rem, 8vw, 9rem)',
                fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#0a0a0a', whiteSpace: 'nowrap', userSelect: 'none',
              }}>{flashText ?? siteName}</span>
            </div>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              clipPath: `polygon(${lineTop}% 0%, 100% 0%, 100% 100%, ${lineBottom}% 100%)`,
              opacity: siteNameIn * splitExitOpacity,
              transform: `translate(${rightExitX}px, ${rightExitY}px)`,
            }}>
              <span style={{
                fontFamily: '"Bebas Neue", "Arial Black", sans-serif',
                fontSize: isMobile ? 'clamp(2rem, 14vw, 6rem)' : 'clamp(3rem, 8vw, 9rem)',
                fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#0a0a0a', whiteSpace: 'nowrap', userSelect: 'none',
              }}>{flashText ?? siteName}</span>
            </div>
          </div>
        )}

        {/* ════ LAYER 3: Red slash ════ */}
        {slashOpacity > 0 && slashDraw > 0 && (
          <svg
            viewBox="0 0 100 100" preserveAspectRatio="none"
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              zIndex: 10, pointerEvents: 'none',
              opacity: slashOpacity, overflow: 'visible',
            }}
          >
            <defs>
              <filter id="brushFilter" x="-40%" y="-5%" width="180%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.018 0.055" numOctaves="3" seed="5" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.5" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <clipPath id="strokeReveal" clipPathUnits="userSpaceOnUse">
                <polygon points={`${lineTop - 2},0 ${lineTop + 2.5},0 ${stripeBottomL + 0.1},${stripeBottomY}`} />
              </clipPath>
            </defs>
            <polygon points={`${lineTop - 0.9},0 ${lineTop + 1.3},0 ${stripeBottomL},${stripeBottomY}`}
              fill="rgba(212,0,0,0.35)" filter="url(#brushFilter)" clipPath="url(#strokeReveal)" />
            <polygon points={`${lineTop - 0.45},0 ${lineTop + 0.75},0 ${stripeBottomL},${stripeBottomY}`}
              fill="rgba(212,0,0,0.7)" filter="url(#brushFilter)" clipPath="url(#strokeReveal)" />
            <polygon points={`${lineTop - 0.08},0 ${lineTop + 0.22},0 ${stripeBottomL},${stripeBottomY}`}
              fill="rgb(212,0,0)" filter="url(#brushFilter)" clipPath="url(#strokeReveal)" />
          </svg>
        )}

        {/* ════ LAYER 4: Phase 1 — logo banner ════ */}
        {phase1Vis > 0.01 && (
          <div style={{
            position: 'absolute', inset: 0,
            zIndex: 15,
            background: '#0a0a0a',
            opacity: phase1Vis,
            pointerEvents: phase1Vis < 0.02 ? 'none' : 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}>
            {logoSlides.length > 0 ? (
              <>
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: isMobile ? '72vh' : '78vh',
                    // No overflow:hidden — we use contain so nothing is ever cropped
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: '#0a0a0a',
                  }}
                  onMouseEnter={() => setL4Hovered(true)}
                  onMouseLeave={() => setL4Hovered(false)}
                >
                  {logoSlides.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={siteName}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        // Anchor at 35% — more crop on the left, less on the right.
                        objectFit: 'cover',
                        objectPosition: '12.5% center',
                        userSelect: 'none',
                        pointerEvents: 'none',
                        opacity: i === l4Idx ? 1 : 0,
                        transition: 'opacity 0.42s ease',
                        zIndex: i === l4Idx ? 2 : 1,
                      }}
                    />
                  ))}

                  {/* Bottom fade so marquee reads cleanly */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0, left: 0, right: 0,
                    height: '60px',
                    background: 'linear-gradient(to bottom, transparent, #0a0a0a)',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }} />

                  {logoHasMultiple && l4Hovered && (
                    <>
                      <button onClick={l4Prev} style={{ ...navBtnStyle('left', true), zIndex: 4 }}>‹</button>
                      <button onClick={l4Next} style={{ ...navBtnStyle('right', true), zIndex: 4 }}>›</button>
                    </>
                  )}
                </div>

                {/* Marquee below image */}
                <div style={{ width: '100%', padding: '0 3rem', marginTop: '0.75rem', flexShrink: 0 }}>
                  <div style={{ borderTop: '1px solid rgba(240,235,227,0.1)', paddingTop: '0.75rem' }}>
                    <MarqueeText items={marqueeItems} speed={35} isActive={phase1Vis > 0.3} dark={false} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: '100%', paddingTop: '10vh' }}>
                  {displayName.split('\n').map((word, i) => (
                    <div key={i} style={{
                      fontFamily: '"Bebas Neue", "Arial Black", sans-serif',
                      fontSize: isMobile ? 'clamp(5rem, 38vw, 16rem)' : 'clamp(5rem, max(18vw, 22vh), 22rem)',
                      fontWeight: 400, letterSpacing: '-0.01em',
                      textTransform: 'uppercase', lineHeight: 0.9,
                      color: '#f0ebe3', userSelect: 'none',
                      width: '100%', textAlign: 'center',
                      opacity: i % 2 === 0 ? 1 : 0.7,
                    }}>{word}</div>
                  ))}
                </div>
                <div style={{ width: '100%', padding: '0 3rem', marginTop: '1.5rem' }}>
                  <div style={{ borderTop: '1px solid rgba(240,235,227,0.1)', paddingTop: '1rem' }}>
                    <MarqueeText items={marqueeItems} speed={35} isActive={phase1Vis > 0.3} dark={false} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════ LAYER 5: Curtain ════ */}
        {curtainP > 0 && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: `${curtainHeight}vh`,
            zIndex: 20,
            background: '#0f0f0f',
            pointerEvents: 'none',
          }}>
            {isMobile ? (
              <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: '4px', background: '#d40000' }} />
            ) : (
              <div style={{
                position: 'absolute', bottom: -2, left: 0, right: 0,
                height: '3px', background: '#d40000',
                boxShadow: '0 0 24px rgba(212,0,0,0.7), 0 0 60px rgba(212,0,0,0.25)',
              }} />
            )}
          </div>
        )}

      </div>
    </section>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const navBtnStyle = (side, onDark = false) => ({
  position: 'absolute',
  top: '50%', transform: 'translateY(-50%)',
  [side]: '10px',
  zIndex: 10,
  background: 'transparent',
  border: 'none',
  color: onDark ? '#f0ebe3' : '#0a0a0a',
  fontSize: '2.8rem',
  lineHeight: 1,
  cursor: 'pointer',
  padding: '0 6px',
  opacity: 0.75,
  textShadow: onDark ? '0 1px 6px rgba(0,0,0,0.7)' : 'none',
  transition: 'opacity 0.15s',
  borderRadius: '2px',

  appearance: 'none',
  WebkitAppearance: 'none',
  boxShadow: 'none'

});

const dotStyle = {
  width: 8, height: 8, borderRadius: '50%',
  border: 'none', padding: 0, cursor: 'pointer',
  transition: 'background 0.2s, transform 0.2s',
};
