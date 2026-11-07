package br.edu.fatec.cafeteria.nucleo;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class SegurancaTest {

    @Test
    void tokensSaoUnicosELongos() {
        String a = GeradorToken.novoTokenOpaco();
        String b = GeradorToken.novoTokenOpaco();
        assertNotEquals(a, b);
        assertEquals(43, a.length());
        assertEquals(64, GeradorToken.sha256Hex(a).length());
        assertTrue(GeradorToken.iguais(a, a));
        assertFalse(GeradorToken.iguais(a, b));
        assertFalse(GeradorToken.iguais(null, a));
    }

    @Test
    void sha256Conhecido() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", GeradorToken.sha256Hex("abc"));
    }

    @Test
    void limitadorConsomeEReabastece() {
        AtomicLong t = new AtomicLong(0);
        LimitadorTaxa l = new LimitadorTaxa(3, 3000, t::get);
        assertTrue(l.permitir("ip"));
        assertTrue(l.permitir("ip"));
        assertTrue(l.permitir("ip"));
        assertFalse(l.permitir("ip"));
        assertTrue(l.permitir("outro"));
        t.set(1000); // 1 ficha de volta
        assertTrue(l.permitir("ip"));
        assertFalse(l.permitir("ip"));
        t.set(10_000);
        l.limpar();
        assertEquals(0, l.tamanho());
    }

    @Test
    void bloqueioAposCincoFalhasEExpira() {
        AtomicLong t = new AtomicLong(1000);
        BloqueioTentativas b = new BloqueioTentativas(5, 300_000, t::get);
        String k = BloqueioTentativas.chave("Ana", "1.1.1.1");
        for (int i = 0; i < 4; i++) b.registrarFalha(k);
        assertFalse(b.bloqueado(k));
        b.registrarFalha(k);
        assertTrue(b.bloqueado(k));
        assertEquals(300, b.segundosRestantes(k));
        assertFalse(b.bloqueado(BloqueioTentativas.chave("ana", "2.2.2.2")));
        assertTrue(b.bloqueado(BloqueioTentativas.chave("ANA", "1.1.1.1")));
        t.addAndGet(300_001);
        assertFalse(b.bloqueado(k));
        b.registrarFalha(k); // contador recomeça
        assertFalse(b.bloqueado(k));
    }

    @Test
    void sucessoZeraContador() {
        BloqueioTentativas b = new BloqueioTentativas(2, 1000);
        b.registrarFalha("k");
        b.registrarSucesso("k");
        b.registrarFalha("k");
        assertFalse(b.bloqueado("k"));
    }

    @Test
    void sessaoExpiraPorInatividadeEDuracao() {
        AtomicLong t = new AtomicLong(0);
        RegistroSessoes r = new RegistroSessoes(30 * 60_000L, 12 * 3_600_000L, t::get);
        String tk = r.criar(1, "Ana", "ana");
        assertTrue(r.validar(tk).isPresent());
        t.addAndGet(29 * 60_000L);
        assertTrue(r.validar(tk).isPresent()); // renova
        t.addAndGet(29 * 60_000L);
        assertTrue(r.validar(tk).isPresent());
        t.addAndGet(31 * 60_000L);
        assertTrue(r.validar(tk).isEmpty()); // inatividade
        // duração máxima
        String tk2 = r.criar(1, "Ana", "ana");
        for (int i = 0; i < 25; i++) {
            t.addAndGet(29 * 60_000L);
            r.validar(tk2);
        }
        assertTrue(r.validar(tk2).isEmpty());
    }

    @Test
    void sessaoRevogacaoETokensInvalidos() {
        RegistroSessoes r = new RegistroSessoes(60_000, 120_000);
        String tk = r.criar(7, "Ana", "ana");
        assertEquals(1, r.quantidade());
        r.revogar(tk);
        assertTrue(r.validar(tk).isEmpty());
        assertTrue(r.validar(null).isEmpty());
        assertTrue(r.validar("curto").isEmpty());
        String a = r.criar(7, "Ana", "ana");
        r.criar(8, "Bia", "bia");
        r.revogarDoColaborador(7);
        assertTrue(r.validar(a).isEmpty());
        assertEquals(1, r.quantidade());
    }

    @Test
    void ipSoConfiaNoProxyQuandoConfigurado() {
        assertEquals("9.9.9.9", IpCliente.resolver("9.9.9.9", "1.2.3.4", false));
        assertEquals("1.2.3.4", IpCliente.resolver("9.9.9.9", "6.6.6.6, 1.2.3.4", true));
        assertEquals("9.9.9.9", IpCliente.resolver("9.9.9.9", "<script>", true));
        assertEquals("desconhecido", IpCliente.resolver(null, null, false));
        assertEquals("0:0:0:0:0:0:0:1", IpCliente.resolver("0:0:0:0:0:0:0:1", null, false));
    }
}
