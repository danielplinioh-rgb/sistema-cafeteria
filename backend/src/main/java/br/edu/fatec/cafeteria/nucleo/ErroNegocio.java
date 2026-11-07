package br.edu.fatec.cafeteria.nucleo;

/**
 * Erro previsto pelas regras do sistema (pedido não encontrado, alteração após
 * o pagamento, login inválido...). É convertido em resposta HTTP pelo
 * {@code TratadorErros}, no formato {@code {"codigo": "...", "mensagem": "..."}}.
 *
 * <p>Estende {@link RuntimeException} para que a transação de banco seja
 * desfeita automaticamente (rollback) quando ele é lançado dentro de um
 * método {@code @Transactional}.
 */
public class ErroNegocio extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String codigo;
    private final int statusHttp;
    private final transient Object detalhes;

    public ErroNegocio(int statusHttp, String codigo, String mensagem, Object detalhes) {
        super(mensagem);
        this.statusHttp = statusHttp;
        this.codigo = codigo;
        this.detalhes = detalhes;
    }

    public String codigo() {
        return codigo;
    }

    public int statusHttp() {
        return statusHttp;
    }

    /** Dados extras para o cliente da API (ex.: o pedido atualizado). Pode ser nulo. */
    public Object detalhes() {
        return detalhes;
    }

    // ---- fábricas, uma por classe de erro HTTP ---------------------------------

    /** 400: requisição malformada. */
    public static ErroNegocio requisicaoInvalida(String codigo, String mensagem) {
        return new ErroNegocio(400, codigo, mensagem, null);
    }

    /** 401: não autenticado. */
    public static ErroNegocio naoAutenticado(String codigo, String mensagem) {
        return new ErroNegocio(401, codigo, mensagem, null);
    }

    /** 403: autenticado, mas a ação não é permitida (ex.: falha de verificação anti-CSRF). */
    public static ErroNegocio proibido(String codigo, String mensagem) {
        return new ErroNegocio(403, codigo, mensagem, null);
    }

    /** 404: recurso inexistente (também usado para token errado, sem revelar qual dos dois falhou). */
    public static ErroNegocio naoEncontrado(String codigo, String mensagem) {
        return new ErroNegocio(404, codigo, mensagem, null);
    }

    /** 409: a ação conflita com o estado atual do pedido/produto. */
    public static ErroNegocio conflito(String codigo, String mensagem) {
        return new ErroNegocio(409, codigo, mensagem, null);
    }

    public static ErroNegocio conflito(String codigo, String mensagem, Object detalhes) {
        return new ErroNegocio(409, codigo, mensagem, detalhes);
    }

    /** 422: dados válidos como JSON, mas rejeitados pelas regras de entrada. */
    public static ErroNegocio invalido(String codigo, String mensagem) {
        return new ErroNegocio(422, codigo, mensagem, null);
    }

    /** 429: limite de requisições ou tentativas excedido. */
    public static ErroNegocio muitasRequisicoes(String codigo, String mensagem) {
        return new ErroNegocio(429, codigo, mensagem, null);
    }
}
