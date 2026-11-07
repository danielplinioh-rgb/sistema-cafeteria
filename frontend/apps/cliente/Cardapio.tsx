import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Aparencia } from '../../src/compartilhado/aparencia';
import { urlImagem } from '../../src/compartilhado/aparencia';
import { formatarPreco } from '../../src/compartilhado/formatar';
import { Icone } from '../../src/compartilhado/icones';
import { T } from '../../src/compartilhado/textos';
import type { CategoriaCardapio, ProdutoCardapio } from '../../src/compartilhado/tipos';

interface Props {
  aparencia: Aparencia;
  categorias: CategoriaCardapio[] | null;
  erro: boolean;
  aoRecarregar: () => void;
  aoEscolher: (p: ProdutoCardapio) => void;
  /** Quantas unidades de cada produto já estão no carrinho (selo no cartão). */
  noCarrinho: Map<number, number>;
  modoEdicao: boolean;
}

/** Tela principal: cabeçalho da marca, banner, abas de categoria e produtos (RF02, RF04, RF18). */
export function Cardapio({ aparencia, categorias, erro, aoRecarregar, aoEscolher, noCarrinho, modoEdicao }: Props): ReactElement {
  const [ativa, setAtiva] = useState<number | null>(null);
  const secoes = useRef(new Map<number, HTMLElement>());

  // Destaca a aba da categoria que está visível enquanto o cliente rola a página.
  useEffect(() => {
    if (!categorias || categorias.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visivel = entradas.find((e) => e.isIntersecting);
        if (visivel) setAtiva(Number((visivel.target as HTMLElement).dataset.categoria));
      },
      { rootMargin: '-120px 0px -65% 0px' },
    );
    secoes.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [categorias]);

  const ir = (id: number) => {
    setAtiva(id);
    secoes.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <header className="marca">
        <img className="marca__logo" src={aparencia.marca.logo} alt="" width={44} height={44} />
        <div>
          <h1 className="marca__nome">{aparencia.marca.nome}</h1>
          {aparencia.marca.slogan && <p className="marca__slogan">{aparencia.marca.slogan}</p>}
        </div>
      </header>

      {modoEdicao && (
        <div className="faixa faixa--aviso faixa--edicao" role="status">
          Você está alterando seu pedido. Ajuste os itens e toque em “Salvar alterações”.
        </div>
      )}

      {aparencia.cliente.mostrarBanner && (
        <div className="banner" style={{ backgroundImage: `url(${aparencia.marca.banner})` }} role="img" aria-label="Destaques do cardápio" />
      )}

      {categorias === null && !erro && <div className="girando" role="status" aria-label={T.carregando} />}

      {erro && (
        <div className="erro-cardapio cartao" role="alert">
          <Icone nome="alerta" tamanho={32} />
          <p>{T.cardapioIndisponivel}</p>
          <button className="botao" onClick={aoRecarregar}>
            {T.tentarNovamente}
          </button>
        </div>
      )}

      {categorias && categorias.length > 0 && (
        <nav className="abas" aria-label="Categorias">
          {categorias.map((c) => (
            <button key={c.idCategoria} className={`aba ${ativa === c.idCategoria ? 'aba--ativa' : ''}`} onClick={() => ir(c.idCategoria)}>
              {c.nome}
            </button>
          ))}
        </nav>
      )}

      {categorias?.map((c) => (
        <section
          key={c.idCategoria}
          className="secao"
          data-categoria={c.idCategoria}
          ref={(el) => {
            if (el) secoes.current.set(c.idCategoria, el);
            else secoes.current.delete(c.idCategoria);
          }}
        >
          <h2 className="secao__titulo">{c.nome}</h2>
          <ul className="produtos">
            {c.produtos.map((p) => {
              const qtd = noCarrinho.get(p.idProduto) ?? 0;
              return (
                <li key={p.idProduto}>
                  <button
                    className={`produto ${p.disponivel ? '' : 'produto--indisponivel'}`}
                    disabled={!p.disponivel}
                    onClick={() => aoEscolher(p)}
                    aria-label={`${p.nome}, ${formatarPreco(p.preco)}${p.disponivel ? '' : ', ' + T.indisponivel}`}
                  >
                    <span className="produto__foto">
                      <img src={urlImagem(p.imagem, aparencia.marca.imagemPadrao)} alt="" loading="lazy" />
                      {!p.disponivel && <span className="produto__selo">{T.indisponivel}</span>}
                      {qtd > 0 && <span className="produto__qtd">{qtd}</span>}
                    </span>
                    <span className="produto__texto">
                      <span className="produto__nome">{p.nome}</span>
                      {aparencia.cliente.mostrarDescricao && p.descricao && <span className="produto__desc">{p.descricao}</span>}
                      <span className="produto__rodape">
                        <span className="produto__preco">{formatarPreco(p.preco)}</span>
                        {p.disponivel && (
                          <span className="produto__mais" aria-hidden="true">
                            <Icone nome="mais" tamanho={18} />
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
