import { attributeGag, fighterRace, findMentions, parsePower, raceWordOf, type ArenaRoster } from '../arena/combat';

describe('races', () => {
    test('reads the race noun from a short description, in any gender', () => {
        expect(raceWordOf('niski brodaty krasnolud')).toBe('krasnolud');
        expect(raceWordOf('smukla jasnowlosa elfka')).toBe('elfka');
        expect(raceWordOf('niska pulchna niziołka')).toBe('niziolka');
        expect(raceWordOf('wysoki postawny mężczyzna')).toBe('mezczyzna');
        expect(raceWordOf('ogromny troll jaskiniowy')).toBeUndefined();
    });

    test('names resolve through the people database, descriptions only for the team', () => {
        const db = new Map([['lirael', 'smukla jasnowlosa elfka']]);
        expect(fighterRace('Lirael', 'team', db)).toBe('elfka');
        expect(fighterRace('Lirael', 'enemy', db)).toBe('elfka');
        expect(fighterRace('Nieznany', 'team', db)).toBeUndefined();
        expect(fighterRace('niski brodaty krasnolud', 'team', db)).toBe('krasnolud');
        expect(fighterRace('gburowaty krasnolud chaosu', 'enemy', db)).toBeUndefined();
    });
});

const ME = 1, LIRAEL = 2, ORK = 3, WILK = 4, ORK2 = 5;

function roster(overrides: Partial<Record<number, { target?: number }>> = {}): ArenaRoster {
    const base: ArenaRoster = {
        playerNum: ME,
        fighters: [
            { num: ME, desc: 'Kranik', side: 'me', hp: 6, target: ORK },
            { num: LIRAEL, desc: 'Lirael', side: 'team', hp: 5, target: WILK },
            { num: ORK, desc: 'zielonoskory ork', side: 'enemy', hp: 4, target: ME },
            { num: WILK, desc: 'szary wilk', side: 'enemy', hp: 6, target: LIRAEL },
        ],
    };
    base.fighters.forEach(f => Object.assign(f, overrides[f.num] ?? {}));
    return base;
}

