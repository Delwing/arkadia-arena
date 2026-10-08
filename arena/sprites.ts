import { foldText } from '../shared/text';
import { raceWordOf } from './combat';

/**
 * Pixel sprites for the arena, drawn from tiny character grids (one letter per
 * pixel, '.' transparent) so no image assets are needed. Every grid faces right;
 * the scene mirrors it for fighters facing left.
 */

export type Grid = string[];
export type Palette = Record<string, string>;

export type WeaponId = 'axe' | 'sword' | 'dagger' | 'club' | 'hammer' | 'staff' | 'halberd' | 'sabre' | 'lance' | 'trident' | 'pick';
export type Pose = 'rest' | 'strike';

export interface SpriteLook {
    grid: Grid;
    palette: Palette;
    /** Screen pixels per grid pixel. */
    scale: number;
    weapon?: WeaponId;
    /** Moves the weapon's grip for bodies whose hands are not where a man's are. */
    weaponShift?: { col: number; row: number };
    /** Flyers float this many pixels above their shadow, bobbing. */
    hover?: number;
    /** Spirits are drawn see-through. */
    alpha?: number;
}

const BASE: Palette = {
    k: '#1a1222', s: '#f0b98d', S: '#c98a62', e: '#1a1222', E: '#ff4040', h: '#d9772b',
    m: '#cfd8e3', M: '#7d8a9c', r: '#b8333a', R: '#7e1f2a', y: '#f2c94c', n: '#7a4a2a', N: '#4e2d18',
    c: '#3f8f5a', C: '#25603a', p: '#7d4bc2', P: '#52307f', w: '#f4f1ff', g: '#79b04a',
    G: '#4c7a2c', f: '#8d8f99', F: '#5b5d68', b: '#e8e4d0', B: '#a8a28c', o: '#ff9b3d', O: '#fff1a8',
};

function norm(rows: string[]): Grid {
    const width = Math.max(...rows.map(r => r.length));
    return rows.map(r => r.padEnd(width, '.'));
}

export function rotateCW(grid: Grid): Grid {
    const h = grid.length, w = grid[0].length, out: Grid = [];
    for (let r = 0; r < w; r++) {
        let row = '';
        for (let c = 0; c < h; c++) row += grid[h - 1 - c][r];
        out.push(row);
    }
    return out;
}

