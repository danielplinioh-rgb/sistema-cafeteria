import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { carregarAparencia } from '../../src/compartilhado/aparencia';
import '../../src/compartilhado/estilos/tokens.css';
import '../../src/compartilhado/estilos/base.css';
import './painel.css';
import { App } from './App';

carregarAparencia().then((aparencia) => {
  document.title = `${aparencia.marca.nome} · Painel do Colaborador`;
  createRoot(document.getElementById('raiz')!).render(
    <StrictMode>
      <App aparencia={aparencia} />
    </StrictMode>,
  );
});
