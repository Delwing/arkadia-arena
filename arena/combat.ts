import { foldText, fuzzyMatchScore } from '../shared/text';

/**
 * The fight as the Arena sees it, from data the client already has:
 *
 * - the roster - who stands on the field (player, team, fighting mobs), their
 *   GMCP hp (0-6) and whom each attacks (`attack_num`);
 * - actions - one fight beat each: a hit with its x/6 power, a parry, a dodge,
 *   a cover or a kill, with attacker and defender resolved to object ids where
 *   the line and the roster allow it.
 *
 * Hit lines carry no ids. The client's combat gags already sort each line into
 * a category (`combat.gag`); here the names in the line are matched against the
 * roster and the pair is settled on GMCP targets, since a fighter normally hits
 * whoever it attacks. Everything in this module is pure.
 */

export type ArenaSide = 'me' | 'team' | 'enemy';

export interface ArenaFighter {
    num: number;
    desc: string;
    /**
     * The player's GMCP `Char.Info.race`; for others the race noun from the
     * people database (by name) or, for teammates, from their description.
     */
    race?: string;
    /** GMCP hp level, 0-6. */
    hp?: number;
    side: ArenaSide;
    /** Object id this fighter attacks. */
    target?: number;
}

export interface ArenaRoster {
    playerNum?: number;
    fighters: ArenaFighter[];
}

/** `stun`/`stunEnd` - ogluszenie: the defender is out of the fight for a while. */
export type ArenaActionKind = 'hit' | 'spec' | 'parry' | 'dodge' | 'cover' | 'kill' | 'stun' | 'stunEnd';

export interface ArenaAction {
    kind: ArenaActionKind;
    attacker?: number;
    defender?: number;
    /** Hit strength scaled to 1-6 - drives the effects, never shown. */
    power?: number;
    /** The strength as the game counts it ("4/7"), for display. */
    fraction?: string;
    /** A special's own name from its prefix ("MLOT SPEC", "JATAGAN OGL"). */
    label?: string;
    /** The killing-blow prefix instead of x/y. */
    finisher?: boolean;
    /** Parry only - what took the blow. */
    guard?: 'bron' | 'zbroja' | 'tarcza';
    /** Cover only - whom the defender is covered against. */
    against?: number;
    /** The game line, '' when the beat came from GMCP. */
    text: string;
}

/** The client's `combat.gag` payload. */
export interface CombatGag {
    type: string;
    prefix: string;
    text: string;
    /** The prefix is the player's killing-blow prefix. Clients before it was added leave it out. */
    finisher?: boolean;
}

const HIT_TYPES = new Set(['moje_ciosy', 'innych_ciosy', 'innych_ciosy_we_mnie', 'npc']);
const SPEC_TYPES = new Set(['moje_spece', 'innych_spece', 'npc_spece']);
const DODGE_TYPES = new Set(['moje_uniki', 'innych_uniki']);
const PARRY_TYPES = new Set(['moje_parowanie', 'innych_parowanie']);

const PRONOUNS = new Set(['cie', 'ciebie', 'ci', 'tobie', 'toba', 'twoj', 'twoja', 'twoje', 'twojego', 'twojej', 'twoim', 'twa', 'twe', 'twego', 'twej', 'twym']);
const MIN_MENTION_SCORE = 0.55;

const words = (s: string): string[] => foldText(s).split(/[^a-z0-9]+/).filter(Boolean);

interface Mention {
    fighter: ArenaFighter;
    index: number;
    score: number;
}

/**
 * Fighters named in a line, in the order they appear. Each desc is slid over the
 * line word by word; Polish declension rewrites endings but keeps the first
 * letter, so a pair of words whose first letters differ scores zero.
 * Second-person pronouns stand for the player.
 */
export function findMentions(text: string, fighters: ArenaFighter[]): ArenaFighter[] {
    const tw = words(text);
    const found: Mention[] = [];
    for (const fighter of fighters) {
        if (fighter.side === 'me') {
            const index = tw.findIndex(w => PRONOUNS.has(w));
            if (index >= 0) found.push({fighter, index, score: 1});
            continue;
        }
        const dw = words(fighter.desc);
        if (dw.length === 0 || dw.length > tw.length) continue;
        let best: Mention | null = null;
        for (let i = 0; i + dw.length <= tw.length; i++) {
            let total = 0;
            for (let k = 0; k < dw.length; k++) {
                const a = dw[k], b = tw[i + k];
                total += a[0] === b[0] ? fuzzyMatchScore(a, b) : 0;
            }
            const score = total / dw.length;
            if (score >= MIN_MENTION_SCORE && (!best || score > best.score)) {
                best = {fighter, index: i, score};
            }
        }
        if (best) found.push(best);
    }
    found.sort((a, b) => a.index - b.index || b.score - a.score);
    return found.map(m => m.fighter);
}

const FRACTION = /(\d+)\s*\/\s*(\d+)/;

/** "3/6" -> 3, "4/7" -> 3; a prefix without numbers (the killing blow) -> null. */
export function parsePower(prefix: string): number | null {
    const m = prefix.match(FRACTION);
    if (!m) return null;
    const value = parseInt(m[1], 10), max = parseInt(m[2], 10);
    if (!max) return null;
    return Math.max(1, Math.min(6, Math.round(value / max * 6)));
}

function guardOf(prefix: string): ArenaAction['guard'] {
    const p = prefix.trim().toLowerCase();
    if (p.startsWith('zbr')) return 'zbroja';
    if (p.startsWith('tar') || p.includes('tarcza')) return 'tarcza';
    return 'bron';
}

