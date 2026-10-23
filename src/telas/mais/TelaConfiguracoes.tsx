import { FalhaAoCarregar } from '../../componentes/FalhaAoCarregar';
import { useConfiguracoes } from '../../dados/useConfiguracoes';
import { FormularioConfiguracoes } from './FormularioConfiguracoes';
import { VoltarParaMais } from './VoltarParaMais';

export function TelaConfiguracoes() {
  const { config, carregando, erro, recarregar } = useConfiguracoes();

  return (
    <section className="flex flex-col items-start gap-6">
      <VoltarParaMais />
      <h1 className="text-3xl">Configurações</h1>
      {carregando && <p role="status">Carregando…</p>}
      {/* Sem ler o que está gravado não há formulário: salvar agora gravaria os padrões por cima. */}
      {erro && <FalhaAoCarregar mensagem="Não foi possível carregar as configurações." aoTentarDeNovo={recarregar} />}
      {!carregando && !erro && <FormularioConfiguracoes config={config} />}
    </section>
  );
}
