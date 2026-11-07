package br.edu.fatec.cafeteria.seguranca;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/** Escreve erros JSON padronizados a partir dos filtros (que ficam fora do Spring MVC). */
final class RespostaJson {

    private RespostaJson() {
    }

    static void erro(HttpServletResponse resposta, ObjectMapper json, int status, String codigo, String mensagem)
            throws IOException {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("codigo", codigo);
        corpo.put("mensagem", mensagem);
        byte[] bytes = json.writeValueAsBytes(corpo);
        resposta.setStatus(status);
        resposta.setContentType("application/json;charset=UTF-8");
        resposta.setContentLength(bytes.length);
        resposta.getOutputStream().write(bytes);
    }
}