export const GRIDS = {
    // --- adventurers -------------------------------------------------------
    dwarf: norm([
        '...MmmmM....', '..MmmmmmM...', '..MMMMMMMk..', '..hssssses..', '..hsssssss..', '..hhhhhhhhh.',
        '..hhhhhhhh..', '...hhhhhh...', '.mmrrrrrrmm.', '.SmrrrrrrmS.', '.S.rryyrr.S.', '...rrrrrr...',
        '...NNNNNN...', '...nn..nn...', '...MM..MM...', '..MMM..MMMM.']),
    elf: norm([
        '....hhhh....', '...hhhhhh...', '.s.hhsssss..', '..shsssses..', '...hssssss..', '...hhssss...',
        '...hh.ss....', '..hhcccccc..', '.Shcccccccs.', '.S.ccyycc.s.', '...cccccc...', '...CCCCCC...',
        '...nn..nn...', '...nn..nn...', '...nn..nn...', '...NN..NN...', '..NNN..NNN..']),
    halfElf: norm([
        '....hhhh....', '...hhhhhh...', '..shhssssh..', '...hsssses..', '...hssssss..', '....ssss....',
        '..CnnnnnnC..', '.CCnnyynnCS.', '.SCnnnnnnC..', '..CnnnnnnC..', '...MMMMMM...', '...cc..cc...',
        '...cc..cc...', '...cc..cc...', '...NN..NN...', '..NNN..NNN..']),
    halfling: norm([
        '...hhhhh....', '..hhhhhhh...', '..hhsssss...', '..hssssess..', '..hhsssss...', '...ssSss....',
        '..rrnnnrr...', '.srrnynrrs..', '...rrnrr....', '...nnnnn....', '...nn.nn....', '..sss.sss...']),
    gnome: norm([
        '....r.......', '....rr......', '...rrr......', '...rrrr.....', '..rrrrrr....', '.rrrrrrrr...',
        '..sssessS...', '..wwwwwww...', '..wwwwwww...', '.ScccwwccS..', '...cccccc...', '...nn..nn...',
        '..NNN.NNN...']),
    // A head taller and broader than a man at the same scale - big, but it
    // leaves room for the rest of a crowded field.
    ogre: norm([
        '....ssssss....', '...ssssssss...', '...sssssesss..', '...ssssssssS..', '...sswsswsss..', '....SSSSsss...',
        '..ssssssssss..', '.ssssssssssss.', 'sssSssssssSsss', 'ss.ssssssss.ss', 'ss.sssSSsss.ss', 'ss.sSSSSSSs.ss',
        'S...nnnnnn...S', '....nnNNnn....', '....ss..ss....', '....ss..ss....', '....ss..ss....', '....ss..ss....',
        '...NNN..NNN...']),
    // Olbrzym, cyklop: the old ogre body drawn half again as large.
    giant: norm([
        '...ssssss...', '..ssssssss..', '..sssssess..', '..ssssssss..', '..sswsswss..', '...SSSSss...',
        '.ssssssssss.', 'sssSssssSsss', 'ss.ssssss.ss', 'ss.sSSSSs.ss', 'S..nnnnnn..S', '...nnNNnn...',
        '...ss..ss...', '...ss..ss...', '...ss..ss...', '..NNN..NNN..']),
    ranger: norm([
        '....CCCC....', '...CCCCCC...', '..CCCsssCC..', '..CCsssesC..', '..CCsssssC..', '..CC.sss....',
        '..CCccccc...', '.CCcccccccS.', '.S.ccyycc.S.', '...cccccc...', '...nnnnnn...', '...nn..nn...',
        '...nn..nn...', '...nn..nn...', '...NN..NN...', '..NNN..NNN..']),
    mage: norm([
        '......p.....', '.....pp.....', '....ppp.....', '...ppppp....', '.ppppppppp..', '...sssses...',
        '...wwwwwww..', '...wwwwwww..', '..ppwwwwwpp.', '.SpppwwwppS.', '.S.ppppppP..', '...pppppp...',
        '..ppppppppP.', '..pppppppPP.', '.ppppppppPPP', '..NN...NN...']),
    // --- monsters ----------------------------------------------------------
    chaosDwarf: norm([
        '.k.MmmmM.k..', '.kMmmmmmMk..', '..MMMMMMMk..', '..hssssEs...', '..hsssssss..', '..hhhhhhhhh.',
        '..hhhhhhhh..', '...hhhhhh...', '.mmrrrrrrmm.', '.SmrrrrrrmS.', '.S.rryyrr.S.', '...rrrrrr...',
        '...NNNNNN...', '...nn..nn...', '...MM..MM...', '..MMM..MMMM.']),
    orc: norm([
        '...gggggg...', '..gggggggg..', '..gggggEgg..', '..gggggggg..', '..ggggwgwg..', '...gGGGgg...',
        '.nnnnnnnnnn.', 'gnnMMMMMMnng', 'g.nMMMMMMn.g', 'g.nnnnnnnn.g', 'G..NNNNNN..G', '...nn..nn...',
        '...gg..gg...', '...gg..gg...', '..NNN..NNN..', '..NNN..NNN..']),
    troll: norm([
        '.....fffff....', '....fffffff...', '...fffffEfff..', '...ffffffffff.', '...fffffwfwf..', '..ffFFfffff...',
        '.ffffffffffff.', 'ffFfffffffFff.', 'ff.ffffffff.ff', 'ff.fFFFFFFf.ff', 'ff..nnnnnn..ff', 'Fk..nnNNnn..kF',
        '....ff..ff....', '...ffF..Fff...', '..kkkk..kkkk..']),
    bear: norm([
        '............FF.FF.', '...........FffFff.', '..FFFFFFFFFfffEff.', '.Ffffffffffffffffk', 'FfffffffffffffSSf.',
        'Fffffffffffffff...', 'FffffffffffffffF..', '.FffffffffffffF...', '..fff.....fff.....', '..fff.....fff.....',
        '.kkkk....kkkk.....']),
    bullCentaur: norm([
        '..........w....w..', '..........ww..ww..', '...........FFFF...', '..........FfffEF..', '..........Fffffff.',
        '...........fffSS..', '..........sssss...', '.........ssssssss.', '........sSssssssS.', '.........ssssss.s.',
        '..F......nnnnnn...', '.F.FfffffffffffF..', '..FfffffffffffffF.', '..Fffffffffffffff.', '..FffffffffffffF..',
        '...ff.ff....ff.ff.', '...ff.ff....ff.ff.', '...kk.kk....kk.kk.']),
    guard: norm([
        '...MMMMM....', '..MmmmmmM...', '..MmkkkkMk..', '..MmmmmmM...', '...MMMMM....', '..rrMMMMrr..',
        '.mmrryyrrmm.', '.SmrrrrrrmS.', '.S.rrrrrr.S.', '...rrrrrr...', '...MMMMMM...', '...MM..MM...',
        '...mm..mm...', '...mm..mm...', '...MM..MM...', '..MMM..MMM..']),
    soldier: norm([
        '...MMMMMM...', '..MMMMMMMM..', '...ssssss...', '...sssses...', '...ssssss...', '....ssss....',
        '..rrrrrrrr..', '.SrrrwwrrrS.', '.S.rrwwrr.S.', '...rrrrrr...', '...nnnnnn...', '...cc..cc...',
        '...cc..cc...', '...nn..nn...', '...nn..nn...', '..NNN..NNN..']),
    officer: norm([
        '.......ww...', '......ww....', '..NNNNNN....', '.NNNNNNNN...', '...ssssss...', '...sssses...',
        '...shhhhs...', '....ssss....', '.RrrryrrrR..', '.RSrryrrSR..', '.R.rryrr.R..', '.R.rrrrrr...',
        '...NNNNNN...', '...cc..cc...', '...NN..NN...', '..NNN..NNN..']),
    noble: norm([
        '.......w....', '......wy....', '...FFFFFF...', '..FFppppFF..', '...ssssss...', '...sssses...',
        '..hhsssshh..', '..h.ssss.h..', '..pppppppp..', '.SppyyyyppS.', '.S.pppppp.S.', '...pppppp...',
        '..pppppppp..', '..pppppppp..', '...yy..yy...', '..yyy..yyy..']),
    lancer: norm([
        '....rr......', '...MMMM.....', '..MMmmMM....', '..Mssses....', '..Mssssss...', '...ssss.....',
        '..mmmmmmm...', '.SmmMmmmmS..', '.S.mmmmm.S..', '...cccccc...', '...cc..cc...', '...cc..cc...',
        '...NN..NN...', '...NN..NN...', '..NNN..NNN..']),
    beastman: norm([
        '.w......w...', '.ww....ww...', '..wFFFFw....', '...FfffF....', '...ffEfff...', '...fffffSS..',
        '....fff.....', '..ffffffff..', '.fffnnnffff.', '.f.ffnnff.f.', '.f.ffffff.f.', '...ffffff...',
        '...ff..ff...', '....f...f...', '...ff..ff...', '..kk...kk...']),
    chaosSpawn: norm([
        '..w.......w...', '..ww.....ww...', '...rRRRRRr....', '..rrEErEErr...', '..rrrrrrrrr...', '..rwrwrwrwr...',
        '.rrrrrrrrrrrk.', 'rrRrrrrrrRrrkk', 'rr.rrrrrrr.rr.', 'w..rrRRRrr..w.', 'w..rrrrrrr..ww', '...prrrrrp....',
        '...rr...rr....', '..rrr...rrr...', '..ww....ww....']),
    harpy: norm([
        '......hhhh......', '.....hhhhhh.....', '....hhsssssh....', '....hhsssesh....', '.....hsssss.....',
        'FF....ssss....FF', 'fFF..FssssF..FFf', 'ffFFFfssssfFFFff', '.ffffffssffffff.', '..fff.FffF.fff..',
        '......FffF......', '......FFFF......', '......y..y......', '......y..y......', '.....yy.yy......',
        '....k.k.k.k.....']),
    windSpirit: norm([
        '....wwww....', '...wwwwww...', '..wwssssww..', '..wwssesw...', '..wwsssswww.', '...wsssw.ww.',
        '..ccssssc...', '.sccccccccs.', '.s.cccccc.s.', '...cccccc...', '....cccc....', '.....ccc....',
        '....cc.c....', '...c...cc...', '..c.....c...', '.c.......c..']),
    reptilion: norm([
        '...GGGG.....', '..GgggGG....', '..ggggEgggg.', '..gggggggwg.', '...gGGGgg...', '....ggg.....',
        '..ggyyyygg..', '.gggyyyyggg.', '.g.ggyyggg.g', '.g.gggggg..g', '...nnnnnn...', '...gg..gg...',
        'g..gg..gg...', 'gg.gg..gg...', '.gggg..gg...', '..kk...kk...']),
    monster: norm([
        '..k.k.k......w.w..', '.kFkFkF.....wFFw..', 'FFFFFFFFFFFFfffF..', 'FfffffffffffffEff.', 'FffffffffffffffwfS',
        'FffffffffffffffSS.', 'FfffffffffffffF...', '.FffffffffffffF...', '..ff.f.....ff.f...', '..ff.f.....ff.f...',
        '.kkk.k....kkk.k...']),
    chaosKnight: norm([
        '.w........w.', '.ww.MMMM.ww.', '..wMMMMMMw..', '...MkkEkM...', '...MMMMMM...', '.k.mMMMMm.k.',
        'kMMMMyyMMMMk', 'RMmMMyyMMmMm', 'R.MMMMMMMM.M', 'R.MrrrrrrM..', 'RR.MMMMMM...', 'RR.MM..MM...',
        'R..MM..MM...', '...MM..MM...', '..kMM..MMk..', '..kkk..kkkk.']),
    cultist: norm([
        '....RRRR....', '...RRRRRR...', '..RRkkkkRR..', '..RRkEkEkR..', '..RRkkkkkR..', '..RRRkkkRR..',
        '..RRRRRRRR..', '.sRRRyRRRRs.', '.s.RRRRRR.s.', '...RRRRRR...', '...RRRRRR...', '..RRRRRRRR..',
        '..RRRRRRRR..', '.RRRRRRRRRR.', '.RRRRRRRRRRR', '..kk....kk..']),
    golem: norm([
        '....MMMMMM....', '...MmmmmmmM...', '...MmmOmmOM...', '...MmmmmmmM...', '....MMMMMM....', '.MMMmmmmmmMMM.',
        'MmmmmmkmmmmmmM', 'Mmmmmmmkmmmmmm', 'MmmMmmmmmmMmmm', 'MMM.mmmmmm.MMM', 'MmM.mmmOmm.MmM', 'MMM.MmmmmM.MMM',
        '....mmmmmm....', '....mm..mm....', '...MMm..mMM...', '...MMM..MMM...', '..MMMM..MMMM..']),
    snotling: norm([
        '..gggg..', '.gggggg.', 'ggEggEgg', '.gggggg.', '..gwwg..', '.nnnnnn.', 'g.nnnn.g', '..g..g..', '.gg..gg.']),
    skaven: norm([
        '...ff.......', '..fFf.......', '..ffffff....', '..ffffEfff..', '..fffffffSk.', '...fffwff...',
        '..nnffnn....', '.fnnnnnnnf..', '.f.nnnnnn.f.', '...nnnnnn...', '...nn..nn...', 'ff.ff..ff...',
        '.fff...ff...', '..ff..fff...', '...k.k..k...']),
    ratOgre: norm([
        '...ff.........', '..fFf.........', '..ffffffff....', '..fffffEffff..', '..fffffffffSk.', '...ffffwfwf...',
        '.fffffffffff..', 'ffFfffffffFff.', 'ff.ffrfrfff.ff', 'ff.fffffffff.ff', 'F..fffffffff..F', 'w..nnnnnnnn..w',
        '....nnNNnn....', '....ff..ff....', 'ff..ff..ff....', '.ffff...ff....', '...kk...kk....']),
    mushroom: norm([
        '...rrrrrr...', '..rrwrrrwr..', '.rrrrrrwrrr.', 'rrwrrrrrrrwr', 'rrrrrrrrrrrr', '..bbbbbbbb..',
        '...wwwwww...', '...wewwew...', '...wwwwww...', '.w.wwwwww.w.', '..wwwwwwww..', '...wwwwww...',
        '...ww..ww...', '..www..www..']),
    fishman: norm([
        '...cccc.....', '..cCccccc...', '..ccOeccccc.', '..cccccccwc.', 'C..cccccc...', 'CC.cCCCcc...',
        '.ccccccccc..', 'cccyyyyyccc.', 'c.cyyyyyc.c.', 'c.cccccccc.c', '..cccccc....', '...cc..cc...',
        '...cc..cc...', '..CCc..cCC..', '.CCC...CCC..']),
    dryad: norm([
        '...gGgGg....', '..gggggggg..', '.gGgnnnnggG.', '.ggnnnenng..', '..gnnnnnng..', '.g.gnnnng...',
        '..ggnnnngg..', '.ngggrgggn..', '.n.gggggg.n.', '...gggggg...', '..gggggggg..', '..gGggggGg..',
        '.gGgggggggG.', '..NN....NN..', '.NNN....NNN.']),
    minotaur: norm([
        '.w.........w..', '.ww.......ww..', '..wFFFFFFFw...', '...FfffffEF...', '...Fffffffff..', '....ffffSSf...',
        '....ffffSyS...', '..ffffffffff..', '.ffFffffffFff.', 'ff.ffffffff.ff', 'ff.fffffffff.ff', 'f..nnnnnnnn..f',
        '...nnnNNnnn...', '....ff..ff....', '....ff..ff....', '....ff..ff....', '...kkk..kkk...']),
    rat: norm([
        '..........ff..', '....fffff.fFf.', '...fffffffffEfk', 'ffffffffffffffS', '...fffffffff...', '....S.S..S.S...']),
    lich: norm([
        '..y.y.y.....', '..yyyyy.....', '..bbbbbb....', '..bOObOOb...', '..bbbbbbb...', '...bkbkb....',
        '..pppppppp..', '.bpppPpppPb.', '.b.pppppp.b.', '...pPppppp..', '..pppppppp..', '..ppPppPpp..',
        '.pppppppppp.', '.p.p.pp.p.p.']),
    zombie: norm([
        '...hhhh.....', '..hssssh....', '..sssesS....', '..sSsssss...', '...ssksss...', '....sss.....',
        '..nnnnnsssss', '.nnnnnnnn...', '.nnRnnnsssss', '..nnnnnn....', '...nnnnn....', '...cc.cc....',
        '...cc.cc....', '...s..cc....', '..ss..cc....', '..kk..kkk...']),
    ghoul: norm([
        '....ssss....', '...ssssss...', '...ssEsssS..', '...sssssww..', '..sssSss....', '.sssssssss..',
        'ssSssssssSs.', 'ww.sssssss.w', 'w..sSSSSs..w', '...nnnnnn...', '..ss....ss..', '.ss......ss.',
        '.kk......kk.']),
    ghost: norm([
        '....wwww....', '..wwwwwwww..', '.wwwwwwwwww.', '.wwkkwwkkww.', '.wwkkwwkkww.', '.wwwwwwwwww.',
        'wwwwwkkwwwww', 'wwwwwkkwwwww', 'wwwwwwwwwwww', 'wwwwwwwwwwww', 'wwwwwwwwwwww', 'ww.www.www.w',
        'w...w...w...']),
    wraith: norm([
        '....kkkk....', '...kkkkkk...', '..kkkkkkkk..', '..kkOkkOkk..', '..kkkkkkkk..', '..kkkkkkkk..',
        '.kkkkkkkkkk.', 'wkkkkkkkkkkw', 'w.kkkkkkkk.w', '..kkkFkkkk..', '..kkkkkkkk..', '..kkFkkFkk..',
        '..kkkkkkkk..', '..k.kk.kk.k.', '..k..k..k...', '.....k......']),
    slime: norm([
        '.....gggg.....', '...gggGgggg...', '..ggOggggOgg..', '.gggggggggggg.', '.ggggkkkggggg.', 'ggggggggggggggg',
        'gGgggggggggGgg', 'ggggggggggggggg', '.GGGGGGGGGGGGG.']),
    elemental: norm([
        '.....o......', '....ooo.....', '...oOOoo....', '..oOOOOoo...', '..oOeOOeo...', '..oOOOOOo...',
        '...oOOOo....', '.o.ooOoo.o..', 'oo.oOOOoo.oo', '.oooOOOOooo.', '...oOOOOo...', '...ooOOoo...',
        '....oOOo....', '.....oo.....', '....o..o....', '.....oo.....']),
    troglodyte: norm([
        '...ssssss...', '..ssssssss..', '..sSsssEss..', '..sssssssS..', '..sswswsws..', '...SSSSSs...',
        '.ssssssssss.', 'ss.ssssss.ss', 'ss.ssssss.ss', 's..nnnnnn..s', '...nNnnNn...', '...ss..ss...',
        '...ss..ss...', '..sss..sss..']),
    fimir: norm([
        '....ffffff....', '...ffffffff...', '...fffOOfff...', '...fffOefff...', '...ffffffffF..', '....fwfwfF....',
        '..ffffffffff..', '.ffFffffffFff.', 'ff.ffffffff.ff', 'ff.fffffffff.ff', 'w..nnnnnnnn..w', '....ffffff....',
        'f...ff..ff....', 'ff..ff..ff....', 'Mff.ff..ff....', 'MM..kk..kk....']),
    werewolf: norm([
        '....F...F.....', '...FfF.FfF....', '...ffffffff...', '...fffffEfff..', '....fffffffffk', '....ffffwwfw..',
        '..ffffffffff..', '.ffFffffffFff.', 'ff.ffSSSSff.ff', 'ff.ffSSSSfff.ff', 'w..fffffffff..w', '....nnnnnnn...',
        '....ff..ff....', '...fff..fff...', '...ff....ff...', '..ff......ff..', '..kk......kk..']),
    dragon: norm([
        '........FF................', '.......FffF...........w.w.', '......FfffF...........FFF.', '.....FffffF..........FfEff',
        '....FfffffF.........FfffffS', '...FffFfffF........FffffwSw', '..FffF.FffF.......Ffff.....', '.FfF....FfF......Ffff......',
        'FF.......FFFFFFFFfff.......', '........FffffffffffffF.....', '.......FfffSSSSSSffffF.....', 'FF....FffffSSSSSSfffffF....',
        '.Ff..FfffffSSSSSfffffff....', '..FfFfffffffffffffffF......', '...FffffffffffffffffF......', '....FFfff.....fffF.........',
        '......ffF.....ffF..........', '......ffF.....fff..........', '.....kkk.....kkkk..........']),
    wyvern: norm([
        '.....F......ww....', '....FfF.....FFF...', '...FffF....FfEff..', '..FfffF...FfffffS.', '.FfffffF.Fffw.wS..',
        'FffFffffFfff......', 'Ff..FffffffF......', '....FfSSSffF......', '...FffSSSfffF.....', '..FfffffffffF.....',
        '.Ff..fF..fF.......', 'Ff...ff..ff.......', 'y....kk..kk.......']),
    vran: norm([
        '...kkkk.....', '..kkkkkk....', '..kkkkOkyy..', '..kkkkkkyyy.', '...kkkkk....', '..kkkkkkkk..',
        '.KkkkkkkkkK.', 'KK.kkkkkk.KK', 'K..kkkkkk..K', '...kknnkk...', '...kkkkkk...', '...kk..kk...',
        '...yy..yy...', '..yyy..yyy..']),
    redcap: norm([
        '...rrr....', '..rrrrr...', '.rrrrrrr..', '..gggggg..', '..ggEgggg.', '..gggggww.', '...ggggg..',
        '.MnnnnnM..', 'g.nnnnn.g.', '..nnnnn...', '..gg.gg...', '..MM.MM...', '.MMM.MMM..']),
    kilmulis: norm([
        '...nnnnn....', '..nnnnnnn...', '..sssssss...', '..ssessSSSS.', '..sssssSSSSS', '..sssssSSS..',
        '...sssss....', '..NNNNNNN...', '.sNNNNNNNs..', '.s.NNNNN.s..', '...NNNNN....', '...ss.ss....', '..sss.sss...']),
    korred: norm([
        '..hhhhhhh...', '.hhhhhhhhh..', 'hhhssssshhh.', 'hhhsessshh..', '.hhsssssh...', '.hhhhhhhh...',
        '..hhhhhhh...', '.shhhhhhs...', '.s.nnnnn.s..', '...nnnnn....', '...ff..ff...', '....f...f...',
        '...ff..ff...', '...kk..kk...']),
    kobold: norm([
        '..ww......', '..GGGG....', '.GggggGg..', '.ggEgggggk', '..gggggww.', '...ggg....', '.nnnnnn...',
        'g.nnnn.g..', '..nnnn....', '..gg.gg...', 'gggg.gg...', '..kk.kk...']),
    wight: norm([
        '...MMMMM....', '..MbbbbbM...', '..bOObbOO...', '..bbbbbbb...', '...bkbkb....', '..RMMMMMMR..',
        '.RbMmmmmMbR.', '.R.MmmmmM.R.', '.R.MMMMMM.R.', '.R.nnnnnn.R.', '...bb..bb...', '...bb..bb...', '..MMM..MMM..']),
    drowner: norm([
        '..gggggg....', '.gssssssg...', '.gsOssOss...', '.gsssssss...', '..swwwwss...', '...ssSss....',
        '.sssssssss..', 'ss.sSSSss.ss', 'w..sssssss.w', '..gsssssg...', '...ss..ss...', '...ss..ss...', '..sss..sss..']),
    squig: norm([
        '...rrrrrr...', '.rrrrrrrrrr.', 'rrrEErrrEErr', 'rwwwwwwwwwwr', 'rkkkkkkkkkkr', 'rwwwwwwwwwwr',
        '.rrrrrrrrrr.', '...rr..rr...', '..rr....rr..', '.kkk....kkk.']),
    // A masked warrior: porcelain face, hood with a trailing ribbon, diamond-quilted armour.
    harlequin: norm([
        '....kkkk....', '...kkkkkkr..', '...kwwwwwr..', '...kwkwwkr..', '...kwwwwww..', '....wwRw....',
        '..MRkRkRkM..', '.SMkRkRkRMS.', '.S.RkRkRk.S.', '...kRkRkR...', '...nnynnn...', '...kR..Rk...',
        '...kk..kk...', '...RR..RR...', '...kk..kk...', '..kkk..kkk..']),
    // Pukacz as the Witcher books have it: squat, shaggy, bow-legged, shoulders
    // a fathom wide, a red beard wider still, a big nose and huge horny feet.
    knocker: norm([
        '.....ffFfff.....', '....ffffFfff....', '...ffssssssff...', '...fsssesssSS...', '...fssssssSSS...',
        '..hhhhhhhhhhhh..', '.hhhhHhhhhHhhhh.', 'fhhhhhhhhhhhhhhf', 'ffhhhHhhhhhHhhff', 'ff.fhhhhhhhhf.ff',
        'fF.fffFffFffff.F', 'S..ffffffffff..S', '...fff....fff...', '..ffF......Fff..', '.SSSSS....SSSSSS']),
    beast: norm([
        '............FF..', '...........FffF.', '.f........FffEff', 'ff.......Ffffffw', 'Ff.fffffffffffkk',
        '.FffffffffffffF.', '..ffffffffffff..', '..FfF.....FfF...', '..f.f.....f.f...', '..f.f.....f.f...',
        '.kk.kk...kk.kk..']),
    spider: norm([
        '..k..........k..', '...k..FFFF..k...', '....kFffffFk....', '.kkkFfEffEfFkkk.', 'k...FffffffF...k',
        '..kkkFffffFkkk..', '.k...kFFFFk...k.', 'k...k......k...k', '...k........k...']),
    skeleton: norm([
        '...bbbbbb...', '..bbbbbbbb..', '..bkkbbkkb..', '..bbbbbbbb..', '...bkbkbb...', '....bbbb....',
        '..bbBbbBbb..', '.b.bbbbbb.b.', '.b..bBBb..b.', '.b.bbbbbb.b.', '....bBBb....', '...bb..bb...',
        '...b....b...', '...b....b...', '...b....b...', '..bb....bb..']),
    // --- folk: hands where a man's are, so the same weapons fit -------------
    villager: norm([
        '....hhhh....', '...hhhhhh...', '...hsssss...', '...sssses...', '...ssssss...', '....ssss....',
        '..cccccccc..', '.SccccccccS.', '.S.cnnnnc.S.', '...cccccc...', '...cccccc...', '...NN..NN...',
        '...NN..NN...', '...NN..NN...', '...kk..kk...', '..kkk..kkk..']),
    elder: norm([
        '....hhhh....', '...hhhhhh...', '...hsssss...', '...sssses...', '...shhhhh...', '....hhhh....',
        '..cccchhcc..', '.ScccccccS..', '.S.cccccc.S.', '...cnnnnc...', '...cccccc...', '..cccccccc..',
        '..cccccccc..', '..CCCCCCCC..', '...kk..kk...']),
    woman: norm([
        '....hhhh....', '...hhhhhh...', '..hhsssss...', '..hhsssess..', '..hhssssss..', '..hh.ssss...',
        '..hcccccccc.', '.Shcccccccs.', '.S.cnnnnc.s.', '...cccccc...', '..cccccccc..', '..cccccccc..',
        '.cccccccccc.', '.CCCCCCCCCC.', '...kk..kk...']),
    child: norm([
        '...hhhh...', '..hhhhhh..', '..hsssse..', '...sssss..', '..cccccc..', '.sccccccs.', '...nnnn...',
        '...cccc...', '...c..c...', '..kk..kk..']),
    // --- beasts and vermin ------------------------------------------------
    hoofed: norm([
        '............ff..', '...........ffff.', '...........ffeff', '..........fffffS', '.........ffff.SS',
        '.........fff....', '.ffffffffffff...', 'ffffffffffffF...', 'f.ffffffffffF...', 'f.FffffffffF....',
        '..ff.f....ff.f..', '..ff.f....ff.f..', '..ff.f....ff.f..', '..kk.k....kk.k..']),
    stag: norm([
        '..........n.n.n.', '...........nnn..', '............ff..', '...........ffff.', '...........ffeff',
        '..........fffffS', '.........ffff.SS', '.........fff....', '.ffffffffffff...', 'ffffffffffffF...',
        'f.ffffffffffF...', 'f.FffffffffF....', '..ff.f....ff.f..', '..ff.f....ff.f..', '..ff.f....ff.f..',
        '..kk.k....kk.k..']),
    bird: norm([
        '......rr...', '.....ffff..', '.....fefyy.', '.....fff...', 'F...ffff...', 'FF.fffffF..', '.FffffffF..',
        '..FffffF...', '...FFFF....', '....y.y....', '...yy.yy...']),
    heron: norm([
        '.....rr.....', '....wwww....', '....wwewyyyy', '....www.....', '.....ww.....', '.....ww.....',
        '....www.....', '..FFwwww....', 'kFFFFwwww...', '.kFFFFwww...', '...FFFww....', '.....y.y....',
        '.....y.y....', '.....y.y....', '....yy.yy...']),
    bat: norm([
        '.....k..k.....', '.....kkkk.....', 'F...kEkkEk...F', 'FF..kkkkkk..FF', 'FfF.kwkkwk.FfF',
        'FffFkkkkkkFffF', 'FfffFkkkkFfffF', 'Ff.ffFkkFff.fF', 'F...f.kk.f...F', '......k..k....']),
    snake: norm([
        '............ffff..', '...........ffeffff', '..........ffffff.r', '..fff....fff......', '.fFFFf..fFf.......',
        'ffF..fffFf........', '.f....FFF.........']),
    amphisbaena: norm([
        '.ffff............ffff.', 'fffeff..........ffefff', '.ffffff........ffffff.', '....fff..ffff..fff....',
        '.....fFffFFFFffFf.....', '......FFFF..FFFF......']),
    frog: norm([
        '.......gg.', '......gweg', '..gggggggg', '.ggggggGGG', 'gggGgggyyy', 'gg.GGg.yy.', '.gg..gg...', 'ggg.ggg...']),
    rabbit: norm([
        '.....ff.....', '.....fSf....', '......fSf...', '......ffff..', '.....fffefS.', '.w..ffffff..',
        'wwfffffff...', '.fffffffff..', '.ffFfffFff..', '..kkk..kk...']),
    // Longer ears, longer legs, leaner body than the rabbit.
    hare: norm([
        '....ff........', '....fSf.......', '.....fSf......', '.....fSf......', '......fff.....', '......ffff....',
        '.....fffeffS..', '.w..fffffff...', 'wwffffffff....', '.fffffffff....', '.FfF...fF.....', '.F.F...fF.....',
        'kk.k...kk.....']),
    mouse: norm([
        '.......ff...', '......fSSf..', '...ffffffff.', '..fffffffeff', '.fffffffffSS', 'k..FfffffF..', '.k..k...k...']),
    centipede: norm([
        '.....................k.k', '......................kk', '.FfFfFfFfFfFfFfFfFfFfff.', 'FfFfFfFfFfFfFfFfFfFfffEf',
        '.FfFfFfFfFfFfFfFfFfFfff.', '.k.k.k.k.k.k.k.k.k.k.k..', 'k.k.k.k.k.k.k.k.k.k.k.k.']),
    // Seen from the front, pincers raised; symmetric, so facing does not matter.
    crab: norm([
        '.rr..........rr.', 'rRrr........rrRr', 'rwRr........rRwr', '.rR...e..e...Rr.', '..r...r..r...r..',
        '...rrrrrrrrrr...', '..rrrrrrrrrrrr..', '..rRrrrrrrrrRr..', '...RRRRRRRRRR...', '.r.r.r....r.r.r.',
        'r..r..r....r..r.']),
    hedgehog: norm([
        '..k.k.k.....', '.knknknkn...', 'knnnnnnnnss.', 'nnnnnnnnssse', '.nnnnnnnsssk', '..s.s..s.s..']),
    // --- fiends, stone and wood ---------------------------------------------
    demon: norm([
        '...w....w.....', '...ww..ww.....', '....rrrrr.....', '....rrrEr.....', '....rrrrrr....', '.....rwwr.....',
        'F..rrrrrrrr..F', 'FF.rRrrrrRr.FF', 'FfFrrrrrrrrFfF', 'Ff.rr.RR.rr.fF', 'F..r.rrrr.r..F', '....rrrrrr....',
        '....RR..RR....', '....rr..rr....', '....rr..rr....', '...kkk..kkk...']),
    gargoyle: norm([
        '...M...M......', '...MM.MM......', '...MmmmmM.....', '...mmmOmm.....', '...mmmmmmmM...', '....mmwmw.....',
        'MM.mmmmmm.MM..', 'MmMmmmmmmmMmM.', 'Mm.mmMMmm.mmM.', 'M..mmmmmm..M..', '...mm..mm.....', '..MMm..mMM....',
        '..kkk..kkk....']),
    treant: norm([
        '..g.gGg.g.....', '.gGgggggGg....', 'gggGgggGggg...', '.gggnngggg....', '...nnnnn......', '...nOnnO......',
        '...nnnnn......', '.n.nnNnn.n....', 'nn.nnnnn.nn...', 'n..nnNnn..n...', '...nnnnn......', '...nnNnn......',
        '..nn...nn.....', '.nNn...nNn....', 'NN.......NN...']),
};

