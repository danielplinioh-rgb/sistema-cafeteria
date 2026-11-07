package br.edu.fatec.cafeteria.nucleo;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Sessões do terminal do colaborador (RF17).
 *
 * <p><b>Por que sessão opaca e não JWT?</b> O token é um número aleatório sem
 * significado; o servidor decide se ele vale. Isso permite <i>encerrar a sessão
 * de verdade</i> no logout (um JWT continuaria válido até expirar) e não expõe
 * dados do usuário no token. O token viaja num cookie {@code HttpOnly} +
 * {@code SameSite=Strict} (JavaScript não consegue lê-lo, o que mitiga roubo por XSS).
 *
 * <p>Regras: expira por <b>inatividade</b> (ex.: 30 min) e por <b>duração
 * máxima</b> (ex.: 12 h); cada login gera um token novo (evita fixação de sessão).
 * Em memória: ao reiniciar o servidor os colaboradores precisam entrar de novo.
 * Para vários servidores, troque por armazenamento compartilhado (Redis/BD).
 */
public final class RegistroSessoes {

    /** Dados da sessão. Não contém o token nem a senha. */
    public record Sessao(int idColaborador, String nome, String usuario, long criadaEm, long ultimoAcesso) {
        Sessao comAcesso(long agora) {
            return new Sessao(idColaborador, nome, usuario, criadaEm, agora);
        }
    }

    private final long inatividadeMaxMs;
    private final long duracaoMaxMs;
    private final LongSupplier relogioMs;
    /** Chave: SHA-256 do token. O token em si nunca é guardado. */
    private final Map<String, Sessao> sessoes = new ConcurrentHashMap<>();

    public RegistroSessoes(long inatividadeMaxMs, long duracaoMaxMs) {
        this(inatividadeMaxMs, duracaoMaxMs, System::currentTimeMillis);
    }

    public RegistroSessoes(long inatividadeMaxMs, long duracaoMaxMs, LongSupplier relogioMs) {
        this.inatividadeMaxMs = inatividadeMaxMs;
        this.duracaoMaxMs = duracaoMaxMs;
        this.relogioMs = relogioMs;
    }

    /** Cria uma sessão nova e devolve o token (único momento em que ele existe em claro no servidor). */
    public String criar(int idColaborador, String nome, String usuario) {
        String token = GeradorToken.novoTokenOpaco();
        long agora = relogioMs.getAsLong();
        sessoes.put(GeradorToken.sha256Hex(token), new Sessao(idColaborador, nome, usuario, agora, agora));
        return token;
    }

    /** Valida o token e renova o prazo de inatividade. Vazio se inexistente ou expirada. */
    public Optional<Sessao> validar(String token) {
        if (token == null || token.length() < 20 || token.length() > 100) {
            return Optional.empty();
        }
        String chave = GeradorToken.sha256Hex(token);
        Sessao sessao = sessoes.get(chave);
        if (sessao == null) {
            return Optional.empty();
        }
        long agora = relogioMs.getAsLong();
        if (agora - sessao.ultimoAcesso() > inatividadeMaxMs || agora - sessao.criadaEm() > duracaoMaxMs) {
            sessoes.remove(chave);
            return Optional.empty();
        }
        Sessao renovada = sessao.comAcesso(agora);
        sessoes.put(chave, renovada);
        return Optional.of(renovada);
    }

    /** Logout: a sessão deixa de valer imediatamente. */
    public void revogar(String token) {
        if (token != null) {
            sessoes.remove(GeradorToken.sha256Hex(token));
        }
    }

    /** Usado quando um colaborador é desativado: derruba todas as sessões dele. */
    public void revogarDoColaborador(int idColaborador) {
        sessoes.values().removeIf(s -> s.idColaborador() == idColaborador);
    }

    /** Remoção periódica das sessões vencidas (chamado por tarefa agendada). */
    public void limparExpiradas() {
        long agora = relogioMs.getAsLong();
        sessoes.values().removeIf(s -> agora - s.ultimoAcesso() > inatividadeMaxMs || agora - s.criadaEm() > duracaoMaxMs);
    }

    public int quantidade() {
        return sessoes.size();
    }
}
