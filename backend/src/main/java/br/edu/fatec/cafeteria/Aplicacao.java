package br.edu.fatec.cafeteria;

import br.edu.fatec.cafeteria.config.PropriedadesApp;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Ponto de entrada do servidor (API única para os dois módulos).
 *
 * <p>Organização em camadas, espelhando o diagrama BCE da documentação:
 * <ul>
 *   <li>{@code api}         - Controle: PedidoController, ProdutoController... (HTTP/JSON)</li>
 *   <li>{@code servico}     - regras de negócio de cada caso de uso</li>
 *   <li>{@code repositorio} - RepositorioPedido e afins (SQL parametrizado)</li>
 *   <li>{@code nucleo}      - regras puras e segurança, sem dependência de framework (testáveis)</li>
 *   <li>{@code seguranca}   - filtros HTTP: cabeçalhos, limite de taxa, sessão + CSRF</li>
 * </ul>
 */
@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(PropriedadesApp.class)
public class Aplicacao {
    public static void main(String[] args) {
        SpringApplication.run(Aplicacao.class, args);
    }
}
