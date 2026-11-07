package br.edu.fatec.cafeteria.seguranca;

import br.edu.fatec.cafeteria.config.ConfiguracaoSeguranca.Limitadores;
import br.edu.fatec.cafeteria.config.PropriedadesApp;
import br.edu.fatec.cafeteria.nucleo.IpCliente;
import br.edu.fatec.cafeteria.nucleo.LimitadorTaxa;
import br.edu.fatec.cafeteria.nucleo.Textos;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Limite de requisições por IP (RNF07) e tamanho máximo do corpo.
 * Mitiga força bruta, varredura de códigos de pedido, spam de pedidos e DoS simples.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class FiltroLimiteTaxa extends OncePerRequestFilter {

    private static final long CORPO_MAXIMO_BYTES = 64 * 1024;

    private final Limitadores limitadores;
    private final PropriedadesApp props;
    private final ObjectMapper json;

    public FiltroLimiteTaxa(Limitadores limitadores, PropriedadesApp props, ObjectMapper json) {
        this.limitadores = limitadores;
        this.props = props;
        this.json = json;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (req.getContentLengthLong() > CORPO_MAXIMO_BYTES) {
            RespostaJson.erro(res, json, 413, "CORPO_GRANDE", Textos.REQUISICAO_INVALIDA);
            return;
        }
        String ip = IpCliente.resolver(req.getRemoteAddr(), req.getHeader("X-Forwarded-For"), props.confiarProxy());
        req.setAttribute(ATRIBUTO_IP, ip);

        String metodo = req.getMethod();
        boolean login = req.getRequestURI().endsWith("/painel/login");
        boolean escrita = !("GET".equals(metodo) || "HEAD".equals(metodo) || "OPTIONS".equals(metodo));
        LimitadorTaxa limitador = login ? limitadores.login() : escrita ? limitadores.escrita() : limitadores.geral();

        if (!limitador.permitir((login ? "L:" : escrita ? "E:" : "G:") + ip)) {
            res.setHeader("Retry-After", "30");
            RespostaJson.erro(res, json, 429, "LIMITE_REQUISICOES", Textos.LIMITE_REQUISICOES);
            return;
        }
        chain.doFilter(req, res);
    }

    /** Nome do atributo de requisição que carrega o IP já resolvido. */
    public static final String ATRIBUTO_IP = "cafeteria.ip";
}
