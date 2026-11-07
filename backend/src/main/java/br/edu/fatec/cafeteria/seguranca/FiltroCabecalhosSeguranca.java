package br.edu.fatec.cafeteria.seguranca;

import br.edu.fatec.cafeteria.config.PropriedadesApp;
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
 * Cabeçalhos de segurança em TODAS as respostas da API.
 * (O nginx aplica os equivalentes aos arquivos estáticos do site.)
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class FiltroCabecalhosSeguranca extends OncePerRequestFilter {

    private final PropriedadesApp props;

    public FiltroCabecalhosSeguranca(PropriedadesApp props) {
        this.props = props;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        // A API só devolve JSON: nenhum recurso externo, nenhum quadro, nenhum script.
        res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("Referrer-Policy", "no-referrer");
        res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        // Dados de pedidos/sessão nunca devem ficar em cache do navegador ou de proxies.
        res.setHeader("Cache-Control", "no-store");
        if (props.cookieSeguro()) {
            res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }
        chain.doFilter(req, res);
    }
}
