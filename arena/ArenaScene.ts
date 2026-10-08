import type { ArenaAction, ArenaRoster, ArenaSide } from './combat';
import { GRIDS, WEAPONS, pickLook, type Grid, type Palette, type Pose, type SpriteLook } from './sprites';

/**
 * Canvas battle scene for the Arena popup. It owns no game logic: the roster
 * says who stands where (and their real GMCP hp), actions say who struck whom.
 * The scene only stages them - enemies on the left, the team on the right.
 *
 * Drawn at a fixed 320x180 and scaled up with pixelated CSS. Everything
 * window-bound (rAF, matchMedia, createElement) goes through the canvas's own
 * document so the scene keeps running when the panel is popped out.
 */

const W = 320;
const H = 180;
/** Beats animating at once - a 7-on-7 brawl throws several blows a second. */
const MAX_CONCURRENT = 6;
const MAX_QUEUE = 24;
/** How long a blow waits for its target to come back from a strike of its own. */
const HOLD_MAX = 900;
/** Others' ogluszenie, matching the object list's paralysis timeout. */
const STUN_OTHERS_MS = 15000;
/** The player's own stun ends with a line; this only guards a missed one. */
const STUN_MAX_MS = 30000;

interface Point { x: number; y: number }

interface Move {
    fx: number; fy: number; tx: number; ty: number;
    t0: number; dur: number; arc: number;
}

interface Actor {
    num: number;
    side: ArenaSide;
    desc: string;
    race?: string;
    look: SpriteLook;
    /** Draw scale - the look's own, or smaller on a crowded side. */
    s: number;
    w: number;
    h: number;
    base: Point;
    cover?: Point & { until: number };
    x: number;
    /** Ground line under the feet; `z` lifts the sprite off it. */
    gy: number;
    z: number;
    hp?: number;
    target?: number;
    faceTo?: number;
    pose: Pose;
    hurtUntil: number;
    chargeUntil: number;
    flashKill: number;
    dissolveT0: number;
    mov: Move | null;
    phase: number;
    busyUntil: number;
    impactUntil: number;
    /** Ogluszenie - kneels with stars overhead until the end line or the timeout. */
    stunnedUntil: number;
    goneAt?: number;
    leaving: boolean;
    killed: boolean;
    dead: boolean;
    label: HTMLDivElement;
}

interface Particle {
    x: number; y: number; vx: number; vy: number; g: number;
    life: number; age: number; col: string; size: number;
}

const TIER_WORD = ['', 'muśnięcie', 'lekko', 'rana', 'poważnie!', 'BARDZO CIĘŻKO!', 'MASAKRA!!'];
const GUARD_WORD = { bron: 'CLANG!', zbroja: 'ZBROJA!', tarcza: 'TARCZA!' };
const HP_COLORS = ['#ff4a4a', '#ff4a4a', '#ff4a4a', '#ffd54a', '#ffd54a', '#4fdc6a', '#4fdc6a'];

