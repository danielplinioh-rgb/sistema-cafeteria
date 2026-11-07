package br.edu.fatec.cafeteria.servico;

import br.edu.fatec.cafeteria.api.dto.Dtos.ItemEntrada;
import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoCliente;
import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoCriado;
import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoEntrada;
import br.edu.fatec.cafeteria.api.dto.Dtos.PedidoPainel;
import br.edu.fatec.cafeteria.nucleo.DiffItens;
import br.edu.fatec.cafeteria.nucleo.ErroNegocio;
import br.edu.fatec.cafeteria.nucleo.StatusPedido;
import br.edu.fatec.cafeteria.nucleo.Textos;
import br.edu.fatec.cafeteria.nucleo.ValidadorEntrada;
import br.edu.fatec.cafeteria.repositorio.RepositorioCardapio;
import br.edu.fatec.cafeteria.repositorio.RepositorioPedido;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.TransactionException;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Casos de uso do CLIENTE: Realizar Pedido (RF05, RF06), Acompanhar Status
 * (RF13, RF14) e Alterar Pedido Pendente (RF08).
 *
 * <p>Cada operação que grava roda em UMA transação (tudo ou nada). O cliente é
 * identificado pelo par código + token secreto (RNF07).
 */
@Service
public class ServicoPedidoCliente {

    private static final Pattern CHAVE_IDEMPOTENCIA = Pattern.compile("^[A-Za-z0-9_\\-]{16,64}$");
    private static final long VALIDADE_IDEMPOTENCIA_MS = 10 * 60_000L;

    private record Guardado(long criadoEm, PedidoCriado resposta) {
    }

    private final RepositorioPedido pedidos;
    private final RepositorioCardapio cardapio;
    private final TransactionTemplate tx;
    /** Evita pedido duplicado quando o celular reenvia a mesma requisição (rede instável). */
    private final Map<String, Guardado> idempotencia = new ConcurrentHashMap<>();

    public ServicoPedidoCliente(RepositorioPedido pedidos, RepositorioCardapio cardapio, TransactionTemplate tx) {
        this.pedidos = pedidos;
        this.cardapio = cardapio;
        this.tx = tx;
    }

    // ============================================================ criar (RF05/RF06)

    /**
     * @param chave cabeçalho Idempotency-Key: a mesma chave devolve o mesmo pedido, sem criar outro
     * @param ip    parte da chave de idempotência, para que um IP não "adivinhe" a chave de outro
     */
    public PedidoCriado registrar(String chave, String ip, PedidoEntrada entrada) {
        if (chave == null || !CHAVE_IDEMPOTENCIA.matcher(chave).matches()) {
            throw ErroNegocio.requisicaoInvalida("CHAVE_INVALIDA", Textos.REQUISICAO_INVALIDA);
        }
        long agora = System.currentTimeMillis();
        idempotencia.values().removeIf(g -> agora - g.criadoEm() > VALIDADE_IDEMPOTENCIA_MS);
        // computeIfAbsent é atômico por chave: duas requisições simultâneas não criam dois pedidos.
        return idempotencia.computeIfAbsent(ip + "|" + chave, k -> new Guardado(agora, criar(entrada))).resposta();
    }

    private PedidoCriado criar(PedidoEntrada e) {
        String local = ValidadorEntrada.local(e.tipo(), e.mesa());
        List<ItemEntrada> itens = e.itens() == null ? List.of() : e.itens();
        ValidadorEntrada.quantidadeDeItens(itens.size());

        try {
            return tx.execute(status -> {
                // 1) Pré-validação com mensagens claras (o banco repete as regras como defesa final).
                for (ItemEntrada i : itens) {
                    ValidadorEntrada.quantidade(i.quantidade());
                    exigirProdutoDisponivel(i.idProduto());
                    exigirObservacoesValidas(i.idProduto(), conjunto(i.observacoes()));
                }
                // 2) Código único + cabeçalho + itens (Pedido.gerarCodigo -> registrarPedido).
                String codigo = pedidos.proximoCodigo();
                RepositorioPedido.Criado criado = pedidos.inserirPedido(codigo, local);
                for (ItemEntrada i : itens) {
                    int idItem = pedidos.inserirItem(criado.idPedido(), i.idProduto(), i.quantidade());
                    for (Integer obs : conjunto(i.observacoes())) {
                        pedidos.inserirObservacaoDoItem(idItem, i.idProduto(), obs);
                    }
                }
                PedidoPainel salvo = pedidos.buscarPorCodigo(codigo).orElseThrow();
                return new PedidoCriado(criado.token().toString(), salvo.paraCliente());
            });
        } catch (DataAccessException | TransactionException ex) {
            throw new ErroNegocio(503, "INSTABILIDADE", Textos.INSTABILIDADE, null);
        }
    }

    // ================================================== acompanhar / abrir (RF13)

    public PedidoCliente consultar(String codigo, String tokenTexto) {
        return buscar(codigo, tokenTexto).paraCliente();
    }

    private PedidoPainel buscar(String codigo, String tokenTexto) {
        UUID token = ValidadorEntrada.tokenDoPedido(tokenTexto);
        if (token == null || !ValidadorEntrada.codigoComFormatoValido(codigo)) {
            throw naoEncontrado();
        }
        return pedidos.buscarDoCliente(codigo, token).orElseThrow(ServicoPedidoCliente::naoEncontrado);
    }

