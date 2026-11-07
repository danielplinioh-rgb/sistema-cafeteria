/**
 * Gerador de QR Code (norma ISO/IEC 18004), modo byte, correção de erros nível M,
 * versões 1 a 10 (até 213 bytes — suficiente para qualquer endereço do site).
 * Sem dependências: o QR é gerado no navegador do colaborador, sem enviar o endereço a terceiros.
 */

// [versão] -> blocos: [qtde, dados por bloco] (grupo 1 e 2) e códigos de correção por bloco
const BLOCOS_M: { ec: number; grupos: [number, number][] }[] = [
  { ec: 10, grupos: [[1, 16]] },
  { ec: 16, grupos: [[1, 28]] },
  { ec: 26, grupos: [[1, 44]] },
  { ec: 18, grupos: [[2, 32]] },
  { ec: 24, grupos: [[2, 43]] },
  { ec: 16, grupos: [[4, 27]] },
  { ec: 18, grupos: [[4, 31]] },
  { ec: 22, grupos: [[2, 38], [2, 39]] },
  { ec: 22, grupos: [[3, 36], [2, 37]] },
  { ec: 26, grupos: [[4, 43], [1, 44]] },
];
const ALINHAMENTO: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// ---- aritmética de Reed-Solomon em GF(256) (polinômio 0x11d) -------------------
const EXP = new Array<number>(512);
const LOG = new Array<number>(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function multiplicar(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

function restoRS(dados: number[], nEc: number): number[] {
  let gerador = [1];
  for (let i = 0; i < nEc; i++) {
    const prox = new Array<number>(gerador.length + 1).fill(0);
    for (let j = 0; j < gerador.length; j++) {
      prox[j] ^= gerador[j];
      prox[j + 1] ^= multiplicar(gerador[j], EXP[i]);
    }
    gerador = prox;
  }
  const resto = new Array<number>(nEc).fill(0);
  for (const d of dados) {
    const fator = d ^ resto[0];
    resto.shift();
    resto.push(0);
    for (let i = 0; i < nEc; i++) resto[i] ^= multiplicar(gerador[i + 1], fator);
  }
  return resto;
}

function bit(valor: number, i: number): boolean {
  return ((valor >>> i) & 1) !== 0;
}

/** Retorna a matriz do QR (true = módulo escuro). */
export function gerarQr(texto: string, mascaraForcada?: number): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(texto));
  let versao = 0;
  for (let v = 1; v <= 10; v++) {
    const capacidade = BLOCOS_M[v - 1].grupos.reduce((s, [n, d]) => s + n * d, 0);
    const bitsContagem = v < 10 ? 8 : 16;
    if (4 + bitsContagem + bytes.length * 8 <= capacidade * 8) {
      versao = v;
      break;
    }
  }
  if (versao === 0) throw new Error('Endereço longo demais para o QR Code (máx. 213 caracteres).');

  const { ec, grupos } = BLOCOS_M[versao - 1];
  const totalDados = grupos.reduce((s, [n, d]) => s + n * d, 0);

  // 1) fluxo de bits: modo(0100) + contagem + dados + terminador + preenchimento
  const bits: number[] = [];
  const empurrar = (valor: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  empurrar(0b0100, 4);
  empurrar(bytes.length, versao < 10 ? 8 : 16);
  bytes.forEach((b) => empurrar(b, 8));
  empurrar(0, Math.min(4, totalDados * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const palavras: number[] = [];
  for (let i = 0; i < bits.length; i += 8) palavras.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; palavras.length < totalDados; pad ^= 0xec ^ 0x11) palavras.push(pad);

  // 2) divide em blocos, calcula correção de erros e intercala
  const blocosDados: number[][] = [];
  let pos = 0;
  for (const [n, d] of grupos) {
    for (let i = 0; i < n; i++) {
      blocosDados.push(palavras.slice(pos, pos + d));
      pos += d;
    }
  }
  const blocosEc = blocosDados.map((b) => restoRS(b, ec));
  const final: number[] = [];
  const maxDados = Math.max(...blocosDados.map((b) => b.length));
  for (let i = 0; i < maxDados; i++) blocosDados.forEach((b) => i < b.length && final.push(b[i]));
  for (let i = 0; i < ec; i++) blocosEc.forEach((b) => final.push(b[i]));

  // 3) desenha os padrões fixos
  const tam = 17 + 4 * versao;
  const m: boolean[][] = Array.from({ length: tam }, () => new Array<boolean>(tam).fill(false));
  const fixo: boolean[][] = Array.from({ length: tam }, () => new Array<boolean>(tam).fill(false));
  const set = (x: number, y: number, escuro: boolean) => {
    if (x >= 0 && x < tam && y >= 0 && y < tam) {
      m[y][x] = escuro;
      fixo[y][x] = true;
    }
  };
  for (let i = 0; i < tam; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const localizador = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
  };
  localizador(3, 3);
  localizador(tam - 4, 3);
  localizador(3, tam - 4);
  const pos2 = ALINHAMENTO[versao - 1];
  pos2.forEach((cy, i) =>
    pos2.forEach((cx, j) => {
      const nosCantos = (i === 0 && j === 0) || (i === 0 && j === pos2.length - 1) || (i === pos2.length - 1 && j === 0);
      if (nosCantos) return;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );

  const formato = (mascara: number) => {
    const dados = (0 << 3) | mascara; // nível M = 00
    let r = dados;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((dados << 10) | r) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
    set(8, 7, bit(b, 6));
    set(8, 8, bit(b, 7));
    set(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) set(tam - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) set(8, tam - 15 + i, bit(b, i));
    set(8, tam - 8, true);
  };
  formato(0);
  if (versao >= 7) {
    let r = versao;
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (versao << 12) | r;
    for (let i = 0; i < 18; i++) {
      const a = tam - 11 + (i % 3);
      const c = Math.floor(i / 3);
      set(a, c, bit(b, i));
      set(c, a, bit(b, i));
    }
  }

  // 4) posiciona os dados em zigue-zague
  let k = 0;
  for (let direita = tam - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5;
    for (let vert = 0; vert < tam; vert++)
      for (let j = 0; j < 2; j++) {
        const x = direita - j;
        const subindo = ((direita + 1) & 2) === 0;
        const y = subindo ? tam - 1 - vert : vert;
        if (!fixo[y][x] && k < final.length * 8) {
          m[y][x] = bit(final[k >>> 3], 7 - (k & 7));
          k++;
        }
      }
  }

  // 5) escolhe a máscara de menor penalidade
  const condicao = [
    (x: number, y: number) => (x + y) % 2 === 0,
    (_x: number, y: number) => y % 2 === 0,
    (x: number) => x % 3 === 0,
    (x: number, y: number) => (x + y) % 3 === 0,
    (x: number, y: number) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const aplicar = (mascara: number) => {
    for (let y = 0; y < tam; y++)
      for (let x = 0; x < tam; x++) if (!fixo[y][x] && condicao[mascara](x, y)) m[y][x] = !m[y][x];
  };
  let melhor = 0;
  let menor = Infinity;
  for (let mascara = 0; mascara < 8; mascara++) {
    if (mascaraForcada !== undefined && mascara !== mascaraForcada) continue;
    aplicar(mascara);
    formato(mascara);
    const p = penalidade(m);
    if (p < menor) {
      menor = p;
      melhor = mascara;
    }
    aplicar(mascara);
  }
  aplicar(melhor);
  formato(melhor);
  return m;
}

function penalidade(m: boolean[][]): number {
  const n = m.length;
  let p = 0;
  // regra 1: sequências de 5+ módulos iguais; regra 3: padrão semelhante ao localizador
  const linhaPenal = (get: (i: number) => boolean) => {
    let corrida = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && get(i) === get(i - 1)) corrida++;
      else {
        if (corrida >= 5) p += 3 + (corrida - 5);
        corrida = 1;
      }
    }
    for (let i = 0; i + 10 < n; i++) {
      const s = Array.from({ length: 11 }, (_, k) => (get(i + k) ? 1 : 0)).join('');
      if (s === '10111010000' || s === '00001011101') p += 40;
    }
  };
  for (let a = 0; a < n; a++) {
    linhaPenal((i) => m[a][i]);
    linhaPenal((i) => m[i][a]);
  }
  // regra 2: blocos 2x2
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++)
      if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  // regra 4: proporção de escuros
  const escuros = m.reduce((s, l) => s + l.filter(Boolean).length, 0);
  p += (Math.ceil(Math.abs(escuros * 20 - n * n * 10) / (n * n)) - 1) * 10;
  return p;
}
