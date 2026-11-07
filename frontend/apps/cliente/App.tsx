import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Aparencia } from '../../src/compartilhado/aparencia';
import { ErroApi, api } from '../../src/compartilhado/http';
import { Icone } from '../../src/compartilhado/icones';
import { formatarPreco } from '../../src/compartilhado/formatar';
import { T } from '../../src/compartilhado/textos';
import { ProvedorAvisos, useAvisos } from '../../src/compartilhado/toast';
import type { CategoriaCardapio, PedidoCliente, PedidoCriado, ProdutoCardapio } from '../../src/compartilhado/tipos';
import { Cardapio } from './Cardapio';
import { FolhaCarrinho } from './FolhaCarrinho';
import { FolhaProduto } from './FolhaProduto';
import { TelaPedido } from './TelaPedido';
import {
  adicionar, chaveIdempotencia, dePedido, guardar, linhaDeProduto, mudarQuantidade, paraEntrada, remover,
  totalItens, totalValor,
} from './carrinho';
import type { Linha, Local, PedidoSalvo } from './carrinho';

export function App({ aparencia }: { aparencia: Aparencia }): ReactElement {
  return (
    <ProvedorAvisos>
      <Aplicacao aparencia={aparencia} />
    </ProvedorAvisos>
  );
}

const LOCAL_INICIAL: Local = { tipo: 'MESA', mesa: '' };