const AXE = norm(['mM.', 'mMn', 'mM.', '..n', '..n', '..n']);
const SWORD = norm(['m', 'm', 'm', 'm', 'y', 'n']);
const DAGGER = norm(['m', 'm', 'y', 'n']);
const CLUB = norm(['nn', 'Nn', 'nn', '.n', '.n', '.n']);
const HAMMER = norm(['MMM', 'MmM', '.n.', '.n.', '.n.']);
const STAFF = norm(['y', 'N', 'n', 'n', 'n', 'n', 'n', 'n', 'n']);
const PICK = norm(['.mmm.', 'm.n.m', '..n..', '..n..', '..n..']);
const HALBERD = norm(['.m', 'mm', 'Mm', '.n', '.n', '.n', '.n', '.n', '.n', '.n', '.n', '.n']);
const SABRE = norm(['.m', 'm.', 'm.', 'y.', 'n.']);
const TRIDENT = norm(['m.m.m', 'mmmmm', '..n..', '..n..', '..n..', '..n..', '..n..', '..n..', '..n..']);
const LANCE = norm(['m..', 'm..', 'mrr', 'mr.', 'n..', 'n..', 'n..', 'n..', 'n..', 'n..', 'n..', 'n..', 'n..', 'n..']);

export interface WeaponPose {
    grid: Grid;
    /** Grid column/row of the weapon's top-left inside the body grid. */
    col: number;
    row: number;
}

