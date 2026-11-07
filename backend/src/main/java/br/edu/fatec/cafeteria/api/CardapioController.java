package br.edu.fatec.cafeteria.api;

import br.edu.fatec.cafeteria.api.dto.Dtos.CategoriaCardapio;
import br.edu.fatec.cafeteria.servico.ServicoCardapio;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints PÚBLICOS do cardápio (RF02, RF04, RF18) e verificação de saúde. */
@RestController
@RequestMapping("/api")
public class CardapioController {

    private final ServicoCardapio cardapio;

    public CardapioController(ServicoCardapio cardapio) {
        this.cardapio = cardapio;
    }

    @GetMapping("/cardapio")
    public List<CategoriaCardapio> cardapio() {
        return cardapio.cardapioPublico();
    }

    /** Usado pelo Docker/nginx para saber se o servidor e o banco estão de pé. */
    @GetMapping("/saude")
    public Map<String, String> saude() {
        cardapio.verificarBanco();
        return Map.of("status", "ok");
    }
}
