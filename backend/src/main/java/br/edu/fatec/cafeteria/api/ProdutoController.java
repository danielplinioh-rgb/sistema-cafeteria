package br.edu.fatec.cafeteria.api;

import br.edu.fatec.cafeteria.api.dto.Dtos.CategoriaView;
import br.edu.fatec.cafeteria.api.dto.Dtos.ContagemView;
import br.edu.fatec.cafeteria.api.dto.Dtos.DisponibilidadeEntrada;
import br.edu.fatec.cafeteria.api.dto.Dtos.ObservacaoView;
import br.edu.fatec.cafeteria.api.dto.Dtos.ProdutoEntrada;
import br.edu.fatec.cafeteria.api.dto.Dtos.ProdutoPainel;
import br.edu.fatec.cafeteria.servico.ServicoCardapio;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** ProdutoController do terminal: gestão de produtos e disponibilidade (RF18). Exige sessão. */
@RestController
@RequestMapping("/api/painel")
public class ProdutoController {

    private final ServicoCardapio servico;

    public ProdutoController(ServicoCardapio servico) {
        this.servico = servico;
    }

    @GetMapping("/produtos")
    public List<ProdutoPainel> produtos() {
        return servico.produtos();
    }

    @GetMapping("/categorias")
    public List<CategoriaView> categorias() {
        return servico.categorias();
    }

    @GetMapping("/observacoes")
    public List<ObservacaoView> observacoes() {
        return servico.observacoes();
    }

    @PostMapping("/produtos")
    public Map<String, Integer> adicionar(@RequestBody ProdutoEntrada e) {
        return Map.of("idProduto", servico.adicionar(e));
    }

    @PutMapping("/produtos/{id}")
    public Map<String, String> atualizar(@PathVariable int id, @RequestBody ProdutoEntrada e) {
        servico.atualizar(id, e);
        return Map.of("status", "ok");
    }

    /** Aviso do cenário "produto constando em pedidos pendentes", mostrado antes de confirmar. */
    @GetMapping("/produtos/{id}/pendentes")
    public ContagemView pendentes(@PathVariable int id) {
        return new ContagemView(servico.pedidosPendentesComProduto(id));
    }

    @PutMapping("/produtos/{id}/disponibilidade")
    public Map<String, String> disponibilidade(@PathVariable int id, @RequestBody DisponibilidadeEntrada e) {
        servico.alterarDisponibilidade(id, e.disponivel());
        return Map.of("status", "ok");
    }

    @DeleteMapping("/produtos/{id}")
    public Map<String, String> remover(@PathVariable int id) {
        servico.remover(id);
        return Map.of("status", "ok");
    }
}
