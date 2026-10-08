/**
 * The Arena's host over the real plugin API - the only module that knows the
 * API exists.
 */

import type { PluginApi } from '@arkadia/plugin-types';
import type { ArenaHost, LocationObjectLike, PersonLike } from '../arena/feed';

type LooseEvents = {
    on(event: string, listener: (payload: unknown) => void): void;
    off(event: string, listener: (payload: unknown) => void): void;
};

/** `people.subscribe`/`refresh` came after the first published types; older clients lack them. */
type LoosePeople = {
    getAll(): PersonLike[];
    subscribe?(listener: (people: PersonLike[]) => void): () => void;
    refresh?(): Promise<void>;
};

/** How often an older client without `people.subscribe` is re-read. */
const PEOPLE_POLL_MS = 60_000;

export function createApiHost(api: PluginApi): ArenaHost {
    const events = api.events as unknown as LooseEvents;
    const people = api.people as unknown as LoosePeople;

    return {
        objects: () => api.objects.getObjectsOnLocation() as unknown as LocationObjectLike[],

        charInfo: () => (api.gmcp.get() as { char?: { info?: { race?: string } } } | undefined)?.char?.info,

        on(event, listener) {
            const safe = (payload: unknown) => {
                try {
                    listener(payload);
                } catch (error) {
                    console.error('[Arena]', event, error);
                }
            };
            events.on(event, safe);
            return () => events.off(event, safe);
        },

        subscribePeople(listener) {
            people.refresh?.().catch(() => undefined);
            if (people.subscribe) return people.subscribe(listener);
            listener(people.getAll());
            const timer = setInterval(() => listener(people.getAll()), PEOPLE_POLL_MS);
            return () => clearInterval(timer);
        },
    };
}