describe('attribution', () => {
    test('parsePower scales any x/y onto 1-6', () => {
        expect(parsePower('3/6')).toBe(3);
        expect(parsePower('4/7')).toBe(3);
        expect(parsePower('spec 7/7')).toBe(6);
        expect(parsePower('FIN')).toBeNull();
    });

    test('finds declined names in the order they appear', () => {
        const r = roster();
        const found = findMentions('Szary wilk lekko rani Lirael w lewe ramie.', r.fighters);
        expect(found.map(f => f.num)).toEqual([WILK, LIRAEL]);
        const declined = findMentions('Lirael rani zielonoskorego orka, trafiajac go w korpus.', r.fighters);
        expect(declined.map(f => f.num)).toEqual([LIRAEL, ORK]);
    });

    test('second-person pronouns stand for the player', () => {
        const found = findMentions('Zielonoskory ork rani cie w glowe.', roster().fighters);
        expect(found.map(f => f.num)).toEqual([ORK, ME]);
    });

    test('my hits land on my GMCP target', () => {
        const action = attributeGag({ type: 'moje_ciosy', prefix: '5/6', text: 'Bardzo ciezko ranisz zielonoskorego orka.' }, roster());
        expect(action).toMatchObject({ kind: 'hit', attacker: ME, defender: ORK, power: 5 });
    });

    test('blows on me come from whoever is named and attacks me', () => {
        const r = roster({ [WILK]: { target: ME } });
        const action = attributeGag({ type: 'innych_ciosy_we_mnie', prefix: '2/6', text: 'Szary wilk lekko rani cie w nogi.' }, r);
        expect(action).toMatchObject({ kind: 'hit', attacker: WILK, defender: ME, power: 2 });
    });

    test('others hitting each other resolve to the attacking pair', () => {
        const action = attributeGag({ type: 'innych_ciosy', prefix: '3/6', text: 'Lirael rani szarego wilka w korpus.' }, roster());
        expect(action).toMatchObject({ attacker: LIRAEL, defender: WILK });
    });

    test('identical descs are told apart by who attacks whom', () => {
        const r = roster();
        r.fighters.push({ num: ORK2, desc: 'zielonoskory ork', side: 'enemy', hp: 6, target: LIRAEL });
        const action = attributeGag({ type: 'innych_ciosy', prefix: '4/6', text: 'Zielonoskory ork powaznie rani Lirael.' }, r);
        expect(action).toMatchObject({ attacker: ORK2, defender: LIRAEL, power: 4 });
    });

    test('in a mutual fight the dodger is the one named first', () => {
        const action = attributeGag({ type: 'innych_uniki', prefix: 'unk', text: 'Szary wilk uchyla sie przed ciosem Lirael.' }, roster());
        expect(action).toMatchObject({ kind: 'dodge', defender: WILK, attacker: LIRAEL });
    });

    test('a miss phrased from the attacker names the attacker first', () => {
        const action = attributeGag({ type: 'innych_uniki', prefix: 'unk', text: 'Szary wilk nie trafia Lirael.' }, roster());
        expect(action).toMatchObject({ kind: 'dodge', attacker: WILK, defender: LIRAEL });
    });

    test('a dodge with no GMCP link still names the dodger first', () => {
        const r = roster({ [LIRAEL]: { target: undefined }, [WILK]: { target: undefined } });
        const action = attributeGag({ type: 'innych_uniki', prefix: 'unk', text: 'Szary wilk uchyla sie przed ciosem Lirael.' }, r);
        expect(action).toMatchObject({ kind: 'dodge', defender: WILK, attacker: LIRAEL });
    });

    test('my parry records what took the blow', () => {
        const action = attributeGag({ type: 'moje_parowanie', prefix: 'tar', text: 'Zaslaniasz sie tarcza przed ciosem zielonoskorego orka.' }, roster());
        expect(action).toMatchObject({ kind: 'parry', defender: ME, attacker: ORK, guard: 'tarcza' });
    });

    test('a spec keeps the strength the game gave it', () => {
        const action = attributeGag({ type: 'moje_spece', prefix: '4/7', text: 'Bardzo ciezko ranisz zielonoskorego orka.' }, roster());
        expect(action).toMatchObject({ kind: 'spec', attacker: ME, defender: ORK, power: 3, fraction: '4/7' });
        expect(action?.label).toBeUndefined();
    });

    test('a named spec keeps its name apart from the strength', () => {
        const action = attributeGag({ type: 'moje_spece', prefix: 'MLOT SPEC 5 / 7', text: 'Miazdzysz zielonoskorego orka.' }, roster());
        expect(action).toMatchObject({ label: 'MLOT SPEC', fraction: '5/7', power: 4 });
    });

    test('a plain hit shows its own x/y too', () => {
        const action = attributeGag({ type: 'moje_ciosy', prefix: '3/6', text: 'Ranisz zielonoskorego orka.' }, roster());
        expect(action).toMatchObject({ fraction: '3/6', power: 3 });
    });

    test('the client marks the killing blow, whatever its prefix', () => {
        const action = attributeGag({ type: 'moje_ciosy', prefix: 'DOBIJASZ', text: 'Rozplatasz zielonoskorego orka.', finisher: true }, roster());
        expect(action).toMatchObject({ power: 6, finisher: true });
    });

    test('a client that does not mark it still has FIN taken as the killing blow', () => {
        const action = attributeGag({ type: 'moje_ciosy', prefix: 'FIN', text: 'Rozplatasz zielonoskorego orka.' }, roster());
        expect(action).toMatchObject({ power: 6, finisher: true });
    });

    test('a named special is strong and labelled, not a killing blow', () => {
        const r = roster({ [LIRAEL]: { target: ORK } });
        const action = attributeGag({ type: 'npc_spece', prefix: 'OGLUCH', text: 'Lirael silnym ciosem tarczy oglusza zielonoskorego orka.' }, r);
        expect(action).toMatchObject({ kind: 'spec', attacker: LIRAEL, defender: ORK, power: 4, label: 'OGLUCH' });
        expect(action?.finisher).toBeUndefined();
    });

    test('a prefix the client says is no finisher stays a special, even FIN', () => {
        const action = attributeGag({ type: 'moje_ciosy', prefix: 'FIN', text: 'Rozplatasz zielonoskorego orka.', finisher: false }, roster());
        expect(action?.finisher).toBeUndefined();
        expect(action).toMatchObject({ power: 4, label: 'FIN' });
    });

    test('non-fight categories are ignored', () => {
        expect(attributeGag({ type: 'bron', prefix: '', text: 'Ork wytraca ci miecz.' }, roster())).toBeNull();
    });
});

