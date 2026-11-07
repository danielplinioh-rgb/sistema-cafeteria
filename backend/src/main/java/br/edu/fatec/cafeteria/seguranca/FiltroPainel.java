package br.edu.fatec.cafeteria.seguranca;

import br.edu.fatec.cafeteria.config.PropriedadesApp;
import br.edu.fatec.cafeteria.nucleo.RegistroSessoes;
import br.edu.fatec.cafeteria.nucleo.Textos;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.Optional;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Porteiro do módulo do colaborador: tudo sob {@code /api/painel/**}, exceto o login,
 * exige sessão válida (RF17).
 *
 * <p>Proteção contra CSRF (requisição forjada por outro site) em 3 camadas, sem token
 * extra para o front-end gerenciar:
 * <ol>
 *   <li>cookie {@code SameSite=Strict}: o navegador não o envia em requisições de outros sites;</li>
 *   <li>qualquer método que altera dados exige o cabeçalho {@code X-Requested-With: cafeteria-painel},
 *       que um formulário de outro site não consegue enviar (e que exigiria CORS, não habilitado);</li>
 *   <li>se houver cabeçalho {@code Origin}, ele precisa ser a mesma origem ou estar em {@code app.origens-permitidas}.</li>
 * </ol>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class FiltroPainel extends OncePerRequestFilter {

    public static final String COOKIE = "sessao_painel";
    public static final String CABECALHO_REQUISICAO = "X-Requested-With";
    public static final String VALOR_CABECALHO = "cafeteria-painel";
    public static final String ATRIBUTO_SESSAO = "cafeteria.sessao";
    public static final String ATRIBUTO_TOKEN = "cafeteria.token";

    private final RegistroSessoes sessoes;
    private final PropriedadesApp props;
    private final ObjectMapper json;

    public FiltroPainel(RegistroSessoes sessoes, PropriedadesApp props, ObjectMapper json) {
        this.sessoes = sessoes;
        this.props = props;
        this.json = json;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest req) {
        return !req.getRequestURI().startsWith("/api/painel/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String metodo = req.getMethod();
        boolean altera = !("GET".equals(metodo) || "HEAD".equals(metodo));

        if (altera && !requisicaoLegitima(req)) {
            RespostaJson.erro(res, json, 403, "VERIFICACAO_REQUISICAO", Textos.VERIFICACAO_REQUISICAO);
            return;
        }
        if (req.getRequestURI().equals("/api/painel/login")) {
            chain.doFilter(req, res);
            return;
        }
        String token = lerCookie(req);
        Optional<RegistroSessoes.Sessao> sessao = sessoes.validar(token);
        if (sessao.isEmpty()) {
            RespostaJson.erro(res, json, 401, "NAO_AUTENTICADO", Textos.NAO_AUTENTICADO);
            return;
        }
        req.setAttribute(ATRIBUTO_SESSAO, sessao.get());
        req.setAttribute(ATRIBUTO_TOKEN, token);
        chain.doFilter(req, res);
    }

    private boolean requisicaoLegitima(HttpServletRequest req) {
        if (!VALOR_CABECALHO.equals(req.getHeader(CABECALHO_REQUISICAO))) {
            return false;
        }
        String origem = req.getHeader("Origin");
        if (origem == null || origem.isBlank()) {
            return true; // navegadores sempre enviam Origin em POST/PUT/DELETE entre origens; ausente = mesma origem
        }
        if (props.origensPermitidas().contains(origem)) {
            return true;
        }
        try {
            URI o = URI.create(origem);
            String host = req.getHeader("X-Forwarded-Host") != null && props.confiarProxy()
                    ? req.getHeader("X-Forwarded-Host") : req.getHeader("Host");
            String autoridade = o.getPort() == -1 ? o.getHost() : o.getHost() + ":" + o.getPort();
            return host != null && host.equalsIgnoreCase(autoridade);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    /** Lê o token da sessão do cookie HttpOnly. */
    public static String lerCookie(HttpServletRequest req) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie c : cookies) {
            if (COOKIE.equals(c.getName())) {
                return c.getValue();
            }
        }
        return null;
    }
}
