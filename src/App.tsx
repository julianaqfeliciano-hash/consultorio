import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ExigeLogin } from './componentes/ExigeLogin';
import { Layout } from './componentes/Layout';
import { TelaAgenda } from './telas/agenda/TelaAgenda';
import { TelaFinanceiro } from './telas/financeiro/TelaFinanceiro';
import { TelaLogin } from './telas/login/TelaLogin';
import { TelaMais } from './telas/mais/TelaMais';
import { TelaPacientes } from './telas/pacientes/TelaPacientes';
import { TelaRelatorios } from './telas/relatorios/TelaRelatorios';

/**
 * Rotas do aplicativo, separadas do roteador para os testes usarem `MemoryRouter`.
 * `/entrar` é pública; todas as outras ficam atrás de `ExigeLogin`.
 */
export function RotasApp() {
  return (
    <Routes>
      <Route path="entrar" element={<TelaLogin />} />
      <Route element={<ExigeLogin />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/agenda" replace />} />
          <Route path="agenda" element={<TelaAgenda />} />
          <Route path="pacientes" element={<TelaPacientes />} />
          <Route path="financeiro" element={<TelaFinanceiro />} />
          <Route path="relatorios" element={<TelaRelatorios />} />
          <Route path="mais" element={<TelaMais />} />
          <Route path="*" element={<Navigate to="/agenda" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <RotasApp />
    </BrowserRouter>
  );
}