/**
 * The mentioned pair where one attacks the other, as [attacker, defender]. Two
 * fighters trading blows attack each other, so the sentence decides the roles:
 * `attackerFirst` takes the earliest mention as the attacker, otherwise as the
 * defender ("X unika ciosu Y").
 */
function linkedPair(mentions: ArenaFighter[], attackerFirst: boolean): [ArenaFighter, ArenaFighter] | null {
    for (const first of mentions) {
        for (const second of mentions) {
            if (first === second) continue;
            if (attackerFirst && first.target === second.num) return [first, second];
            if (!attackerFirst && second.target === first.num) return [second, first];
        }
    }
    return null;
}

/** Dodges phrased from the attacker's side: "X nie trafia Y", "X chybia". */
const MISS_PHRASING = /\bnie trafia|\bchybia|\bmija\b/;

/**
 * Settles one classified combat line onto roster ids. Returns null when the
 * category is not a fight beat or nobody on the field can be the defender.
 */
export function attributeGag(gag: CombatGag, roster: ArenaRoster): ArenaAction | null {
    const {type, prefix, text} = gag;
    const isHit = HIT_TYPES.has(type), isSpec = SPEC_TYPES.has(type);
    const isDodge = DODGE_TYPES.has(type), isParry = PARRY_TYPES.has(type);
    if (!isHit && !isSpec && !isDodge && !isParry) return null;

    const byNum = new Map(roster.fighters.map(f => [f.num, f]));
    const me = roster.fighters.find(f => f.side === 'me');
    const mentions = findMentions(text, roster.fighters);
    const others = mentions.filter(f => f !== me);
    const attackersOf = (num: number) => roster.fighters.filter(f => f.target === num);
    const attackerOf = (num: number) =>
        others.find(f => f.target === num) ?? others[0] ?? attackersOf(num)[0];

    let attacker: ArenaFighter | undefined;
    let defender: ArenaFighter | undefined;

    const mine = type.startsWith('moje_');
    if (mine && (isHit || isSpec)) {
        attacker = me;
        defender = (me?.target !== undefined ? byNum.get(me.target) : undefined) ?? others[0];
    } else if (mine || type === 'innych_ciosy_we_mnie') {
        // My dodges and parries, and blows that land on me.
        defender = me;
        attacker = me ? attackerOf(me.num) : others[0];
    } else {
        const attackerFirst = isHit || isSpec || MISS_PHRASING.test(foldText(text));
        const pair = linkedPair(mentions, attackerFirst);
        if (pair) {
            [attacker, defender] = pair;
        } else if (attackerFirst) {
            attacker = mentions[0];
            defender = mentions[1] ?? (attacker?.target !== undefined ? byNum.get(attacker.target) : undefined);
        } else {
            defender = mentions[0];
            attacker = mentions[1] ?? (defender ? attackersOf(defender.num)[0] : undefined);
        }
    }

    if (!defender) return null;
    const action: ArenaAction = {
        kind: isHit ? 'hit' : isSpec ? 'spec' : isDodge ? 'dodge' : 'parry',
        attacker: attacker && attacker !== defender ? attacker.num : undefined,
        defender: defender.num,
        text,
    };
    if (isHit || isSpec) {
        const power = parsePower(prefix);
        const word = prefix.trim();
        if (power !== null) {
            action.power = power;
            action.fraction = prefix.match(FRACTION)![0].replace(/\s+/g, '');
            // "MLOT SPEC 4/7" - the name in front of the strength.
            const name = prefix.replace(FRACTION, '').trim();
            if (name) action.label = name;
        } else if (gag.finisher ?? word === 'FIN') {
            action.power = 6;
            action.finisher = true;
        } else {
            // A named special without a strength: strong, and worth its own label.
            action.power = 4;
            if (word) action.label = word;
        }
    }
    if (isParry) action.guard = guardOf(prefix);
    return action;
}

// Race nouns as they end a character's short description, every gendered form.
const RACE_WORDS = new Set([
    'elf', 'elfka', 'polelf', 'polelfka', 'krasnolud', 'krasnoludka', 'niziolek', 'niziolka',
    'gnom', 'gnomka', 'ogr', 'ogrzyca', 'czlowiek', 'mezczyzna', 'kobieta',
]);

/**
 * The race noun in a short description - "niski brodaty krasnolud" ->
 * "krasnolud". Whole words only, last one wins, so "ogromny" is not an ogre.
 */
export function raceWordOf(description: string): string | undefined {
    const found = words(description).filter(w => RACE_WORDS.has(w));
    return found[found.length - 1];
}

/** A lone capitalised word in GMCP desc is a name the player has been introduced to. */
const isName = (desc: string) => /^\S+$/.test(desc.trim()) && desc.trim()[0] !== desc.trim()[0].toLowerCase();

/**
 * Race for a fighter other than the player, who gets theirs from GMCP.
 * - a known name: the race in that character's description in the people database;
 * - the team, unintroduced: the race in the description GMCP shows instead of a name.
 * Enemies are left to the sprite picker in that case: "krasnolud chaosu" is a
 * monster first and a dwarf second.
 */
export function fighterRace(desc: string, side: ArenaSide, descriptionsByName: Map<string, string>): string | undefined {
    if (isName(desc)) {
        const description = descriptionsByName.get(desc.trim().toLowerCase());
        return description ? raceWordOf(description) : undefined;
    }
    return side === 'team' ? raceWordOf(desc) : undefined;
}

