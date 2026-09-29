// Tiny i18n: English + Bulgarian.
import { Save } from './save.js';

const S = {
  en: {
    play: 'Play', adventure: 'Adventure', daily: 'Daily', island: 'Island', echodex: 'Echodex', more: 'More',
    tapToStart: 'Tap to begin', tagline: 'Fall. Rescue. Rebuild.',
    realm: 'Realm', stage: 'Stage', locked: 'Locked', stars: 'Stars', best: 'Best',
    launch: 'Launch', chooseSong: 'Choose your starting Song', mutators: 'Conditions', guardian: 'Guardian',
    pullToLaunch: 'Pull back and release to launch', survive: 'Survive', defeatGuardian: 'Defeat the Guardian!',
    levelUp: 'Level up!', chooseOne: 'Choose one', reroll: 'Reroll', new: 'NEW', resonance: 'RESONANCE',
    paused: 'Paused', resume: 'Resume', quit: 'Give up', victory: 'Island reached!', defeat: 'Lost to the Void',
    coins: 'Coins', pieces: 'Island pieces', kills: 'Defeated', time: 'Time', rescued: 'Echoes rescued',
    next: 'Next', retry: 'Retry', toIsland: 'Build island', toMap: 'Map', continue: 'Continue',
    buildings: 'Buildings', upgrade: 'Upgrade', max: 'MAX', lands: 'Lands', slot: 'Slot', unlocksAt: 'Unlocks at {n} lands',
    wellTitle: 'Island Well', wellHint: 'Drop your pieces. Full rows become new land.', noPieces: 'No pieces left — dive to earn more.',
    rotate: 'Rotate', drop: 'Drop', housed: 'Housed', house: 'House', unhouse: 'Remove', nestFull: 'Nest is full',
    undiscovered: 'Undiscovered', found: 'Found', dailyTitle: 'Daily World', dailyDesc: 'Same world for every player on Earth today.',
    streak: 'Streak', share: 'Share', copied: 'Copied!', playedToday: 'You already fell today. Come back tomorrow!',
    endless: 'Endless Abyss', endlessDesc: 'No timer. No mercy. How deep can you fall?', endlessLocked: 'Clear realm 3 to unlock',
    settings: 'Settings', music: 'Music', sfx: 'Sound', language: 'Language', exportSave: 'Export save', importSave: 'Import save',
    resetSave: 'Reset progress', confirmReset: 'Really erase everything?', wardrobe: 'Wardrobe', achievements: 'Achievements',
    journal: 'Memory Stones', stats: 'Stats', gems: 'Gems', buy: 'Buy', equip: 'Equip', equipped: 'Equipped',
    nightfall: 'Nightfall', nightfallDesc: 'Hard mode: tougher enemies, +50% rewards.',
    memoryFound: 'Memory stone found', newEcho: 'New Echo!', gardenCollect: 'Collect garden', welcome: 'Welcome back',
    realmLocked: 'Clear the previous realm and hold {n} ★ to enter', howTo: 'Move: drag anywhere · WASD / arrows. Your songs attack on their own.',
    cageHint: 'Stand next to cages to free Echoes', firstClear: 'First clear', flawless: 'Flawless!', hp: 'HP',
    island_level: 'Island', level: 'Lv', dive: 'Dive', abyssBest: 'Deepest fall', install: 'Install app',
  },
  bg: {
    play: 'Играй', adventure: 'Приключение', daily: 'Дневен', island: 'Остров', echodex: 'Ехотека', more: 'Още',
    tapToStart: 'Докосни, за да започнеш', tagline: 'Падни. Спаси. Построй отново.',
    realm: 'Свят', stage: 'Ниво', locked: 'Заключено', stars: 'Звезди', best: 'Рекорд',
    launch: 'Изстреляй', chooseSong: 'Избери начална Песен', mutators: 'Условия', guardian: 'Пазител',
    pullToLaunch: 'Дръпни назад и пусни, за да полетиш', survive: 'Оцелей', defeatGuardian: 'Победи Пазителя!',
    levelUp: 'Ново ниво!', chooseOne: 'Избери едно', reroll: 'Нов избор', new: 'НОВО', resonance: 'РЕЗОНАНС',
    paused: 'Пауза', resume: 'Продължи', quit: 'Откажи се', victory: 'Стигна острова!', defeat: 'Погълнат от Празнотата',
    coins: 'Монети', pieces: 'Парчета остров', kills: 'Победени', time: 'Време', rescued: 'Спасени Ехота',
    next: 'Напред', retry: 'Отново', toIsland: 'Строй остров', toMap: 'Карта', continue: 'Продължи',
    buildings: 'Сгради', upgrade: 'Подобри', max: 'МАКС', lands: 'Земи', slot: 'Място', unlocksAt: 'Отключва се при {n} земи',
    wellTitle: 'Островен кладенец', wellHint: 'Пускай парчетата. Пълните редове стават нова земя.', noPieces: 'Нямаш парчета — спусни се, за да спечелиш още.',
    rotate: 'Завърти', drop: 'Пусни', housed: 'Настанени', house: 'Настани', unhouse: 'Махни', nestFull: 'Гнездото е пълно',
    undiscovered: 'Неоткрито', found: 'Открити', dailyTitle: 'Дневен свят', dailyDesc: 'Един и същ свят за всеки играч на Земята днес.',
    streak: 'Серия', share: 'Сподели', copied: 'Копирано!', playedToday: 'Вече падна днес. Ела утре!',
    endless: 'Безкрайна бездна', endlessDesc: 'Без таймер. Без милост. Колко дълбоко ще паднеш?', endlessLocked: 'Премини свят 3, за да отключиш',
    settings: 'Настройки', music: 'Музика', sfx: 'Звук', language: 'Език', exportSave: 'Експорт на запис', importSave: 'Импорт на запис',
    resetSave: 'Изтрий прогреса', confirmReset: 'Наистина ли да изтрия всичко?', wardrobe: 'Гардероб', achievements: 'Постижения',
    journal: 'Камъни на паметта', stats: 'Статистика', gems: 'Скъпоценни камъни', buy: 'Купи', equip: 'Облечи', equipped: 'Облечено',
    nightfall: 'Нощопад', nightfallDesc: 'Труден режим: по-силни врагове, +50% награди.',
    memoryFound: 'Намерен камък на паметта', newEcho: 'Ново Ехо!', gardenCollect: 'Събери градината', welcome: 'Добре дошъл отново',
    realmLocked: 'Премини предишния свят и събери {n} ★', howTo: 'Движение: плъзни навсякъде · WASD / стрелки. Песните ти атакуват сами.',
    cageHint: 'Застани до клетките, за да освободиш Ехота', firstClear: 'Първо минаване', flawless: 'Без драскотина!', hp: 'Живот',
    island_level: 'Остров', level: 'Ниво', dive: 'Спускане', abyssBest: 'Най-дълбоко', install: 'Инсталирай',
  },
};

export const lang = () => 'en'; // the game ships in English
export function t(key, vars) {
  let s = (S[lang()] && S[lang()][key]) || S.en[key] || key;
  if (vars) for (const k in vars) s = s.replace(`{${k}}`, vars[k]);
  return s;
}
export const L = (obj) => (obj ? obj[lang()] || obj.en || '' : '');
