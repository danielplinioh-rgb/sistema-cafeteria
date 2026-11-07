package br.edu.fatec.cafeteria.api;

import br.edu.fatec.cafeteria.api.dto.Dtos.LoginEntrada;
import br.edu.fatec.cafeteria.api.dto.Dtos.SessaoView;
import br.edu.fatec.cafeteria.config.PropriedadesApp;
import br.edu.fatec.cafeteria.nucleo.RegistroSessoes;
import br.edu.fatec.cafeteria.seguranca.FiltroLimiteTaxa;
import br.edu.fatec.cafeteria.seguranca.FiltroPainel;
import br.edu.fatec.cafeteria.servico.ServicoAutenticacao;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Login, sessão e logout do colaborador (RF17). */
@RestController
@RequestMapping("/api/painel")
public class PainelAutenticacaoController {

    private final ServicoAutenticacao autenticacao;
    private final PropriedadesApp props;

    public PainelAutenticacaoController(ServicoAutenticacao autenticacao, PropriedadesApp props) {
        this.autenticacao = autenticacao;
        this.props = props;
    }

    @PostMapping("/login")
    public SessaoView login(@RequestBody LoginEntrada e, HttpServletRequest req, HttpServletResponse res) {
        var entrada = autenticacao.entrar(e.usuario(), e.senha(), (String) req.getAttribute(FiltroLimiteTaxa.ATRIBUTO_IP));
        res.addHeader("Set-Cookie", cookie(entrada.token(), props.sessaoDuracaoHoras() * 3600L));
        return new SessaoView(entrada.nome(), entrada.usuario());
    }

    /** Permite ao front-end saber, ao abrir a página, se ainda há sessão válida. */
    @GetMapping("/sessao")
    public SessaoView sessao(HttpServletRequest req) {
        var s = (RegistroSessoes.Sessao) req.getAttribute(FiltroPainel.ATRIBUTO_SESSAO);
        return new SessaoView(s.nome(), s.usuario());
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest req, HttpServletResponse res) {
        autenticacao.sair((String) req.getAttribute(FiltroPainel.ATRIBUTO_TOKEN));
        res.addHeader("Set-Cookie", cookie("", 0));
        return Map.of("status", "ok");
    }

    /**
     * Cookie da sessão: HttpOnly (JavaScript não lê), SameSite=Strict (não vai em
     * requisições de outros sites), Path restrito ao painel e Secure em HTTPS.
     */
    private String cookie(String valor, long segundos) {
        return FiltroPainel.COOKIE + "=" + valor + "; Path=/api/painel; Max-Age=" + segundos
                + "; HttpOnly; SameSite=Strict" + (props.cookieSeguro() ? "; Secure" : "");
    }
}
