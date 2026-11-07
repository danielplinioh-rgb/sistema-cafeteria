import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import type { Aparencia } from '../../src/compartilhado/aparencia';
import { aoExpirarSessao, api } from '../../src/compartilhado/http';
import { Icone } from '../../src/compartilhado/icones';
import type { NomeIcone } from '../../src/compartilhado/icones';
import { T } from '../../src/compartilhado/textos';
import { ProvedorAvisos } from '../../src/compartilhado/toast';
import type { SessaoView } from '../../src/compartilhado/tipos';
import { Fila } from './Fila';
import { Historico } from './Historico';
import { Login } from './Login';
import { PaginaQr } from './PaginaQr';
import { Produtos } from './Produtos';

type Pagina = 'fila' | 'historico' | 'produtos' | 'qr';

const MENU: { id: Pagina; rotulo: string; icone: NomeIcone }[] = [
  { id: 'fila', rotulo: T.filaDePedidos, icone: 'lista' },
  { id: 'historico', rotulo: T.historico, icone: 'historico' },
  { id: 'produtos', rotulo: T.produtos, icone: 'copo' },
  { id: 'qr', rotulo: T.qrCode, icone: 'qr' },
];

export function App({ aparencia }: { aparencia: Aparencia }): ReactElement {
  return (
    <ProvedorAvisos>
      <Painel aparencia={aparencia} />
    </ProvedorAvisos>
  );
}

function Painel({ aparencia }: { aparencia: Aparencia }): ReactElement {
  const [sessao, setSessao] = useState<SessaoView | null | 'verificando'>('verificando');
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [pagina, setPagina] = useState<Pagina>('fila');
  const [pendentes, setPendentes] = useState(0);
  const temporizador = useRef<number>(0);

  // Ao abrir, descobre se ainda existe uma sessão válida (cookie HttpOnly).
  useEffect(() => {
    api.get<SessaoView>('/api/painel/sessao', { painel: true }).then(setSessao).catch(() => setSessao(null));
  }, []);

  // Servidor respondeu 401 em qualquer chamada: volta ao login.
  useEffect(() => aoExpirarSessao(() => {
    setSessao(null);
    setMensagem(T.sessaoExpirada);
  }), []);

  const sair = useCallback(async (motivo?: string) => {
    try {
      await api.post('/api/painel/logout', {}, { painel: true });
    } catch {
      /* mesmo se a rede falhar, a tela volta ao login; a sessão expira no servidor */
    }
    setSessao(null);
    setMensagem(motivo ?? null);
    setPagina('fila');
  }, []);

  // Encerra a sessão após X minutos sem interação (RNF07). O servidor também expira a sessão por conta própria.
  useEffect(() => {
    if (!sessao || sessao === 'verificando') return;
    const limite = aparencia.painel.minutosInatividade * 60_000;
    const reiniciar = () => {
      window.clearTimeout(temporizador.current);
      temporizador.current = window.setTimeout(() => void sair(T.inatividade), limite);
    };
    const eventos = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    reiniciar();
    return () => {
      window.clearTimeout(temporizador.current);
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
    };
  }, [sessao, aparencia.painel.minutosInatividade, sair]);

  if (sessao === 'verificando') return <div className="girando" role="status" aria-label={T.carregando} />;
  if (sessao === null) return <Login aparencia={aparencia} mensagem={mensagem} aoEntrar={(s) => { setMensagem(null); setSessao(s); }} />;

  return (
    <div className="shell">
      <nav className="menu" aria-label="Menu principal">
        <div className="menu__marca">
          <img src={aparencia.marca.logo} alt="" width={40} height={40} />
          <strong>{aparencia.marca.nome}</strong>
        </div>
        <ul>
          {MENU.map((m) => (
            <li key={m.id}>
              <button className={`menu__item ${pagina === m.id ? 'menu__item--ativo' : ''}`} onClick={() => setPagina(m.id)} aria-current={pagina === m.id ? 'page' : undefined}>
                <Icone nome={m.icone} /> {m.rotulo}
                {m.id === 'fila' && pendentes > 0 && <span className="menu__contador" aria-label={`${pendentes} aguardando pagamento`}>{pendentes}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="menu__usuario">
          <span><Icone nome="usuario" tamanho={18} /> {sessao.nome}</span>
          <button className="menu__sair" onClick={() => void sair()}><Icone nome="sair" tamanho={18} /> {T.sair}</button>
        </div>
      </nav>
      <main className="principal">
        <header className="principal__topo"><h1>{MENU.find((m) => m.id === pagina)?.rotulo}</h1></header>
        {pagina === 'fila' && <Fila aparencia={aparencia} aoContar={setPendentes} />}
        {pagina === 'historico' && <Historico />}
        {pagina === 'produtos' && <Produtos aparencia={aparencia} />}
        {pagina === 'qr' && <PaginaQr aparencia={aparencia} />}
      </main>
    </div>
  );
}
