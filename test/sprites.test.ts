import { GRIDS, pickLook, raceOf } from '../arena/sprites';

describe('arena sprites', () => {
    test.each([
        ['elf', 'elf'],
        ['Elfka', 'elf'],
        ['półelf', 'halfElf'],
        ['polelf', 'halfElf'],
        ['krasnolud', 'dwarf'],
        ['Krasnoludka', 'dwarf'],
        ['niziołek', 'halfling'],
        ['niziolka', 'halfling'],
        ['gnom', 'gnome'],
        ['ogr', 'ogre'],
        ['człowiek', 'human'],
    ])('reads GMCP race %s as %s', (race, expected) => {
        expect(raceOf(race)).toBe(expected);
    });

    test('unknown or missing race falls back to a look picked from the name', () => {
        expect(raceOf(undefined)).toBeNull();
        expect(raceOf('jaszczuroczlek')).toBeNull();
        expect(pickLook('Kranik', 'me', 'jaszczuroczlek').grid).toBe(pickLook('Kranik', 'me').grid);
    });

    test.each([
        ['gnom', GRIDS.gnome],
        ['niziolek', GRIDS.halfling],
        ['polelf', GRIDS.halfElf],
        ['elf', GRIDS.elf],
        ['krasnolud', GRIDS.dwarf],
        ['ogr', GRIDS.ogre],
    ])('the player of race %s gets that body', (race, grid) => {
        expect(pickLook('Kranik', 'me', race).grid).toBe(grid);
    });

    test('a gnome is not green', () => {
        const look = pickLook('Kranik', 'me', 'gnom');
        expect(look.palette.s).not.toBe(pickLook('zielonoskory ork', 'enemy').palette.g);
        expect(look.grid.join('')).not.toMatch(/g/);
    });

    test('a teammate with a known race gets that body', () => {
        expect(pickLook('Lirael', 'team', 'elfka').grid).toBe(GRIDS.elf);
        expect(pickLook('Borin', 'team', 'krasnoludka').grid).toBe(GRIDS.dwarf);
        expect(pickLook('Ola', 'team', 'kobieta').grid).not.toBe(GRIDS.dwarf);
    });

    test("a named enemy player's race beats the monster rules", () => {
        expect(pickLook('Trollek', 'enemy', 'gnom').grid).toBe(GRIDS.gnome);
    });

    test('an unintroduced enemy player is drawn by the race in the description', () => {
        expect(pickLook('wysoki jasnowlosy elf', 'enemy').grid).toBe(GRIDS.elf);
        expect(pickLook('niska pulchna niziolka', 'enemy').grid).toBe(GRIDS.halfling);
        // ...but a monster rule still wins over a race word.
        expect(pickLook('gburowaty krasnolud chaosu', 'enemy').grid).toBe(GRIDS.chaosDwarf);
    });

    test.each([
        ['brunatny niedźwiedź', GRIDS.bear, 3],
        ['stara niedźwiedzica', GRIDS.bear, 3],
        ['mały niedźwiadek', GRIDS.bear, 2],
        ['maly niedziwiadek', GRIDS.bear, 2],
        ['troll jaskiniowy', GRIDS.troll, 3],
        ['krasnolud chaosu', GRIDS.chaosDwarf, 2],
        ['brodaty krasnolud', GRIDS.dwarf, 2],
        ['potężny bykocentaur', GRIDS.bullCentaur, 3],
        ['zielonoskóry ork', GRIDS.orc, 2],
        ['tępy ogr', GRIDS.ogre, 2],
        ['ogromny olbrzym', GRIDS.giant, 3],
        ['stary ogrodnik', GRIDS.ranger, 2],
        ['wysoki gwardzista', GRIDS.guard, 2],
        ['krępy żołnierz', GRIDS.soldier, 2],
        ['wąsaty oficer', GRIDS.officer, 2],
        ['otyły szlachcic', GRIDS.noble, 2],
        ['młody lansjer', GRIDS.lancer, 2],
        ['rogaty zwierzoczłek', GRIDS.beastman, 2],
        ['ohydny krasnozwierz', GRIDS.chaosSpawn, 3],
        ['blada wietrzyca', GRIDS.windSpirit, 2],
        ['skrzeczaca harpia', GRIDS.harpy, 2],
        ['zielonoluski reptilion', GRIDS.reptilion, 2],
        ['rogata bestia', GRIDS.monster, 2],
        ['posępny okrutny rycerz chaosu', GRIDS.chaosKnight, 2],
        ['zakapturzony kultysta', GRIDS.cultist, 2],
        ['bestialski ork', GRIDS.orc, 2],
        ['kamienny golem', GRIDS.golem, 2],
        ['mały snotling', GRIDS.snotling, 2],
        ['parszywy skaven', GRIDS.skaven, 2],
        ['ogromny szczurogr', GRIDS.ratOgre, 2],
        ['niski grzyboczłek', GRIDS.mushroom, 2],
        ['oślizgły ryboczłek', GRIDS.fishman, 2],
        ['smukła driada', GRIDS.dryad, 2],
        ['potężny minotaur', GRIDS.minotaur, 2],
        ['tłusty szczur', GRIDS.rat, 2],
        ['potezny bykocentaur', GRIDS.bullCentaur, 3],
        ['stary szkielet', GRIDS.skeleton, 2],
        ['potężny licz', GRIDS.lich, 2],
        ['gnijący ożywieniec', GRIDS.zombie, 2],
        ['powolny zombie', GRIDS.zombie, 2],
        ['głodny ghul', GRIDS.ghoul, 2],
        ['blady duch', GRIDS.ghost, 2],
        ['przerażająca zjawa', GRIDS.windSpirit, 2],
        ['mroczny upiór', GRIDS.wraith, 2],
        ['zielony śluz', GRIDS.slime, 2],
        ['ognisty żywiołak ognia', GRIDS.elemental, 2],
        ['żywiołak ziemi', GRIDS.elemental, 2],
        ['żywiołak powietrza', GRIDS.elemental, 2],
        ['żywiołak wody', GRIDS.elemental, 2],
        ['brudny troglodyta', GRIDS.troglodyte, 2],
        ['jednooki fimir', GRIDS.fimir, 2],
        ['wściekły wilkołak', GRIDS.werewolf, 2],
        ['szary wilk', GRIDS.beast, 2],
        ['czerwony smok', GRIDS.dragon, 3],
        ['młody smok', GRIDS.dragon, 3],
        ['jadowita wiwerna', GRIDS.wyvern, 2],
        ['czarnopióry vran', GRIDS.vran, 2],
        ['złośliwy redcap', GRIDS.redcap, 2],
        ['brzydki kilmulis', GRIDS.kilmulis, 2],
        ['kudłaty korred', GRIDS.korred, 2],
        ['mały kobold', GRIDS.kobold, 2],
        ['chudy chobold', GRIDS.kobold, 2],
        ['parszywy szczurołak', GRIDS.skaven, 2],
        ['tłusty szczur', GRIDS.rat, 2],
        ['stary wicht', GRIDS.wight, 2],
        ['oślizgły utopiec', GRIDS.drowner, 2],
        ['czerwony squig', GRIDS.squig, 2],
        ['zwinny arlekin', GRIDS.harlequin, 2],
        ['brodaty pukacz', GRIDS.knocker, 2],
        ['jadowity pająk', GRIDS.spider, 2],
        ['olbrzymi pająk', GRIDS.spider, 3],
        ['smoczy dziedzic', GRIDS.ranger, 2],
        ['stary duchowny', GRIDS.ranger, 2],
        ['wierny służący', GRIDS.ranger, 2],
        ['liczny oddział', GRIDS.ranger, 2],
    ])('%s is drawn as the right monster', (desc, grid, scale) => {
        const look = pickLook(desc, 'enemy');
        expect(look.grid).toBe(grid);
        expect(look.scale).toBe(scale);
    });
});

