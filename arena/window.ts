import { ArenaScene } from './ArenaScene';
import type { ArenaFeed } from './feed';

export interface ArenaView {
    root: HTMLElement;
    destroy(): void;
}

/**
 * The window's content: the 16:9 stage and a one-line ticker. Built fresh each
 * time the window opens, so the scene (and its animation loop) lives exactly as
 * long as the window does.
 */
export function createArenaView(feed: ArenaFeed): ArenaView {
    const root = document.createElement('div');
    root.className = 'arena-root';
    root.innerHTML = `
        <div class="arena-stage">
            <div class="arena-screen">
                <canvas class="arena-canvas"></canvas>
                <div class="arena-overlay"></div>
            </div>
        </div>
        <div class="arena-ticker">&nbsp;</div>`;

    const canvas = root.querySelector<HTMLCanvasElement>('.arena-canvas')!;
    const overlay = root.querySelector<HTMLElement>('.arena-overlay')!;
    const ticker = root.querySelector<HTMLElement>('.arena-ticker')!;

    const scene = new ArenaScene(canvas, overlay, {
        onLine: line => {
            ticker.textContent = line || ' ';
            ticker.title = line;
        },
    });
    scene.setRoster(feed.roster());
    const offRoster = feed.onRoster(roster => scene.setRoster(roster));
    const offAction = feed.onAction(action => scene.push(action));

    return {
        root,
        destroy() {
            offRoster();
            offAction();
            scene.destroy();
        },
    };
}
