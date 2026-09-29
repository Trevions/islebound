// Twelve realms — one for every month. Each has its own palette, enemy roster,
// guardian, musical mode and hazards. Enemies unlock progressively (see enemies.js).
export const REALMS = [
  {
    id: 'meadow', month: 'JAN', name: { en: 'Meadow Drift', bg: 'Носеща ливада' },
    tag: { en: 'Where every fall begins', bg: 'Където започва всяко падане' },
    sky: ['#1b2a4a', '#0b1024'], void: '#070a18', ground: '#7bd389', groundDark: '#3e8f5a', accent: '#b8f28a', glow: '#d9ffb0',
    enemies: ['blob', 'bat', 'splitter'], elite: 'brute', boss: 'bramblehart', hazard: null,
    scale: [0, 2, 4, 7, 9], root: 220, debris: 'leaf',
  },
  {
    id: 'coral', month: 'FEB', name: { en: 'Coral Hollow', bg: 'Коралова кухина' },
    tag: { en: 'The sea fell upward', bg: 'Морето падна нагоре' },
    sky: ['#0f3a4a', '#051620'], void: '#03101a', ground: '#5fe0d0', groundDark: '#2a8c8a', accent: '#ff9fb2', glow: '#aefcff',
    enemies: ['blob', 'orbiter', 'spitter', 'bat'], elite: 'shielder', boss: 'tidemaw', hazard: 'current',
    scale: [0, 3, 5, 7, 10], root: 196, debris: 'bubble',
  },
  {
    id: 'ember', month: 'MAR', name: { en: 'Ember Wastes', bg: 'Жарава' },
    tag: { en: 'Stone that remembers fire', bg: 'Камък, който помни огъня' },
    sky: ['#4a1d1a', '#1a0808'], void: '#140606', ground: '#ff9a4d', groundDark: '#a8431e', accent: '#ffd166', glow: '#ffcf8a',
    enemies: ['blob', 'bomber', 'dasher', 'spitter'], elite: 'brute', boss: 'cinderking', hazard: 'embers',
    scale: [0, 1, 4, 5, 7], root: 174, debris: 'ember',
  },
  {
    id: 'frost', month: 'APR', name: { en: 'Frostveil', bg: 'Мразовал' },
    tag: { en: 'Silence has a temperature', bg: 'Тишината има температура' },
    sky: ['#1d3150', '#0a1426'], void: '#081020', ground: '#cfe9ff', groundDark: '#7aa6cf', accent: '#8fd3ff', glow: '#e8f7ff',
    enemies: ['bat', 'shielder', 'blinker', 'splitter'], elite: 'shielder', boss: 'glacimoth', hazard: 'ice',
    scale: [0, 2, 3, 7, 8], root: 247, debris: 'snow',
  },
  {
    id: 'mire', month: 'MAY', name: { en: 'Mirelight Bog', bg: 'Светеща топь' },
    tag: { en: 'The lanterns lie', bg: 'Фенерите лъжат' },
    sky: ['#1f3322', '#0a130b'], void: '#070e08', ground: '#9ccf5c', groundDark: '#4d6b2a', accent: '#e3ff6b', glow: '#f3ffb5',
    enemies: ['wisp', 'blob', 'healer', 'minelayer'], elite: 'healer', boss: 'lanternwitch', hazard: 'fog',
    scale: [0, 3, 5, 6, 10], root: 165, debris: 'firefly',
  },
  {
    id: 'crystal', month: 'JUN', name: { en: 'Crystal Spires', bg: 'Кристални кули' },
    tag: { en: 'Light, broken into rooms', bg: 'Светлина, разчупена на стаи' },
    sky: ['#2c1f4a', '#110a24'], void: '#0c0720', ground: '#c9a7ff', groundDark: '#6b4fb8', accent: '#7ef0ff', glow: '#efe2ff',
    enemies: ['orbiter', 'blinker', 'splitter', 'spitter'], elite: 'brute', boss: 'prismarch', hazard: 'beams',
    scale: [0, 2, 4, 6, 9], root: 262, debris: 'shard',
  },
  {
    id: 'storm', month: 'JUL', name: { en: 'Storm Canopy', bg: 'Бурен покров' },
    tag: { en: 'The sky keeps its own time', bg: 'Небето има свое време' },
    sky: ['#1c2638', '#090d16'], void: '#060910', ground: '#8fb2d9', groundDark: '#43618a', accent: '#fff36b', glow: '#fffbd0',
    enemies: ['bat', 'dasher', 'orbiter', 'bomber', 'blinker'], elite: 'dasher', boss: 'thunderwyrm', hazard: 'lightning',
    scale: [0, 2, 5, 7, 9], root: 185, debris: 'rain',
  },
  {
    id: 'clock', month: 'AUG', name: { en: 'Sunken Clockwork', bg: 'Потънал часовник' },
    tag: { en: 'Someone wound the world', bg: 'Някой навил света' },
    sky: ['#3a2c1a', '#150f08'], void: '#100b05', ground: '#e0b872', groundDark: '#8a6a32', accent: '#ffe29a', glow: '#fff1c9',
    enemies: ['shielder', 'minelayer', 'orbiter', 'splitter', 'spitter'], elite: 'shielder', boss: 'grandgear', hazard: 'gears',
    scale: [0, 2, 4, 5, 7], root: 147, debris: 'cog',
  },
  {
    id: 'bloom', month: 'SEP', name: { en: 'Bloomrot Garden', bg: 'Гниеща градина' },
    tag: { en: 'Beautiful. Hungry.', bg: 'Красиво. Гладно.' },
    sky: ['#3a1a33', '#150812'], void: '#10060e', ground: '#ff8ccf', groundDark: '#9c3f7a', accent: '#b6ff8c', glow: '#ffd0ee',
    enemies: ['healer', 'splitter', 'wisp', 'bomber', 'blob'], elite: 'healer', boss: 'rotqueen', hazard: 'spores',
    scale: [0, 1, 3, 7, 8], root: 208, debris: 'petal',
  },
  {
    id: 'obsidian', month: 'OCT', name: { en: 'Obsidian Maw', bg: 'Обсидианова паст' },
    tag: { en: 'The void has teeth here', bg: 'Тук празнотата има зъби' },
    sky: ['#231a2e', '#08050c'], void: '#050308', ground: '#6e5a8a', groundDark: '#2e2240', accent: '#ff5d73', glow: '#ffb0bc',
    enemies: ['brute', 'dasher', 'blinker', 'minelayer', 'wisp'], elite: 'brute', boss: 'maw', hazard: 'rifts',
    scale: [0, 1, 3, 6, 8], root: 138, debris: 'ash',
  },
  {
    id: 'aurora', month: 'NOV', name: { en: 'Aurora Reach', bg: 'Полярен предел' },
    tag: { en: 'The last warm colors', bg: 'Последните топли цветове' },
    sky: ['#102a3a', '#040c14'], void: '#030a10', ground: '#7dffc8', groundDark: '#2a9c7a', accent: '#c58bff', glow: '#d9fff0',
    enemies: ['orbiter', 'wisp', 'spitter', 'shielder', 'healer', 'blinker'], elite: 'healer', boss: 'aurorax', hazard: 'beams',
    scale: [0, 2, 4, 7, 11], root: 233, debris: 'spark',
  },
  {
    id: 'heart', month: 'DEC', name: { en: 'The Hollow Heart', bg: 'Кухото сърце' },
    tag: { en: 'Where the islands broke', bg: 'Където островите се счупиха' },
    sky: ['#2a0f1f', '#050206'], void: '#030104', ground: '#ffd6e0', groundDark: '#9a4a66', accent: '#ffffff', glow: '#fff0f4',
    enemies: ['blob', 'bat', 'dasher', 'spitter', 'splitter', 'wisp', 'bomber', 'shielder', 'orbiter', 'blinker', 'healer', 'minelayer'],
    elite: 'brute', boss: 'hollowone', hazard: 'rifts', scale: [0, 2, 3, 7, 10], root: 131, debris: 'mote',
  },
];

