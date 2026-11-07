package br.edu.fatec.cafeteria.api;

import br.edu.fatec.cafeteria.api.dto.Dtos.HistoricoView;
import br.edu.fatec.cafeteria.api.dto.Dtos.PagamentoEntrada;
import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoPainel;
import br.edu.fatec.cafeteria.api.dto.Dtos.StatusEntrada;
import br.edu.fatec.cafeteria.api.dto.Dtos.TextoEntrada;
import br.edu.fatec.cafeteria.nucleo.RegistroSessoes;
import br.edu.fatec.cafeteria.seguranca.FiltroPainel;
import br.edu.fatec.cafeteria.servico.ServicoPedidoPainel;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Operações de pedidos do terminal do colaborador. Todas exigem sessão (FiltroPainel). */
@RestController
@RequestMapping("/api/painel")
public class PainelPedidoController {

    private final ServicoPedidoPainel servico;

    public PainelPedidoController(ServicoPedidoPainel servico) {
        this.servico = servico;
    }

    private static int quem(HttpServletRequest req) {
        return ((RegistroSessoes.Sessao) req.getAttribute(FiltroPainel.ATRIBUTO_SESSAO)).idColaborador();
    }

    @GetMapping("/pedidos")
    public List<PedidoPainel> fila() {
        return servico.fila();
    }

    @GetMapping("/pedidos/{codigo}")
    public PedidoPainel detalhe(@PathVariable String codigo) {
        return servico.detalhe(codigo);
    }

    @GetMapping("/historico")
    public List<HistoricoView> historico() {
        return servico.historico();
    }

    @PostMapping("/pedidos/{codigo}/pagamento")
    public PedidoPainel confirmarPagamento(@PathVariable String codigo, @RequestBody PagamentoEntrada e,
                                           HttpServletRequest req) {
        return servico.confirmarPagamento(codigo, e.versao(), quem(req));
    }

    @PostMapping("/pedidos/{codigo}/status")
    public PedidoPainel atualizarStatus(@PathVariable String codigo, @RequestBody StatusEntrada e,
                                        HttpServletRequest req) {
        return servico.atualizarStatus(codigo, e.para(), quem(req));
    }

    @PostMapping("/pedidos/{codigo}/cancelamento")
    public PedidoPainel cancelar(@PathVariable String codigo, @RequestBody TextoEntrada e, HttpServletRequest req) {
        return servico.cancelar(codigo, e.texto(), quem(req));
    }

    @PostMapping("/pedidos/{codigo}/finalizacao")
    public PedidoPainel finalizar(@PathVariable String codigo, @RequestBody TextoEntrada e, HttpServletRequest req) {
        return servico.finalizar(codigo, e.texto(), quem(req));
    }

    @PutMapping("/pedidos/{codigo}/observacao")
    public PedidoPainel observacao(@PathVariable String codigo, @RequestBody TextoEntrada e, HttpServletRequest req) {
        return servico.observacaoInterna(codigo, e.texto(), quem(req));
    }
}