function Aplicacao({ aparencia }: { aparencia: Aparencia }): ReactElement {
  const { avisar } = useAvisos();
  const salvoInicial = useMemo(() => guardar.lerCarrinho(), []);

  const [categorias, setCategorias] = useState<CategoriaCardapio[] | null>(null);
  const [erroCardapio, setErroCardapio] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>(salvoInicial?.linhas ?? []);
  const [local, setLocal] = useState<Local>(salvoInicial?.local ?? LOCAL_INICIAL);
  const [pedidoAtivo, setPedidoAtivo] = useState<PedidoSalvo | null>(() => guardar.lerPedido());
  const [editando, setEditando] = useState<PedidoSalvo | null>(null);
  const [escolhido, setEscolhido] = useState<ProdutoCardapio | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const carregarCardapio = useCallback(async () => {
    try {
      setCategorias(await api.get<CategoriaCardapio[]>('/api/cardapio'));
      setErroCardapio(false);
    } catch {
      setErroCardapio(true); // RF02: "Não foi possível carregar o cardápio no momento"
    }
  }, []);
  useEffect(() => {
    void carregarCardapio();
  }, [carregarCardapio]);

  // O carrinho de um NOVO pedido sobrevive a recarregar a página; o de alteração não.
  useEffect(() => {
    if (!editando) guardar.carrinho(linhas, local);
  }, [linhas, local, editando]);

  const noCarrinho = useMemo(() => {
    const m = new Map<number, number>();
    linhas.forEach((l) => m.set(l.idProduto, (m.get(l.idProduto) ?? 0) + l.quantidade));
    return m;
  }, [linhas]);

  // ------------------------------------------------------------------ ações
  const adicionarProduto = (qtd: number, obs: number[]) => {
    if (!escolhido) return;
    setLinhas((l) => adicionar(l, linhaDeProduto(escolhido, qtd, obs)));
    setEscolhido(null);
    setErroEnvio(null);
  };

  const enviar = async () => {
    setEnviando(true);
    setErroEnvio(null);
    try {
      const corpo = paraEntrada(linhas, local);
      if (editando) {
        await api.put<PedidoCliente>(`/api/pedidos/${encodeURIComponent(editando.codigo)}`, corpo, { token: editando.token });
        avisar('Pedido alterado com sucesso!', 'sucesso');
        sairDaEdicao();
      } else {
        const criado = await api.post<PedidoCriado>('/api/pedidos', corpo, {
          idempotencia: chaveIdempotencia(JSON.stringify(corpo)),
        });
        const novo = { codigo: criado.pedido.codigo, token: criado.token };
        guardar.pedido(novo);
        setPedidoAtivo(novo);
        setLinhas([]);
        setCarrinhoAberto(false);
      }
    } catch (e) {
      const erro = e as ErroApi;
      // O carrinho é PRESERVADO em qualquer falha: o cliente pode tentar de novo sem remontar o pedido.
      if (erro instanceof ErroApi && erro.codigo === 'ALTERACAO_APOS_PAGAMENTO') {
        setErroEnvio(T.alteracaoAposPagamento);
      } else if (erro instanceof ErroApi && erro.codigo === 'PRODUTO_INDISPONIVEL') {
        setErroEnvio(erro.message);
        void carregarCardapio();
      } else if (editando) {
        setErroEnvio(erro instanceof ErroApi && erro.status < 500 && erro.status > 0 ? erro.message : T.alteracaoFalhou);
      } else {
        setErroEnvio(erro instanceof ErroApi && erro.status !== 503 && erro.status !== 0 ? erro.message : T.instabilidade);
      }
    } finally {
      setEnviando(false);
    }
  };

  const iniciarEdicao = (pedido: PedidoCliente) => {
    if (!pedidoAtivo) return;
    setEditando(pedidoAtivo);
    setLinhas(dePedido(pedido));
    setErroEnvio(null);
  };
  const sairDaEdicao = () => {
    setEditando(null);
    setLinhas(guardar.lerCarrinho()?.linhas ?? []);
    setCarrinhoAberto(false);
    setErroEnvio(null);
  };

  const novoPedido = () => {
    guardar.pedido(null);
    setPedidoAtivo(null);
  };
  const pedidoInexistente = () => {
    novoPedido();
    avisar('Não encontramos o pedido anterior. Você pode fazer um novo.', 'info');
  };

  // ------------------------------------------------------------------- telas
  const mostrandoPedido = pedidoAtivo !== null && editando === null;

  return (
    <div className="app">
      <main className="conteudo">
        {mostrandoPedido ? (
          <TelaPedido aparencia={aparencia} salvo={pedidoAtivo} aoAlterar={iniciarEdicao} aoNovoPedido={novoPedido} aoPedidoInexistente={pedidoInexistente} />
        ) : (
          <Cardapio
            aparencia={aparencia}
            categorias={categorias}
            erro={erroCardapio}
            aoRecarregar={() => void carregarCardapio()}
            aoEscolher={setEscolhido}
            noCarrinho={noCarrinho}
            modoEdicao={editando !== null}
          />
        )}
      </main>

      {!mostrandoPedido && (linhas.length > 0 || editando) && (
        <div className="barra-carrinho">
          <button className="barra-carrinho__botao" onClick={() => setCarrinhoAberto(true)}>
            <span className="barra-carrinho__icone">
              <Icone nome="sacola" />
              <span className="barra-carrinho__qtd">{totalItens(linhas)}</span>
            </span>
            <span>{editando ? 'Revisar alterações' : T.verPedido}</span>
            <strong>{formatarPreco(totalValor(linhas))}</strong>
          </button>
        </div>
      )}

      {escolhido && <FolhaProduto produto={escolhido} imagemPadrao={aparencia.marca.imagemPadrao} aoAdicionar={adicionarProduto} aoFechar={() => setEscolhido(null)} />}

      {carrinhoAberto && (
        <FolhaCarrinho
          linhas={linhas}
          local={local}
          editando={editando !== null}
          enviando={enviando}
          erro={erroEnvio}
          imagemPadrao={aparencia.marca.imagemPadrao}
          aoMudarLocal={setLocal}
          aoMudarQuantidade={(c, d) => setLinhas((l) => mudarQuantidade(l, c, d))}
          aoRemover={(c) => setLinhas((l) => remover(l, c))}
          aoEnviar={() => void enviar()}
          aoDescartar={sairDaEdicao}
          aoFechar={() => setCarrinhoAberto(false)}
        />
      )}
    </div>
  );
}
