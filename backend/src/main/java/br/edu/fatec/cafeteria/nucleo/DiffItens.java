package br.edu.fatec.cafeteria.nucleo;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Calcula o que mudou entre o pedido gravado e o pedido que o cliente enviou
 * ao alterar um pedido pendente (RF08, caso de uso "Alterar Pedido Pendente").
 *
 * <p>Por que aplicar só as <b>diferenças</b> em vez de apagar tudo e regravar?
 * Itens mantidos conservam o preço do momento do pedido (o banco só copia o
 * preço do cadastro para itens NOVOS) e continuam valendo mesmo que o produto
 * tenha ficado indisponível depois ("a indisponibilidade afeta apenas novas
 * seleções").
 */
public final class DiffItens {

    private DiffItens() {
    }

    /** Item como está gravado no banco. */
    public record ItemAtual(int idItem, int idProduto, int quantidade, Set<Integer> observacoes) {
    }

    /** Item como o cliente quer que fique. {@code idItem == null} indica item novo. */
    public record ItemDesejado(Integer idItem, int idProduto, int quantidade, Set<Integer> observacoes) {
    }

    /** Alteração de um item existente; campos nulos significam "não mudou". */
    public record Atualizacao(int idItem, Integer novaQuantidade, Set<Integer> novasObservacoes) {
    }

    public record Plano(List<Integer> remover, List<Atualizacao> atualizar, List<ItemDesejado> inserir) {
        public boolean semMudancas() {
            return remover.isEmpty() && atualizar.isEmpty() && inserir.isEmpty();
        }
    }

    public static Plano calcular(List<ItemAtual> atuais, List<ItemDesejado> desejados) {
        ValidadorEntrada.quantidadeDeItens(desejados.size());

        Map<Integer, ItemAtual> porId = new HashMap<>();
        for (ItemAtual a : atuais) {
            porId.put(a.idItem(), a);
        }

        Set<Integer> mantidos = new HashSet<>();
        List<Atualizacao> atualizar = new ArrayList<>();
        List<ItemDesejado> inserir = new ArrayList<>();

        for (ItemDesejado d : desejados) {
            ValidadorEntrada.quantidade(d.quantidade());
            if (d.observacoes().size() > ValidadorEntrada.OBSERVACOES_MAXIMAS_POR_ITEM) {
                throw ErroNegocio.invalido("OBSERVACOES_DEMAIS", "Há observações demais em um dos itens");
            }
            if (d.idItem() == null) {
                inserir.add(d);
                continue;
            }
            ItemAtual atual = porId.get(d.idItem());
            if (atual == null) {
                // Item que não pertence a este pedido: nunca revelar detalhes, apenas recusar.
                throw ErroNegocio.invalido("ITEM_INVALIDO", "Um dos itens enviados não pertence a este pedido");
            }
            if (!mantidos.add(atual.idItem())) {
                throw ErroNegocio.invalido("ITEM_DUPLICADO", "O mesmo item foi enviado mais de uma vez");
            }
            if (atual.idProduto() != d.idProduto()) {
                throw ErroNegocio.invalido("ITEM_INVALIDO", "Não é possível trocar o produto de um item; remova-o e adicione outro");
            }
            Integer novaQuantidade = atual.quantidade() != d.quantidade() ? d.quantidade() : null;
            Set<Integer> novasObs = atual.observacoes().equals(d.observacoes()) ? null : d.observacoes();
            if (novaQuantidade != null || novasObs != null) {
                atualizar.add(new Atualizacao(atual.idItem(), novaQuantidade, novasObs));
            }
        }

        List<Integer> remover = new ArrayList<>();
        for (ItemAtual a : atuais) {
            if (!mantidos.contains(a.idItem())) {
                remover.add(a.idItem());
            }
        }
        return new Plano(remover, atualizar, inserir);
    }
}