export const WEAPONS: Record<WeaponId, Record<Pose, WeaponPose>> = {
    axe: { rest: { grid: AXE, col: 10, row: 3 }, strike: { grid: rotateCW(AXE), col: 10, row: 7 } },
    sword: { rest: { grid: SWORD, col: 10, row: 3 }, strike: { grid: rotateCW(SWORD), col: 10, row: 8 } },
    dagger: { rest: { grid: DAGGER, col: 9, row: 4 }, strike: { grid: rotateCW(DAGGER), col: 9, row: 7 } },
    club: { rest: { grid: CLUB, col: 10, row: 4 }, strike: { grid: rotateCW(CLUB), col: 10, row: 8 } },
    hammer: { rest: { grid: HAMMER, col: 9, row: 4 }, strike: { grid: rotateCW(HAMMER), col: 9, row: 8 } },
    staff: { rest: { grid: STAFF, col: 10, row: 3 }, strike: { grid: rotateCW(STAFF), col: 9, row: 7 } },
    pick: { rest: { grid: PICK, col: 8, row: 3 }, strike: { grid: rotateCW(PICK), col: 8, row: 6 } },
    halberd: { rest: { grid: HALBERD, col: 10, row: -1 }, strike: { grid: rotateCW(HALBERD), col: 8, row: 7 } },
    sabre: { rest: { grid: SABRE, col: 10, row: 4 }, strike: { grid: rotateCW(SABRE), col: 10, row: 8 } },
    trident: { rest: { grid: TRIDENT, col: 8, row: 0 }, strike: { grid: rotateCW(TRIDENT), col: 8, row: 7 } },
    lance: { rest: { grid: LANCE, col: 9, row: -3 }, strike: { grid: rotateCW(LANCE), col: 7, row: 7 } },
};

