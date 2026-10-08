/** The Arena window's stylesheet, injected once on load (plugins ship no CSS files). */
export const ARENA_CSS = `
/* Arena window - a fixed 16:9 pixel stage letterboxed into whatever size the
   window has, with a one-line ticker of the game line behind the last beat.
   The scene itself is a deliberately dark dusk, so its colours stay literal. */

.arena-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #0c0b1d;
}

.arena-stage {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  container-type: size;
}

.arena-screen {
  position: relative;
  width: min(100cqw, calc(100cqh * 16 / 9));
  aspect-ratio: 16 / 9;
  container-type: inline-size;
  overflow: hidden;
}

.arena-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.arena-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: var(--font-ui, sans-serif);
}

.arena-ticker {
  flex: none;
  padding: 3px 8px;
  font-size: 12px;
  color: #c9cdf0;
  background: #121433;
  border-top: 1px solid #2c2f5e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.arena-label {
  position: absolute;
  transform: translateX(-50%);
  font-size: 2.1cqw;
  line-height: 1;
  white-space: nowrap;
  color: #e9ecff;
  text-shadow: 0 0 .3cqw #000, .15cqw .15cqw 0 #000;
  opacity: .85;
  transition: opacity .4s;
}
.arena-label.is-small { font-size: 1.6cqw; }
.arena-label.is-me { color: #ffd54a; font-weight: 700; opacity: 1; }
.arena-label.is-enemy { color: #ffc9b8; }
.arena-label.is-away { opacity: 0; transition-duration: .1s; }
.arena-label.is-gone { opacity: 0; }

.arena-calm,
.arena-victory {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  opacity: 0;
  transition: opacity .4s;
}
.arena-calm {
  top: 8%;
  padding: .5cqw 2cqw;
  font-size: 2.6cqw;
  color: #e9ecff;
  background: linear-gradient(#2c46b4, #111a5c);
  border: .4cqw solid #e9ecff;
  border-radius: .8cqw;
}
.arena-overlay[data-calm="1"] .arena-calm { opacity: .9; }

.arena-victory {
  top: 30%;
  font-size: 8cqw;
  font-weight: 700;
  letter-spacing: .06em;
  color: #ffd54a;
  text-shadow: .5cqw .5cqw 0 #6b2a12, -.3cqw 0 0 #1a1222, .3cqw 0 0 #1a1222, 0 -.3cqw 0 #1a1222;
}
.arena-victory.show { opacity: 1; animation: arena-bounce .9s ease-in-out infinite alternate; }

.arena-pop {
  position: absolute;
  transform: translate(-50%, -100%);
  font-size: 3.2cqw;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  text-align: center;
  color: #ffcc80;
  text-shadow: .25cqw 0 0 #1a1222, -.25cqw 0 0 #1a1222, 0 .25cqw 0 #1a1222, 0 -.25cqw 0 #1a1222, .3cqw .4cqw 0 #1a1222;
  animation: arena-rise 1.1s cubic-bezier(.2, .8, .3, 1) forwards;
}
.arena-pop small {
  display: block;
  margin-top: .2em;
  font-size: .55em;
  letter-spacing: .1em;
  opacity: .9;
}
.arena-pop.t1 { color: #d6dbe4; font-size: 2.4cqw; }
.arena-pop.t2 { color: #fff59d; font-size: 2.7cqw; }
.arena-pop.t3 { color: #ffcc80; }
.arena-pop.t4 { color: #ff9a6b; font-size: 3.6cqw; }
.arena-pop.t5 { color: #ff5a5a; font-size: 4.2cqw; }
.arena-pop.t6 { color: #ff2d55; font-size: 5.6cqw; animation-name: arena-rise-big; animation-duration: 1.5s; }
.arena-pop.parry { color: #bfe3ff; font-size: 3cqw; }
.arena-pop.dodge { color: #b9ffcf; font-size: 3cqw; font-style: italic; }
.arena-pop.cover { color: #8fd0ff; font-size: 3cqw; }
.arena-pop.spec { color: #ffe27a; font-size: 3.8cqw; }
.arena-pop.kill { color: #ffd54a; font-size: 2.8cqw; }
.arena-pop.stun { color: #ffe27a; font-size: 3.2cqw; animation-name: arena-rise-big; animation-duration: 1.4s; }

@keyframes arena-rise {
  0% { transform: translate(-50%, -60%) scale(.5); opacity: 0; }
  12% { transform: translate(-50%, -105%) scale(1.15); opacity: 1; }
  24% { transform: translate(-50%, -100%) scale(1); }
  75% { opacity: 1; }
  100% { transform: translate(-50%, -190%) scale(1); opacity: 0; }
}
@keyframes arena-rise-big {
  0% { transform: translate(-50%, -60%) scale(.3) rotate(-8deg); opacity: 0; }
  10% { transform: translate(-50%, -110%) scale(1.4) rotate(4deg); opacity: 1; }
  18% { transform: translate(-50%, -100%) scale(1) rotate(-3deg); }
  26% { transform: translate(-50%, -100%) scale(1.1) rotate(2deg); }
  80% { transform: translate(-50%, -120%) scale(1) rotate(0); opacity: 1; }
  100% { transform: translate(-50%, -200%) scale(1); opacity: 0; }
}
@keyframes arena-bounce {
  from { transform: translateX(-50%) translateY(0); }
  to { transform: translateX(-50%) translateY(-6%); }
}

@media (prefers-reduced-motion: reduce) {
  .arena-pop { animation-duration: .01s; animation-delay: .9s; }
  .arena-victory.show { animation: none; }
}
`;

const STYLE_ID = 'arkadia-arena-styles';

export function injectStyles(): () => void {
    if (document.getElementById(STYLE_ID)) return () => undefined;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = ARENA_CSS;
    document.head.appendChild(style);
    return () => style.remove();
}