function hash(r: number, c: number): number {
    const x = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

function seeded(seed: number) {
    return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

function escapeHtml(text: string): string {
    return text.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
}

function shortName(desc: string, max = 22): string {
    const name = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : '?';
    return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

export interface ArenaSceneOptions {
    /** Called with the game line behind every beat that has one. */
    onLine?: (text: string) => void;
}

export class ArenaScene {
    private readonly ctx: CanvasRenderingContext2D;
    private readonly bg: HTMLCanvasElement;
    private readonly view: Window;
    private readonly reduceMotion: boolean;
    private readonly calmEl: HTMLDivElement;
    private readonly victoryEl: HTMLDivElement;

    private actors = new Map<number, Actor>();
    private order: Record<'enemy' | 'team', number[]> = { enemy: [], team: [] };
    private killedNums = new Set<number>();
    private queue: ArenaAction[] = [];
    private queuedAt = new WeakMap<ArenaAction, number>();
    private timers: { at: number; fn: () => void }[] = [];
    private particles: Particle[] = [];
    private playerNum?: number;
    private firstRoster = true;

    private now = 0;
    private last = 0;
    private raf = 0;
    private destroyed = false;
    private shakeUntil = 0;
    private shakeMag = 0;
    private flashUntil = 0;
    private victoryUntil = 0;
    private shield: { num: number; until: number } | null = null;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly overlay: HTMLElement,
        private readonly options: ArenaSceneOptions = {},
    ) {
        const doc = canvas.ownerDocument;
        this.view = doc.defaultView ?? window;
        this.ctx = canvas.getContext('2d')!;
        canvas.width = W;
        canvas.height = H;
        this.ctx.imageSmoothingEnabled = false;
        this.reduceMotion = this.view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        this.bg = doc.createElement('canvas');
        this.bg.width = W;
        this.bg.height = H;
        paintBackground(this.bg.getContext('2d')!);

        this.calmEl = doc.createElement('div');
        this.calmEl.className = 'arena-calm';
        this.calmEl.textContent = 'Spokój. Czekam na walkę…';
        this.victoryEl = doc.createElement('div');
        this.victoryEl.className = 'arena-victory';
        this.victoryEl.textContent = 'ZWYCIĘSTWO!';
        overlay.append(this.calmEl, this.victoryEl);

        this.last = this.view.performance.now();
        this.raf = this.view.requestAnimationFrame(this.frame);
    }

    destroy() {
        this.destroyed = true;
        this.view.cancelAnimationFrame(this.raf);
        this.overlay.replaceChildren();
    }

    // ------------------------------------------------------------------ input

    setRoster(roster: ArenaRoster) {
        this.playerNum = roster.playerNum;
        const present = new Set<number>();
        for (const f of roster.fighters) {
            present.add(f.num);
            if (this.killedNums.has(f.num)) continue;
            let a = this.actors.get(f.num);
            if (!a) {
                a = this.createActor(f.num, f.side, f.desc, f.race);
                this.actors.set(f.num, a);
                const list = this.order[f.side === 'enemy' ? 'enemy' : 'team'];
                if (f.side === 'me') list.unshift(f.num); else list.push(f.num);
            } else if (a.desc !== f.desc || a.race !== f.race) {
                // The player's name and race arrive on their own GMCP messages.
                a.desc = f.desc;
                a.race = f.race;
                this.setLook(a, pickLook(f.desc, f.side, f.race));
                a.label.textContent = shortName(f.desc);
            }
            a.hp = f.hp;
            a.target = f.target;
            a.goneAt = undefined;
        }
        for (const a of this.actors.values()) {
            if (!present.has(a.num) && a.goneAt === undefined) a.goneAt = this.now;
        }
        for (const num of [...this.killedNums]) {
            if (!present.has(num) && !this.actors.has(num)) this.killedNums.delete(num);
        }
        this.layout();
        // Whoever already stands on the location when the window opens is
        // placed directly; only later arrivals walk in.
        if (this.firstRoster && this.actors.size) {
            this.firstRoster = false;
            for (const a of this.actors.values()) {
                a.x = a.base.x;
                a.gy = a.base.y;
            }
        }
    }

    push(action: ArenaAction) {
        if (this.queue.length >= MAX_QUEUE) {
            const drop = this.queue.findIndex(q => q.kind !== 'kill');
            this.queue.splice(drop >= 0 ? drop : 0, 1);
        }
        this.queue.push(action);
        this.queuedAt.set(action, this.now);
    }

    // ------------------------------------------------------------ bookkeeping

    private setLook(a: Actor, look: SpriteLook) {
        a.look = look;
        this.setScale(a, look.scale);
    }

    private setScale(a: Actor, s: number) {
        a.s = s;
        a.w = a.look.grid[0].length * s;
        a.h = a.look.grid.length * s;
    }

    private createActor(num: number, side: ArenaSide, desc: string, race?: string): Actor {
        const look = pickLook(desc, side, race);
        const label = this.canvas.ownerDocument.createElement('div');
        label.className = 'arena-label' + (side === 'me' ? ' is-me' : side === 'enemy' ? ' is-enemy' : '');
        label.textContent = shortName(desc);
        this.overlay.appendChild(label);
        const startX = side === 'enemy' ? -24 : W + 24;
        return {
            num, side, desc, race, look,
            s: look.scale,
            w: look.grid[0].length * look.scale,
            h: look.grid.length * look.scale,
            base: { x: startX, y: 140 },
            x: startX, gy: 140, z: 0,
            pose: 'rest', hurtUntil: 0, chargeUntil: 0, flashKill: 0, dissolveT0: 0,
            mov: null, phase: (num % 7) * 0.9, busyUntil: 0, impactUntil: 0, stunnedUntil: 0,
            leaving: false, killed: false, dead: false, label,
        };
    }

    private removeFromOrder(num: number) {
        this.order.enemy = this.order.enemy.filter(n => n !== num);
        this.order.team = this.order.team.filter(n => n !== num);
    }

    private dropActor(a: Actor) {
        a.label.remove();
        this.actors.delete(a.num);
        this.removeFromOrder(a.num);
    }

    /**
     * Slots per side, front column nearest the middle. Big fights (6-7 a side
     * is ordinary) spread into more columns rather than taller ones: three rows
     * keep sprites and names apart, four only past twelve fighters. Columns are
     * as wide as their widest sprite and squeeze together when the half-field
     * runs out; a crowded side draws its giants one size smaller.
     */
    private layout() {
        (['enemy', 'team'] as const).forEach(side => {
            const actors = this.order[side].map(num => this.actors.get(num)).filter((a): a is Actor => !!a);
            const n = actors.length;
            if (!n) return;
            const crowded = n > 4;
            actors.forEach(a => {
                this.setScale(a, crowded ? Math.min(a.look.scale, 2) : a.look.scale);
                a.label.classList.toggle('is-small', crowded);
                a.label.textContent = shortName(a.desc, crowded ? 13 : 22);
            });
            // Tall monsters need two rows' height each: pairs until the side gets crowded.
            const perCol = n <= 2 ? n : n <= 4 ? 2 : n <= 12 ? 3 : 4;
            const cols = Math.ceil(n / perCol);
            const dir = side === 'enemy' ? -1 : 1;
            // Inner edge of the front column, either side of the middle of the field.
            const edge = side === 'enemy' ? 140 : 180;
            const columns = Array.from({ length: cols }, (_, col) => actors.slice(col * perCol, (col + 1) * perCol));
            const widths = columns.map(members => Math.max(...members.map(a => a.w)));
            const gap = 4;
            const needed = widths.reduce((sum, w) => sum + w + gap, 0);
            const room = 132;
            const squeeze = needed > room ? room / needed : 1;
            let offset = 0;
            columns.forEach((members, col) => {
                const width = widths[col];
                // Feet between 112 and 162 leave room for the hp bar and name below;
                // every other column sits between the rows of its neighbours so
                // names never line up across columns.
                const odd = cols > 1 && col % 2 === 1;
                const top = odd ? 121 : 112;
                const bottom = odd ? 158 : 162;
                members.forEach((a, row) => {
                    const y = members.length === 1 ? (top + bottom) / 2 : top + row * ((bottom - top) / (members.length - 1));
                    const stagger = row % 2 ? 5 : 0;
                    a.base = { x: Math.round(edge + dir * ((offset + width / 2) * squeeze + stagger)), y: Math.round(y) };
                });
                offset += width + gap;
            });
        });
        const enemies = this.order.enemy.length;
        this.overlay.dataset.calm = enemies === 0 ? '1' : '0';
    }

    private home(a: Actor): Point {
        return a.cover && this.now < a.cover.until ? a.cover : a.base;
    }

    private after(ms: number, fn: () => void) {
        this.timers.push({ at: this.now + ms, fn });
        this.timers.sort((p, q) => p.at - q.at);
    }

    /** Busy with a strike of its own, away from its slot or on the way somewhere. */
    private isAway(a: Actor): boolean {
        if (this.now >= a.busyUntil) return false;
        const home = this.home(a);
        return !!a.mov || Math.hypot(home.x - a.x, home.y - a.gy) > 6;
    }

    /**
     * Where a blow should land: the defender's slot when it is there, otherwise
     * the end of its current move or where it stands - a blow that waited its
     * full HOLD_MAX follows the defender instead of hitting an empty slot.
     */
    private standing(a: Actor): Point {
        if (!this.isAway(a)) return this.home(a);
        return a.mov ? { x: a.mov.tx, y: a.mov.ty } : { x: a.x, y: a.gy };
    }

    private moveTo(a: Actor, x: number, y: number, dur: number, arc = 0) {
        a.mov = { fx: a.x, fy: a.gy, tx: x, ty: y, t0: this.now, dur, arc };
    }

    private shake(mag: number, ms: number) {
        if (this.reduceMotion) return;
        this.shakeMag = this.now < this.shakeUntil ? Math.max(mag, this.shakeMag) : mag;
        this.shakeUntil = this.now + ms;
    }

    private burst(x: number, y: number, n: number, cols: string[], spd = 70, grav = 160, life = 0.5) {
        for (let i = 0; i < n; i++) {
            const ang = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8);
            this.particles.push({
                x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 30, g: grav,
                life: life * (0.6 + Math.random() * 0.6), age: 0, col: cols[i % cols.length],
                size: Math.random() > 0.7 ? 2 : 1,
            });
        }
    }

    /** Height of the feet above the ground line: a jump, plus a flyer's bobbing hover. */
    private lift(a: Actor): number {
        const hover = a.look.hover && !a.killed ? a.look.hover + Math.sin(this.now / 300 + a.phase) * 1.5 : 0;
        return a.z + hover;
    }

    private chest(a: Actor): Point {
        return { x: a.x, y: a.gy - this.lift(a) - a.h * 0.55 };
    }

    private pop(a: Actor, html: string, cls: string) {
        const el = this.canvas.ownerDocument.createElement('div');
        el.className = 'arena-pop ' + cls;
        el.innerHTML = html;
        el.style.left = (a.x / W * 100) + '%';
        el.style.top = ((a.gy - this.lift(a) - a.h - 2) / H * 100) + '%';
        el.addEventListener('animationend', () => el.remove());
        this.overlay.appendChild(el);
    }

    private timeScale(): number {
        // Big fights run six beats at once, so only a real backlog speeds things up.
        return Math.min(3, 1 + Math.max(0, this.queue.length - 3) * 0.25);
    }

    // ---------------------------------------------------------------- actions

    private pump() {
        let running = 0;
        for (const a of this.actors.values()) if (a.busyUntil > this.now) running++;
        for (let i = 0; i < this.queue.length; i++) {
            const action = this.queue[i];
            const d = action.defender !== undefined ? this.actors.get(action.defender) : undefined;
            if (!d || d.dead || d.leaving || d.killed) {
                this.queue.splice(i--, 1);
                continue;
            }
            if (action.kind === 'kill') {
                if (this.now < d.impactUntil) continue;
                this.queue.splice(i--, 1);
                this.startKill(d);
                continue;
            }
            if (action.kind === 'stun' || action.kind === 'stunEnd') {
                // A stun lands with the blow that caused it, never before.
                // Others' stun is reported just before the blow that dealt it.
                const next = this.queue[i + 1];
                const blowFollows = next?.defender === d.num && (next.kind === 'hit' || next.kind === 'spec');
                if (action.kind === 'stun' && (blowFollows || this.now < d.impactUntil)) continue;
                this.queue.splice(i--, 1);
                this.applyStun(d, action.kind === 'stun');
                continue;
            }
            let att = action.attacker !== undefined ? this.actors.get(action.attacker) : undefined;
            if (att && (att.dead || att.leaving || att.killed)) att = undefined;
            if (att && this.now < att.busyUntil) continue;
            // The target is off striking someone else: let it come back first,
            // so the exchange plays as turns instead of a blow into an empty slot.
            if (att && this.isAway(d) && this.now - (this.queuedAt.get(action) ?? this.now) < HOLD_MAX) continue;
            if (running >= MAX_CONCURRENT) break;
            this.queue.splice(i--, 1);
            running++;
            this.start(action, att, d);
        }
    }

    private start(action: ArenaAction, att: Actor | undefined, d: Actor) {
        if (action.text) this.options.onLine?.(action.text);
        if (action.kind === 'cover') {
            if (att) this.startCover(att, d);
            return;
        }
        const impact = () => this.impact(action, att, d);
        const lead = action.kind === 'spec' && att ? 240 : 0;
        // The charge glints gold; the spec's name lands with the blow.
        if (action.kind === 'spec' && att) att.chargeUntil = this.now + lead;
        if (!att) {
            d.impactUntil = Math.max(d.impactUntil, this.now + 80);
            this.after(60, impact);
            return;
        }
        const spot = this.standing(d);
        const dir = this.home(att).x >= spot.x ? 1 : -1;
        const off = d.w / 2 + att.w / 2 - 6;
        const leap = [GRIDS.beast, GRIDS.spider, GRIDS.bear, GRIDS.squig, GRIDS.werewolf].includes(att.look.grid);
        att.faceTo = d.num;
        att.busyUntil = this.now + lead + 760;
        d.impactUntil = Math.max(d.impactUntil, this.now + lead + 320);
        // Several attackers on one target fan out around it instead of stacking.
        const fan = ((att.num % 5) - 2) * 5;
        this.after(lead, () => this.moveTo(att, spot.x + off * dir + Math.abs(fan) * dir * 0.4, spot.y + 1 + fan, 260, leap ? 16 : 3));
        this.after(lead + 220, () => { att.pose = 'strike'; });
        this.after(lead + 300, impact);
        this.after(lead + 440, () => { att.pose = 'rest'; });
        this.after(lead + 760, () => { att.faceTo = undefined; });
    }

    private impact(action: ArenaAction, att: Actor | undefined, d: Actor) {
        if (d.dead) return;
        const c = this.chest(d);
        const away = att ? (att.x >= d.x ? -1 : 1) : (d.side === 'enemy' ? -1 : 1);
        if (action.kind === 'hit' || action.kind === 'spec') {
            const tier = action.power ?? 3;
            d.hurtUntil = this.now + 300;
            d.x += away * 4;
            const cols = tier >= 5 ? ['#ff2d55', '#ffd54a', '#ffffff'] : tier >= 3 ? ['#ffcc80', '#ffffff', '#ff7a59'] : ['#ffffff', '#fff59d'];
            this.burst(c.x, c.y, 4 + tier * 3 + (action.kind === 'spec' ? 10 : 0), cols, 50 + tier * 15);
            if (action.finisher) {
                this.pop(d, 'FIN!!', 't6');
            } else {
                const head = action.kind === 'spec' ? escapeHtml(action.label ?? 'SPEC') : TIER_WORD[tier];
                const strength = action.fraction ?? (action.kind === 'spec' ? '' : `${tier}/6`);
                this.pop(d, strength ? `${head}<small>${escapeHtml(strength)}</small>` : head, action.kind === 'spec' ? 'spec' : 't' + tier);
            }
            if (tier >= 5 || action.finisher) this.shake(tier === 6 || action.finisher ? 4 : 2, tier === 6 ? 420 : 250);
            if (tier === 6 || action.finisher) this.flashUntil = this.now + 90;
        } else if (action.kind === 'parry') {
            this.burst(c.x - away * d.w * 0.4, c.y - 2, 12, ['#ffffff', '#ffe27a', '#bfe3ff'], 90, 60, 0.35);
            this.pop(d, GUARD_WORD[action.guard ?? 'bron'], 'parry');
            this.shake(1, 120);
        } else if (action.kind === 'dodge') {
            d.busyUntil = Math.max(d.busyUntil, this.now + 400);
            this.moveTo(d, d.x + away * 12, d.gy - 2, 160, 7);
            this.pop(d, 'UNIK!', 'dodge');
        }
    }

    private applyStun(d: Actor, on: boolean) {
        if (!on) {
            d.stunnedUntil = 0;
            return;
        }
        // The player's own stun always ends with a line; others' sometimes never
        // do, so they fall back on the object list's 15 s.
        d.stunnedUntil = this.now + (d.side === 'me' ? STUN_MAX_MS : STUN_OTHERS_MS);
        this.pop(d, 'OGŁUSZONY!', 'stun');
        this.burst(d.x, d.gy - this.lift(d) - d.h, 10, ['#ffd54a', '#fff6c8'], 40, 40, 0.5);
        this.shake(1, 150);
    }

    private startCover(coverer: Actor, covered: Actor) {
        const toEnemies = covered.side === 'enemy' ? 1 : -1;
        const spot = { x: covered.base.x + toEnemies * 20, y: covered.base.y + 1 };
        coverer.cover = { ...spot, until: this.now + 6000 };
        coverer.busyUntil = this.now + 700;
        this.moveTo(coverer, spot.x, spot.y, 340, 10);
        this.after(360, () => {
            this.pop(coverer, 'ZASŁONA!', 'cover');
            this.shield = { num: coverer.num, until: this.now + 900 };
        });
    }

    private startKill(d: Actor) {
        d.killed = true;
        d.flashKill = this.now;
        this.killedNums.add(d.num);
        this.pop(d, 'pokonany', 'kill');
        this.after(450, () => { d.dissolveT0 = this.now; });
        this.after(1150, () => {
            d.dead = true;
            this.dropActor(d);
            this.layout();
            const enemiesLeft = this.order.enemy.some(n => {
                const e = this.actors.get(n);
                return e && !e.killed && !e.leaving;
            });
            if (!enemiesLeft && this.order.team.length) {
                this.victoryUntil = this.now + 2600;
            }
        });
    }

    // ------------------------------------------------------------------- loop

    private frame = (t: number) => {
        if (this.destroyed) return;
        // The first rAF timestamp can predate the constructor's performance.now().
        const dt = Math.max(0, Math.min(50, t - this.last));
        this.last = t;
        const scaled = dt * this.timeScale();
        this.now += scaled;
        this.tick(scaled);
        this.draw();
        this.raf = this.view.requestAnimationFrame(this.frame);
    };

    private tick(dms: number) {
        while (this.timers.length && this.timers[0].at <= this.now) this.timers.shift()!.fn();

        for (const a of [...this.actors.values()]) {
            if (a.goneAt !== undefined && !a.killed && !a.leaving && this.now - a.goneAt > 600) {
                a.leaving = true;
                a.label.classList.add('is-gone');
                this.removeFromOrder(a.num);
                this.layout();
                this.moveTo(a, a.side === 'enemy' ? -30 : W + 30, a.gy, 900);
            }
            this.stepMove(a);
            if (a.leaving && !a.mov) {
                this.dropActor(a);
                continue;
            }
            if (!a.mov && !a.leaving && !a.killed && this.now >= a.busyUntil) {
                const home = this.home(a);
                const dist = Math.hypot(home.x - a.x, home.y - a.gy);
                if (dist > 0.5) this.moveTo(a, home.x, home.y, Math.max(240, dist / 150 * 1000));
            }
        }

        if (this.now < this.victoryUntil) {
            this.order.team.forEach((num, i) => {
                const a = this.actors.get(num);
                if (a && !a.mov) a.z = Math.abs(Math.sin(this.now / 170 + i)) * 8;
            });
        }
        this.victoryEl.classList.toggle('show', this.now < this.victoryUntil);

        const dt = dms / 1000;
        for (const p of this.particles) {
            p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
        }
        this.particles = this.particles.filter(p => p.age < p.life);

        this.pump();
    }

    private stepMove(a: Actor) {
        const m = a.mov;
        if (!m) {
            if (this.now >= this.victoryUntil) a.z = 0;
            return;
        }
        const p = Math.min(1, (this.now - m.t0) / m.dur);
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        a.x = m.fx + (m.tx - m.fx) * e;
        a.gy = m.fy + (m.ty - m.fy) * e;
        a.z = m.arc ? Math.sin(p * Math.PI) * m.arc : 0;
        if (p >= 1) {
            a.mov = null;
            a.z = 0;
        }
    }

    // ------------------------------------------------------------------- draw

    private drawGrid(grid: Grid, pal: Palette, left: number, top: number, s: number, flip: boolean, gw: number,
                     o: { mode?: 'white' | 'red' | 'gold' | null; dis?: number; kneel?: boolean; ox?: number; oy?: number }) {
        const ctx = this.ctx;
        const gh = grid.length;
        const isWeapon = o.ox !== undefined;
        for (let r = 0; r < gh; r++) {
            const row = grid[r];
            for (let c = 0; c < row.length; c++) {
                const ch = row[c];
                if (ch === '.') continue;
                let col = pal[ch];
                if (!col) continue;
                const cc = c + (o.ox ?? 0);
                let ry = r + (o.oy ?? 0);
                if (o.kneel && !isWeapon) {
                    if (r >= gh - 4 && r < gh - 1) continue;
                    if (r < gh - 4) ry = r + 3;
                }
                if (o.dis) {
                    const h = hash(ry, cc);
                    if (h < o.dis) continue;
                    if (h < o.dis + 0.2) col = '#c58cff';
                }
                if (o.mode === 'white') col = '#ffffff';
                else if (o.mode === 'red') col = '#ff8a80';
                else if (o.mode === 'gold') col = '#ffe27a';
                const px = flip ? gw - 1 - cc : cc;
                ctx.fillStyle = col;
                ctx.fillRect(left + px * s, top + ry * s, s, s);
            }
        }
    }

    private facingLeft(a: Actor): boolean {
        const faceNum = a.faceTo ?? a.target;
        const other = faceNum !== undefined ? this.actors.get(faceNum) : undefined;
        if (other && Math.abs(other.x - a.x) > 2) return other.x < a.x;
        return a.side !== 'enemy';
    }

    private drawActor(a: Actor) {
        const { grid, palette, weapon, weaponShift } = a.look;
        const s = a.s;
        const gw = grid[0].length, gh = grid.length;
        const flip = this.facingLeft(a);
        const stunned = this.now < a.stunnedUntil && !a.killed;
        const exhausted = a.side !== 'enemy' && a.hp !== undefined && a.hp <= 2 && this.now >= this.victoryUntil;
        // Flyers have no knees to drop to; they keep hovering, stars and all.
        const kneel = (stunned || exhausted) && !a.mov && !a.look.hover;
        const bob = !a.mov && !a.killed && Math.floor(this.now / 420 + a.phase) % 2 ? s / 2 : 0;
        const left = Math.round(a.x - gw * s / 2);
        const top = Math.round(a.gy - this.lift(a) - gh * s + bob);
        let mode: 'white' | 'red' | 'gold' | null = null;
        if (a.flashKill && !a.dissolveT0 && Math.floor((this.now - a.flashKill) / 75) % 2 === 0) mode = 'white';
        else if (a.hurtUntil > this.now && Math.floor((a.hurtUntil - this.now) / 60) % 2) mode = 'red';
        else if (a.chargeUntil > this.now && Math.floor(this.now / 60) % 2) mode = 'gold';
        const dis = a.dissolveT0 ? Math.min(1, (this.now - a.dissolveT0) / 700) : 0;
        this.ctx.globalAlpha = a.look.alpha ?? 1;
        this.drawGrid(grid, palette, left, top, s, flip, gw, { mode, dis, kneel });
        if (weapon && !dis) {
            const p = WEAPONS[weapon][a.pose];
            this.drawGrid(p.grid, palette, left, top, s, flip, gw, {
                mode,
                ox: p.col + (weaponShift?.col ?? 0),
                oy: p.row + (weaponShift?.row ?? 0) + (kneel ? 3 : 0),
            });
        }
        this.ctx.globalAlpha = 1;
        if (stunned) {
            this.drawStunStars(a, top + (kneel ? 3 * s : 0));
        } else if (kneel) {
            const sx = a.x + (flip ? -1 : 1) * (a.w / 2 - 2);
            const sy = top + 6 * s + Math.floor((this.now / 50) % 10);
            this.ctx.fillStyle = '#8fd3ff';
            this.ctx.fillRect(Math.round(sx), Math.round(sy), 2, 3);
        }
    }

    /** Three stars circling the head of a stunned fighter. */
    private drawStunStars(a: Actor, headTop: number) {
        const ctx = this.ctx;
        const rx = Math.max(6, a.w * 0.35);
        for (let i = 0; i < 3; i++) {
            const ang = this.now / 260 + i * (Math.PI * 2 / 3);
            const x = Math.round(a.x + Math.cos(ang) * rx);
            const y = Math.round(headTop - 3 + Math.sin(ang) * 2);
            ctx.fillStyle = Math.sin(ang) > 0 ? '#ffd54a' : '#c9a227';
            ctx.fillRect(x - 1, y, 3, 1);
            ctx.fillRect(x, y - 1, 1, 3);
            ctx.fillStyle = '#fff6c8';
            ctx.fillRect(x, y, 1, 1);
        }
    }

    private drawShadow(a: Actor) {
        const ctx = this.ctx;
        const k = Math.max(0.4, 1 - this.lift(a) / 30), w = a.w * 0.8 * k;
        ctx.fillStyle = 'rgba(8,5,18,.45)';
        ctx.fillRect(Math.round(a.x - w / 2), Math.round(a.gy), Math.round(w), 1);
        ctx.fillRect(Math.round(a.x - w * 0.35), Math.round(a.gy + 1), Math.round(w * 0.7), 1);
        ctx.fillRect(Math.round(a.x - w * 0.35), Math.round(a.gy - 1), Math.round(w * 0.7), 1);
    }

    private drawHpBar(a: Actor) {
        if (a.hp === undefined || a.killed) return;
        const ctx = this.ctx;
        const level = Math.max(0, Math.min(6, a.hp));
        const left = Math.round(a.x - 11), top = Math.round(a.gy + 3);
        ctx.fillStyle = 'rgba(10,8,24,.75)';
        ctx.fillRect(left - 1, top - 1, 25, 4);
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = i < level ? HP_COLORS[level] : '#2a2f55';
            ctx.fillRect(left + i * 4, top, 3, 2);
        }
    }

    private drawShield() {
        if (!this.shield || this.now > this.shield.until || Math.floor(this.now / 90) % 2) return;
        const a = this.actors.get(this.shield.num);
        if (!a) return;
        const dir = this.facingLeft(a) ? -1 : 1;
        const x = Math.round(a.x + dir * (a.w / 2 + 2) - (dir < 0 ? 7 : 0));
        const y = Math.round(a.gy - a.h * 0.75);
        const rows = ['.mmmmm.', 'mbbbbbm', 'mbbybbm', 'mbyyybm', 'mbbybbm', '.mbbbm.', '..mbm..', '...m...'];
        const pal: Record<string, string> = { m: '#e9ecff', b: '#3a6ec9', y: '#ffd54a' };
        rows.forEach((row, r) => [...row].forEach((ch, c) => {
            if (!pal[ch]) return;
            this.ctx.fillStyle = pal[ch];
            this.ctx.fillRect(x + c, y + r, 1, 1);
        }));
    }

    private drawCursor() {
        const me = this.playerNum !== undefined ? this.actors.get(this.playerNum) : undefined;
        const t = me?.target !== undefined ? this.actors.get(me.target) : undefined;
        if (!t || t.killed || t.leaving) return;
        const ctx = this.ctx;
        const x = Math.round(t.x), y = Math.round(t.gy - this.lift(t) - t.h - 9 + Math.sin(this.now / 140) * 2);
        const rows: [number, number][] = [[7, 0], [5, 1], [3, 2], [1, 3]];
        ctx.fillStyle = '#1a1222';
        rows.forEach(([w, r]) => ctx.fillRect(x - (w + 2) / 2, y + r - 1, w + 2, 1));
        rows.forEach(([w, r]) => {
            ctx.fillStyle = r === 0 ? '#fff6c8' : '#ffd54a';
            ctx.fillRect(x - w / 2, y + r, w, 1);
        });
    }

    private draw() {
        const ctx = this.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#0c0b1d';
        ctx.fillRect(0, 0, W, H);
        if (this.now < this.shakeUntil) {
            ctx.translate(
                Math.round((Math.random() - 0.5) * 2 * this.shakeMag),
                Math.round((Math.random() - 0.5) * 2 * this.shakeMag),
            );
        }
        ctx.drawImage(this.bg, 0, 0);
        const list = [...this.actors.values()].sort((p, q) => p.gy - q.gy);
        list.forEach(a => this.drawShadow(a));
        list.forEach(a => this.drawActor(a));
        list.forEach(a => this.drawHpBar(a));
        this.drawShield();
        for (const p of this.particles) {
            ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
            ctx.fillStyle = p.col;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        ctx.globalAlpha = 1;
        this.drawCursor();
        if (this.now < this.flashUntil && !this.reduceMotion) {
            ctx.fillStyle = 'rgba(255,255,255,.55)';
            ctx.fillRect(-8, -8, W + 16, H + 16);
        }
        for (const a of list) {
            a.label.style.left = (a.x / W * 100) + '%';
            a.label.style.top = ((a.gy + 6) / H * 100) + '%';
            // A fighter mid-dash stands on someone else's label; hide its own.
            const home = this.home(a);
            a.label.classList.toggle('is-away', Math.hypot(home.x - a.x, home.y - a.gy) > 6);
        }
    }
}

/** Mountain pass at dusk, painted once into an offscreen canvas. */
function paintBackground(g: CanvasRenderingContext2D) {
    const R = seeded(7);
    const bands = ['#16122f', '#221a45', '#35205a', '#56286a', '#82346c', '#b04866', '#d9675a', '#e98a5e'];
    const bh = 12;
    bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bh, W, bh); });
    for (let i = 1; i < bands.length; i++) {
        g.fillStyle = bands[i];
        for (let x = 0; x < W; x += 2) g.fillRect(x, i * bh - 1, 1, 1);
        g.fillStyle = bands[i - 1];
        for (let x = 1; x < W; x += 2) g.fillRect(x, i * bh, 1, 1);
    }
    for (let i = 0; i < 45; i++) {
        g.fillStyle = R() > 0.7 ? '#fff6d8' : '#9f95d6';
        g.fillRect(Math.floor(R() * W), Math.floor(R() * 40), 1, 1);
    }
    for (let dy = -16; dy <= 16; dy++) {
        for (let dx = -16; dx <= 16; dx++) {
            const d = dx * dx + dy * dy;
            if (d <= 256) { g.fillStyle = d < 120 ? '#ffe0a3' : '#ffb36b'; g.fillRect(208 + dx, 74 + dy, 1, 1); }
        }
    }
    let y = 66;
    for (let x = 0; x < W; x++) {
        y += (R() - 0.5) * 2.4 + Math.sin(x / 23) * 0.5;
        y = Math.max(50, Math.min(78, y));
        g.fillStyle = '#43295c';
        g.fillRect(x, Math.round(y), 1, H);
        if (R() > 0.6 && y < 62) { g.fillStyle = '#6a3f78'; g.fillRect(x, Math.round(y), 1, 1); }
    }
    for (let x = 0; x < W; x++) {
        const y2 = Math.round(84 + Math.sin(x / 31) * 4 + Math.sin(x / 11) * 1.5);
        g.fillStyle = '#2b1c42';
        g.fillRect(x, y2, 1, H);
    }
    const rows: [number, string][] = [[92, '#232b20'], [97, '#2c3626'], [108, '#33402b'], [130, '#38472e']];
    rows.forEach(([y0, col], i) => {
        g.fillStyle = col;
        g.fillRect(0, y0, W, (rows[i + 1] ? rows[i + 1][0] : H) - y0);
    });
    for (let yy = 100; yy < H; yy++) {
        for (let x = 0; x < W; x++) {
            const d = ((x - 160) / 165) ** 2 + ((yy - 142) / 36) ** 2;
            if (d < 0.8 || (d < 1 && (x + yy) % 2 === 0)) {
                g.fillStyle = d < 0.35 ? '#55493a' : '#4a4032';
                g.fillRect(x, yy, 1, 1);
            }
        }
    }
    for (let i = 0; i < 140; i++) {
        const x = Math.floor(R() * W), yy = 95 + Math.floor(R() * (H - 95));
        const d = ((x - 160) / 165) ** 2 + ((yy - 142) / 36) ** 2;
        if (d < 0.9) { g.fillStyle = '#6b5d48'; g.fillRect(x, yy, 1, 1); continue; }
        g.fillStyle = '#5a7040';
        g.fillRect(x, yy - 1, 1, 1); g.fillRect(x - 1, yy, 1, 1); g.fillRect(x + 1, yy, 1, 1);
    }
}
