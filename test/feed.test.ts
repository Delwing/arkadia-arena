import { createArenaFeed, type ArenaHost, type LocationObjectLike, type PersonLike } from '../arena/feed';
import type { ArenaAction, ArenaRoster } from '../arena/combat';

const ME = 1, LIRAEL = 2, ORK = 3;

class FakeHost implements ArenaHost {
    objectsHere: LocationObjectLike[] = [];
    info: { race?: string } | undefined;
    private listeners = new Map<string, Set<(payload: any) => void>>();
    private peopleListener?: (people: PersonLike[]) => void;

    objects() {
        return this.objectsHere;
    }
    charInfo() {
        return this.info;
    }
    on(event: string, listener: (payload: any) => void) {
        const set = this.listeners.get(event) ?? new Set();
        set.add(listener);
        this.listeners.set(event, set);
        return () => set.delete(listener);
    }
    subscribePeople(listener: (people: PersonLike[]) => void) {
        this.peopleListener = listener;
        return () => (this.peopleListener = undefined);
    }
    fire(event: string, payload?: unknown) {
        this.listeners.get(event)?.forEach(l => l(payload));
    }
    people(people: PersonLike[]) {
        this.peopleListener?.(people);
    }
    get listenerCount() {
        return [...this.listeners.values()].reduce((n, s) => n + s.size, 0) + (this.peopleListener ? 1 : 0);
    }
}

function setup() {
    const host = new FakeHost();
    const feed = createArenaFeed(host);
    const rosters: ArenaRoster[] = [];
    const actions: ArenaAction[] = [];
    feed.onRoster(r => rosters.push(r));
    feed.onAction(a => actions.push(a));
    host.objectsHere = [
        { num: ME, desc: 'Kranik', hp: 6, attack_num: ORK, __category: 'player' },
        { num: ORK, desc: 'zielonoskory ork', hp: 3, attack_num: ME, __category: 'rest' },
        { num: 9, desc: 'stary kupiec', hp: 6, attack_num: false, __category: 'rest-noncombat' },
    ];
    host.fire('parsedObjects');
    return { host, feed, rosters, actions };
}

describe('arena feed', () => {
    test('publishes the roster once per change, fighters only', () => {
        const { host, feed, rosters } = setup();
        host.fire('parsedObjects');
        expect(rosters).toHaveLength(1);
        expect(rosters[0]!.fighters.map(f => [f.num, f.side, f.target])).toEqual([[ME, 'me', ORK], [ORK, 'enemy', ME]]);
        expect(feed.roster()).toBe(rosters[0]);
    });

    test('attributes combat lines and kills', () => {
        const { host, actions } = setup();
        host.fire('combat.gag', { type: 'moje_ciosy', prefix: '6/6', text: 'Masakrujesz zielonoskorego orka.' });
        host.fire('enemyKilled', { objNum: ORK, killer: 'ME' });
        expect(actions).toEqual([
            expect.objectContaining({ kind: 'hit', attacker: ME, defender: ORK, power: 6 }),
            expect.objectContaining({ kind: 'kill', defender: ORK }),
        ]);
    });

    test('stuns land on the player or on whoever the line names', () => {
        const { host, actions } = setup();
        host.fire('stunStart');
        host.fire('enemy.paralyzed', { name: 'zielonoskorego orka' });
        host.fire('enemy.paralyzed.end', { name: '' });
        host.fire('stunEnd');
        expect(actions).toEqual([
            expect.objectContaining({ kind: 'stun', defender: ME }),
            expect.objectContaining({ kind: 'stun', defender: ORK }),
            expect.objectContaining({ kind: 'stunEnd', defender: ME }),
        ]);
    });

    test('an established cover becomes a cover beat', () => {
        const { host, actions } = setup();
        host.fire('cover.event', { kind: 'established', covererId: ME, coveredId: LIRAEL, attackerId: ORK, raw: 'Zaslaniasz Lirael.' });
        host.fire('cover.event', { kind: 'failed', covererId: ME, coveredId: LIRAEL, raw: '' });
        expect(actions).toEqual([expect.objectContaining({ kind: 'cover', attacker: ME, defender: LIRAEL, against: ORK })]);
    });

    test('races come from GMCP for the player and the people database for others', () => {
        const { host, rosters } = setup();
        host.fire('gmcp.char.info', { name: 'Kranik', race: 'gnom' });
        expect(rosters.at(-1)!.fighters.map(f => f.race)).toEqual(['gnom', undefined]);

        host.objectsHere.push({ num: LIRAEL, desc: 'Lirael', hp: 6, attack_num: ORK, __category: 'team' });
        host.people([{ name: 'Lirael', description: 'smukla jasnowlosa elfka' }]);
        expect(rosters.at(-1)!.fighters.find(f => f.num === LIRAEL)?.race).toBe('elfka');
    });

    test('installed mid-session: starts from the field and the race the client already has', () => {
        const host = new FakeHost();
        host.info = { race: 'krasnolud' };
        host.objectsHere = [
            { num: ME, desc: 'Kranik', hp: 6, attack_num: ORK, __category: 'player' },
            { num: ORK, desc: 'zielonoskory ork', hp: 3, attack_num: ME, __category: 'rest' },
        ];
        const feed = createArenaFeed(host);
        expect(feed.roster().fighters.map(f => [f.num, f.race])).toEqual([[ME, 'krasnolud'], [ORK, undefined]]);

        const actions: ArenaAction[] = [];
        feed.onAction(a => actions.push(a));
        host.fire('combat.gag', { type: 'moje_ciosy', prefix: '3/6', text: 'Ranisz zielonoskorego orka.' });
        expect(actions).toEqual([expect.objectContaining({ attacker: ME, defender: ORK })]);
    });

    test('a disconnect empties the field', () => {
        const { host, rosters } = setup();
        host.fire('client.disconnect');
        expect(rosters.at(-1)).toEqual({ fighters: [] });
    });

    test('destroy lets go of every client event', () => {
        const { host, feed } = setup();
        feed.destroy();
        expect(host.listenerCount).toBe(0);
    });
});
