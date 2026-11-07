package br.edu.fatec.cafeteria.nucleo;

import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Limitador de taxa por chave (normalmente o IP) usando o algoritmo "balde de
 * fichas": o balde tem {@code capacidade} fichas e se reabastece de modo contínuo
 * ao longo de {@code janelaMs}. Cada requisição consome uma ficha; sem ficha, a
 * requisição é recusada (HTTP 429).
 *
 * <p>Protege contra força bruta, varredura de códigos de pedido e abuso de
 * criação de pedidos. É em memória (suficiente para um único servidor); para
 * vários servidores use Redis ou o limitador do proxy.
 */
public final class LimitadorTaxa {

    private static final int LIMITE_DE_CHAVES = 20_000;

    private static final class Balde {
        double fichas;
        long ultimoReabastecimento;
    }

    private final int capacidade;
    private final long janelaMs;
    private final LongSupplier relogioMs;
    private final Map<String, Balde> baldes = new ConcurrentHashMap<>();

    public LimitadorTaxa(int capacidade, long janelaMs) {
        this(capacidade, janelaMs, System::currentTimeMillis);
    }

    /** Construtor com relógio injetável (usado nos testes). */
    public LimitadorTaxa(int capacidade, long janelaMs, LongSupplier relogioMs) {
        if (capacidade < 1 || janelaMs < 1) {
            throw new IllegalArgumentException("capacidade e janela devem ser positivas");
        }
        this.capacidade = capacidade;
        this.janelaMs = janelaMs;
        this.relogioMs = relogioMs;
    }

    /** Consome uma ficha da chave. Retorna {@code false} se o limite foi excedido. */
    public boolean permitir(String chave) {
        long agora = relogioMs.getAsLong();
        if (baldes.size() > LIMITE_DE_CHAVES) {
            limpar();
        }
        Balde balde = baldes.computeIfAbsent(chave, k -> {
            Balde novo = new Balde();
            novo.fichas = capacidade;
            novo.ultimoReabastecimento = agora;
            return novo;
        });
        synchronized (balde) {
            long decorrido = Math.max(0, agora - balde.ultimoReabastecimento);
            balde.fichas = Math.min(capacidade, balde.fichas + decorrido * ((double) capacidade / janelaMs));
            balde.ultimoReabastecimento = agora;
            if (balde.fichas >= 1.0) {
                balde.fichas -= 1.0;
                return true;
            }
            return false;
        }
    }

    /** Remove baldes que já se reabasteceram por completo (chaves inativas). Evita crescimento da memória. */
    public void limpar() {
        long agora = relogioMs.getAsLong();
        Iterator<Map.Entry<String, Balde>> it = baldes.entrySet().iterator();
        while (it.hasNext()) {
            Balde balde = it.next().getValue();
            synchronized (balde) {
                if (agora - balde.ultimoReabastecimento >= janelaMs) {
                    it.remove();
                }
            }
        }
    }

    int tamanho() {
        return baldes.size();
    }
}
