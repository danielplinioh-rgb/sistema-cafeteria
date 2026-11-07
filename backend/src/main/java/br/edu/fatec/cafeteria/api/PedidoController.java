package br.edu.fatec.cafeteria.api;

import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoCliente;
import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoCriado;
import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoEntrada;
import br.edu.fatec.cafeteria.nucleo.IpCliente;
import br.edu.fatec.cafeteria.seguranca.FiltroLimiteTaxa;
import br.edu.fatec.cafeteria.servico.ServicoPedidoCliente;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * PedidoController do módulo CLIENTE (smartphone). Sem login: o cliente prova que
 * o pedido é dele com o token secreto recebido na criação, enviado no cabeçalho
 * {@code X-Token-Pedido} (nunca na URL, para não ficar em histórico/logs).
 */
@RestController
@RequestMapping("/api/pedidos")
public class PedidoController {

    private final ServicoPedidoCliente servico;

    public PedidoController(ServicoPedidoCliente servico) {
        this.servico = servico;
    }

    /** RF05/RF06: registra o pedido. {@code Idempotency-Key} evita duplicar se o celular reenviar. */
    @PostMapping
    public PedidoCriado criar(@RequestHeader(value = "Idempotency-Key", required = false) String chave,
                              @RequestBody PedidoEntrada entrada, HttpServletRequest req) {
        return servico.registrar(chave, (String) req.getAttribute(FiltroLimiteTaxa.ATRIBUTO_IP), entrada);
    }

    /** RF13/RF14: consulta de status (o front-end consulta a cada poucos segundos). */
    @GetMapping("/{codigo}")
    public PedidoCliente consultar(@PathVariable String codigo,
                                   @RequestHeader(value = "X-Token-Pedido", required = false) String token) {
        return servico.consultar(codigo, token);
    }

    /** RF08: altera itens/quantidades/observações enquanto aguarda pagamento. */
    @PutMapping("/{codigo}")
    public PedidoCliente alterar(@PathVariable String codigo,
                                 @RequestHeader(value = "X-Token-Pedido", required = false) String token,
                                 @RequestBody PedidoEntrada entrada) {
        return servico.alterar(codigo, token, entrada);
    }
}
