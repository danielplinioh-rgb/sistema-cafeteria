package br.edu.fatec.cafeteria.nucleo;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class DiffItensTest {

    private final List<DiffItens.ItemAtual> atuais = List.of(
            new DiffItens.ItemAtual(10, 1, 2, Set.of()),
            new DiffItens.ItemAtual(11, 2, 1, Set.of(5)));

    @Test
    void semMudancas() {
        var p = DiffItens.calcular(atuais, List.of(
                new DiffItens.ItemDesejado(10, 1, 2, Set.of()),
                new DiffItens.ItemDesejado(11, 2, 1, Set.of(5))));
        assertTrue(p.semMudancas());
    }

    @Test
    void removeAtualizaInsere() {
        var p = DiffItens.calcular(atuais, List.of(
                new DiffItens.ItemDesejado(10, 1, 3, Set.of()),
                new DiffItens.ItemDesejado(null, 9, 1, Set.of(6))));
        assertEquals(List.of(11), p.remover());
        assertEquals(1, p.atualizar().size());
        assertEquals(3, (int) p.atualizar().get(0).novaQuantidade());
        assertNull(p.atualizar().get(0).novasObservacoes());
        assertEquals(1, p.inserir().size());
    }

    @Test
    void mudaApenasObservacoes() {
        var p = DiffItens.calcular(atuais, List.of(
                new DiffItens.ItemDesejado(10, 1, 2, Set.of()),
                new DiffItens.ItemDesejado(11, 2, 1, Set.of(6))));
        assertNull(p.atualizar().get(0).novaQuantidade());
        assertEquals(Set.of(6), p.atualizar().get(0).novasObservacoes());
    }

    @Test
    void rejeitaItemDeOutroPedidoDuplicadoETrocaDeProduto() {
        assertThrows(ErroNegocio.class, () -> DiffItens.calcular(atuais,
                List.of(new DiffItens.ItemDesejado(99, 1, 1, Set.of()))));
        assertThrows(ErroNegocio.class, () -> DiffItens.calcular(atuais, List.of(
                new DiffItens.ItemDesejado(10, 1, 1, Set.of()),
                new DiffItens.ItemDesejado(10, 1, 1, Set.of()))));
        assertThrows(ErroNegocio.class, () -> DiffItens.calcular(atuais,
                List.of(new DiffItens.ItemDesejado(10, 7, 1, Set.of()))));
    }

    @Test
    void rejeitaPedidoVazioQuantidadeEObservacoesDemais() {
        assertThrows(ErroNegocio.class, () -> DiffItens.calcular(atuais, List.of()));
        assertThrows(ErroNegocio.class, () -> DiffItens.calcular(atuais,
                List.of(new DiffItens.ItemDesejado(10, 1, 21, Set.of()))));
        assertThrows(ErroNegocio.class, () -> DiffItens.calcular(atuais,
                List.of(new DiffItens.ItemDesejado(10, 1, 1, Set.of(1, 2, 3, 4, 5)))));
    }

    @Test
    void statusDoCiclo() {
        assertTrue(StatusPedido.AGUARDANDO_PAGAMENTO.podeIrPara(StatusPedido.EM_PREPARO));
        assertFalse(StatusPedido.ENTREGUE.cancelavel());
        assertTrue(StatusPedido.EM_PREPARO.cancelamentoExigeJustificativa());
        assertFalse(StatusPedido.AGUARDANDO_PAGAMENTO.cancelamentoExigeJustificativa());
        assertEquals(StatusPedido.PRONTO, StatusPedido.ENTREGUE.anteriorNoCiclo());
        assertEquals(StatusPedido.EM_PREPARO, StatusPedido.deTexto("em_preparo"));
        List<Integer> l = new ArrayList<>();
        assertTrue(l.isEmpty());
    }
}
