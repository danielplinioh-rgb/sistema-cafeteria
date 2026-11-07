import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Aparencia } from '../../src/compartilhado/aparencia';
import { formatarPreco, tempoDecorrido } from '../../src/compartilhado/formatar';
import { api } from '../../src/compartilhado/http';
import { ROTULO_STATUS_PAINEL, T } from '../../src/compartilhado/textos';
import { useAvisos } from '../../src/compartilhado/toast';
import type { PedidoPainel, Status } from '../../src/compartilhado/tipos';
import { usePolling } from '../../src/compartilhado/usePolling';
import { DetalhePedido } from './DetalhePedido';
import { bipe } from './util';

const COLUNAS: Status[] = ['AGUARDANDO_PAGAMENTO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE'];

/** Fila de pedidos do terminal (RF07): quadro em colunas por status, atualizado automaticamente. */
export function Fila({ aparencia, aoContar }: { aparencia: Aparencia; aoContar: (n: number) => void }): ReactElement {
  const [pedidos, setPedidos] = useState<PedidoPainel[] | null>(null);
  const [falha, setFalha] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [novos, setNovos] = useState<Set<string>>(new Set());
  const conhecidos = useRef<Set<string> | null>(null);
  const { avisar } = useAvisos();

  usePolling(async () => {
    try {
      const lista = await api.get<PedidoPainel[]>('/api/painel/pedidos', { painel: true });
      // Detecta pedidos que acabaram de chegar (a primeira carga não conta).
      if (conhecidos.current) {
        const chegaram = lista.filter((p) => !conhecidos.current!.has(p.codigo));
        if (chegaram.length > 0) {
          bipe();
          avisar(chegaram.length === 1 ? `Novo pedido: ${chegaram[0].codigo}` : `${chegaram.length} novos pedidos`, 'info');
          setNovos((s) => new Set([...s, ...chegaram.map((c) => c.codigo)]));
          window.setTimeout(() => setNovos((s) => new Set([...s].filter((c) => !chegaram.some((n) => n.codigo === c)))), 10_000);
        }
      }
      conhecidos.current = new Set(lista.map((p) => p.codigo));
      setPedidos(lista);
      setFalha(false);
      aoContar(lista.filter((p) => p.status === 'AGUARDANDO_PAGAMENTO').length);
    } catch {
      setFalha(true);
    }
  }, aparencia.painel.intervaloAtualizacaoSeg);

  const atualizarUm = (p: PedidoPainel) => {
    setPedidos((lista) => {
      if (!lista) return lista;
      // pedidos finalizados/cancelados saem da fila; os demais são substituídos
      if (p.status === 'FINALIZADO' || p.status === 'CANCELADO') return lista.filter((x) => x.codigo !== p.codigo);
      return lista.map((x) => (x.codigo === p.codigo ? p : x));
    });
    if (p.status === 'FINALIZADO' || p.status === 'CANCELADO') setAberto(null);
  };

  const selecionado = pedidos?.find((p) => p.codigo === aberto) ?? null;

  return (
    <div className={`fila ${selecionado ? 'fila--com-detalhe' : ''}`}>
      <div className="fila__quadro">
        {falha && <div className="faixa faixa--erro" role="alert">{T.instabilidade}</div>}
        {pedidos === null && !falha && <div className="girando" role="status" aria-label={T.carregando} />}
        {pedidos && (
          <div className="colunas">
            {COLUNAS.map((status) => {
              const doStatus = pedidos.filter((p) => p.status === status);
              return (
                <section key={status} className={`coluna coluna--${status.toLowerCase()}`} aria-label={ROTULO_STATUS_PAINEL[status]}>
                  <h3 className="coluna__titulo">
                    {ROTULO_STATUS_PAINEL[status]} <span className="coluna__contagem">{doStatus.length}</span>
                  </h3>
                  {doStatus.length === 0 && <p className="vazio">Nenhum pedido</p>}
                  {doStatus.map((p) => (
                    <button
                      key={p.codigo}
                      className={`cartao-pedido ${aberto === p.codigo ? 'cartao-pedido--ativo' : ''} ${novos.has(p.codigo) ? 'cartao-pedido--novo' : ''}`}
                      onClick={() => setAberto(p.codigo)}
                    >
                      <span className="cartao-pedido__topo">
                        <strong>{p.codigo}</strong>
                        <small>{tempoDecorrido(p.dataHora)}</small>
                      </span>
                      <span className="cartao-pedido__local">{p.local}</span>
                      <span className="cartao-pedido__itens">
                        {p.itens.slice(0, 3).map((i) => `${i.quantidade}× ${i.produto}`).join(', ')}
                        {p.itens.length > 3 && ` +${p.itens.length - 3}`}
                      </span>
                      <strong className="cartao-pedido__total">{formatarPreco(p.valorTotal)}</strong>
                    </button>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>
      {selecionado && <DetalhePedido pedido={selecionado} aparencia={aparencia} aoAtualizar={atualizarUm} aoFechar={() => setAberto(null)} />}
    </div>
  );
}
