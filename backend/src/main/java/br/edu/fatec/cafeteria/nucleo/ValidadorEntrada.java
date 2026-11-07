package br.edu.fatec.cafeteria.nucleo;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Validação e normalização de TODA entrada vinda dos navegadores.
 *
 * <p>Regra de ouro: nunca confiar no front-end. Mesmo que a interface já limite
 * os campos, o servidor valida de novo (OWASP: validação no servidor, lista de
 * permissão, tamanhos máximos). Todas as consultas SQL usam parâmetros, então
 * esta validação é uma camada adicional, não a única proteção contra injeção.
 */
public final class ValidadorEntrada {

    private ValidadorEntrada() {
    }

    // ---- limites do domínio (fáceis de ajustar em um só lugar) ------------------
    public static final int MESA_MAXIMA = 9999;
    public static final int QUANTIDADE_MAXIMA = 20;
    public static final int ITENS_MAXIMOS_POR_PEDIDO = 30;
    public static final int OBSERVACOES_MAXIMAS_POR_ITEM = 4;
    public static final int TEXTO_LIVRE_MAXIMO = 255;
    public static final BigDecimal PRECO_MAXIMO = new BigDecimal("9999.99");

    /** Apenas nome de arquivo simples (sem pastas, sem "..") e extensões de imagem conhecidas. */
    private static final Pattern ARQUIVO_IMAGEM =
            Pattern.compile("^[A-Za-z0-9_][A-Za-z0-9_.\\-]{0,100}\\.(svg|png|jpe?g|webp|gif)$", Pattern.CASE_INSENSITIVE);

    private static final Pattern USUARIO = Pattern.compile("^[A-Za-z0-9._\\-]{3,50}$");

    // ---- local de atendimento (RF05) --------------------------------------------

    /**
     * Converte o par (tipo, mesa) no texto gravado em {@code pedido.local_entrega}:
     * "Mesa N" ou "Retirada no Balcão". Combina com o CHECK {@code ck_pedido_local} do banco.
     */
    public static String local(String tipo, Integer mesa) {
        if (tipo == null) {
            throw ErroNegocio.invalido("LOCAL_INVALIDO", "Informe o número da mesa ou escolha a retirada no balcão");
        }
        switch (tipo.trim().toUpperCase(java.util.Locale.ROOT)) {
            case "BALCAO":
                return "Retirada no Balcão";
            case "MESA":
                if (mesa == null || mesa < 1 || mesa > MESA_MAXIMA) {
                    throw ErroNegocio.invalido("MESA_INVALIDA", "Informe um número de mesa entre 1 e " + MESA_MAXIMA);
                }
                return "Mesa " + mesa;
            default:
                throw ErroNegocio.invalido("LOCAL_INVALIDO", "Tipo de atendimento inválido");
        }
    }

    // ---- itens ------------------------------------------------------------------

    public static int quantidade(int valor) {
        if (valor < 1 || valor > QUANTIDADE_MAXIMA) {
            throw ErroNegocio.invalido("QUANTIDADE_INVALIDA",
                    "A quantidade de cada item deve estar entre 1 e " + QUANTIDADE_MAXIMA);
        }
        return valor;
    }

    public static void quantidadeDeItens(int total) {
        if (total < 1) {
            throw ErroNegocio.invalido("PEDIDO_SEM_ITENS", Textos.PEDIDO_SEM_ITENS);
        }
        if (total > ITENS_MAXIMOS_POR_PEDIDO) {
            throw ErroNegocio.invalido("ITENS_DEMAIS", "O pedido pode ter no máximo " + ITENS_MAXIMOS_POR_PEDIDO + " itens");
        }
    }

    // ---- cadastro de produto (RF18 / ProdutoController) -------------------------

    public static BigDecimal preco(BigDecimal valor) {
        if (valor == null || valor.signum() < 0 || valor.compareTo(PRECO_MAXIMO) > 0 || valor.scale() > 2) {
            throw ErroNegocio.invalido("PRECO_INVALIDO", "Informe um preço entre 0,00 e 9999,99 com até duas casas decimais");
        }
        return valor.setScale(2);
    }

    /**
     * Nome de arquivo de imagem do cardápio. Retorna {@code null} se vazio.
     * Impede travessia de diretório ("../", barras) e extensões inesperadas.
     */
    public static String arquivoImagem(String nome) {
        if (nome == null || nome.isBlank()) {
            return null;
        }
        String limpo = nome.trim();
        if (limpo.contains("..") || !ARQUIVO_IMAGEM.matcher(limpo).matches()) {
            throw ErroNegocio.invalido("IMAGEM_INVALIDA",
                    "Use apenas o nome do arquivo (ex.: cappuccino.svg) com extensão svg, png, jpg, webp ou gif");
        }
        return limpo;
    }

    /**
     * Texto livre curto (nome, descrição, justificativa, observação interna).
     * Remove espaços nas pontas, recusa caracteres de controle e limita o tamanho.
     *
     * @return texto limpo, ou {@code null} se vazio e não obrigatório
     */
    public static String texto(String valor, String campo, int maximo, boolean obrigatorio) {
        if (valor == null || valor.isBlank()) {
            if (obrigatorio) {
                throw ErroNegocio.invalido("CAMPO_OBRIGATORIO", "Preencha o campo " + campo);
            }
            return null;
        }
        String limpo = valor.strip();
        if (limpo.length() > maximo) {
            throw ErroNegocio.invalido("CAMPO_LONGO", "O campo " + campo + " aceita no máximo " + maximo + " caracteres");
        }
        for (int i = 0; i < limpo.length(); i++) {
            char c = limpo.charAt(i);
            if (Character.isISOControl(c)) {
                throw ErroNegocio.invalido("CAMPO_INVALIDO", "O campo " + campo + " contém caracteres inválidos");
            }
        }
        return limpo;
    }

    // ---- autenticação -----------------------------------------------------------

    /** Formato do login. Falhar aqui equivale a "usuário ou senha inválidos" (sem dica). */
    public static boolean usuarioComFormatoValido(String usuario) {
        return usuario != null && USUARIO.matcher(usuario).matches();
    }

    public static boolean senhaComTamanhoValido(String senha) {
        // 72 bytes é o limite do bcrypt; 128 caracteres impede abuso de CPU com senhas gigantes.
        return senha != null && !senha.isEmpty() && senha.length() <= 128;
    }

    // ---- token do pedido (RNF07) ------------------------------------------------

    /** Converte o cabeçalho X-Token-Pedido em UUID; devolve {@code null} se malformado. */
    public static UUID tokenDoPedido(String texto) {
        if (texto == null || texto.length() != 36) {
            return null;
        }
        try {
            return UUID.fromString(texto);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** O código do pedido tem sempre o formato PED-0000 (4 a 8 dígitos). */
    public static boolean codigoComFormatoValido(String codigo) {
        return codigo != null && codigo.matches("^PED-[0-9]{4,8}$");
    }
}
