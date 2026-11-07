import type { ReactElement } from 'react';
import { urlImagem } from '../../src/compartilhado/aparencia';
import { formatarPreco } from '../../src/compartilhado/formatar';
import { Icone } from '../../src/compartilhado/icones';
import { Modal } from '../../src/compartilhado/Modal';
import { resumoObservacoes } from '../../src/compartilhado/formatar';
import { T } from '../../src/compartilhado/textos';
import { mesaValida, totalValor } from './carrinho';
import type { Linha, Local } from './carrinho';

interface Props {
  linhas: Linha[];
  local: Local;
  editando: boolean;
  enviando: boolean;
  erro: string | null;
  imagemPadrao: string;
  aoMudarLocal: (l: Local) => void;
  aoMudarQuantidade: (chave: string, delta: number) => void;
  aoRemover: (chave: string) => void;
  aoEnviar: () => void;
  aoDescartar: () => void;
  aoFechar: () => void;
}

/** Revisão do pedido: itens, local de atendimento (RF05) e confirmação (RF06) ou salvamento da alteração (RF08). */
export function FolhaCarrinho(p: Props): ReactElement {
  const mesaOk = p.local.tipo === 'BALCAO' || mesaValida(p.local.mesa);
  const podeEnviar = p.linhas.length > 0 && (p.editando || mesaOk) && !p.enviando;

  return (
    <Modal titulo={p.editando ? T.alterarPedido : T.seuPedido} aoFechar={p.aoFechar} classe="folha">
      {p.linhas.length === 0 ? (
        <p className="vazio">{p.editando ? T.pedidoSemItens : T.carrinhoVazio}</p>
      ) : (
        <ul className="linhas">
          {p.linhas.map((l) => (
            <li key={l.chave} className="linha">
              <img src={urlImagem(l.imagem, p.imagemPadrao)} alt="" width={52} height={52} />
              <div className="linha__info">
                <strong>{l.nome}</strong>
                {l.nomesObservacoes.length > 0 && <small>{resumoObservacoes(l.nomesObservacoes)}</small>}
                <span>{formatarPreco(l.preco * l.quantidade)}</span>
              </div>
              <div className="stepper stepper--pequeno">
                <button className="botao-icone" onClick={() => (l.quantidade <= 1 ? p.aoRemover(l.chave) : p.aoMudarQuantidade(l.chave, -1))} aria-label={l.quantidade <= 1 ? `Remover ${l.nome}` : `Diminuir ${l.nome}`}>
                  <Icone nome={l.quantidade <= 1 ? 'lixo' : 'menos'} tamanho={16} />
                </button>
                <output>{l.quantidade}</output>
                <button className="botao-icone" onClick={() => p.aoMudarQuantidade(l.chave, 1)} aria-label={`Aumentar ${l.nome}`}>
                  <Icone nome="mais" tamanho={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!p.editando && p.linhas.length > 0 && (
        <fieldset className="grupo">
          <legend>{T.onde}</legend>
          <div className="alternador" role="radiogroup">
            <button role="radio" aria-checked={p.local.tipo === 'MESA'} className={`alternador__opcao ${p.local.tipo === 'MESA' ? 'alternador__opcao--ativa' : ''}`} onClick={() => p.aoMudarLocal({ ...p.local, tipo: 'MESA' })}>
              {T.naMesa}
            </button>
            <button role="radio" aria-checked={p.local.tipo === 'BALCAO'} className={`alternador__opcao ${p.local.tipo === 'BALCAO' ? 'alternador__opcao--ativa' : ''}`} onClick={() => p.aoMudarLocal({ ...p.local, tipo: 'BALCAO' })}>
              {T.retirarBalcao}
            </button>
          </div>
          {p.local.tipo === 'MESA' && (
            <div className="campo">
              <label htmlFor="mesa">{T.numeroMesa}</label>
              <input
                id="mesa"
                className="entrada"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                value={p.local.mesa}
                onChange={(e) => p.aoMudarLocal({ ...p.local, mesa: e.target.value.replace(/\D/g, '') })}
                aria-invalid={!mesaOk}
              />
              {!mesaOk && <span className="campo__erro">{T.informeMesa}</span>}
            </div>
          )}
        </fieldset>
      )}

      {p.erro && (
        <div className="faixa faixa--erro" role="alert">
          {p.erro}
        </div>
      )}

      <div className="total">
        <span>{T.total}</span>
        <strong>{formatarPreco(totalValor(p.linhas))}</strong>
      </div>

      <div className="modal__acoes">
        {p.editando ? (
          <button className="botao botao--contorno" onClick={p.aoDescartar}>
            {T.cancelarEdicao}
          </button>
        ) : (
          <button className="botao botao--contorno" onClick={p.aoFechar}>
            {T.voltar}
          </button>
        )}
        <button className="botao" disabled={!podeEnviar} onClick={p.aoEnviar}>
          {p.enviando ? T.enviando : p.editando ? T.salvarAlteracoes : T.confirmarPedido}
        </button>
      </div>
    </Modal>
  );
}
