import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Aparencia } from '../../src/compartilhado/aparencia';
import { urlImagem } from '../../src/compartilhado/aparencia';
import { ErroApi, api } from '../../src/compartilhado/http';
import { formatarPreco, resumoObservacoes } from '../../src/compartilhado/formatar';
import { Icone } from '../../src/compartilhado/icones';
import type { NomeIcone } from '../../src/compartilhado/icones';
import { ROTULO_STATUS_CLIENTE, T } from '../../src/compartilhado/textos';
import { useAvisos } from '../../src/compartilhado/toast';
import type { PedidoCliente, Status } from '../../src/compartilhado/tipos';
import { usePolling } from '../../src/compartilhado/usePolling';
import type { PedidoSalvo } from './carrinho';

const ETAPAS: Status[] = ['AGUARDANDO_PAGAMENTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE'];

const ICONE_STATUS: Record<Status, NomeIcone> = {
  AGUARDANDO_PAGAMENTO: 'caixa',
  EM_PREPARO: 'copo',
  PRONTO: 'sino',
  ENTREGUE: 'check',
  FINALIZADO: 'check',
  CANCELADO: 'x',
};

/** Posição do status na barra de progresso (FINALIZADO aparece como "Entregue", RF13). */
export function etapaDoStatus(s: Status): number {
  if (s === 'FINALIZADO') return 3;
  return Math.max(0, ETAPAS.indexOf(s));
}

interface Props {
  aparencia: Aparencia;
  salvo: PedidoSalvo;
  aoAlterar: (pedido: PedidoCliente) => void;
  aoNovoPedido: () => void;
  aoPedidoInexistente: () => void;
}

/** Acompanhamento do pedido (RF13/RF14): código, status em tempo quase real e ações permitidas. */
export function TelaPedido({ aparencia, salvo, aoAlterar, aoNovoPedido, aoPedidoInexistente }: Props): ReactElement {
  const [pedido, setPedido] = useState<PedidoCliente | null>(null);
  const [falha, setFalha] = useState(false);
  const anterior = useRef<Status | null>(null);
  const { avisar } = useAvisos();

  const encerrado = pedido?.status === 'FINALIZADO' || pedido?.status === 'CANCELADO';

  usePolling(
    async () => {
      try {
        const p = await api.get<PedidoCliente>(`/api/pedidos/${encodeURIComponent(salvo.codigo)}`, { token: salvo.token });
        setPedido(p);
        setFalha(false);
      } catch (e) {
        if (e instanceof ErroApi && e.status === 404) aoPedidoInexistente();
        else setFalha(true); // falha momentânea: mantém o último status e tenta de novo
      }
    },
    aparencia.cliente.intervaloAtualizacaoSeg,
    !encerrado,
  );

  // Avisa o cliente quando o pedido fica pronto (RF14).
  useEffect(() => {
    if (!pedido) return;
    if (anterior.current && anterior.current !== pedido.status && pedido.status === 'PRONTO') {
      avisar(T.pedidoPronto, 'sucesso');
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* sem vibração */
      }
    }
    anterior.current = pedido.status;
  }, [pedido, avisar]);

  if (!pedido) {
    return (
      <div className="tela-pedido">
        {falha ? <div className="faixa faixa--erro" role="alert">{T.semConexao}</div> : <div className="girando" role="status" aria-label={T.carregando} />}
      </div>
    );
  }

  const cancelado = pedido.status === 'CANCELADO';
  const etapa = etapaDoStatus(pedido.status);
  const naMesa = pedido.local.startsWith('Mesa');

  return (
    <div className="tela-pedido">
      <div className="codigo cartao">
        <span className="codigo__rotulo">{T.codigoDoPedido}</span>
        <strong className="codigo__valor">{pedido.codigo}</strong>
        <span className="codigo__local">{pedido.local}</span>
      </div>

      <div className={`situacao situacao--${pedido.status.toLowerCase()}`} role="status" aria-live="polite">
        <span className="situacao__icone"><Icone nome={ICONE_STATUS[pedido.status]} tamanho={28} /></span>
        <div>
          <strong>
            {pedido.status === 'AGUARDANDO_PAGAMENTO' ? T.pagamentoNoBalcao : pedido.status === 'PRONTO' ? T.pedidoPronto : ROTULO_STATUS_CLIENTE[pedido.status]}
          </strong>
          <p>
            {pedido.status === 'AGUARDANDO_PAGAMENTO' && T.vaAoBalcao}
            {pedido.status === 'EM_PREPARO' && 'Estamos preparando seu pedido com carinho.'}
            {pedido.status === 'PRONTO' && (naMesa ? T.prontoMesa : T.prontoRetirar)}
            {(pedido.status === 'ENTREGUE' || pedido.status === 'FINALIZADO') && T.pedidoEntregue}
            {cancelado && T.pedidoCancelado}
          </p>
        </div>
      </div>

      {!cancelado && (
        <ol className="etapas" aria-label="Progresso do pedido">
          {ETAPAS.map((s, i) => (
            <li key={s} className={`etapa ${i < etapa ? 'etapa--feita' : ''} ${i === etapa ? 'etapa--atual' : ''}`} aria-current={i === etapa ? 'step' : undefined}>
              <span className="etapa__ponto">{i < etapa ? <Icone nome="check" tamanho={14} /> : i + 1}</span>
              <span className="etapa__nome">{ROTULO_STATUS_CLIENTE[s]}</span>
            </li>
          ))}
        </ol>
      )}

      <section className="cartao itens-pedido" aria-label="Itens do pedido">
        <ul>
          {pedido.itens.map((i) => (
            <li key={i.idItem ?? i.produto + i.quantidade}>
              <img src={urlImagem(i.imagem, aparencia.marca.imagemPadrao)} alt="" width={44} height={44} />
              <div>
                <strong>{i.quantidade}× {i.produto}</strong>
                {i.observacoes.length > 0 && <small>{resumoObservacoes(i.observacoes)}</small>}
              </div>
              <span>{formatarPreco(i.precoUnitario * i.quantidade)}</span>
            </li>
          ))}
        </ul>
        <div className="total">
          <span>{T.total}</span>
          <strong>{formatarPreco(pedido.valorTotal)}</strong>
        </div>
      </section>

      {falha && <div className="faixa faixa--aviso" role="status">{T.semConexao}</div>}

      <div className="acoes-pedido">
        {pedido.status === 'AGUARDANDO_PAGAMENTO' && (
          <button className="botao botao--secundario botao--bloco" onClick={() => aoAlterar(pedido)}>
            <Icone nome="editar" tamanho={18} /> {T.alterarPedido}
          </button>
        )}
        {encerrado && (
          <button className="botao botao--bloco" onClick={aoNovoPedido}>
            {T.novoPedido}
          </button>
        )}
      </div>
      {!encerrado && <p className="atualizacao">{T.atualizadoAgora}</p>}
    </div>
  );
}
