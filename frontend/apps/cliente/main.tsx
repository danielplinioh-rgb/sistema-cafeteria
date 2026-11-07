import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { carregarAparencia } from '../../src/compartilhado/aparencia';
import '../../src/compartilhado/estilos/tokens.css';
import '../../src/compartilhado/estilos/base.css';
import './cliente.css';
import { App } from './App';

// A aparência (cores, logo, banner) é lida do arquivo de configuração antes de mostrar a tela.
carregarAparencia().then((aparencia) => {
  document.title = `${aparencia.marca.nome} · Cardápio`;
  createRoot(document.getElementById('raiz')!).render(
    <StrictMode>
      <App aparencia={aparencia} />
    </StrictMode>,
  );
});
