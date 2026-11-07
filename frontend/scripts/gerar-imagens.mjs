// Gera as ilustrações de exemplo (SVG) usadas pelo cardápio, banner e logo.
// Todas são desenhos originais, leves (poucos KB) e servem como imagens padrão.
// Para trocar por fotos reais basta colocar os arquivos em publico/imagens e
// apontar o nome do arquivo no cadastro do produto (coluna produto.imagem).
//
// Uso: node scripts/gerar-imagens.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = join(dirname(fileURLToPath(import.meta.url)), '..', 'publico', 'imagens');
mkdirSync(pasta, { recursive: true });

const W = 480, H = 360;

/** Moldura comum: fundo suave com gradiente + sombra no chão. */
function moldura(fundoA, fundoB, corpo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
<defs>
  <linearGradient id="fundo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${fundoA}"/><stop offset="1" stop-color="${fundoB}"/></linearGradient>
  <radialGradient id="brilho" cx="0.3" cy="0.2" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#fundo)"/><rect width="${W}" height="${H}" fill="url(#brilho)"/>
${corpo}
</svg>`;
}

/** Xícara com pires, líquido, espuma opcional e vapor. */
function xicara({ fundoA, fundoB, louca = '#fffaf3', liquido, espuma, arte = 'nenhuma', vapor = true }) {
  const arteSvg = arte === 'coracao'
    ? `<path d="M240 170c-18-22-46-4-30 14 8 9 30 22 30 22s22-13 30-22c16-18-12-36-30-14z" fill="#fff" opacity=".85" transform="translate(0 -10) scale(1 .85) translate(0 22)"/>`
    : arte === 'folha'
      ? `<path d="M240 150c-22 6-34 22-34 38 20-2 34-14 34-38zm0 0c22 6 34 22 34 38-20-2-34-14-34-38z" fill="#fff" opacity=".8"/><path d="M240 150v50" stroke="${liquido}" stroke-width="3"/>`
      : '';
  const vaporSvg = vapor
    ? `<g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".75">
        <path d="M205 120c-14-18 14-30 0-50"/><path d="M240 112c-14-18 14-30 0-52"/><path d="M275 120c-14-18 14-30 0-50"/></g>`
    : '';
  return moldura(fundoA, fundoB, `
<ellipse cx="240" cy="296" rx="150" ry="22" fill="#000" opacity=".12"/>
<ellipse cx="240" cy="282" rx="140" ry="26" fill="${louca}"/><ellipse cx="240" cy="276" rx="118" ry="19" fill="#fff" opacity=".7"/>
<path d="M150 166h180c0 62-34 108-90 108s-90-46-90-108z" fill="${louca}"/>
<path d="M330 184c46-6 52 52-10 62" fill="none" stroke="${louca}" stroke-width="16" stroke-linecap="round"/>
<ellipse cx="240" cy="166" rx="90" ry="24" fill="${espuma}"/><ellipse cx="240" cy="168" rx="76" ry="18" fill="${liquido}"/>
${arteSvg}
<path d="M168 190c6 40 30 70 72 76-40-10-62-40-72-76z" fill="#fff" opacity=".35"/>
${vaporSvg}`);
}

/** Copo alto (bebida gelada) com gelo e canudo. */
function copo({ fundoA, fundoB, liquido, topo }) {
  return moldura(fundoA, fundoB, `
<ellipse cx="240" cy="306" rx="86" ry="14" fill="#000" opacity=".12"/>
<path d="M170 96h140l-14 200c-1 10-12 16-56 16s-55-6-56-16z" fill="#fff" opacity=".55"/>
<path d="M176 130h128l-12 164c-1 8-10 12-52 12s-51-4-52-12z" fill="${liquido}"/>
<path d="M176 130h128l-2 24H178z" fill="${topo}" opacity=".9"/>
<g fill="#fff" opacity=".7"><rect x="196" y="160" width="44" height="44" rx="9" transform="rotate(-10 218 182)"/><rect x="240" y="206" width="42" height="42" rx="9" transform="rotate(12 261 227)"/><rect x="204" y="236" width="38" height="38" rx="9" transform="rotate(6 223 255)"/></g>
<path d="M258 40l22 236" stroke="#c0392b" stroke-width="10" stroke-linecap="round"/><path d="M258 40l-8-14" stroke="#c0392b" stroke-width="10" stroke-linecap="round"/>
<path d="M186 110c-2 60 4 120 12 180" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".6" fill="none"/>`);
}

/** Alfajor: duas bolachas com recheio. */
function alfajor({ fundoA, fundoB, bolacha, cobertura, recheio = '#b5651d' }) {
  return moldura(fundoA, fundoB, `
<ellipse cx="240" cy="290" rx="150" ry="22" fill="#000" opacity=".12"/>
<ellipse cx="240" cy="272" rx="150" ry="26" fill="#fffaf3"/>
<g>
<ellipse cx="240" cy="236" rx="104" ry="34" fill="${bolacha}"/>
<ellipse cx="240" cy="214" rx="100" ry="30" fill="${recheio}"/>
<ellipse cx="240" cy="186" rx="104" ry="36" fill="${cobertura || bolacha}"/>
<ellipse cx="240" cy="176" rx="86" ry="22" fill="#fff" opacity=".18"/>
${cobertura ? '' : '<g fill="#fff" opacity=".8"><circle cx="205" cy="180" r="3"/><circle cx="240" cy="172" r="3"/><circle cx="276" cy="182" r="3"/><circle cx="224" cy="192" r="3"/><circle cx="258" cy="194" r="3"/></g>'}
</g>`);
}

/** Brownie: quadrado com cobertura brilhante. */
function brownie() {
  return moldura('#f4e3d3', '#e8c9aa', `
<ellipse cx="240" cy="296" rx="140" ry="20" fill="#000" opacity=".12"/>
<ellipse cx="240" cy="278" rx="140" ry="24" fill="#fffaf3"/>
<path d="M150 200l90-34 90 34-90 38z" fill="#4a2c1a"/><path d="M150 200v44l90 38v-44z" fill="#3b2113"/><path d="M330 200v44l-90 38v-44z" fill="#2f190e"/>
<path d="M170 196l70-26 70 26" fill="none" stroke="#6b4129" stroke-width="6" stroke-linecap="round" opacity=".8"/>
<g fill="#fff" opacity=".35"><ellipse cx="206" cy="194" rx="22" ry="5" transform="rotate(-18 206 194)"/></g>`);
}

const imagens = {
  'cappuccino.svg':       xicara({ fundoA: '#f6e7d6', fundoB: '#e9c9a6', liquido: '#a0643a', espuma: '#f3e3cc', arte: 'coracao' }),
  'expresso.svg':         xicara({ fundoA: '#efe2d3', fundoB: '#d9bfa0', liquido: '#4a2a17', espuma: '#8a5a3a', louca: '#fff6ea', vapor: true }),
  'cha-preto.svg':        xicara({ fundoA: '#f3e6d0', fundoB: '#e2c79a', liquido: '#b5651d', espuma: '#d99a52', louca: '#fff3df' }),
  'latte.svg':            xicara({ fundoA: '#f9ece0', fundoB: '#efd3b8', liquido: '#c48a5c', espuma: '#f7ead8', arte: 'folha' }),
  'mocha.svg':            xicara({ fundoA: '#efdccc', fundoB: '#d2a98a', liquido: '#6b3a22', espuma: '#c9a07e', arte: 'coracao' }),
  'chocolate-quente.svg': xicara({ fundoA: '#f1ddd0', fundoB: '#cf9e86', liquido: '#4b2519', espuma: '#7a4631', louca: '#fff0e6' }),
  'cafe-gelado.svg':      copo({ fundoA: '#e8eef2', fundoB: '#cfdbe3', liquido: '#7a4a2c', topo: '#d8b48c' }),
  'cold-brew.svg':        copo({ fundoA: '#e5edf0', fundoB: '#c3d3da', liquido: '#3a2214', topo: '#8a5a3a' }),
  'alfajor.svg':          alfajor({ fundoA: '#f8ead8', fundoB: '#ecd2b0', bolacha: '#e6b878' }),
  'alfajor-chocolate.svg': alfajor({ fundoA: '#f2e1d3', fundoB: '#dcbba0', bolacha: '#d9a766', cobertura: '#4a2a1a' }),
  'brownie.svg':          brownie(),
  'sem-imagem.svg': moldura('#f1e9df', '#e2d4c3', `
<g fill="none" stroke="#a58b77" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity=".8">
<path d="M170 150h140c0 52-28 92-70 92s-70-40-70-92z"/><path d="M310 164c36-4 40 42-8 50"/><path d="M200 120c-10-14 10-22 0-38M240 114c-10-14 10-22 0-40M280 120c-10-14 10-22 0-38"/></g>`),
};

/** Banner do topo: gradiente quente com grãos de café decorativos. */
function banner() {
  const grao = (x, y, r, giro, op) => `<g transform="translate(${x} ${y}) rotate(${giro})" opacity="${op}">
    <ellipse rx="${r}" ry="${r * 0.68}" fill="#2b140a"/><path d="M${-r * 0.8} 0c${r * 0.4}-${r * 0.35} ${r * 0.9} ${r * 0.35} ${r * 1.6} 0" stroke="#d9a066" stroke-width="${r * 0.12}" fill="none" stroke-linecap="round" transform="translate(0 -${r * 0.02})"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" role="img">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a2716"/><stop offset=".55" stop-color="#7a4527"/><stop offset="1" stop-color="#b9772f"/></linearGradient>
<radialGradient id="l" cx=".85" cy=".1" r=".7"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="520" fill="url(#g)"/><rect width="1200" height="520" fill="url(#l)"/>
<g fill="#fff" opacity=".06"><circle cx="1010" cy="120" r="210"/><circle cx="1120" cy="400" r="150"/><circle cx="80" cy="470" r="170"/></g>
${grao(980, 380, 62, -24, 0.9)}${grao(1110, 210, 46, 32, 0.8)}${grao(860, 130, 38, -10, 0.7)}${grao(1040, 470, 34, 50, 0.7)}${grao(120, 90, 40, 18, 0.5)}${grao(250, 440, 30, -36, 0.45)}${grao(700, 450, 28, 12, 0.4)}
<g fill="none" stroke="#ffe2b8" stroke-width="8" stroke-linecap="round" opacity=".28"><path d="M890 300c-22-30 22-48 0-82"/><path d="M940 292c-22-30 22-48 0-82"/></g>
</svg>`;
}

/** Logotipo genérico (xícara em um círculo) — troque pelo logotipo oficial quando houver. */
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5a3f"/><stop offset="1" stop-color="#4a2716"/></linearGradient></defs>
<circle cx="48" cy="48" r="46" fill="url(#a)"/>
<path d="M26 40h38c0 18-8 30-19 30s-19-12-19-30z" fill="#fff6e8"/><path d="M64 44c10-1 11 12-2 14" fill="none" stroke="#fff6e8" stroke-width="5" stroke-linecap="round"/>
<ellipse cx="45" cy="40" rx="19" ry="4" fill="#e8a33d"/><rect x="24" y="72" width="42" height="5" rx="2.5" fill="#fff6e8" opacity=".9"/>
<path d="M38 30c-4-5 4-8 0-14M48 28c-4-5 4-8 0-14M58 30c-4-5 4-8 0-14" fill="none" stroke="#ffd9a0" stroke-width="3" stroke-linecap="round"/>
</svg>`;

for (const [nome, svg] of Object.entries(imagens)) writeFileSync(join(pasta, nome), svg);
writeFileSync(join(pasta, 'banner.svg'), banner());
writeFileSync(join(pasta, 'logo.svg'), logo);
console.log(`Imagens geradas em ${pasta}`);