    private static ErroNegocio naoEncontrado() {
        // Mesma resposta para "código inexistente" e "token errado": não revela qual dos dois falhou.
        return ErroNegocio.naoEncontrado("PEDIDO_NAO_ENCONTRADO", Textos.PEDIDO_NAO_ENCONTRADO);
    }

    // ===================================================== alterar pendente (RF08)

    public PedidoCliente alterar(String codigo, String tokenTexto, PedidoEntrada entrada) {
        UUID token = ValidadorEntrada.tokenDoPedido(tokenTexto);
        if (token == null || !ValidadorEntrada.codigoComFormatoValido(codigo)) {
            throw naoEncontrado();
        }
        List<ItemEntrada> itens = entrada.itens() == null ? List.of() : entrada.itens();
        ValidadorEntrada.quantidadeDeItens(itens.size());

        try {
            return tx.execute(status -> {
                // Trava o pedido: se o colaborador estiver confirmando o pagamento, uma das duas
                // operações espera a outra terminar. Nunca se altera um pedido já pago.
                RepositorioPedido.Travado t = pedidos.travarDoCliente(codigo, token)
                        .orElseThrow(ServicoPedidoCliente::naoEncontrado);
                if (!StatusPedido.deTexto(t.status()).equals(StatusPedido.AGUARDANDO_PAGAMENTO)) {
                    throw ErroNegocio.conflito("ALTERACAO_APOS_PAGAMENTO", Textos.ALTERACAO_APOS_PAGAMENTO);
                }

                PedidoPainel atual = pedidos.buscarPorCodigo(codigo).orElseThrow();
                List<DiffItens.ItemAtual> atuais = new ArrayList<>();
                for (var i : atual.itens()) {
                    atuais.add(new DiffItens.ItemAtual(i.idItem(), i.idProduto(), i.quantidade(),
                            new LinkedHashSet<>(i.idObservacoes())));
                }
                List<DiffItens.ItemDesejado> desejados = new ArrayList<>();
                for (ItemEntrada i : itens) {
                    desejados.add(new DiffItens.ItemDesejado(i.idItem(), i.idProduto(), i.quantidade(),
                            conjunto(i.observacoes())));
                }
                DiffItens.Plano plano = DiffItens.calcular(atuais, desejados);
                if (plano.semMudancas()) {
                    return atual.paraCliente();
                }

                // Aplica somente as diferenças: itens mantidos conservam o preço original.
                for (int idItem : plano.remover()) {
                    pedidos.removerItem(t.idPedido(), idItem);
                }
                for (DiffItens.Atualizacao a : plano.atualizar()) {
                    if (a.novaQuantidade() != null) {
                        pedidos.alterarQuantidade(t.idPedido(), a.idItem(), a.novaQuantidade());
                    }
                    if (a.novasObservacoes() != null) {
                        int idProduto = atuais.stream().filter(x -> x.idItem() == a.idItem()).findFirst().orElseThrow().idProduto();
                        exigirObservacoesValidas(idProduto, a.novasObservacoes());
                        pedidos.limparObservacoesDoItem(a.idItem());
                        for (Integer obs : a.novasObservacoes()) {
                            pedidos.inserirObservacaoDoItem(a.idItem(), idProduto, obs);
                        }
                    }
                }
                for (DiffItens.ItemDesejado n : plano.inserir()) {
                    exigirProdutoDisponivel(n.idProduto()); // indisponibilidade só afeta NOVAS seleções
                    exigirObservacoesValidas(n.idProduto(), n.observacoes());
                    int idItem = pedidos.inserirItem(t.idPedido(), n.idProduto(), n.quantidade());
                    for (Integer obs : n.observacoes()) {
                        pedidos.inserirObservacaoDoItem(idItem, n.idProduto(), obs);
                    }
                }
                return pedidos.buscarPorCodigo(codigo).orElseThrow().paraCliente();
            });
        } catch (DataAccessException | TransactionException ex) {
            // Falha de comunicação: a transação foi desfeita; o pedido anterior continua intacto.
            throw new ErroNegocio(503, "ALTERACAO_FALHOU", Textos.ALTERACAO_FALHOU, null);
        }
    }

    // ================================================================ auxiliares

    private void exigirProdutoDisponivel(int idProduto) {
        var p = cardapio.produtoBasico(idProduto)
                .filter(RepositorioCardapio.ProdutoBasico::ativo)
                .orElseThrow(() -> ErroNegocio.invalido("PRODUTO_INVALIDO", Textos.PRODUTO_NAO_ENCONTRADO));
        if (!p.disponivel()) {
            throw ErroNegocio.conflito("PRODUTO_INDISPONIVEL", String.format(Textos.PRODUTO_INDISPONIVEL, p.nome()));
        }
    }

    private void exigirObservacoesValidas(int idProduto, Set<Integer> observacoes) {
        if (observacoes.size() > ValidadorEntrada.OBSERVACOES_MAXIMAS_POR_ITEM) {
            throw ErroNegocio.invalido("OBSERVACOES_DEMAIS", "Há observações demais em um dos itens");
        }
        for (Integer obs : observacoes) {
            if (obs == null || !cardapio.produtoAceitaObservacao(idProduto, obs)) {
                throw ErroNegocio.invalido("OBSERVACAO_INVALIDA", "Uma das observações escolhidas não está disponível para este produto");
            }
        }
    }

    private static Set<Integer> conjunto(List<Integer> lista) {
        return lista == null ? new LinkedHashSet<>() : new LinkedHashSet<>(lista);
    }
}
