package br.edu.fatec.cafeteria.api;

import br.edu.fatec.cafeteria.nucleo.ErroNegocio;
import br.edu.fatec.cafeteria.nucleo.Textos;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Converte QUALQUER erro em JSON {@code {"codigo","mensagem"}}.
 * Nunca devolve stack trace, nome de tabela, SQL ou detalhes internos (RNF07):
 * o detalhe técnico vai só para o log do servidor.
 */
@RestControllerAdvice
public class TratadorErros {

    private static final Logger LOG = LoggerFactory.getLogger(TratadorErros.class);

    @ExceptionHandler(ErroNegocio.class)
    public ResponseEntity<Map<String, Object>> negocio(ErroNegocio e) {
        Map<String, Object> corpo = corpo(e.codigo(), e.getMessage());
        if (e.detalhes() != null) {
            corpo.put("detalhes", e.detalhes());
        }
        return ResponseEntity.status(e.statusHttp()).body(corpo);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<Map<String, Object>> banco(DataAccessException e) {
        String sqlState = sqlState(e);
        LOG.error("Falha de banco de dados (SQLState {})", sqlState, e);
        if ("23514".equals(sqlState) || "23503".equals(sqlState)) { // regra do banco / chave estrangeira
            return ResponseEntity.status(422).body(corpo("REGRA_DO_SISTEMA", "Operação não permitida pelas regras do sistema"));
        }
        if ("23505".equals(sqlState)) { // duplicidade
            return ResponseEntity.status(409).body(corpo("REGISTRO_DUPLICADO", "Já existe um registro com esses dados"));
        }
        return ResponseEntity.status(503).body(corpo("INSTABILIDADE", Textos.INSTABILIDADE));
    }

    /** Erros do próprio Spring MVC (JSON inválido, método errado, rota inexistente...). */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> geral(Exception e) {
        if (e instanceof ErrorResponse er) {
            int status = er.getStatusCode().value();
            if (status == 404) {
                return ResponseEntity.status(404).body(corpo("NAO_ENCONTRADO", "Recurso não encontrado"));
            }
            if (status == 405) {
                return ResponseEntity.status(405).body(corpo("METODO_NAO_PERMITIDO", Textos.REQUISICAO_INVALIDA));
            }
            return ResponseEntity.status(status).body(corpo("REQUISICAO_INVALIDA", Textos.REQUISICAO_INVALIDA));
        }
        if (e instanceof org.springframework.http.converter.HttpMessageNotReadableException
                || e instanceof org.springframework.web.method.annotation.MethodArgumentTypeMismatchException) {
            return ResponseEntity.status(400).body(corpo("REQUISICAO_INVALIDA", Textos.REQUISICAO_INVALIDA));
        }
        LOG.error("Erro inesperado", e);
        return ResponseEntity.status(500).body(corpo("ERRO_INTERNO", Textos.ERRO_INTERNO));
    }

    private static Map<String, Object> corpo(String codigo, String mensagem) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("codigo", codigo);
        m.put("mensagem", mensagem);
        return m;
    }

    private static String sqlState(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SQLException s && s.getSQLState() != null) {
                return s.getSQLState();
            }
        }
        return null;
    }
}
