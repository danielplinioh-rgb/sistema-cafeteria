package br.edu.fatec.cafeteria.nucleo;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Geração e comparação segura de segredos (tokens de sessão).
 *
 * <ul>
 *   <li>Tokens vêm de {@link SecureRandom} (gerador criptográfico), 256 bits.</li>
 *   <li>O servidor guarda apenas o SHA-256 do token: se a memória for vazada,
 *       os tokens válidos não são revelados.</li>
 *   <li>Comparações usam tempo constante, para não vazar informação por tempo de resposta.</li>
 * </ul>
 */
public final class GeradorToken {

    private static final SecureRandom ALEATORIO = new SecureRandom();

    private GeradorToken() {
    }

    /** Token opaco de 256 bits em Base64 URL-safe (43 caracteres). */
    public static String novoTokenOpaco() {
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** SHA-256 em hexadecimal; usado como chave de busca da sessão. */
    public static String sha256Hex(String texto) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 é obrigatório em toda JVM; se faltar, o ambiente está quebrado.
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }

    /** Comparação em tempo constante. */
    public static boolean iguais(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
