package br.edu.fatec.cafeteria.config;

import br.edu.fatec.cafeteria.nucleo.BloqueioTentativas;
import br.edu.fatec.cafeteria.nucleo.LimitadorTaxa;
import br.edu.fatec.cafeteria.nucleo.RegistroSessoes;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Cria os componentes de segurança como objetos únicos (singletons) do sistema. */
@Configuration
public class ConfiguracaoSeguranca {

    /** Três limitadores independentes: leitura, gravação e login. */
    public record Limitadores(LimitadorTaxa geral, LimitadorTaxa escrita, LimitadorTaxa login) {
    }

    @Bean
    public Limitadores limitadores(PropriedadesApp p) {
        return new Limitadores(
                new LimitadorTaxa(p.limiteGeralPorMin(), 60_000),
                new LimitadorTaxa(p.limiteEscritaPorMin(), 60_000),
                new LimitadorTaxa(p.limiteLoginPorMin(), 60_000));
    }

    @Bean
    public BloqueioTentativas bloqueioTentativas(PropriedadesApp p) {
        return new BloqueioTentativas(p.loginMaxFalhas(), p.loginBloqueioMin() * 60_000L);
    }

    @Bean
    public RegistroSessoes registroSessoes(PropriedadesApp p) {
        return new RegistroSessoes(p.sessaoInatividadeMin() * 60_000L, p.sessaoDuracaoHoras() * 3_600_000L);
    }

    /** BCrypt com custo 10 (mesmo custo do seed). Aumente para 12 em produção se o hardware permitir. */
    @Bean
    public BCryptPasswordEncoder codificadorSenha() {
        return new BCryptPasswordEncoder(10);
    }
}