// Stage name generator parts — each of the 360 stages has a unique name.
export const STAGE_ADJ = {
  en: ['Whispering', 'Shattered', 'Drowsy', 'Hollow', 'Gilded', 'Restless', 'Tangled', 'Silent', 'Crooked', 'Dimming', 'Bright', 'Sunken', 'Humming', 'Forgotten', 'Lonely', 'Wild', 'Mirrored', 'Stitched', 'Frayed', 'Endless'],
  bg: ['Шепнещ', 'Разбит', 'Сънлив', 'Кух', 'Позлатен', 'Неспокоен', 'Заплетен', 'Безмълвен', 'Крив', 'Гаснещ', 'Светъл', 'Потънал', 'Бръмчащ', 'Забравен', 'Самотен', 'Див', 'Огледален', 'Зашит', 'Протрит', 'Безкраен'],
};
export const STAGE_NOUN = {
  en: ['Shelf', 'Rift', 'Hollow', 'Ledge', 'Garden', 'Stair', 'Crossing', 'Nest', 'Spire', 'Basin', 'Reef', 'Orchard', 'Gate', 'Well', 'Terrace', 'Bridge', 'Vault', 'Grove', 'Drift', 'Crown'],
  bg: ['Рид', 'Процеп', 'Долчинка', 'Корниз', 'Градина', 'Стълба', 'Кръстопът', 'Гнездо', 'Връх', 'Котловина', 'Риф', 'Овощна', 'Порта', 'Кладенец', 'Тераса', 'Мост', 'Свод', 'Горичка', 'Преспа', 'Корона'],
};
