package br.edu.fatec.cafeteria.servico;

import br.edu.fatec.cafeteria.api.dto.Dtos.CategoriaCardapio;
import br.edu.fatec.cafeteria.api.dto.Dtos.CategoriaView;
import br.edu.fatec.cafeteria.api.dto.Dtos.ObservacaoView;
import br.edu.fatec.cafeteria.api.dto.Dtos.ProdutoCardapio;
import br.edu.fatec.cafeteria.api.dto.Dtos.ProdutoEntrada;
import br.edu.fatec.cafeteria.api.dto.Dtos.ProdutoPainel;
import br.edu.fatec.cafeteria.nucleo.ErroNegocio;
import br.edu.fatec.cafeteria.nucleo.Textos;
import br.edu.fatec.cafeteria.nucleo.ValidadorEntrada;
import br.edu.fatec.cafeteria.repositorio.RepositorioCardapio;
import br.edu.fatec.cafeteria.repositorio.RepositorioCardapio.LinhaCardapio;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Cardápio para o cliente (RF02, RF04) e gestão de produtos para o colaborador
 * (RF18 e ProdutoController: adicionar, atualizar, remover e alterar disponibilidade).
 */
@Service
public class ServicoCardapio {

    private final RepositorioCardapio repo;
    private final TransactionTemplate tx;

    public ServicoCardapio(RepositorioCardapio repo, TransactionTemplate tx) {
        this.repo = repo;
        this.tx = tx;
    }

    /** Cardápio agrupado por categoria. Produtos indisponíveis vêm junto (aparecem em cinza). */
    public List<CategoriaCardapio> cardapioPublico() {
        Map<Integer, List<ProdutoCardapio>> produtos = new LinkedHashMap<>();
        Map<Integer, String> nomes = new LinkedHashMap<>();
        for (LinhaCardapio l : repo.cardapio()) {
            nomes.putIfAbsent(l.idCategoria(), l.categoria());
            produtos.computeIfAbsent(l.idCategoria(), k -> new ArrayList<>()).add(new ProdutoCardapio(
                    l.idProduto(), l.nome(), l.descricao(), l.preco(), l.disponivel(), l.imagem(), l.observacoes()));
        }
        List<CategoriaCardapio> saida = new ArrayList<>();
        produtos.forEach((id, lista) -> saida.add(new CategoriaCardapio(id, nomes.get(id), lista)));
        return saida;
    }

    public void verificarBanco() {
        repo.verificarBanco();
    }

    // ------------------------------------------------------------------ painel
    public List<ProdutoPainel> produtos() {
        return repo.produtosDoPainel();
    }

    public List<CategoriaView> categorias() {
        return repo.categorias();
    }

    public List<ObservacaoView> observacoes() {
        return repo.observacoes();
    }

    /** Quantos pedidos em aberto contêm o produto (aviso exibido antes de alterar a disponibilidade). */
    public int pedidosPendentesComProduto(int idProduto) {
        repo.produtoBasico(idProduto).filter(p -> p.ativo()).orElseThrow(ServicoCardapio::naoEncontrado);
        return repo.pedidosPendentesComProduto(idProduto);
    }

    /** Pedidos já registrados não são afetados; só as novas seleções ficam bloqueadas. */
    public void alterarDisponibilidade(int idProduto, boolean disponivel) {
        if (repo.alterarDisponibilidade(idProduto, disponivel) == 0) {
            throw naoEncontrado();
        }
    }

    public int adicionar(ProdutoEntrada e) {
        Validado v = validar(e);
        try {
            return tx.execute(s -> {
                int id = repo.inserirProduto(e.idCategoria(), v.nome, v.descricao, v.preco, v.imagem);
                repo.substituirObservacoes(id, v.observacoes);
                return id;
            });
        } catch (DataAccessException | TransactionException ex) {
            throw ErroNegocio.invalido("DADOS_INVALIDOS", "Verifique a categoria e as observações escolhidas");
        }
    }

    public void atualizar(int idProduto, ProdutoEntrada e) {
        Validado v = validar(e);
        try {
            tx.executeWithoutResult(s -> {
                if (repo.atualizarProduto(idProduto, e.idCategoria(), v.nome, v.descricao, v.preco, v.imagem) == 0) {
                    throw naoEncontrado();
                }
                repo.substituirObservacoes(idProduto, v.observacoes);
            });
        } catch (DataAccessException | TransactionException ex) {
            throw ErroNegocio.invalido("DADOS_INVALIDOS", "Verifique a categoria e as observações escolhidas");
        }
    }

    /** Exclusão lógica: o produto some do cardápio, o histórico de pedidos continua íntegro. */
    public void remover(int idProduto) {
        if (repo.removerLogicamente(idProduto) == 0) {
            throw naoEncontrado();
        }
    }

    // ------------------------------------------------------------- auxiliares
    private record Validado(String nome, String descricao, java.math.BigDecimal preco, String imagem,
                            List<Integer> observacoes) {
    }

    private static Validado validar(ProdutoEntrada e) {
        List<Integer> obs = e.observacoes() == null ? List.of() : new ArrayList<>(new LinkedHashSet<>(e.observacoes()));
        if (obs.size() > 20 || obs.stream().anyMatch(o -> o == null)) {
            throw ErroNegocio.invalido("OBSERVACOES_INVALIDAS", "Lista de observações inválida");
        }
        return new Validado(
                ValidadorEntrada.texto(e.nome(), "nome", 100, true),
                ValidadorEntrada.texto(e.descricao(), "descrição", 255, false),
                ValidadorEntrada.preco(e.preco()),
                ValidadorEntrada.arquivoImagem(e.imagem()),
                obs);
    }

    private static ErroNegocio naoEncontrado() {
        return ErroNegocio.naoEncontrado("PRODUTO_NAO_ENCONTRADO", Textos.PRODUTO_NAO_ENCONTRADO);
    }
}
