package br.edu.fatec.cafeteria.nucleo;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Bloqueio temporário após falhas consecutivas de login (RF17, RNF07).
 *
 * <p>A chave combina <b>usuário + IP</b>. Assim, quem erra a senha repetidamente
 * é bloqueado, mas um atacante não consegue travar a conta de um colaborador
 * legítimo que acessa de outro IP (evita ataque de negação de serviço por bloqueio).
 * Além disso, o {@link LimitadorTaxa} limita o total de tentativas por IP.
 */
public final class BloqueioTentativas {

    private static final class Registro {
        int falhas;
        long bloqueadoAte; // 0 = não bloqueado
        long ultimaFalha;
    }

    private final int maximoDeFalhas;
    private final long duracaoBloqueioMs;
    private final LongSupplier relogioMs;
    private final Map<String, Registro> registros = new ConcurrentHashMap<>();

    public BloqueioTentativas(int maximoDeFalhas, long duracaoBloqueioMs) {
        this(maximoDeFalhas, duracaoBloqueioMs, System::currentTimeMillis);
    }

    public BloqueioTentativas(int maximoDeFalhas, long duracaoBloqueioMs, LongSupplier relogioMs) {
        this.maximoDeFalhas = maximoDeFalhas;
        this.duracaoBloqueioMs = duracaoBloqueioMs;
        this.relogioMs = relogioMs;
    }

    /** Monta a chave de controle a partir do login (sem diferenciar maiúsculas) e do IP. */
    public static String chave(String usuario, String ip) {
        return (usuario == null ? "" : usuario.toLowerCase(java.util.Locale.ROOT)) + "|" + ip;
    }

    public boolean bloqueado(String chave) {
        Registro r = registros.get(chave);
        if (r == null) {
            return false;
        }
        synchronized (r) {
            return r.bloqueadoAte > relogioMs.getAsLong();
        }
    }

    public long segundosRestantes(String chave) {
        Registro r = registros.get(chave);
        if (r == null) {
            return 0;
        }
        synchronized (r) {
            long restante = r.bloqueadoAte - relogioMs.getAsLong();
            return restante > 0 ? (restante + 999) / 1000 : 0;
        }
    }

    /** Registra uma falha; ao atingir o máximo, inicia o bloqueio. */
    public void registrarFalha(String chave) {
        long agora = relogioMs.getAsLong();
        Registro r = registros.computeIfAbsent(chave, k -> new Registro());
        synchronized (r) {
            if (r.bloqueadoAte != 0 && r.bloqueadoAte <= agora) { // bloqueio anterior terminou
                r.falhas = 0;
                r.bloqueadoAte = 0;
            }
            r.falhas++;
            r.ultimaFalha = agora;
            if (r.falhas >= maximoDeFalhas) {
                r.bloqueadoAte = agora + duracaoBloqueioMs;
            }
        }
    }

    /** Login bem-sucedido zera o contador. */
    public void registrarSucesso(String chave) {
        registros.remove(chave);
    }

    /** Remove registros antigos (chamado periodicamente). */
    public void limpar() {
        long agora = relogioMs.getAsLong();
        registros.entrySet().removeIf(e -> {
            Registro r = e.getValue();
            synchronized (r) {
                boolean bloqueioAtivo = r.bloqueadoAte > agora;
                return !bloqueioAtivo && agora - r.ultimaFalha > duracaoBloqueioMs;
            }
        });
    }
}