describe('arena kill list', () => {
    // Nominatives of a real kill list; the vague ones (postac, humanoid)
    // stay the hooded figure on purpose.
    const killList = [
        'amfisbena', 'arlekin', 'barghest', 'bażant', 'bestia', 'bobołak', 'bocian', 'borowik', 'bulwa', 'byk', 'bykocentaur',
        'chłopiec', 'chobold', 'czapla', 'czarny ork', 'demon', 'demonica', 'driada', 'drzewiec', 'dziewczyna', 'dziewczynka',
        'dzik', 'dziki ork', 'elf', 'elfi egzekutor', 'elfka', 'fimir', 'gargulec', 'ghast', 'ghoul', 'ghul', 'gnom', 'goblin',
        'gremlin', 'grzyboczłek', 'gwardzista', 'halfling', 'harpia', 'hobgoblin', 'indyk', 'jeleń', 'jeż', 'kamienny troll',
        'karzeł', 'kawalerzysta', 'kobieta', 'kobold', 'koń', 'konstrukt', 'kościotrup', 'kot', 'koza', 'kozica', 'kozioł',
        'krab', 'krasnolud', 'krasnolud chaosu', 'krasnoludka', 'krasnozwierz', 'królik', 'krowa', 'kultysta', 'kultystka',
        'kurczak', 'kura', 'kuropatwa', 'lansjer', 'licz', 'lis', 'lodowy troll', 'marynarz', 'mężczyzna', 'minotaur',
        'monstrum', 'mutant', 'mysz', 'niedźwiedź', 'niedźwiedzica', 'nietoperz', 'norka', 'oficer', 'ogr', 'ork',
        'owca', 'ożywieniec', 'pająk', 'pajęczak', 'pajęczyca', 'pikinier', 'pluskwa', 'zbroja płytowa', 'półelf',
        'pomiot chaosu', 'potępieniec', 'potwór', 'pies', 'ptak', 'pukacz', 'redcap', 'reptilion', 'robak', 'rusałka',
        'ryboczłek', 'rycerz', 'rycerz chaosu', 'sarna', 'skaven', 'śluz', 'smoczy ogr', 'smok chaosu', 'snotling', 'squig',
        'starzec', 'stonoga', 'strażnik', 'stwór', 'stworek', 'szczur', 'szczurołak', 'szczuroogr', 'szkielet', 'szlachcianka',
        'szlachcic', 'tancerz wojny', 'tarczownik', 'topielec', 'topielica', 'troglodyta', 'troll', 'troll jaskiniowy',
        'trollica', 'upiór', 'utopiec', 'vran', 'weteran', 'wąż', 'wicht', 'widmo', 'wierzchowiec', 'wieśniaczka', 'wietrzyca',
        'wilczyca', 'wilk', 'wojowniczka', 'wywerna', 'żaba', 'zając', 'zjawa', 'zjawa kobiety', 'zjawa strażnika', 'zmora',
        'żołnierz', 'zombie', 'żuraw', 'zwierzoczłek', 'żywiołak ognia', 'żywiołak powietrza', 'żywiołak wody', 'żywiołak ziemi',
    ];

    test.each(killList)('%s is not the hooded fallback', name => {
        expect(pickLook(`groźny ${name}`, 'enemy').grid).not.toBe(GRIDS.ranger);
    });

    test.each([
        ['szczuroogr', GRIDS.ratOgre],
        ['bocian', GRIDS.heron],
        ['jeleń', GRIDS.stag],
        ['strażnik', GRIDS.guard],
        ['zjawa strażnika', GRIDS.windSpirit],
        ['zjawa kobiety', GRIDS.windSpirit],
        ['dziewczynka', GRIDS.child],
        ['wieśniaczka', GRIDS.woman],
        ['drzewiec', GRIDS.treant],
        ['gargulec', GRIDS.gargoyle],
        ['demonica', GRIDS.demon],
        ['królik', GRIDS.rabbit],
        ['szary zając', GRIDS.hare],
        ['mała mysz', GRIDS.mouse],
        ['jadowita stonoga', GRIDS.centipede],
        ['czerwony krab', GRIDS.crab],
        ['przerażająca bestia', GRIDS.monster],
    ])('%s gets its own body', (name, grid) => {
        expect(pickLook(name, 'enemy').grid).toBe(grid);
    });

    test.each([
        'jeździec', 'zabójca', 'potworny rozbójnik', 'demoniczny bandyta', 'konny rozbójnik', 'kurtyzana',
    ])('%s is not mistaken for a beast', desc => {
        expect(pickLook(desc, 'enemy').grid).toBe(GRIDS.ranger);
    });
});

test('someone killed in the dark is a shadow with eyes', () => {
    const look = pickLook('ktoś', 'enemy');
    expect(look.palette.e).not.toBe(look.palette.c);
    expect(look.palette.c).toBe(look.palette.s);
    expect(pickLook('ktoś w czerni', 'enemy').palette.c).not.toBe(look.palette.c);
});
