import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Aparencia } from '../../src/compartilhado/aparencia';
import { urlImagem } from '../../src/compartilhado/aparencia';
import { formatarPreco } from '../../src/compartilhado/formatar';
import { ErroApi, api } from '../../src/compartilhado/http';
import { Icone } from '../../src/compartilhado/icones';
import { Modal } from '../../src/compartilhado/Modal';
import { T } from '../../src/compartilhado/textos';
import { useAvisos } from '../../src/compartilhado/toast';
import type { CategoriaView, ObservacaoView, ProdutoEntrada, ProdutoPainel } from '../../src/compartilhado/tipos';
import { useAcao } from './util';

type Dialogo =
  | { tipo: 'disponibilidade'; produto: ProdutoPainel; pendentes: number }
  | { tipo: 'remover'; produto: ProdutoPainel }
  | { tipo: 'form'; produto: ProdutoPainel | null }
  | null;

/** Gestão de produtos: disponibilidade (RF18), cadastro, edição e remoção lógica. */
export function Produtos({ aparencia }: { aparencia: Aparencia }): ReactElement {
  const [produtos, setProdutos] = useState<ProdutoPainel[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaView[]>([]);
  const [observacoes, setObservacoes] = useState<ObservacaoView[]>([]);
  const [erro, setErro] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const { ocupado, executar } = useAcao();
  const { avisar } = useAvisos();

  const carregar = useCallback(async () => {
    try {
      const [p, c, o] = await Promise.all([
        api.get<ProdutoPainel[]>('/api/painel/produtos', { painel: true }),
        api.get<CategoriaView[]>('/api/painel/categorias', { painel: true }),
        api.get<ObservacaoView[]>('/api/painel/observacoes', { painel: true }),
      ]);
      setProdutos(p);
      setCategorias(c);
      setObservacoes(o);
      setErro(false);
    } catch (e) {
      if (!(e instanceof ErroApi) || e.status !== 401) setErro(true);
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Antes de confirmar, descobre se há pedidos pendentes com o produto para avisar o colaborador. */
  const pedirDisponibilidade = async (produto: ProdutoPainel) => {
    const r = await executar(() => api.get<{ pedidosPendentes: number }>(`/api/painel/produtos/${produto.idProduto}/pendentes`, { painel: true }));
    if (r) setDialogo({ tipo: 'disponibilidade', produto, pendentes: r.pedidosPendentes });
  };

  const confirmarDisponibilidade = async (produto: ProdutoPainel) => {
    const ok = await executar(() =>
      api.put(`/api/painel/produtos/${produto.idProduto}/disponibilidade`, { disponivel: !produto.disponivel }, { painel: true }),
    );
    if (ok) {
      avisar(produto.disponivel ? 'Produto marcado como indisponível' : 'Produto disponível novamente', 'sucesso');
      setDialogo(null);
      void carregar();
    }
  };

  const confirmarRemocao = async (produto: ProdutoPainel) => {
    const ok = await executar(() => api.delete(`/api/painel/produtos/${produto.idProduto}`, { painel: true }));
    if (ok) {
      avisar('Produto removido do cardápio', 'sucesso');
      setDialogo(null);
      void carregar();
    }
  };

  const grupos = categorias
    .map((c) => ({ categoria: c, itens: (produtos ?? []).filter((p) => p.idCategoria === c.idCategoria) }))
    .filter((g) => g.itens.length > 0);

  return (
    <div>
      <div className="barra-acoes">
        <p className="dica">Produtos indisponíveis aparecem em cinza para o cliente e não podem ser escolhidos.</p>
        <button className="botao" onClick={() => setDialogo({ tipo: 'form', produto: null })}>
          <Icone nome="mais" /> {T.novoProduto}
        </button>
      </div>
      {erro && <div className="faixa faixa--erro" role="alert">{T.instabilidade}</div>}
      {produtos === null && !erro && <div className="girando" role="status" aria-label={T.carregando} />}

      {grupos.map((g) => (
        <section key={g.categoria.idCategoria} className="grupo-produtos">
          <h3>{g.categoria.nome}</h3>
          <div className="cartao tabela-caixa">
            <table className="tabela">
              <tbody>
                {g.itens.map((p) => (
                  <tr key={p.idProduto} className={p.disponivel ? '' : 'linha-indisponivel'}>
                    <td className="tabela__foto"><img src={urlImagem(p.imagem, aparencia.marca.imagemPadrao)} alt="" width={48} height={48} /></td>
                    <td><strong>{p.nome}</strong><br /><small>{p.descricao}</small></td>
                    <td>{formatarPreco(p.preco)}</td>
                    <td>
                      <button
                        role="switch"
                        aria-checked={p.disponivel}
                        aria-label={`${p.nome}: ${p.disponivel ? 'disponível' : 'indisponível'}`}
                        className={`chave ${p.disponivel ? 'chave--ligada' : ''}`}
                        disabled={ocupado}
                        onClick={() => void pedirDisponibilidade(p)}
                      >
                        <span className="chave__bola" />
                      </button>
                      <span className="chave__texto">{p.disponivel ? 'Disponível' : 'Indisponível'}</span>
                    </td>
                    <td className="tabela__acoes">
                      <button className="botao-icone" aria-label={`${T.editar} ${p.nome}`} onClick={() => setDialogo({ tipo: 'form', produto: p })}><Icone nome="editar" tamanho={18} /></button>
                      <button className="botao-icone" aria-label={`${T.remover} ${p.nome}`} onClick={() => setDialogo({ tipo: 'remover', produto: p })}><Icone nome="lixo" tamanho={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {dialogo?.tipo === 'disponibilidade' && (
        <Modal titulo={T.confirmarDisponibilidade} aoFechar={() => setDialogo(null)}>
          <p><strong>{dialogo.produto.nome}</strong> passará a ficar <strong>{dialogo.produto.disponivel ? 'indisponível' : 'disponível'}</strong> no cardápio.</p>
          {dialogo.pendentes > 0 && (
            <div className="faixa faixa--aviso" role="alert">
              Este produto consta em <strong>{dialogo.pendentes}</strong> pedido(s) pendente(s). Eles não serão afetados: a mudança vale apenas para novas seleções.
            </div>
          )}
          <div className="modal__acoes">
            <button className="botao botao--contorno" onClick={() => setDialogo(null)}>{T.cancelar}</button>
            <button className="botao" disabled={ocupado} onClick={() => void confirmarDisponibilidade(dialogo.produto)}>{T.confirmar}</button>
          </div>
        </Modal>
      )}

      {dialogo?.tipo === 'remover' && (
        <Modal titulo="Remover produto do cardápio?" aoFechar={() => setDialogo(null)}>
          <p><strong>{dialogo.produto.nome}</strong> deixará de aparecer no cardápio. O histórico de pedidos é preservado.</p>
          <div className="modal__acoes">
            <button className="botao botao--contorno" onClick={() => setDialogo(null)}>{T.cancelar}</button>
            <button className="botao botao--perigo" disabled={ocupado} onClick={() => void confirmarRemocao(dialogo.produto)}>{T.remover}</button>
          </div>
        </Modal>
      )}

      {dialogo?.tipo === 'form' && (
        <FormularioProduto
          produto={dialogo.produto}
          categorias={categorias}
          observacoes={observacoes}
          aparencia={aparencia}
          aoFechar={() => setDialogo(null)}
          aoSalvar={() => { setDialogo(null); void carregar(); }}
        />
      )}
    </div>
  );
}

function FormularioProduto({
  produto, categorias, observacoes, aparencia, aoFechar, aoSalvar,
}: {
  produto: ProdutoPainel | null;
  categorias: CategoriaView[];
  observacoes: ObservacaoView[];
  aparencia: Aparencia;
  aoFechar: () => void;
  aoSalvar: () => void;
}): ReactElement {
  const [nome, setNome] = useState(produto?.nome ?? '');
  const [descricao, setDescricao] = useState(produto?.descricao ?? '');
  const [preco, setPreco] = useState(produto ? String(produto.preco).replace('.', ',') : '');
  const [categoria, setCategoria] = useState(produto?.idCategoria ?? categorias[0]?.idCategoria ?? 0);
  const [imagem, setImagem] = useState(produto?.imagem ?? '');
  const [obs, setObs] = useState<number[]>(produto?.idObservacoes ?? []);
  const { ocupado, executar } = useAcao();
  const { avisar } = useAvisos();

  const valor = Number(preco.replace(',', '.'));
  const precoOk = /^\d{1,4}([.,]\d{1,2})?$/.test(preco.trim()) && valor >= 0;
  const valido = nome.trim().length > 0 && precoOk && categoria > 0;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const corpo: ProdutoEntrada = { idCategoria: categoria, nome: nome.trim(), descricao: descricao.trim(), preco: valor, imagem: imagem.trim(), observacoes: obs };
    const ok = await executar(() =>
      produto ? api.put(`/api/painel/produtos/${produto.idProduto}`, corpo, { painel: true }) : api.post('/api/painel/produtos', corpo, { painel: true }),
    );
    if (ok) {
      avisar(produto ? 'Produto atualizado' : 'Produto cadastrado', 'sucesso');
      aoSalvar();
    }
  };

  return (
    <Modal titulo={produto ? `${T.editar}: ${produto.nome}` : T.novoProduto} aoFechar={aoFechar} classe="modal--larga">
      <form onSubmit={(e) => void enviar(e)}>
        <div className="form-grade">
          <div>
            <div className="campo"><label htmlFor="p-nome">Nome</label><input id="p-nome" className="entrada" value={nome} maxLength={100} onChange={(e) => setNome(e.target.value)} required /></div>
            <div className="campo"><label htmlFor="p-desc">Descrição</label><textarea id="p-desc" className="entrada" value={descricao} maxLength={255} onChange={(e) => setDescricao(e.target.value)} /></div>
            <div className="campo-duplo">
              <div className="campo"><label htmlFor="p-preco">Preço (R$)</label><input id="p-preco" className="entrada" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} aria-invalid={preco !== '' && !precoOk} required /></div>
              <div className="campo"><label htmlFor="p-cat">Categoria</label>
                <select id="p-cat" className="entrada" value={categoria} onChange={(e) => setCategoria(Number(e.target.value))}>
                  {categorias.map((c) => <option key={c.idCategoria} value={c.idCategoria}>{c.nome}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <div className="campo">
              <label htmlFor="p-img">Arquivo da imagem</label>
              <input id="p-img" className="entrada" value={imagem} maxLength={100} placeholder="ex.: cappuccino.svg" onChange={(e) => setImagem(e.target.value)} />
              <span className="dica">O arquivo fica na pasta publico/imagens.</span>
            </div>
            <img className="previa-imagem" src={urlImagem(imagem.trim() || null, aparencia.marca.imagemPadrao)} alt="Prévia da imagem" onError={(e) => { (e.currentTarget as HTMLImageElement).src = aparencia.marca.imagemPadrao; }} />
            <fieldset className="grupo-obs">
              <legend>Observações aceitas</legend>
              {observacoes.map((o) => (
                <label key={o.id} className="marcador">
                  <input type="checkbox" checked={obs.includes(o.id)} onChange={() => setObs((x) => (x.includes(o.id) ? x.filter((i) => i !== o.id) : [...x, o.id]))} /> {o.descricao}
                </label>
              ))}
            </fieldset>
          </div>
        </div>
        <div className="modal__acoes">
          <button type="button" className="botao botao--contorno" onClick={aoFechar}>{T.cancelar}</button>
          <button className="botao" disabled={!valido || ocupado}>{T.salvar}</button>
        </div>
      </form>
    </Modal>
  );
}
