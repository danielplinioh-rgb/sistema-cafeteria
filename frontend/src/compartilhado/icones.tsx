/** Ícones SVG embutidos (sem dependências externas). Herdam a cor do texto (currentColor). */
import type { ReactElement } from 'react';

const caminhos: Record<string, string> = {
  mais: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  sacola: 'M6 8h12l-1 12H7L6 8zM9 8a3 3 0 016 0',
  relogio: 'M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  copo: 'M5 8h12v5a5 5 0 01-5 5h-2a5 5 0 01-5-5V8zM17 9h1.5a2.5 2.5 0 010 5H17M8 3v2M12 3v2',
  sino: 'M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 21h4',
  lixo: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  editar: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
  lista: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  historico: 'M3 12a9 9 0 109-9 9 9 0 00-7 3.5M3 4v4h4M12 8v4l3 2',
  caixa: 'M4 8l8-4 8 4v8l-8 4-8-4V8zM4 8l8 4 8-4M12 12v8',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01',
  sair: 'M10 5H6a1 1 0 00-1 1v12a1 1 0 001 1h4M14 8l4 4-4 4M18 12H9',
  alerta: 'M12 4l9 16H3L12 4zM12 10v4M12 17v.01',
  imprimir: 'M7 9V4h10v5M7 17H5a1 1 0 01-1-1v-5a2 2 0 012-2h12a2 2 0 012 2v5a1 1 0 01-1 1h-2M7 14h10v6H7z',
  usuario: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0',
  cadeado: 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z',
};

export type NomeIcone = keyof typeof caminhos;

export function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }): ReactElement {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={caminhos[nome]} />
    </svg>
  );
}
