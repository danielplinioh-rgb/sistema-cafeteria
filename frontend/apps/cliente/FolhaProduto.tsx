import { useState } from 'react';
import type { ReactElement } from 'react';
import { urlImagem } from '../../src/compartilhado/aparencia';
import { formatarPreco } from '../../src/compartilhado/formatar';
import { Icone } from '../../src/compartilhado/icones';
import { Modal } from '../../src/compartilhado/Modal';
import { T } from '../../src/compartilhado/textos';
import type { ProdutoCardapio } from '../../src/compartilhado/tipos';
import { QUANTIDADE_MAXIMA } from './carrinho';

/** Escolha de quantidade e observações (lista fechada, RF04) de um produto. */
export function FolhaProduto({
  produto,
  imagemPadrao,
  aoAdicionar,
  aoFechar,
}: {
  produto: ProdutoCardapio;
  imagemPadrao: string;
  aoAdicionar: (quantidade: number, observacoes: number[]) => void;
  aoFechar: () => void;
}): ReactElement {
  const [quantidade, setQuantidade] = useState(1);
  const [obs, setObs] = useState<number[]>([]);
  const alternar = (id: number) => setObs((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <Modal titulo={produto.nome} aoFechar={aoFechar} classe="folha">
      <img className="folha__foto" src={urlImagem(produto.imagem, imagemPadrao)} alt="" />
      {produto.descricao && <p className="folha__desc">{produto.descricao}</p>}

      {produto.observacoes.length > 0 && (
        <fieldset className="grupo">
          <legend>{T.observacoes}</legend>
          <div className="chips">
            {produto.observacoes.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`chip ${obs.includes(o.id) ? 'chip--ativo' : ''}`}
                aria-pressed={obs.includes(o.id)}
                onClick={() => alternar(o.id)}
              >
                {obs.includes(o.id) && <Icone nome="check" tamanho={14} />} {o.descricao}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="quantidade">
        <span className="rotulo">{T.quantidade}</span>
        <div className="stepper">
          <button className="botao-icone" onClick={() => setQuantidade((q) => Math.max(1, q - 1))} disabled={quantidade <= 1} aria-label="Diminuir">
            <Icone nome="menos" />
          </button>
          <output aria-live="polite">{quantidade}</output>
          <button className="botao-icone" onClick={() => setQuantidade((q) => Math.min(QUANTIDADE_MAXIMA, q + 1))} disabled={quantidade >= QUANTIDADE_MAXIMA} aria-label="Aumentar">
            <Icone nome="mais" />
          </button>
        </div>
      </div>

      <div className="modal__acoes">
        <button className="botao botao--contorno" onClick={aoFechar}>
          {T.cancelar}
        </button>
        <button className="botao" onClick={() => aoAdicionar(quantidade, obs)}>
          {T.adicionarAoPedido} · {formatarPreco(produto.preco * quantidade)}
        </button>
      </div>
    </Modal>
  );
}
