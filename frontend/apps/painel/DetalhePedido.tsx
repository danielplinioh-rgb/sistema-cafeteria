import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Aparencia } from '../../src/compartilhado/aparencia';
import { urlImagem } from '../../src/compartilhado/aparencia';
import { formatarDataHora, formatarPreco, resumoObservacoes } from '../../src/compartilhado/formatar';
import { ErroApi, api } from '../../src/compartilhado/http';
import { Icone } from '../../src/compartilhado/icones';
import { Modal } from '../../src/compartilhado/Modal';
import { ROTULO_STATUS_PAINEL, T } from '../../src/compartilhado/textos';
import { useAvisos } from '../../src/compartilhado/toast';
import type { PedidoPainel } from '../../src/compartilhado/tipos';
import { useAcao } from './util';

type Dialogo = 'pagamento' | 'cancelar' | 'finalizar' | null;

/** Detalhes do pedido e ações do colaborador (RF09–RF12, RF15). Cada ação destrutiva pede confirmação. */
export function DetalhePedido({
  pedido, aparencia, aoAtualizar, aoFechar,
}: {
  pedido: PedidoPainel;
  aparencia: Aparencia;
  aoAtualizar: (p: PedidoPainel) => void;
  aoFechar: () => void;
}): ReactElement {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [texto, setTexto] = useState('');
  const [alerta, setAlerta] = useState<string | null>(null);
  const { ocupado, executar } = useAcao();
  const { avisar } = useAvisos();
  const base = `/api/painel/pedidos/${encodeURIComponent(pedido.codigo)}`;
  const pago = pedido.status !== 'AGUARDANDO_PAGAMENTO';

  const fechar = () => {
    setDialogo(null);
    setTexto('');
  };

  /** Envia a ação; trata o conflito "pedido alterado pelo cliente" (cenário A3) mostrando o pedido atualizado. */
  const enviar = async (caminho: string, corpo: unknown, sucesso: string) => {
    setAlerta(null);
    try {
      const novo = await executarComErro(() => api.post<PedidoPainel>(`${base}/${caminho}`, corpo, { painel: true }));
      if (novo) {
        aoAtualizar(novo);
        avisar(sucesso, 'sucesso');
        fechar();
      }
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === 'PEDIDO_ALTERADO' && e.detalhes) {
        aoAtualizar(e.detalhes as PedidoPainel); // mostra os itens e o novo total para conferência
      }
      setAlerta(e instanceof ErroApi ? e.message : T.instabilidade);
      fechar();
    }
  };
  // useAcao esconde o erro em aviso; aqui queremos o erro bruto para tratar o conflito.
  const executarComErro = async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    let resultado: R | undefined;
    let erro: unknown = null;
    await executar(async () => {
      try {
        resultado = await fn();
      } catch (e) {
        erro = e;
      }
    });
    if (erro) throw erro;
    return resultado;
  };

  const justificativaOk = !pago || texto.trim().length > 0;

  return (
    <aside className="detalhe cartao" aria-label={`Pedido ${pedido.codigo}`}>
      <header className="detalhe__topo">
        <div>
          <h2>{pedido.codigo}</h2>
          <span className="etiqueta">{ROTULO_STATUS_PAINEL[pedido.status]}</span> <span className="detalhe__local">{pedido.local}</span>
        </div>
        <button className="botao-icone" onClick={aoFechar} aria-label={T.fechar}><Icone nome="x" /></button>
      </header>

      {alerta && <div className="faixa faixa--aviso" role="alert">{alerta}</div>}

      <ul className="detalhe__itens">
        {pedido.itens.map((i) => (
          <li key={i.idItem ?? i.produto}>
            <img src={urlImagem(i.imagem, aparencia.marca.imagemPadrao)} alt="" width={44} height={44} />
            <div>
              <strong>{i.quantidade}× {i.produto}</strong>
              {i.observacoes.length > 0 && <small>{resumoObservacoes(i.observacoes)}</small>}
            </div>
            <span>{formatarPreco(i.precoUnitario * i.quantidade)}</span>
          </li>
        ))}
      </ul>
      <div className="total"><span>{T.total}</span><strong>{formatarPreco(pedido.valorTotal)}</strong></div>

      <dl className="detalhe__meta">
        <dt>Realizado</dt><dd>{formatarDataHora(pedido.dataHora)}</dd>
        {pedido.dataPagamento && (<><dt>Pago</dt><dd>{formatarDataHora(pedido.dataPagamento)}</dd></>)}
      </dl>

      <div className="detalhe__acoes">
        {pedido.status === 'AGUARDANDO_PAGAMENTO' && (
          <>
            <button className="botao botao--sucesso botao--bloco" disabled={ocupado} onClick={() => setDialogo('pagamento')}>
              <Icone nome="check" /> {T.confirmarPagamento}
            </button>
            <p className="dica">{T.statusComPagamentoPendente}</p>
          </>
        )}
        {pedido.status === 'EM_PREPARO' && (
          <button className="botao botao--bloco" disabled={ocupado} onClick={() => void enviar('status', { para: 'PRONTO' }, 'Pedido marcado como Pronto')}>
            <Icone nome="sino" /> {T.marcarPronto}
          </button>
        )}
        {pedido.status === 'PRONTO' && (
          <button className="botao botao--bloco" disabled={ocupado} onClick={() => void enviar('status', { para: 'ENTREGUE' }, 'Pedido marcado como Entregue')}>
            <Icone nome="check" /> {T.marcarEntregue}
          </button>
        )}
        {pedido.status === 'ENTREGUE' && (
          <button className="botao botao--bloco" disabled={ocupado} onClick={() => setDialogo('finalizar')}>
            <Icone nome="check" /> {T.finalizar}
          </button>
        )}
        {pedido.status !== 'ENTREGUE' && (
          <button className="botao botao--contorno botao--bloco" disabled={ocupado} onClick={() => setDialogo('cancelar')}>
            <Icone nome="x" /> {T.cancelarPedido}
          </button>
        )}
      </div>

      {dialogo === 'pagamento' && (
        <Modal titulo={T.confirmarPagamento} aoFechar={fechar}>
          <p>Confirmar o recebimento de <strong>{formatarPreco(pedido.valorTotal)}</strong> do pedido <strong>{pedido.codigo}</strong>? O preparo será iniciado.</p>
          <div className="modal__acoes">
            <button className="botao botao--contorno" onClick={fechar}>{T.cancelar}</button>
            <button className="botao botao--sucesso" disabled={ocupado} onClick={() => void enviar('pagamento', { versao: pedido.versao }, 'Pagamento confirmado')}>{T.confirmar}</button>
          </div>
        </Modal>
      )}

      {dialogo === 'cancelar' && (
        <Modal titulo={T.confirmarCancelar} aoFechar={fechar}>
          <p>Pedido <strong>{pedido.codigo}</strong>. {pago && 'O pagamento já foi confirmado: a justificativa é obrigatória.'}</p>
          <div className="campo">
            <label htmlFor="just">{T.justificativa}{pago ? '' : ' (opcional)'}</label>
            <textarea id="just" className="entrada" value={texto} maxLength={255} onChange={(e) => setTexto(e.target.value)} aria-required={pago} />
            {pago && texto.trim() === '' && <span className="campo__erro">{T.justificativaObrigatoria}</span>}
          </div>
          <div className="modal__acoes">
            <button className="botao botao--contorno" onClick={fechar}>{T.voltar}</button>
            <button className="botao botao--perigo" disabled={ocupado || !justificativaOk} onClick={() => void enviar('cancelamento', { texto }, 'Pedido cancelado')}>{T.cancelarPedido}</button>
          </div>
        </Modal>
      )}

      {dialogo === 'finalizar' && (
        <Modal titulo={T.confirmarFinalizar} aoFechar={fechar}>
          <div className="campo">
            <label htmlFor="obs">{T.observacaoInterna} (opcional)</label>
            <textarea id="obs" className="entrada" value={texto} maxLength={255} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div className="modal__acoes">
            <button className="botao botao--contorno" onClick={fechar}>{T.voltar}</button>
            <button className="botao" disabled={ocupado} onClick={() => void enviar('finalizacao', { texto }, 'Pedido finalizado')}>{T.finalizar}</button>
          </div>
        </Modal>
      )}
    </aside>
  );
}
