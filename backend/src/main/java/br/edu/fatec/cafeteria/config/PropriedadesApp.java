package br.edu.fatec.cafeteria.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configurações do sistema (prefixo {@code app} no application.yml; cada uma pode
 * ser trocada por variável de ambiente, ex.: APP_COOKIE_SEGURO=true).
 *
 * @param confiarProxy         true quando há um proxy confiável (nginx) à frente: usa X-Forwarded-For
 * @param cookieSeguro         true em produção com HTTPS: marca o cookie como Secure e envia HSTS
 * @param origensPermitidas    origens (esquema+host+porta) autorizadas a chamar o painel; vazio = apenas mesma origem
 * @param sessaoInatividadeMin minutos sem uso até a sessão do colaborador expirar
 * @param sessaoDuracaoHoras   duração máxima de uma sessão, mesmo com uso contínuo
 * @param loginMaxFalhas       falhas seguidas até bloquear usuário+IP
 * @param loginBloqueioMin     minutos de bloqueio
 * @param limiteGeralPorMin    leituras por minuto por IP
 * @param limiteEscritaPorMin  gravações por minuto por IP
 * @param limiteLoginPorMin    tentativas de login por minuto por IP
 */
@ConfigurationProperties(prefix = "app")
public record PropriedadesApp(
        boolean confiarProxy,
        boolean cookieSeguro,
        List<String> origensPermitidas,
        int sessaoInatividadeMin,
        int sessaoDuracaoHoras,
        int loginMaxFalhas,
        int loginBloqueioMin,
        int limiteGeralPorMin,
        int limiteEscritaPorMin,
        int limiteLoginPorMin) {

    public PropriedadesApp {
        if (origensPermitidas == null) {
            origensPermitidas = List.of();
        }
    }
}
