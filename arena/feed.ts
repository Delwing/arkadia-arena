import {
    attributeGag,
    fighterRace,
    findMentions,
    type ArenaAction,
    type ArenaFighter,
    type ArenaRoster,
    type ArenaSide,
    type CombatGag,
} from './combat';

/** What the feed needs from a location object (`api.objects.getObjectsOnLocation()`). */
export interface LocationObjectLike {
    num: number;
    desc?: string;
    hp?: unknown;
    attack_num?: unknown;
    __category?: string;
}

export interface PersonLike {
    name: string;
    description: string;
    ignored?: boolean;
}

/** The Arena's whole view of the client - client/apiHost.ts over the plugin API, a fake in tests. */
export interface ArenaHost {
    objects(): LocationObjectLike[];
    /** Subscribes to a client event; returns the unsubscribe. */
    on(event: string, listener: (payload: any) => void): () => void;
    /** GMCP Char.Info as the client holds it now - sent at login, before a freshly installed plugin listens. */
    charInfo(): { race?: string } | undefined;
    /** The people database now and on every change; returns the unsubscribe. */
    subscribePeople(listener: (people: PersonLike[]) => void): () => void;
}

interface CoverEvent {
    kind: string;
    covererId?: number;
    coveredId?: number;
    attackerId?: number;
    raw: string;
}

export interface ArenaFeed {
    /** The latest roster, for a scene opened mid-fight. */
    roster(): ArenaRoster;
    onRoster(listener: (roster: ArenaRoster) => void): () => void;
    onAction(listener: (action: ArenaAction) => void): () => void;
    destroy(): void;
}

/**
 * Turns client events into the Arena's roster and actions. Runs from plugin
 * load, not just while the window is open, so a window opened mid-fight starts
 * from the current field.
 */
export function createArenaFeed(host: ArenaHost): ArenaFeed {
    const rosterListeners = new Set<(roster: ArenaRoster) => void>();
    const actionListeners = new Set<(action: ArenaAction) => void>();
    const offs: (() => void)[] = [];

    let roster: ArenaRoster = { fighters: [] };
    let lastKey = '';
    let race: string | undefined = host.charInfo()?.race;
    let descriptionsByName = new Map<string, string>();

    const emit = (action: ArenaAction) => actionListeners.forEach(l => l(action));

    const refreshRoster = () => {
        const fighters: ArenaFighter[] = [];
        let playerNum: number | undefined;
        const objects = host.objects();
        const present = new Set(objects.map(o => o.num));
        objects.forEach(o => {
            const side: ArenaSide | null = o.__category === 'player' ? 'me'
                : o.__category === 'team' ? 'team'
                : o.__category === 'rest' ? 'enemy'
                : null;
            if (!side) return;
            if (side === 'me') playerNum = o.num;
            const desc = o.desc ?? '';
            const fighterRaceWord = side === 'me' ? race : fighterRace(desc, side, descriptionsByName);
            fighters.push({
                num: o.num,
                desc,
                ...(fighterRaceWord ? { race: fighterRaceWord } : {}),
                hp: typeof o.hp === 'number' ? o.hp : undefined,
                side,
                target: typeof o.attack_num === 'number' && present.has(o.attack_num) ? o.attack_num : undefined,
            });
        });
        const next: ArenaRoster = { playerNum, fighters };
        const key = JSON.stringify(next);
        if (key === lastKey) return;
        lastKey = key;
        roster = next;
        rosterListeners.forEach(l => l(next));
    };

    offs.push(host.on('parsedObjects', refreshRoster));
    offs.push(host.on('parsedNums', refreshRoster));
    offs.push(host.on('gmcp.char.info', (info: { race?: string } | undefined) => {
        if (!info?.race || info.race === race) return;
        race = info.race;
        refreshRoster();
    }));

    offs.push(host.subscribePeople(people => {
        descriptionsByName = new Map(people
            .filter(p => !p.ignored)
            .map(p => [p.name.toLowerCase(), p.description]));
        refreshRoster();
    }));

    offs.push(host.on('combat.gag', (gag: CombatGag) => {
        const action = attributeGag(gag, roster);
        if (action) emit(action);
    }));

    // Ogluszenie. The player's own comes as stunStart/stunEnd; everyone else's
    // as enemy.paralyzed with the name the line used, declined ("oglusza orka").
    const stun = (kind: 'stun' | 'stunEnd', defender: number | undefined) => {
        if (defender !== undefined) emit({ kind, defender, text: '' });
    };
    const fighterNamed = (name: string) =>
        findMentions(name, roster.fighters.filter(f => f.side !== 'me'))[0]?.num;
    offs.push(host.on('stunStart', () => stun('stun', roster.playerNum)));
    offs.push(host.on('stunEnd', () => stun('stunEnd', roster.playerNum)));
    offs.push(host.on('enemy.paralyzed', ({ name }: { name: string }) => stun('stun', fighterNamed(name))));
    offs.push(host.on('enemy.paralyzed.end', ({ name }: { name: string }) => {
        // The object list's own timeout sends an empty name; the scene times out by itself.
        if (name) stun('stunEnd', fighterNamed(name));
    }));

    offs.push(host.on('enemyKilled', ({ objNum }: { objNum: number }) => emit({ kind: 'kill', defender: objNum, text: '' })));

    offs.push(host.on('cover.event', (entry: CoverEvent) => {
        if (entry.kind !== 'established' || entry.covererId === undefined || entry.coveredId === undefined) return;
        emit({
            kind: 'cover',
            attacker: entry.covererId,
            defender: entry.coveredId,
            against: entry.attackerId !== undefined && entry.attackerId >= 0 ? entry.attackerId : undefined,
            text: entry.raw,
        });
    }));

    offs.push(host.on('client.disconnect', () => {
        lastKey = '';
        roster = { fighters: [] };
        rosterListeners.forEach(l => l(roster));
    }));

    // Installed mid-session: the field is already there, and a fight where no hp
    // level moves would never report it.
    refreshRoster();

    return {
        roster: () => roster,
        onRoster(listener) {
            rosterListeners.add(listener);
            return () => rosterListeners.delete(listener);
        },
        onAction(listener) {
            actionListeners.add(listener);
            return () => actionListeners.delete(listener);
        },
        destroy() {
            offs.splice(0).forEach(off => off());
            rosterListeners.clear();
            actionListeners.clear();
        },
    };
}
