package br.edu.fatec.cafeteria.config;

import br.edu.fatec.cafeteria.nucleo.BloqueioTentativas;
import br.edu.fatec.cafeteria.nucleo.RegistroSessoes;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Limpeza periódica dos controles em memória (evita crescimento indefinido). */
@Component
public class Manutencao {

    private final ConfiguracaoSeguranca.Limitadores limitadores;
    private final BloqueioTentativas bloqueio;
    private final RegistroSessoes sessoes;

    public Manutencao(ConfiguracaoSeguranca.Limitadores limitadores, BloqueioTentativas bloqueio, RegistroSessoes sessoes) {
        this.limitadores = limitadores;
        this.bloqueio = bloqueio;
        this.sessoes = sessoes;
    }

    @Scheduled(fixedDelay = 60_000)
    public void limpar() {
        limitadores.geral().limpar();
        limitadores.escrita().limpar();
        limitadores.login().limpar();
        bloqueio.limpar();
        sessoes.limparExpiradas();
    }
}
