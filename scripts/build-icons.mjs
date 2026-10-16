// Gera public/js/shared/icons.js com uma seleção de ícones do Lucide (lucide-static, licença ISC).
// Só os ícones listados aqui vão para o site, mantendo o frontend leve.
// Uso: npm run build:icons
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('lucide-static/package.json');
const iconsDir = new URL('../node_modules/lucide-static/icons/', import.meta.url);

// [nome no Lucide, rótulo em português usado na busca do seletor]
const SELECTION = [
  ['tag', 'Etiqueta'],
  ['gamepad-2', 'Controle'],
  ['joystick', 'Joystick'],
  ['trophy', 'Troféu'],
  ['medal', 'Medalha'],
  ['award', 'Prêmio'],
  ['crown', 'Coroa'],
  ['star', 'Estrela'],
  ['sparkles', 'Brilho'],
  ['heart', 'Coração'],
  ['heart-crack', 'Coração partido'],
  ['flame', 'Fogo'],
  ['zap', 'Raio'],
  ['swords', 'Espadas'],
  ['sword', 'Espada'],
  ['shield', 'Escudo'],
  ['skull', 'Caveira'],
  ['ghost', 'Fantasma'],
  ['bot', 'Robô'],
  ['rocket', 'Foguete'],
  ['puzzle', 'Quebra-cabeça'],
  ['brain', 'Cérebro'],
  ['map', 'Mapa'],
  ['compass', 'Bússola'],
  ['footprints', 'Exploração'],
  ['mountain', 'Montanha'],
  ['castle', 'Castelo'],
  ['tree-pine', 'Floresta'],
  ['globe', 'Mundo aberto'],
  ['car', 'Corrida'],
  ['plane', 'Avião'],
  ['ship', 'Navio'],
  ['anchor', 'Âncora'],
  ['flag', 'Bandeira'],
  ['target', 'Alvo'],
  ['crosshair', 'Mira'],
  ['timer', 'Cronômetro'],
  ['hourglass', 'Ampulheta'],
  ['clock', 'Relógio'],
  ['calendar', 'Calendário'],
  ['music', 'Música'],
  ['headphones', 'Fones'],
  ['users', 'Multijogador'],
  ['user', 'Solo'],
  ['smile', 'Feliz'],
  ['laugh', 'Risada'],
  ['frown', 'Triste'],
  ['angry', 'Raiva'],
  ['eye', 'Olho'],
  ['moon', 'Lua'],
  ['sun', 'Sol'],
  ['snowflake', 'Neve'],
  ['leaf', 'Folha'],
  ['fish', 'Peixe'],
  ['cat', 'Gato'],
  ['dog', 'Cachorro'],
  ['bug', 'Bug'],
  ['cpu', 'Retrô'],
  ['monitor', 'PC'],
  ['smartphone', 'Celular'],
  ['tv', 'TV'],
  ['wifi', 'Online'],
  ['lock', 'Cadeado'],
  ['key', 'Chave'],
  ['wand-sparkles', 'Magia'],
  ['dices', 'Dados'],
  ['gem', 'Gema'],
  ['coins', 'Moedas'],
  ['gift', 'Presente'],
  ['book-open', 'História'],
  ['bookmark', 'Marcador'],
  ['film', 'Cinematográfico'],
  ['camera', 'Fotografia'],
  ['palette', 'Arte'],
  ['hammer', 'Construção'],
  ['wrench', 'Mods'],
  ['flask-conical', 'Experimental'],
  ['baby', 'Infantil'],
  ['party-popper', 'Festa'],
  ['thumbs-up', 'Recomendado'],
  ['thumbs-down', 'Não recomendado'],
  ['repeat', 'Replay'],
  ['infinity', 'Infinito'],
  ['circle-check', 'Concluído'],
  ['circle-pause', 'Pausado'],
  ['circle-x', 'Abandonado'],
  ['list-checks', 'Checklist'],
  ['percent', 'Porcentagem'],
];

const icons = {};
const missing = [];

for (const [name, label] of SELECTION) {
  let source;
  try {
    source = readFileSync(new URL(`${name}.svg`, iconsDir), 'utf8');
  } catch (_error) {
    missing.push(name);
    continue;
  }

  // Só o conteúdo interno do <svg>, sem quebras de linha.
  const inner = source
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .replace(/\s*\n\s*/g, '')
    .trim();
  icons[name] = { label, svg: inner };
}

if (missing.length) {
  console.error(`Ícones não encontrados no lucide-static ${pkg.version}: ${missing.join(', ')}`);
  process.exit(1);
}

const output = `// Gerado por scripts/build-icons.mjs a partir do lucide-static ${pkg.version} (https://lucide.dev, licença ISC).
// Não edite à mão: ajuste a seleção no script e rode \`npm run build:icons\`.
export const ICONS = ${JSON.stringify(icons, null, 2)};

export const ICON_NAMES = Object.keys(ICONS);

export const DEFAULT_ICON = 'tag';

export function iconSvg(name, className = 'w-4 h-4') {
  const icon = ICONS[name] || ICONS[DEFAULT_ICON];
  return \`<svg xmlns="http://www.w3.org/2000/svg" class="\${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\${icon.svg}</svg>\`;
}
`;

writeFileSync(new URL('../public/js/shared/icons.js', import.meta.url), output);
console.log(`public/js/shared/icons.js gerado com ${Object.keys(icons).length} ícones (lucide-static ${pkg.version}).`);
