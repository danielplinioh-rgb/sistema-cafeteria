import { describe, expect, it } from 'vitest';
import { adicionar, chaveLinha, mesaValida, mudarQuantidade, paraEntrada, totalValor } from '../../apps/cliente/carrinho';
import type { Linha } from '../../apps/cliente/carrinho';
import { APARENCIA_PADRAO, mesclar, urlImagem } from '../compartilhado/aparencia';
import { somarItens, tempoDecorrido } from '../compartilhado/formatar';
import { gerarQr } from '../compartilhado/qr';

const linha = (id: number, obs: number[], qtd: number, preco = 10): Linha => ({
  chave: chaveLinha(id, obs), idItem: null, idProduto: id, nome: 'P' + id, imagem: null, preco, quantidade: qtd,
  observacoes: obs, nomesObservacoes: [],
});

describe('carrinho', () => {
  it('mesmo produto e observações somam quantidade, respeitando o máximo de 20', () => {
    let l = adicionar([], linha(1, [2, 1], 15));
    l = adicionar(l, linha(1, [1, 2], 10));
    expect(l).toHaveLength(1);
    expect(l[0].quantidade).toBe(20);
  });
  it('observações diferentes criam linhas diferentes', () => {
    expect(adicionar([linha(1, [1], 1)], linha(1, [], 1))).toHaveLength(2);
  });
  it('quantidade zero remove a linha', () => {
    const l = mudarQuantidade([linha(1, [], 1)], chaveLinha(1, []), -1);
    expect(l).toHaveLength(0);
  });
  it('total é arredondado em centavos', () => {
    expect(totalValor([linha(1, [], 3, 8.5), linha(2, [], 1, 0.1)])).toBe(25.6);
  });
  it('valida número da mesa como o servidor', () => {
    expect(mesaValida('7')).toBe(true);
    expect(mesaValida('0')).toBe(false);
    expect(mesaValida('10000')).toBe(false);
    expect(mesaValida('1a')).toBe(false);
  });
  it('monta o corpo da requisição sem preço nem total', () => {
    const e = paraEntrada([linha(1, [3], 2)], { tipo: 'MESA', mesa: '12' });
    expect(e).toEqual({ tipo: 'MESA', mesa: 12, itens: [{ idItem: null, idProduto: 1, quantidade: 2, observacoes: [3] }] });
    expect(paraEntrada([], { tipo: 'BALCAO', mesa: '5' }).mesa).toBeNull();
  });
});

describe('aparência', () => {
  it('mescla somente textos válidos e mantém padrões', () => {
    const a = mesclar(APARENCIA_PADRAO, { marca: { nome: 'X', logo: 5 }, variaveis: { '--cor-primaria': '#fff' } });
    expect(a.marca.nome).toBe('X');
    expect(a.marca.logo).toBe(APARENCIA_PADRAO.marca.logo);
    expect(a.variaveis['--cor-primaria']).toBe('#fff');
  });
  it('ignora lixo', () => {
    expect(mesclar(APARENCIA_PADRAO, null)).toBe(APARENCIA_PADRAO);
  });
  it('imagem inválida cai na padrão (sem travessia de diretório)', () => {
    expect(urlImagem('../x.png', '/p.svg')).toBe('/p.svg');
    expect(urlImagem('a.svg', '/p.svg')).toBe('/imagens/a.svg');
    expect(urlImagem(null, '/p.svg')).toBe('/p.svg');
  });
});

describe('formatar', () => {
  it('soma e tempo', () => {
    expect(somarItens([{ quantidade: 2, preco: 1.1 }])).toBe(2.2);
    expect(tempoDecorrido('2026-01-01T10:00:00Z', Date.parse('2026-01-01T10:05:00Z'))).toBe('há 5 min');
  });
});

describe('qr', () => {
  it('gera matriz com tamanho de versão válida e finders', () => {
    const m = gerarQr('http://192.168.0.10/');
    expect((m.length - 17) % 4).toBe(0);
    expect(m[0][0] && m[0][6] && m[6][0]).toBe(true);
  });
  it('recusa endereço grande demais', () => {
    expect(() => gerarQr('x'.repeat(300))).toThrow();
  });
});
