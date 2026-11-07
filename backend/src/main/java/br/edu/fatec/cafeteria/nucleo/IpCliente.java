package br.edu.fatec.cafeteria.nucleo;

import java.util.regex.Pattern;

/**
 * Descobre o IP do cliente para fins de limite de requisições e bloqueio de login.
 *
 * <p>O cabeçalho {@code X-Forwarded-For} é forjável por qualquer cliente. Por isso
 * ele só é considerado quando o sistema está atrás de um proxy reverso CONFIÁVEL
 * (o nginx do projeto) e a opção {@code app.confiar-proxy} está ligada. Nesse
 * caso o nginx sobrescreve o cabeçalho com o IP real que ele enxergou.
 */
public final class IpCliente {

    /** Aceita apenas caracteres de endereços IPv4/IPv6: evita lixo em logs e em chaves de mapa. */
    private static final Pattern FORMATO_IP = Pattern.compile("^[0-9a-fA-F:.]{3,45}$");

    private IpCliente() {
    }

    public static String resolver(String enderecoRemoto, String xForwardedFor, boolean confiarNoProxy) {
        if (confiarNoProxy && xForwardedFor != null && !xForwardedFor.isBlank()) {
            // O último valor é o acrescentado pelo proxy confiável mais próximo.
            String[] partes = xForwardedFor.split(",");
            String candidato = partes[partes.length - 1].trim();
            if (FORMATO_IP.matcher(candidato).matches()) {
                return candidato;
            }
        }
        if (enderecoRemoto != null && FORMATO_IP.matcher(enderecoRemoto).matches()) {
            return enderecoRemoto;
        }
        return "desconhecido";
    }
}
