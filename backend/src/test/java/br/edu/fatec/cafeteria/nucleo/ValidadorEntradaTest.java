package br.edu.fatec.cafeteria.nucleo;

import static org.junit.jupiter.api.Assertions.*;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class ValidadorEntradaTest {

    @Test
    void localMesaEBalcao() {
        assertEquals("Mesa 5", ValidadorEntrada.local("MESA", 5));
        assertEquals("Retirada no Balcão", ValidadorEntrada.local("balcao", null));
    }

    @Test
    void localInvalidoEhRecusado() {
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.local("MESA", 0));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.local("MESA", null));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.local("MESA", 10000));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.local("OUTRO", 1));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.local(null, 1));
    }

    @Test
    void quantidadeLimites() {
        assertEquals(1, ValidadorEntrada.quantidade(1));
        assertEquals(20, ValidadorEntrada.quantidade(20));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.quantidade(0));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.quantidade(21));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.quantidadeDeItens(0));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.quantidadeDeItens(31));
    }

    @Test
    void precoValida() {
        assertEquals(new BigDecimal("12.50"), ValidadorEntrada.preco(new BigDecimal("12.5")));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.preco(new BigDecimal("-1")));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.preco(new BigDecimal("10000")));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.preco(new BigDecimal("1.999")));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.preco(null));
    }

    @Test
    void imagemBloqueiaTravessiaDeDiretorio() {
        assertEquals("cappuccino.svg", ValidadorEntrada.arquivoImagem(" cappuccino.svg "));
        assertNull(ValidadorEntrada.arquivoImagem("  "));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.arquivoImagem("../etc/passwd.png"));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.arquivoImagem("a/b.png"));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.arquivoImagem("x.exe"));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.arquivoImagem("a..b.png"));
    }

    @Test
    void textoLivre() {
        assertEquals("ok", ValidadorEntrada.texto("  ok ", "nome", 10, true));
        assertNull(ValidadorEntrada.texto("", "nome", 10, false));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.texto("", "nome", 10, true));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.texto("abcdefghijk", "nome", 10, true));
        assertThrows(ErroNegocio.class, () -> ValidadorEntrada.texto("a\u0000b", "nome", 10, true));
    }

    @Test
    void autenticacaoEToken() {
        assertTrue(ValidadorEntrada.usuarioComFormatoValido("ana.souza"));
        assertFalse(ValidadorEntrada.usuarioComFormatoValido("a b"));
        assertFalse(ValidadorEntrada.usuarioComFormatoValido("' OR 1=1"));
        assertFalse(ValidadorEntrada.senhaComTamanhoValido(""));
        assertFalse(ValidadorEntrada.senhaComTamanhoValido("x".repeat(129)));
        assertTrue(ValidadorEntrada.senhaComTamanhoValido("segredo"));
        assertNotNull(ValidadorEntrada.tokenDoPedido("123e4567-e89b-12d3-a456-426614174000"));
        assertNull(ValidadorEntrada.tokenDoPedido("nao-e-uuid"));
        assertNull(ValidadorEntrada.tokenDoPedido(null));
        assertTrue(ValidadorEntrada.codigoComFormatoValido("PED-0001"));
        assertFalse(ValidadorEntrada.codigoComFormatoValido("PED-1; DROP"));
    }
}
