/**
 * Arena - the fight on your location acted out as a pixel-art JRPG battle.
 * Wiring only: the feed (arena/feed.ts) turns client events into a roster and
 * fight beats, the window (arena/window.ts) draws them.
 */

import type { PluginApi, PluginInfo, PersistentPopupHandle } from '@arkadia/plugin-types';
import { createApiHost } from './client/apiHost';
import { createArenaFeed, type ArenaFeed } from './arena/feed';
import { createArenaView, type ArenaView } from './arena/window';
import { injectStyles } from './arena/styles';

const PLUGIN_NAME = 'Arena';
const PLUGIN_VERSION = '0.1.1';
const PLUGIN_AUTHOR = 'Dargoth';
const PLUGIN_DESCRIPTION = 'Walka na lokacji odgrywana jako pikselowa bitwa w stylu JRPG. Okno: /arena.';

let feed: ArenaFeed | null = null;
let view: ArenaView | null = null;
let popup: PersistentPopupHandle | null = null;
let removeStyles: (() => void) | null = null;

const closeView = () => {
    view?.destroy();
    view = null;
};

export async function init(api: PluginApi): Promise<PluginInfo> {
    removeStyles = injectStyles();
    feed = createArenaFeed(createApiHost(api));

    popup = await api.ui.registerPersistentPopup({
        id: 'arena',
        title: 'Arena',
        initialWidth: 480,
        initialHeight: 310,
        createContent: () => {
            // A reopen builds a new scene; never leave the old loop running.
            closeView();
            view = createArenaView(feed!);
            return view.root;
        },
    });
    popup.onClose(closeView);

    const toggle = () => {
        if (!popup) return;
        if (popup.isOpen) popup.close();
        else void popup.open();
    };
    api.ui.addPopupMenuEntry('Arena', toggle);
    api.aliases.register(/^\/arena$/, () => {
        toggle();
        return true;
    });

    return { name: PLUGIN_NAME, version: PLUGIN_VERSION, author: PLUGIN_AUTHOR, description: PLUGIN_DESCRIPTION };
}

/** Aliases, the window and the menu entry go with the plugin; events and styles are ours to drop. */
export async function destroy(): Promise<void> {
    closeView();
    feed?.destroy();
    feed = null;
    popup = null;
    removeStyles?.();
    removeStyles = null;
}
