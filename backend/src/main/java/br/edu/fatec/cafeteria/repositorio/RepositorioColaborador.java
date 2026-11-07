package br.edu.fatec.cafeteria.repositorio;

import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Acesso aos colaboradores (somente leitura: o cadastro é feito pelo administrador no banco). */
@Repository
public class RepositorioColaborador {

    public record Registro(int idColaborador, String nome, String usuario, String senhaHash) {
    }

    private final JdbcTemplate jdbc;

    public RepositorioColaborador(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Registro> porUsuario(String usuario) {
        return jdbc.query(Sql.COLABORADOR_POR_USUARIO, (rs, n) -> new Registro(rs.getInt("id_colaborador"),
                rs.getString("nome"), rs.getString("usuario"), rs.getString("senha_hash")), usuario)
                .stream().findFirst();
    }
}