/** Stable small hash so a fighter keeps its look across re-renders. */
export function hashOf(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

const CLOTH = [
    ['#b8333a', '#7e1f2a'], ['#3a6ec9', '#24468a'], ['#3f8f5a', '#25603a'], ['#7d4bc2', '#52307f'],
    ['#c27a2c', '#8a521a'], ['#2f8f8f', '#1d5f5f'], ['#9c3f80', '#6a2856'], ['#5d6b7a', '#3b4652'],
];
const HAIR = ['#d9772b', '#f2c94c', '#3a2a1c', '#c8c8d0', '#8a3a1c'];

const OGRE_SKIN: Palette = { s: '#c9a06a', S: '#9c7648', e: '#3a1a10' };

/** The ogre avatar and ogre mobs alike. Hands hang at row 12, two columns past a man's. */
const OGRE_LOOK: SpriteLook = { grid: GRIDS.ogre, scale: 2, weapon: 'club', weaponShift: { col: 2, row: 4 }, palette: { ...BASE, ...OGRE_SKIN, n: '#6b4a2a' } };

type Race = 'elf' | 'halfElf' | 'dwarf' | 'halfling' | 'gnome' | 'ogre' | 'human';

/** GMCP `Char.Info.race`, ASCII-folded. Half-elf before elf - "polelf" contains "elf". */
export function raceOf(race: string | undefined): Race | null {
    if (!race) return null;
    const r = foldText(race);
    if (/pol-? ?elf|half-? ?elf/.test(r)) return 'halfElf';
    if (/elf/.test(r)) return 'elf';
    if (/krasnolud|dwarf/.test(r)) return 'dwarf';
    if (/niziol|halfling|hobbit/.test(r)) return 'halfling';
    if (/gnom/.test(r)) return 'gnome';
    if (/\bogr|ogre/.test(r)) return 'ogre';
    if (/czlowiek|ludz|human|mezczyzn|kobiet/.test(r)) return 'human';
    return null;
}

function raceLook(race: Race, h: number): SpriteLook {
    const [cloth, clothDark] = CLOTH[h % CLOTH.length];
    const hair = HAIR[(h >>> 4) % HAIR.length];
    switch (race) {
        case 'elf':
            return { grid: GRIDS.elf, scale: 2, weapon: 'sword', palette: { ...BASE, h: h % 2 ? '#f2dc8a' : '#e8e4d0', c: cloth, C: clothDark } };
        case 'halfElf':
            return { grid: GRIDS.halfElf, scale: 2, weapon: 'sword', palette: { ...BASE, h: hair, C: clothDark, c: '#3b4652' } };
        case 'dwarf':
            return { grid: GRIDS.dwarf, scale: 2, weapon: 'axe', palette: { ...BASE, r: cloth, R: clothDark, h: hair } };
        case 'halfling':
            return { grid: GRIDS.halfling, scale: 2, weapon: 'dagger', weaponShift: { col: 0, row: 1 }, palette: { ...BASE, h: '#5a3a1c', r: cloth } };
        case 'gnome':
            return { grid: GRIDS.gnome, scale: 2, weapon: 'hammer', weaponShift: { col: 0, row: 3 }, palette: { ...BASE, r: cloth === '#b8333a' ? cloth : '#c0392b', c: '#3a6ec9' } };
        case 'ogre':
            return OGRE_LOOK;
        case 'human':
            return h % 2
                ? { grid: GRIDS.ranger, scale: 2, weapon: 'sword', palette: { ...BASE, c: cloth, C: clothDark } }
                : { grid: GRIDS.mage, scale: 2, weapon: 'staff', palette: { ...BASE, p: cloth, P: clothDark, w: hair === '#3a2a1c' ? '#f4f1ff' : hair } };
    }
}

const TEAM_RACES: Race[] = ['dwarf', 'elf', 'halfElf', 'halfling', 'gnome', 'human'];

/**
 * Player and team. The race comes from GMCP for the player and from the people
 * database for others; whoever has none gets one picked from their name.
 */
function heroLook(desc: string, race?: string): SpriteLook {
    const h = hashOf(desc.toLowerCase());
    const known = raceOf(race);
    return raceLook(known ?? TEAM_RACES[(h >>> 8) % TEAM_RACES.length], h);
}

interface EnemyRule {
    pattern: RegExp;
    look: (h: number, folded: string) => SpriteLook;
}

// Patterns run on ASCII-folded, lower-cased descs. Order matters: the first hit wins.
const UNIFORM = [['#b8333a', '#7e1f2a'], ['#3a6ec9', '#24468a'], ['#c9a227', '#8a6d14'], ['#3f8f5a', '#25603a'], ['#5d6b7a', '#3b4652']];
const uniform = (h: number): Palette => {
    const [main, dark] = UNIFORM[h % UNIFORM.length];
    return { r: main, R: dark };
};

const ENEMY_RULES: EnemyRule[] = [
    // "krasnozwierz" holds "zwierz" - keep it ahead of anything matching animals.
    // --- these come first: each holds a word a broader rule below would take ---
    // (wilkolak: wilk, szczurolak: szczur, redcap: goblin-like, kobold: once an orc)
    { pattern: /wilkolak|wilkolacz/, look: h => ({ grid: GRIDS.werewolf, scale: 2, palette: { ...BASE, f: h % 2 ? '#6a6a72' : '#6a5440', F: h % 2 ? '#44444c' : '#44362a', S: '#9a9aa0', E: '#ffd54a', w: '#e8e4d0', n: '#3a3a5a', k: '#1a1222' } }) },
    { pattern: /szczurolak|szczurolacz/, look: () => ({ grid: GRIDS.skaven, scale: 2, palette: { ...BASE, f: '#4a4040', F: '#2e2828', n: '#4a4040', S: '#d08a8a', E: '#ff4040', k: '#1a1222' } }) },
    // "smoczy" is only dragon-like.
    { pattern: /\bsmok(a|i|iem|owi|u)?\b/, look: (_, folded) => {
        const [f, F, S] = /zielon/.test(folded) ? ['#4a8a3a', '#24501c', '#c8d07a'] : /czarn/.test(folded) ? ['#3a3a44', '#1a1a22', '#8a7a6a']
            : /niebiesk|blekit/.test(folded) ? ['#3a6ec9', '#1e3a7a', '#c0d8f0'] : /zlot/.test(folded) ? ['#d0a030', '#8a6a14', '#f2e0a0']
            : /bial|srebrn/.test(folded) ? ['#e0e4ec', '#9aa0b0', '#ffffff'] : ['#b8333a', '#6e1a20', '#e0b070'];
        // Usually alone on the field, so it gets the giant's scale.
        return { grid: GRIDS.dragon, scale: 3, palette: { ...BASE, f, F, S, E: '#ffd54a', w: '#e8e4d0', k: '#1a1222' } };
    } },
    { pattern: /wiwern|wywern|wyvern/, look: () => ({ grid: GRIDS.wyvern, scale: 2, hover: 6, palette: { ...BASE, f: '#6a7a3a', F: '#3e4a20', S: '#c0b070', E: '#ff4040', y: '#d0d050', w: '#e8e4d0', k: '#1a1222' } }) },
    { pattern: /\bvran/, look: () => ({ grid: GRIDS.vran, scale: 2, weapon: 'sword', palette: { ...BASE, k: '#2a2a3a', K: '#45455a', O: '#ffd54a', y: '#d0a030', n: '#7a4a2a' } }) },
    { pattern: /redcap|czerwonoczap|czerwony kaptur/, look: () => ({ grid: GRIDS.redcap, scale: 2, weapon: 'axe', palette: { ...BASE, r: '#c0392b', g: '#8aa05a', n: '#5a4030', M: '#6a6e78', E: '#ffd54a', w: '#e8e4d0' } }) },
    { pattern: /kilmulis/, look: () => ({ grid: GRIDS.kilmulis, scale: 2, palette: { ...BASE, s: '#c8a080', S: '#d88a7a', n: '#5a4a3a', N: '#6a5a40', e: '#1a1222' } }) },
    { pattern: /korred|korrigan/, look: () => ({ grid: GRIDS.korred, scale: 2, weapon: 'club', palette: { ...BASE, h: '#3a2a1a', s: '#c09070', n: '#6a5a2a', f: '#7a5a3a', e: '#1a1222', k: '#1a1222' } }) },
    { pattern: /kobold|chobold/, look: h => ({ grid: GRIDS.kobold, scale: 2, weapon: 'dagger', palette: { ...BASE, g: h % 2 ? '#b0703a' : '#8a6a3a', G: '#7a4a22', E: '#ffd54a', w: '#e8e4d0', n: '#5a4a3a', k: '#1a1222' } }) },
    { pattern: /\bwicht/, look: () => ({ grid: GRIDS.wight, scale: 2, weapon: 'sword', palette: { ...BASE, M: '#7a5a3a', m: '#9a7a52', b: '#c8c4b0', O: '#7fd3ff', R: '#3a3a4a', n: '#4a3a2a', k: '#1a1222' } }) },
    { pattern: /utopiec|utopc|topielec|topielc|topielic/, look: () => ({ grid: GRIDS.drowner, scale: 2, palette: { ...BASE, s: '#6a9a9a', S: '#4a7a7a', g: '#3a6a3a', O: '#e0f0e0', w: '#e8e4d0' } }) },
    { pattern: /squig|skwig/, look: h => ({ grid: GRIDS.squig, scale: 2, palette: { ...BASE, r: h % 2 ? '#e0701a' : '#c0392b', E: '#1a1222', w: '#f4f1e0', k: '#5a1010' } }) },
    { pattern: /arlekin/, look: h => ({ grid: GRIDS.harlequin, scale: 2, weapon: 'sabre', palette: { ...BASE, k: '#1e1a24', R: h % 2 ? '#7a1a2a' : '#2a3a5a', r: h % 2 ? '#b8333a' : '#3a6ec9', w: '#ece6da', M: '#55555f', n: '#3a2a20', y: '#c9a227', S: '#2a2a33', m: '#cfd8e3' } }) },
    { pattern: /pukacz/, look: () => ({ grid: GRIDS.knocker, scale: 2, palette: { ...BASE, f: '#6a4a30', F: '#4a3220', s: '#c8a080', S: '#a07a5a', h: '#c0502a', H: '#8a3418', e: '#1a1222' } }) },
    { pattern: /krasnozwierz/, look: () => ({ grid: GRIDS.chaosSpawn, scale: 3, palette: { ...BASE, r: '#8a2a5a', R: '#5a1638', p: '#6a3fa0', w: '#e8e4d0', E: '#ffe14a', k: '#2a0a1a' } }) },
    { pattern: /zwierzocz|zwierzolud/, look: h => ({ grid: GRIDS.beastman, scale: 2, weapon: h % 2 ? 'axe' : 'club', palette: { ...BASE, f: h % 2 ? '#a8835a' : '#9a8a70', F: '#5e4430', S: '#d0b08a', w: '#e8e4d0', E: '#ff4040' } }) },
    { pattern: /wietrzyc/, look: () => ({ grid: GRIDS.windSpirit, scale: 2, hover: 8, alpha: 0.75, palette: { ...BASE, w: '#eef6ff', s: '#cfe6ff', e: '#3a6ec9', c: '#8fc4ee' } }) },
    { pattern: /harpi/, look: h => ({ grid: GRIDS.harpy, scale: 2, hover: 6, palette: { ...BASE, f: h % 2 ? '#7a6a8a' : '#8a6a4a', F: h % 2 ? '#4e425a' : '#5a442e', h: '#2a1a1a', s: '#d8b090', e: '#ff4040', y: '#e0b030' } }) },
    { pattern: /reptilion/, look: h => ({ grid: GRIDS.reptilion, scale: 2, weapon: 'sabre', palette: { ...BASE, g: h % 2 ? '#4f9a6a' : '#5a8a3a', G: h % 2 ? '#2f6a48' : '#3a5a22', y: '#c8d07a', E: '#ffd54a' } }) },
    { pattern: /rycerz\w* chaosu|chaosu rycerz/, look: () => ({ grid: GRIDS.chaosKnight, scale: 2, weapon: 'sword', palette: { ...BASE, M: '#2a2a33', m: '#55555f', k: '#140e14', R: '#7a1010', r: '#9a1a1a', y: '#c9a227', w: '#d8d0c0', E: '#ff3030' } }) },
    { pattern: /kultyst/, look: h => {
        const [robe, dark] = [['#6a1a2a', '#40101a'], ['#3a2050', '#24143a'], ['#3a4a22', '#243014'], ['#1e3a6a', '#122444']][h % 4];
        return { grid: GRIDS.cultist, scale: 2, weapon: 'dagger', palette: { ...BASE, R: robe, k: '#0e0a10', E: '#ffcf40', s: '#d8c0b0', y: '#c9a227', N: dark } };
    } },
    { pattern: /\bbesti(a|i|e|ami)?\b/, look: h => ({ grid: GRIDS.monster, scale: 2, palette: { ...BASE, f: h % 2 ? '#54465e' : '#5e4636', F: '#30283a', S: '#8a6a7a', w: '#e8e4d0', E: '#ff3030', k: '#140e14' } }) },
    { pattern: /gwardzist/, look: h => ({ grid: GRIDS.guard, scale: 2, weapon: 'halberd', palette: { ...BASE, ...uniform(h) } }) },
    { pattern: /oficer/, look: h => ({ grid: GRIDS.officer, scale: 2, weapon: 'sword', palette: { ...BASE, ...uniform(h), h: HAIR[h % HAIR.length] } }) },
    { pattern: /zolnierz|zolnier/, look: h => ({ grid: GRIDS.soldier, scale: 2, weapon: h % 3 ? 'sword' : 'axe', palette: { ...BASE, ...uniform(h) } }) },
    { pattern: /szlachc/, look: h => ({ grid: GRIDS.noble, scale: 2, weapon: 'sabre', palette: { ...BASE, p: CLOTH[h % CLOTH.length][0], F: '#3a2a1c', h: HAIR[(h >>> 4) % HAIR.length] } }) },
    { pattern: /lansjer/, look: h => ({ grid: GRIDS.lancer, scale: 2, weapon: 'lance', palette: { ...BASE, r: UNIFORM[h % UNIFORM.length][0] } }) },
    { pattern: /golem|konstrukt/, look: (_, folded) => {
        const [m, M] = /konstrukt|kosci/.test(folded) ? ['#e8e4d0', '#a8a28c'] : /glinian/.test(folded) ? ['#a87a52', '#7a5432'] : /zelaz|stalow|metal/.test(folded) ? ['#7a8494', '#4e5664'] : ['#9a968c', '#6a665e'];
        return { grid: GRIDS.golem, scale: 2, palette: { ...BASE, m, M, k: '#3a3630', O: '#7fd3ff' } };
    } },
    { pattern: /snotling/, look: h => ({ grid: GRIDS.snotling, scale: 2, palette: { ...BASE, g: h % 2 ? '#8ac04a' : '#a0b84a', E: '#fff6c8', n: '#7a5a3a' } }) },
    // Rat-ogres before the skaven and plain rats they contain.
    { pattern: /szczuro?ogr/, look: () => ({ grid: GRIDS.ratOgre, scale: 2, palette: { ...BASE, f: '#8a7a6a', F: '#5e4e40', S: '#d08a8a', r: '#c04a4a', w: '#e8e4d0', E: '#ff4040', n: '#3a3028' } }) },
    { pattern: /skaven/, look: h => ({ grid: GRIDS.skaven, scale: 2, weapon: 'sabre', palette: { ...BASE, f: h % 2 ? '#7a6a5a' : '#6a6a6a', F: '#4e4238', S: '#d08a8a', n: h % 2 ? '#4a4030' : '#3a2a4a', E: '#ff4040', m: '#9a8a6a' } }) },
    { pattern: /grzyboczl|grzybolud/, look: h => ({ grid: GRIDS.mushroom, scale: 2, palette: { ...BASE, r: ['#c0392b', '#8a5a2a', '#7d4bc2'][h % 3], w: '#efe6d0', b: '#c8b48a', e: '#1a1222' } }) },
    { pattern: /ryboczl|rybolud/, look: h => ({ grid: GRIDS.fishman, scale: 2, weapon: 'trident', palette: { ...BASE, c: h % 2 ? '#3f8f8f' : '#4a7a9a', C: h % 2 ? '#1d5f5f' : '#2a4e6a', y: '#b8d8c8', O: '#ffffff', e: '#000000', m: '#b8c4b0' } }) },
    { pattern: /driad/, look: () => ({ grid: GRIDS.dryad, scale: 2, weapon: 'staff', palette: { ...BASE, g: '#5aa04a', G: '#3a7a2a', n: '#9a7a52', N: '#5e4430', r: '#ff8ab0', e: '#1a1222', y: '#8ac04a' } }) },
    { pattern: /minotaur/, look: () => ({ grid: GRIDS.minotaur, scale: 2, weapon: 'axe', weaponShift: { col: 2, row: 5 }, palette: { ...BASE, f: '#6b3a24', F: '#45241a', S: '#b08860', w: '#e8e4d0', y: '#f2c94c', E: '#ff4040', n: '#4e3322', N: '#2e1e14' } }) },
    { pattern: /szczur/, look: h => ({ grid: GRIDS.rat, scale: 2, palette: { ...BASE, f: h % 2 ? '#7a6a5a' : '#6a6a6a', F: '#4e4238', S: '#d08a8a', E: '#1a1222', k: '#d08a8a' } }) },
    { pattern: /bykocentaur/, look: () => ({ grid: GRIDS.bullCentaur, scale: 3, weapon: 'axe', weaponShift: { col: 6, row: 3 }, palette: { ...BASE, f: '#6b3a24', F: '#45241a', s: '#8a4a30', S: '#5e301e', w: '#e8e4d0', E: '#ff4040' } }) },
    { pattern: /krasnolud\w* chaos|chaos\w* krasnolud/, look: () => ({ grid: GRIDS.chaosDwarf, scale: 2, weapon: 'axe', palette: { ...BASE, M: '#2a2a33', m: '#55555f', r: '#7a1010', R: '#4a0808', h: '#1c1a1a', y: '#c0392b', k: '#3a0a0a' } }) },
    { pattern: /krasnolud/, look: h => ({ grid: GRIDS.dwarf, scale: 2, weapon: 'axe', palette: { ...BASE, r: CLOTH[h % CLOTH.length][0], h: HAIR[(h >>> 4) % HAIR.length] } }) },
    { pattern: /troll/, look: h => ({ grid: GRIDS.troll, scale: 3, weapon: 'club', weaponShift: { col: 2, row: 5 }, palette: { ...BASE, f: h % 2 ? '#7f8f78' : '#8a8478', F: h % 2 ? '#56634f' : '#5e5a50', n: '#4a3a2a' } }) },
    // Nouns only: "olbrzymi pajak", "gigantyczny szczur" are just big.
    { pattern: /\bolbrzym(a|em|owi|ow|ami)?\b|\bcyklop|\bgigant(a|em|owi|ow|ami)?\b/, look: () => ({ grid: GRIDS.giant, scale: 3, weapon: 'club', weaponShift: { col: 1, row: 3 }, palette: { ...BASE, ...OGRE_SKIN, n: '#6b4a2a' } }) },
    { pattern: /\bogr(?!od)/, look: () => OGRE_LOOK },
    { pattern: /\bork|\borcz|goblin|gnoll/, look: h => ({ grid: GRIDS.orc, scale: 2, weapon: 'club', palette: h % 2 ? BASE : { ...BASE, g: '#a8b04a', G: '#7a7a2c' } }) },
    // Cubs ("niedzwiadek", also the common "niedziwiadek" slip) stay small.
    { pattern: /niedzwiad|niedziwiad/, look: () => ({ grid: GRIDS.bear, scale: 2, palette: { ...BASE, f: '#8a6040', F: '#5a3e28', S: '#c09870' } }) },
    { pattern: /niedzwied|niedziwied/, look: (h, folded) => ({ grid: GRIDS.bear, scale: 3, palette: /polar|bial/.test(folded) ? { ...BASE, f: '#e8e8e0', F: '#b0b0a8', S: '#d0c8b8' } : { ...BASE, f: h % 2 ? '#7a5236' : '#5e3e28', F: '#3e2618', S: '#b08860' } }) },
    { pattern: /\bdzik|\bzubr|\bbyk\b|\btur\b|\blos\b/, look: () => ({ grid: GRIDS.beast, scale: 3, palette: { ...BASE, f: '#7a5236', F: '#4e3322' } }) },
    { pattern: /wilk|wilcz|warg|\bpies\b|\bpsa\b|\bogar|\blis\b|lisic|szakal|hien/, look: h => ({ grid: GRIDS.beast, scale: 2, palette: h % 2 ? BASE : { ...BASE, f: '#a07a52', F: '#6b4f33' } }) },
    // Word starts only: "przerazajaca" holds "zajac".
    { pattern: /\bzajac|\bzajec|\bszarak/, look: () => ({ grid: GRIDS.hare, scale: 2, palette: { ...BASE, f: '#a07a52', F: '#6b4f33', S: '#d8a890', w: '#efe6d0', e: '#1a1222', k: '#4a3422' } }) },
    { pattern: /\bkrolik/, look: h => ({ grid: GRIDS.rabbit, scale: 2, palette: { ...BASE, f: ['#9a948a', '#efeadc', '#6a5444'][h % 3], F: ['#6a665e', '#b8b2a0', '#44362a'][h % 3], S: '#e0a0a0', w: '#f4f1ff', e: '#1a1222', k: '#3a3028' } }) },
    { pattern: /\bmysz|\bmyszy\b/, look: h => ({ grid: GRIDS.mouse, scale: 2, palette: { ...BASE, f: h % 2 ? '#8a8078' : '#7a6450', F: h % 2 ? '#5a524c' : '#4e3e30', S: '#e0a0a0', e: '#1a1222', k: '#d09090' } }) },
    { pattern: /\bkot\b|\bkocur|\bwiewior|\bkuna|\bborsuk|\btchorz|\blasic|\bnork/, look: () => ({ grid: GRIDS.beast, scale: 1, palette: { ...BASE, f: '#8a7058', F: '#5a4838' } }) },
    { pattern: /stonog|wij\b|wija\b|skolopendr/, look: h => ({ grid: GRIDS.centipede, scale: 2, palette: { ...BASE, f: h % 2 ? '#8a4a2a' : '#6a3a4a', F: h % 2 ? '#5a2a14' : '#42202e', E: '#ffd54a', k: '#2a1a10' } }) },
    { pattern: /\bkrab/, look: (_, folded) => ({ grid: GRIDS.crab, scale: /olbrzym|wielk|ogromn|gigantyczn/.test(folded) ? 3 : 2, palette: { ...BASE, r: '#c0502a', R: '#8a3018', e: '#1a1222', w: '#f4e0d0' } }) },
    { pattern: /pajak|pajecz|skorpion|chrzaszcz|\bowad|pluskw/, look: (h, folded) => ({ grid: GRIDS.spider, scale: /olbrzym|wielk|ogromn|gigantyczn|monstrualn/.test(folded) ? 3 : /pluskw/.test(folded) ? 1 : 2, palette: { ...BASE, f: h % 2 ? '#4a3a5a' : '#5a4a2a', F: '#2c2236' } }) },
    // --- undead ---
    { pattern: /\blicz(a|em|e|u|owi)?\b|\blisz/, look: () => ({ grid: GRIDS.lich, scale: 2, weapon: 'staff', palette: { ...BASE, b: '#e8e4d0', O: '#7fff7f', k: '#1a1222', p: '#4a2a6a', P: '#2e1a44', y: '#c9a227' } }) },
    { pattern: /ozywien/, look: () => ({ grid: GRIDS.zombie, scale: 2, palette: { ...BASE, s: '#9aa0b0', S: '#6a7080', n: '#4a4040', c: '#3a3a44', R: '#5a1a1a', h: '#2a2a2a', e: '#e8e4d0', k: '#1a1222' } }) },
    { pattern: /zombi/, look: () => ({ grid: GRIDS.zombie, scale: 2, palette: { ...BASE, s: '#8aa070', S: '#5a7048', n: '#6a5a4a', c: '#4a4a5a', R: '#7a1a1a', h: '#3a3a2a', e: '#ff4040', k: '#1a1222' } }) },
    { pattern: /\bghul|\bghoul/, look: () => ({ grid: GRIDS.ghoul, scale: 2, palette: { ...BASE, s: '#8a8a7a', S: '#5e5e50', E: '#ffd54a', w: '#e8e4d0', n: '#3a3028' } }) },
    // "duchowny" is a priest, not a ghost.
    { pattern: /\bduch(a|y|em|owi|ow|ami)?\b/, look: () => ({ grid: GRIDS.ghost, scale: 2, hover: 8, alpha: 0.7, palette: { ...BASE, w: '#eef2ff', k: '#2a2a44' } }) },
    { pattern: /zjaw|widm/, look: () => ({ grid: GRIDS.windSpirit, scale: 2, hover: 6, alpha: 0.55, palette: { ...BASE, w: '#e0fff0', s: '#c8f0dc', e: '#1a3a2a', c: '#8ad8b0' } }) },
    { pattern: /upior/, look: () => ({ grid: GRIDS.wraith, scale: 2, hover: 6, alpha: 0.85, palette: { ...BASE, k: '#4a4070', F: '#7a6aaa', O: '#7fffd4', w: '#c8c8e0' } }) },
    // "sluzacy"/"sluzka" are servants: the slime takes only its own word forms.
    { pattern: /\bsluz(u|em|owiec|owca|owcem)?\b/, look: (_, folded) => {
        const [g, G] = /czerw|krwist/.test(folded) ? ['#cf4a4a', '#8a2a2a'] : /niebiesk|blekit/.test(folded) ? ['#4a8acf', '#2a5a9a']
            : /czarn|smolist/.test(folded) ? ['#3a3a44', '#1e1e26'] : /fiolet|purpur/.test(folded) ? ['#8a4acf', '#5a2a9a']
            : /zolt/.test(folded) ? ['#cfc04a', '#9a8a2a'] : ['#6acf4a', '#3a9a2a'];
        return { grid: GRIDS.slime, scale: 2, alpha: 0.85, palette: { ...BASE, g, G, O: '#ffffff', k: '#1a1a12' } };
    } },
    { pattern: /szkielet|nieumar|kosciej|kosciotrup|\btrup|mumi|wampir/, look: () => ({ grid: GRIDS.skeleton, scale: 2, weapon: 'sword', palette: BASE }) },
    // --- elementals and cave folk ---
    { pattern: /zywiolak\w* ognia|ognist\w* zywiolak/, look: () => ({ grid: GRIDS.elemental, scale: 2, hover: 5, palette: { ...BASE, o: '#ff7a1a', O: '#ffd54a', e: '#7a1a00' } }) },
    { pattern: /zywiolak\w* ziemi|ziemn\w* zywiolak/, look: () => ({ grid: GRIDS.elemental, scale: 2, palette: { ...BASE, o: '#6a4a2a', O: '#9a7a52', e: '#ffb347' } }) },
    { pattern: /zywiolak\w* powietrza/, look: () => ({ grid: GRIDS.elemental, scale: 2, hover: 8, alpha: 0.6, palette: { ...BASE, o: '#cfe6ff', O: '#ffffff', e: '#5a8ac9' } }) },
    { pattern: /zywiolak\w* wody|wodn\w* zywiolak/, look: () => ({ grid: GRIDS.elemental, scale: 2, hover: 4, alpha: 0.8, palette: { ...BASE, o: '#2a6ac9', O: '#7fc4ff', e: '#ffffff' } }) },
    { pattern: /troglodyt/, look: () => ({ grid: GRIDS.troglodyte, scale: 2, weapon: 'club', palette: { ...BASE, s: '#7a8a6a', S: '#4e5a44', E: '#ffd54a', w: '#e8e4d0', n: '#6a4a2a', N: '#4a3018' } }) },
    { pattern: /fimir/, look: () => ({ grid: GRIDS.fimir, scale: 2, palette: { ...BASE, f: '#8a7a5a', F: '#5e5038', O: '#fff6c8', e: '#c0392b', w: '#e8e4d0', M: '#5a5a62', n: '#4a3a2a' } }) },
    { pattern: /\bghast/, look: () => ({ grid: GRIDS.ghoul, scale: 2, palette: { ...BASE, s: '#7a8a6a', S: '#4e5a44', E: '#ff4040', w: '#e8e4d0', n: '#2a2a22' } }) },
    { pattern: /gremlin/, look: () => ({ grid: GRIDS.kobold, scale: 2, weapon: 'dagger', palette: { ...BASE, g: '#6a8a5a', G: '#4a6a3a', E: '#ffd54a', w: '#e8e4d0', n: '#3a3a44', k: '#1a1222' } }) },
    { pattern: /bobolak/, look: () => ({ grid: GRIDS.korred, scale: 2, weapon: 'club', palette: { ...BASE, h: '#5a4a3a', s: '#a08060', n: '#4a3a2a', f: '#6a5a4a', e: '#1a1222', k: '#1a1222' } }) },
    { pattern: /barghest/, look: () => ({ grid: GRIDS.beast, scale: 3, palette: { ...BASE, f: '#2a2a30', F: '#141418', E: '#ff3030', w: '#e8e4d0', k: '#0a0a0e' } }) },
    { pattern: /\bdemon(a|em|owi|y|ow|ami|ica|icy|ice|ico)?\b/, look: (_, folded) => ({ grid: GRIDS.demon, scale: 2, palette: /demonic/.test(folded)
        ? { ...BASE, r: '#9c3f80', R: '#6a2856', w: '#e8e4d0', E: '#ffd54a', f: '#4a1a3a', F: '#2a0a20', k: '#1a0a0a' }
        : { ...BASE, r: '#b8333a', R: '#7e1f2a', w: '#e8e4d0', E: '#ffd54a', f: '#5a1a2a', F: '#2e0a14', k: '#1a0a0a' } }) },
    { pattern: /gargul/, look: () => ({ grid: GRIDS.gargoyle, scale: 2, hover: 4, palette: { ...BASE, m: '#8a8a84', M: '#5a5a56', O: '#ff6a3a', w: '#e8e4d0', k: '#3a3a36' } }) },
    { pattern: /drzewc|drzewiec/, look: () => ({ grid: GRIDS.treant, scale: 3, palette: { ...BASE, g: '#4a8a3a', G: '#2e5a22', n: '#6a4a2a', N: '#3e2a18', O: '#ffd54a' } }) },
    // The porcini of the forest: a brown cap on the mushroom-folk body.
    { pattern: /borowik/, look: () => ({ grid: GRIDS.mushroom, scale: 2, palette: { ...BASE, r: '#7a4a22', w: '#efe6d0', b: '#c8b48a', e: '#1a1222' } }) },
    { pattern: /\bbulw(a|y|e|ie|a)?\b/, look: () => ({ grid: GRIDS.slime, scale: 2, palette: { ...BASE, g: '#a08050', G: '#6a5030', O: '#ffffff', k: '#e8e4d0' } }) },
    { pattern: /\bzmor(a|y|e|o|ami)?\b|nocnic/, look: () => ({ grid: GRIDS.windSpirit, scale: 2, hover: 6, alpha: 0.6, palette: { ...BASE, w: '#b0a0c8', s: '#9080b0', e: '#1a0a2a', c: '#6a5a8a' } }) },
    { pattern: /rusalk/, look: () => ({ grid: GRIDS.dryad, scale: 2, palette: { ...BASE, g: '#5aa0a0', G: '#3a7a7a', n: '#c8e0d8', N: '#7aa8a0', r: '#7fd3ff', e: '#1a1222' } }) },
    { pattern: /potepien/, look: () => ({ grid: GRIDS.zombie, scale: 2, palette: { ...BASE, s: '#b8a07a', S: '#8a7450', n: '#c8b48a', c: '#a08a60', R: '#6a5030', h: '#8a7450', e: '#ff4040', k: '#1a1222' } }) },
    // Killed in the dark: the game only says "ktos", so only the eyes show.
    { pattern: /^\s*(ktos|kogos|komus|kims)\s*$/, look: () => {
        const shadow = Object.fromEntries(Object.keys(BASE).map(k => [k, '#0c0a12']));
        return { grid: GRIDS.ranger, scale: 2, palette: { ...shadow, e: '#f2e6a0' } };
    } },
    { pattern: /pomiot\w* chaosu/, look: () => ({ grid: GRIDS.chaosSpawn, scale: 3, palette: { ...BASE, r: '#6a3fa0', R: '#3a2060', p: '#b8333a', w: '#e8e4d0', E: '#ffe14a', k: '#1a0a2a' } }) },
    { pattern: /mutant/, look: () => ({ grid: GRIDS.chaosSpawn, scale: 2, palette: { ...BASE, r: '#7a8a4a', R: '#4e5a2a', p: '#8a4acf', w: '#e8e4d0', E: '#ff4040', k: '#2a2a10' } }) },
    { pattern: /\bstworek|\bstworka/, look: h => ({ grid: GRIDS.monster, scale: 1, palette: { ...BASE, f: h % 2 ? '#54465e' : '#5e4636', F: '#30283a', S: '#8a6a7a', w: '#e8e4d0', E: '#ff3030', k: '#140e14' } }) },
    { pattern: /\bmonstrum|\bpotwor(a|em|owi|y|ow|ami)?\b|\bstwor(a|em|owi|y|ow|ami|zenie|zenia)?\b/, look: h => ({ grid: GRIDS.monster, scale: 2, palette: { ...BASE, f: h % 2 ? '#4a5e46' : '#5e4636', F: '#2a3a28', S: '#8a7a6a', w: '#e8e4d0', E: '#ffd54a', k: '#140e14' } }) },
    // --- birds, hoofed beasts and small fry ---
    { pattern: /\bbocian/, look: () => ({ grid: GRIDS.heron, scale: 2, palette: { ...BASE, w: '#f4f1ff', F: '#1a1a1a', k: '#1a1a1a', y: '#c0392b', r: '#f4f1ff', e: '#1a1222' } }) },
    { pattern: /\bczapl/, look: () => ({ grid: GRIDS.heron, scale: 2, palette: { ...BASE, w: '#c8ccd4', F: '#8a909c', k: '#3a3a44', y: '#d0a030', r: '#3a3a44', e: '#1a1222' } }) },
    { pattern: /\bzuraw/, look: () => ({ grid: GRIDS.heron, scale: 2, palette: { ...BASE, w: '#b8bcc4', F: '#5a5e68', k: '#2a2a30', y: '#3a3a3a', r: '#c0392b', e: '#1a1222' } }) },
    { pattern: /\bbazant/, look: () => ({ grid: GRIDS.bird, scale: 2, palette: { ...BASE, f: '#a85a2a', F: '#5a3a1a', r: '#c0392b', y: '#d0a030', e: '#1a1222' } }) },
    { pattern: /\bindyk/, look: () => ({ grid: GRIDS.bird, scale: 2, palette: { ...BASE, f: '#3a3028', F: '#1e1a14', r: '#c0392b', y: '#c0392b', e: '#e8e4d0' } }) },
    { pattern: /kuropatw/, look: () => ({ grid: GRIDS.bird, scale: 2, palette: { ...BASE, f: '#9a8060', F: '#6a5440', r: '#c06030', y: '#8a6a4a', e: '#1a1222' } }) },
    { pattern: /\bkurcz/, look: () => ({ grid: GRIDS.bird, scale: 1, palette: { ...BASE, f: '#f2d84a', F: '#c8a830', r: '#f2d84a', y: '#e07a1a', e: '#1a1222' } }) },
    { pattern: /\bkur(a|y|e|ze|ami)?\b|\bkogut|\bkaczk|\bges\b|\bgesi/, look: h => ({ grid: GRIDS.bird, scale: 2, palette: { ...BASE, f: h % 2 ? '#efe6d0' : '#b06a30', F: h % 2 ? '#b8b0a0' : '#7a4a20', r: '#c0392b', y: '#e0a030', e: '#1a1222' } }) },
    { pattern: /\bptak|\bptas|\bwron|\bkruk/, look: () => ({ grid: GRIDS.bird, scale: 2, palette: { ...BASE, f: '#3a3a44', F: '#1e1e26', r: '#3a3a44', y: '#d0a030', e: '#e8e4d0' } }) },
    { pattern: /nietoperz/, look: () => ({ grid: GRIDS.bat, scale: 2, hover: 8, palette: { ...BASE, k: '#3a2a2a', F: '#2a1a1a', f: '#5a4040', E: '#ff4040', w: '#e8e4d0' } }) },
    { pattern: /\bjelen|\bjelon/, look: () => ({ grid: GRIDS.stag, scale: 3, palette: { ...BASE, f: '#8a5a34', F: '#5a3a20', S: '#3a2a1c', n: '#d8c8a0', e: '#1a1222', k: '#1a1222' } }) },
    { pattern: /\bsarn/, look: () => ({ grid: GRIDS.hoofed, scale: 2, palette: { ...BASE, f: '#a8744a', F: '#6e4a2c', S: '#3a2a1c', e: '#1a1222', k: '#1a1222' } }) },
    { pattern: /\bkon(ia|iem|iowi|ie|i)?\b|\bklacz|\bogier|\bwierzchow|\bkuc(yk)?\b/, look: h => {
        const [f, F] = [['#7a4a2a', '#4e2d18'], ['#3a3a40', '#1e1e24'], ['#b0b0b0', '#7a7a7a'], ['#c08a4a', '#8a5a2a']][h % 4];
        return { grid: GRIDS.hoofed, scale: 3, palette: { ...BASE, f, F, S: '#2a2020', e: '#1a1222', k: '#1a1222' } };
    } },
    { pattern: /\bkrow(a|y|e|ie|ami)?\b/, look: () => ({ grid: GRIDS.hoofed, scale: 3, palette: { ...BASE, f: '#e8e4d0', F: '#5a3a2a', S: '#d8a0a0', e: '#1a1222', k: '#1a1222' } }) },
    { pattern: /\bowc(a|y|e|ami)?\b|\bbaran/, look: () => ({ grid: GRIDS.hoofed, scale: 2, palette: { ...BASE, f: '#efeadc', F: '#b8b2a0', S: '#3a3030', e: '#1a1222', k: '#1a1222' } }) },
    { pattern: /\bkoz(a|y|e|a|ami)?\b|\bkozic|\bkozio|\bkozl/, look: () => ({ grid: GRIDS.hoofed, scale: 2, palette: { ...BASE, f: '#a08a6a', F: '#6a5a42', S: '#3a3028', e: '#1a1222', k: '#1a1222' } }) },
    { pattern: /amfisben/, look: () => ({ grid: GRIDS.amphisbaena, scale: 2, palette: { ...BASE, f: '#6a7a3a', F: '#3e4a20', e: '#ffd54a' } }) },
    { pattern: /\bwaz(a|em|owi|e|y|ow|ami)?\b|\bzmij|\bzmii|\bpyton|zaskron/, look: h => ({ grid: GRIDS.snake, scale: 2, palette: { ...BASE, f: h % 2 ? '#5a8a3a' : '#6a6a5a', F: h % 2 ? '#3a5a22' : '#3e3e34', e: '#1a1222', r: '#c0392b' } }) },
    { pattern: /\brobak|\bdzdzown|\bczerw(ia|iem|ie|iu)?\b/, look: () => ({ grid: GRIDS.snake, scale: 1, palette: { ...BASE, f: '#d08a8a', F: '#a06060', e: '#d08a8a', r: '#d08a8a' } }) },
    { pattern: /\bzab(a|y|e|ie|ka|ki)?\b|\bropuch/, look: () => ({ grid: GRIDS.frog, scale: 2, palette: { ...BASE, g: '#5aa04a', G: '#3a7a2a', w: '#f2c94c', e: '#1a1222', y: '#c8d07a' } }) },
    { pattern: /\bjez(a|em|owi|e|y|ow)?\b/, look: () => ({ grid: GRIDS.hedgehog, scale: 2, palette: { ...BASE, k: '#3a2a1c', n: '#6a5040', s: '#c8a080', e: '#1a1222' } }) },
    // --- armour, knights and soldiery ---
    { pattern: /plytow/, look: () => ({ grid: GRIDS.chaosKnight, scale: 2, weapon: 'sword', palette: { ...BASE, M: '#7a8494', m: '#b8c0cc', k: '#1a1a22', R: '#3a3a44', r: '#5a5a66', y: '#9aa0b0', w: '#b8c0cc', E: '#7fd3ff' } }) },
    { pattern: /\brycerz/, look: h => ({ grid: GRIDS.chaosKnight, scale: 2, weapon: 'sword', palette: { ...BASE, M: '#8a94a4', m: '#cfd8e3', k: '#1a1222', E: '#1a1222', w: '#c0392b', y: '#c9a227', ...uniform(h) } }) },
    { pattern: /straznik|strazniczk|wartownik|pikinier/, look: h => ({ grid: GRIDS.guard, scale: 2, weapon: 'halberd', palette: { ...BASE, ...uniform(h) } }) },
    { pattern: /kawalerzyst/, look: h => ({ grid: GRIDS.lancer, scale: 2, weapon: 'lance', palette: { ...BASE, r: UNIFORM[h % UNIFORM.length][0] } }) },
    { pattern: /tarczownik|weteran|najemni/, look: (h, folded) => ({ grid: GRIDS.soldier, scale: 2, weapon: /weteran/.test(folded) || h % 2 ? 'axe' : 'sword', palette: { ...BASE, ...uniform(h) } }) },
    // --- elves of war, executioners ---
    { pattern: /tancerz\w* wojny|tancerk\w* wojny/, look: () => ({ grid: GRIDS.elf, scale: 2, weapon: 'sword', palette: { ...BASE, h: '#d9772b', c: '#3f8f5a', C: '#25603a' } }) },
    { pattern: /egzekutor|oprawc|\bkat(a|em|owi)?\b/, look: (_, folded) => /elf/.test(folded)
        ? { grid: GRIDS.elf, scale: 2, weapon: 'axe', palette: { ...BASE, h: '#e8e4d0', c: '#2a2a33', C: '#140e14' } }
        : { grid: GRIDS.ranger, scale: 2, weapon: 'axe', palette: { ...BASE, c: '#2a2a2a', C: '#1a1a1a', e: '#ff4040' } } },
    // --- common folk; "zjawa kobiety" and the like are taken above ---
    { pattern: /niziol|halfling|hobbit/, look: h => raceLook('halfling', h) },
    { pattern: /\bkarzel|\bkarl(a|em|owi|y|ow)?\b/, look: h => raceLook('dwarf', h) },
    { pattern: /dziewczynk|chlopiec|chlopc|chlopczyk|\bdzieck|\bdziec/, look: h => ({ grid: GRIDS.child, scale: 2, palette: { ...BASE, c: CLOTH[h % CLOTH.length][0], h: HAIR[(h >>> 4) % HAIR.length] } }) },
    { pattern: /wojowniczk/, look: h => ({ grid: GRIDS.woman, scale: 2, weapon: 'sword', palette: { ...BASE, c: CLOTH[h % CLOTH.length][0], C: CLOTH[h % CLOTH.length][1], h: HAIR[(h >>> 4) % HAIR.length] } }) },
    { pattern: /kobiet|dziewczyn|wiesniaczk|niewiast|staruszk|mieszczk/, look: (h, folded) => ({ grid: GRIDS.woman, scale: 2, palette: { ...BASE, c: CLOTH[h % CLOTH.length][0], C: CLOTH[h % CLOTH.length][1], h: /staruszk/.test(folded) ? '#e8e4d0' : HAIR[(h >>> 4) % HAIR.length] } }) },
    { pattern: /starzec|starca|starcem|staruszek/, look: () => ({ grid: GRIDS.elder, scale: 2, weapon: 'staff', palette: { ...BASE, h: '#e8e4d0', c: '#7a6a52', C: '#4e4434' } }) },
    { pattern: /marynarz|zeglarz|majtek/, look: () => ({ grid: GRIDS.villager, scale: 2, weapon: 'sabre', palette: { ...BASE, c: '#3a6ec9', C: '#24468a', n: '#f4f1ff', h: '#3a2a1c' } }) },
    { pattern: /mezczyzn|wiesniak|\bchlop(a|em|i|ow)?\b|mieszczanin|parobek/, look: h => ({ grid: GRIDS.villager, scale: 2, weapon: 'club', palette: { ...BASE, c: CLOTH[h % CLOTH.length][0], C: CLOTH[h % CLOTH.length][1], h: HAIR[(h >>> 4) % HAIR.length] } }) },
];

/** Bandits, guards and everyone else humanoid: a hooded figure in dark cloth. */
function brigandLook(h: number): SpriteLook {
    const [cloth, clothDark] = [['#5a4038', '#3a2a25'], ['#3b3f4a', '#25282f'], ['#5a2a2a', '#3a1a1a']][h % 3];
    return { grid: GRIDS.ranger, scale: 2, weapon: h % 2 ? 'sword' : 'club', palette: { ...BASE, c: cloth, C: clothDark, e: '#ff4040' } };
}

/**
 * `race` is known for the player, teammates, and enemies the people database
 * names - all of them other players, so their race beats the monster rules.
 * An enemy player who has not introduced themselves still shows a race noun in
 * the description ("wysoki elf"); it counts only when no monster rule fits.
 */
export function pickLook(desc: string, side: 'me' | 'team' | 'enemy', race?: string): SpriteLook {
    if (side !== 'enemy') return heroLook(desc, race);
    const folded = foldText(desc);
    const h = hashOf(folded);
    const known = raceOf(race);
    if (known) return raceLook(known, h);
    const rule = ENEMY_RULES.find(r => r.pattern.test(folded));
    if (rule) return rule.look(h, folded);
    const described = raceOf(raceWordOf(desc));
    return described ? raceLook(described, h) : brigandLook(h);
}
