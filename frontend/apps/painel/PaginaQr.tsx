import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { Aparencia } from '../../src/compartilhado/aparencia';
import { Icone } from '../../src/compartilhado/icones';
import { gerarQr } from '../../src/compartilhado/qr';

/** QR Code de acesso ao cardápio (módulo do cliente). Pode ser impresso e colocado nas mesas e no balcão. */
export function PaginaQr({ aparencia }: { aparencia: Aparencia }): ReactElement {
  const padrao = aparencia.painel.urlCliente || window.location.origin + '/';
  const [url, setUrl] = useState(padrao);

  const { matriz, erro } = useMemo(() => {
    try {
      return { matriz: gerarQr(url.trim()), erro: null as string | null };
    } catch (e) {
      return { matriz: null, erro: (e as Error).message };
    }
  }, [url]);

  const ehLocal = /localhost|127\.0\.0\.1/.test(url);
  const tam = matriz?.length ?? 0;
  const margem = 4;
  const caminho = useMemo(() => {
    if (!matriz) return '';
    let d = '';
    matriz.forEach((linha, y) => linha.forEach((escuro, x) => { if (escuro) d += `M${x + margem} ${y + margem}h1v1h-1z`; }));
    return d;
  }, [matriz]);

  return (
    <div className="pagina-qr">
      <div className="qr-controles cartao">
        <div className="campo">
          <label htmlFor="url-cliente">Endereço do cardápio</label>
          <input id="url-cliente" className="entrada" value={url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
          <span className="dica">Deve ser o endereço que o smartphone consegue abrir (domínio ou IP da rede, não “localhost”). Pode ser definido de forma permanente em aparencia.json → painel.urlCliente.</span>
        </div>
        {ehLocal && <div className="faixa faixa--aviso" role="alert">“localhost” só funciona neste computador. Use o IP da rede (ex.: http://192.168.0.10/) para o celular acessar.</div>}
        {erro && <div className="faixa faixa--erro" role="alert">{erro}</div>}
        <button className="botao" onClick={() => window.print()} disabled={!matriz}><Icone nome="imprimir" /> Imprimir QR Code</button>
      </div>

      <div className="qr-folha cartao" id="qr-impressao">
        <img src={aparencia.marca.logo} alt="" width={64} height={64} />
        <h2>{aparencia.marca.nome}</h2>
        <p className="qr-folha__chamada">Aponte a câmera do celular e faça seu pedido</p>
        {matriz && (
          <svg className="qr-folha__codigo" viewBox={`0 0 ${tam + margem * 2} ${tam + margem * 2}`} shapeRendering="crispEdges" role="img" aria-label={`QR Code para ${url}`}>
            <rect width="100%" height="100%" fill="#fff" />
            <path d={caminho} fill="#000" />
          </svg>
        )}
        <p className="qr-folha__url">{url}</p>
      </div>
    </div>
  );
}
