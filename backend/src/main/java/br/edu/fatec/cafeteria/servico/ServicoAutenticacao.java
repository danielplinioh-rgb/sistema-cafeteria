package br.edu.fatec.cafeteria.servico;

import br.edu.fatec.cafeteria.nucleo.BloqueioTentativas;
import br.edu.fatec.cafeteria.nucleo.ErroNegocio;
import br.edu.fatec.cafeteria.nucleo.RegistroSessoes;
import br.edu.fatec.cafeteria.nucleo.Textos;
import br.edu.fatec.cafeteria.nucleo.ValidadorEntrada;
import br.edu.fatec.cafeteria.repositorio.RepositorioColaborador;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Login do colaborador (RF17).
 *
 * <p>Defesas aplicadas:
 * <ul>
 *   <li>senha conferida com BCrypt (hash lento e com sal; nunca texto puro);</li>
 *   <li>mensagem ÚNICA para usuário inexistente e senha errada ("Usuário ou senha inválidos.");</li>
 *   <li>tempo de resposta equalizado: com usuário inexistente também roda um BCrypt,
 *       para não revelar quais usuários existem medindo o tempo;</li>
 *   <li>bloqueio temporário por usuário+IP após falhas seguidas;</li>
 *   <li>token de sessão novo a cada login (evita fixação de sessão).</li>
 * </ul>
 */
@Service
public class ServicoAutenticacao {

    /** Resultado do login: o token vai para o cookie; o nome para a tela. */
    public record Entrada(String token, String nome, String usuario) {
    }

    private final RepositorioColaborador colaboradores;
    private final BCryptPasswordEncoder codificador;
    private final BloqueioTentativas bloqueio;
    private final RegistroSessoes sessoes;
    /** Hash descartável para equalizar o tempo quando o usuário não existe. */
    private final String hashFalso;

    public ServicoAutenticacao(RepositorioColaborador colaboradores, BCryptPasswordEncoder codificador,
                               BloqueioTentativas bloqueio, RegistroSessoes sessoes) {
        this.colaboradores = colaboradores;
        this.codificador = codificador;
        this.bloqueio = bloqueio;
        this.sessoes = sessoes;
        this.hashFalso = codificador.encode("senha-descartavel-" + System.nanoTime());
    }

    public Entrada entrar(String usuario, String senha, String ip) {
        String chave = BloqueioTentativas.chave(usuario, ip);
        if (bloqueio.bloqueado(chave)) {
            long minutos = Math.max(1, (bloqueio.segundosRestantes(chave) + 59) / 60);
            throw ErroNegocio.muitasRequisicoes("LOGIN_BLOQUEADO", Textos.LOGIN_BLOQUEADO + " (cerca de " + minutos + " min)");
        }

        boolean formatoOk = ValidadorEntrada.usuarioComFormatoValido(usuario) && ValidadorEntrada.senhaComTamanhoValido(senha);
        var registro = formatoOk ? colaboradores.porUsuario(usuario) : java.util.Optional.<RepositorioColaborador.Registro>empty();

        // Sempre executa UM BCrypt, exista o usuário ou não.
        String hash = registro.map(RepositorioColaborador.Registro::senhaHash).orElse(hashFalso);
        boolean senhaOk = senha != null && senha.length() <= 128 && codificador.matches(senha, hash);

        if (registro.isEmpty() || !senhaOk) {
            bloqueio.registrarFalha(chave);
            throw ErroNegocio.naoAutenticado("CREDENCIAIS_INVALIDAS", Textos.CREDENCIAIS_INVALIDAS);
        }
        bloqueio.registrarSucesso(chave);
        var c = registro.get();
        String token = sessoes.criar(c.idColaborador(), c.nome(), c.usuario());
        return new Entrada(token, c.nome(), c.usuario());
    }

    public void sair(String token) {
        sessoes.revogar(token);
    }
}
