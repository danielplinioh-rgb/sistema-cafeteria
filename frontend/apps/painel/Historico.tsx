import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { formatarDataHora, formatarPreco } from '../../src/compartilhado/formatar';
import { ErroApi, api } from '../../src/compartilhado/http';
import { Modal } from '../../src/compartilhado/Modal';
import { T } from '../../src/compartilhado/textos';
import { useAvisos } from '../../src/compartilhado/toast';
import type { HistoricoView } from '../../src/compartilhado/tipos';
import { useAcao } from './util';

/** Histórico de pedidos finalizados e cancelados, com aviso de situação (RF10/RF15) e observação interna (RF16). */
export function Historico(): ReactElement {
  const [itens, setItens] = useState<HistoricoView[] | null>(null);
  const [erro, setErro] = useState(false);
  const [editando, setEditando] = useState<HistoricoView | null>(null);
  const [texto, setTexto] = useState('');
  const { ocupado, executar } = useAcao();
  const { avisar } = useAvisos();

  const carregar = useCallback(async () => {
    try {
      setItens(await api.get<HistoricoView[]>('/api/painel/historico', { painel: true }));
      setErro(false);
    } catch (e) {
      if (!(e instanceof ErroApi) || e.status !== 401) setErro(true);
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  const salvar = async () => {
    if (!editando) return;
    const ok = await executar(() =>
      api.put(`/api/painel/pedidos/${encodeURIComponent(editando.codigo)}/observacao`, { texto }, { painel: true }),
    );
    if (ok) {
      avisar('Observação registrada', 'sucesso');
      setEditando(null);
      void carregar();
    }
  };

  return (
    <div>
      {erro && <div className="faixa faixa--erro" role="alert">{T.instabilidade}</div>}
      {itens === null && !erro && <div className="girando" role="status" aria-label={T.carregando} />}
      {itens && itens.length === 0 && <p className="vazio">Nenhum pedido finalizado ou cancelado ainda.</p>}
      {itens && itens.length > 0 && (
        <div className="cartao tabela-caixa">
          <table className="tabela">
            <thead>
              <tr><th>Código</th><th>Data</th><th>Situação</th><th>Local</th><th>Total</th><th>Encerrado por</th><th>Justificativa / observação</th><th /></tr>
            </thead>
            <tbody>
              {itens.map((h) => (
                <tr key={h.codigo}>
                  <td><strong>{h.codigo}</strong></td>
                  <td>{formatarDataHora(h.dataHora)}</td>
                  <td><span className={`etiqueta ${h.aviso === 'CANCELADO' ? 'etiqueta--perigo' : 'etiqueta--sucesso'}`}>{h.aviso === 'CANCELADO' ? 'Cancelado' : 'Finalizado'}</span></td>
                  <td>{h.local}</td>
                  <td>{formatarPreco(h.valorTotal)}</td>
                  <td>{h.encerradoPor ?? '—'}</td>
                  <td className="tabela__texto">
                    {h.justificativaCancelamento && <div><small>Justificativa:</small> {h.justificativaCancelamento}</div>}
                    {h.observacaoInterna && <div><small>Obs.:</small> {h.observacaoInterna}</div>}
                    {!h.justificativaCancelamento && !h.observacaoInterna && '—'}
                  </td>
                  <td><button className="botao botao--secundario botao--pequeno" onClick={() => { setEditando(h); setTexto(h.observacaoInterna ?? ''); }}>Observação</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editando && (
        <Modal titulo={`${T.observacaoInterna} · ${editando.codigo}`} aoFechar={() => setEditando(null)}>
          <div className="campo">
            <label htmlFor="obsint">{T.observacaoInterna}</label>
            <textarea id="obsint" className="entrada" value={texto} maxLength={255} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div className="modal__acoes">
            <button className="botao botao--contorno" onClick={() => setEditando(null)}>{T.cancelar}</button>
            <button className="botao" disabled={ocupado || texto.trim() === ''} onClick={() => void salvar()}>{T.salvar}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
