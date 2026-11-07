/**
 * Aparência configurável em tempo de execução.
 *
 * O arquivo /config/aparencia.json (pasta frontend/publico/config) define cores, formas,
 * fontes, logo, banner e opções de layout. Ele é lido ao abrir a página e aplicado como
 * variáveis CSS; trocar o arquivo muda os DOIS módulos sem recompilar nada.
 * Se o arquivo faltar ou estiver inválido, valem os padrões definidos em tokens.css.
 */

export interface Aparencia {
  marca: { nome: string; slogan: string; logo: string; banner: string; imagemPadrao: string };
  variaveis: Record<string, string>;
  cliente: {
    layoutProdutos: 'grade' | 'lista';
    mostrarBanner: boolean;
    alturaBanner: string;
    mostrarDescricao: boolean;
    intervaloAtualizacaoSeg: number;
  };
  painel: {
    urlCliente: string;
    intervaloAtualizacaoSeg: number;
    minutosInatividade: number;
    larguraMenu: string;
  };
}

export const APARENCIA_PADRAO: Aparencia = {
  marca: {
    nome: 'Cafeteria',
    slogan: '',
    logo: '/imagens/logo.svg',
    banner: '/imagens/banner.svg',
    imagemPadrao: '/imagens/sem-imagem.svg',
  },
  variaveis: {},
  cliente: {
    layoutProdutos: 'grade',
    mostrarBanner: true,
    alturaBanner: '168px',
    mostrarDescricao: true,
    intervaloAtualizacaoSeg: 4,
  },
  painel: { urlCliente: '', intervaloAtualizacaoSeg: 5, minutosInatividade: 30, larguraMenu: '248px' },
};

/** Só aceitamos nomes de variáveis CSS e valores sem caracteres perigosos (o arquivo é do administrador, mas validamos mesmo assim). */
const NOME_VARIAVEL = /^--[a-z0-9-]{2,40}$/;
const VALOR_SEGURO = /^[^;{}<>\\]{1,200}$/;

export function mesclar(base: Aparencia, lido: unknown): Aparencia {
  if (!lido || typeof lido !== 'object') return base;
  const l = lido as Partial<Record<keyof Aparencia, Record<string, unknown>>>;
  return {
    marca: { ...base.marca, ...(somenteTextos(l.marca)) },
    variaveis: { ...base.variaveis, ...somenteTextos(l.variaveis) },
    cliente: { ...base.cliente, ...(l.cliente as object) } as Aparencia['cliente'],
    painel: { ...base.painel, ...(l.painel as object) } as Aparencia['painel'],
  };
}

function somenteTextos(o: Record<string, unknown> | undefined): Record<string, string> {
  const saida: Record<string, string> = {};
  if (!o || typeof o !== 'object') return saida;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') saida[k] = v;
  }
  return saida;
}

export function aplicarVariaveis(alvo: HTMLElement, variaveis: Record<string, string>): void {
  for (const [nome, valor] of Object.entries(variaveis)) {
    if (NOME_VARIAVEL.test(nome) && VALOR_SEGURO.test(valor)) {
      alvo.style.setProperty(nome, valor);
    }
  }
}

/** Lê o JSON, aplica no <html> e devolve a configuração para os componentes. */
export async function carregarAparencia(): Promise<Aparencia> {
  let aparencia = APARENCIA_PADRAO;
  try {
    const r = await fetch('/config/aparencia.json', { cache: 'no-cache' });
    if (r.ok) aparencia = mesclar(APARENCIA_PADRAO, await r.json());
  } catch {
    /* sem arquivo: usa os padrões */
  }
  const raiz = document.documentElement;
  aplicarVariaveis(raiz, aparencia.variaveis);
  raiz.dataset.layoutProdutos = aparencia.cliente.layoutProdutos === 'lista' ? 'lista' : 'grade';
  raiz.style.setProperty('--altura-banner', aparencia.cliente.alturaBanner);
  raiz.style.setProperty('--largura-menu', aparencia.painel.larguraMenu);
  return aparencia;
}

/** Endereço da imagem de um produto, com a imagem padrão se não houver. */
export function urlImagem(nome: string | null | undefined, padrao: string): string {
  if (!nome) return padrao;
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*\.(svg|png|jpe?g|webp|gif)$/i.test(nome)) return padrao;
  return `/imagens/${nome}`;
}
