import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { Aparencia } from '../../src/compartilhado/aparencia';
import { ErroApi, api } from '../../src/compartilhado/http';
import { Icone } from '../../src/compartilhado/icones';
import { T } from '../../src/compartilhado/textos';
import type { SessaoView } from '../../src/compartilhado/tipos';

/** Tela de login (RF17). A senha só trafega no corpo do POST; a sessão fica em cookie HttpOnly. */
export function Login({ aparencia, mensagem, aoEntrar }: { aparencia: Aparencia; mensagem: string | null; aoEntrar: (s: SessaoView) => void }): ReactElement {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const sessao = await api.post<SessaoView>('/api/painel/login', { usuario: usuario.trim(), senha }, { painel: true });
      setSenha('');
      aoEntrar(sessao);
    } catch (err) {
      setSenha(''); // nunca mantém a senha digitada após uma falha
      // Mensagem do servidor: única para usuário/senha errados (não revela qual dos dois falhou).
      setErro(err instanceof ErroApi ? err.message : T.credenciaisInvalidas);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className="login__arte" style={{ backgroundImage: `url(${aparencia.marca.banner})` }} aria-hidden="true" />
      <form className="login__cartao cartao" onSubmit={(e) => void enviar(e)} autoComplete="on">
        <img src={aparencia.marca.logo} alt="" width={56} height={56} />
        <h1>{aparencia.marca.nome}</h1>
        <p className="login__sub">Painel do colaborador</p>

        {mensagem && <div className="faixa faixa--aviso" role="status">{mensagem}</div>}
        {erro && <div className="faixa faixa--erro" role="alert">{erro}</div>}

        <div className="campo">
          <label htmlFor="usuario">{T.usuario}</label>
          <input id="usuario" className="entrada" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" maxLength={50} required autoFocus />
        </div>
        <div className="campo">
          <label htmlFor="senha">{T.senha}</label>
          <input id="senha" className="entrada" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" maxLength={128} required />
        </div>
        <button className="botao botao--bloco" disabled={enviando || !usuario || !senha}>
          <Icone nome="cadeado" tamanho={18} /> {enviando ? T.entrando : T.entrar}
        </button>
      </form>
    </div>
  );
}
