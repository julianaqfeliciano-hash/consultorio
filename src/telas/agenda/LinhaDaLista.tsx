import { MessageCircle, Phone, PhoneOff } from 'lucide-react';
import { Aviso } from '../../componentes/Aviso';
import { CaixaDeMarcar } from '../../componentes/CaixaDeMarcar';
import { classesDoBotao } from '../../componentes/estiloBotao';
import type { SessaoComPaciente } from '../../dados/repositorio';
import { useAtualizarSessao } from '../../dados/useAgenda';
import { dataLocal, diaPorExtenso, horaLocal } from '../../regras/datas';
import { linkWhatsApp, preencherMensagem, primeiroNome } from '../../regras/whatsapp';

interface LinhaDaListaProps {
  sessao: SessaoComPaciente;
  /** O modelo da mensagem (das configurações), com {responsável}, {paciente}, {dia} e {hora}. */
  modelo: string;
}

/**
 * Uma sessão da lista do dia: hora, paciente, responsável principal, telefone, o botão que abre a conversa
 * no WhatsApp com a mensagem pronta (o sistema não envia nada) e a caixa "Confirmado". Sem responsável
 * principal ou com telefone que não serve, mostra "sem telefone" e não oferece o WhatsApp.
 */
export function LinhaDaLista({ sessao, modelo }: LinhaDaListaProps) {
  const gravar = useAtualizarSessao();
  // Enquanto grava, a caixa já mostra a escolha (a sessão só muda quando os dados novos chegam).
  const confirmada = gravar.isPending ? (gravar.variables.mudancas.confirmada ?? sessao.confirmada) : sessao.confirmada;

  const responsavel = sessao.responsavelPrincipal;
  const mensagem = preencherMensagem(modelo, {
    'responsável': primeiroNome(responsavel?.nome ?? ''),
    paciente: primeiroNome(sessao.pacienteNome),
    dia: diaPorExtenso(dataLocal(sessao.inicio)),
    hora: horaLocal(sessao.inicio),
  });
  const link = responsavel ? linkWhatsApp(responsavel.telefone, mensagem) : null;

  return (
    <li className="flex flex-col gap-2 rounded-lg bg-white p-3 shadow-sm">
      <p className="flex flex-wrap items-baseline gap-x-3">
        <span className="text-xl font-bold">{horaLocal(sessao.inicio)}</span>
        <span className="text-lg font-semibold">{sessao.pacienteNome}</span>
      </p>
      <p>{responsavel ? `Responsável: ${responsavel.nome}` : 'Sem responsável principal'}</p>
      {responsavel && link ? (
        <p className="flex items-center gap-2">
          <Phone aria-hidden="true" className="size-4 shrink-0" />
          {responsavel.telefone}
        </p>
      ) : (
        <p className="flex items-center gap-2">
          <PhoneOff aria-hidden="true" className="size-4 shrink-0" />
          <span>sem telefone</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {responsavel && link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp de ${responsavel.nome}`}
            className={classesDoBotao('secundario')}
          >
            <MessageCircle aria-hidden="true" className="size-5 shrink-0" />
            WhatsApp
          </a>
        )}
        <CaixaDeMarcar
          rotulo="Confirmado"
          aria-label={`Confirmado: ${sessao.pacienteNome}`}
          checked={confirmada}
          onChange={(e) => {
            if (!gravar.isPending) gravar.mutate({ id: sessao.id, mudancas: { confirmada: e.target.checked } });
          }}
        />
      </div>
      {gravar.isError && <Aviso tipo="erro">Não foi possível salvar. Tente de novo.</Aviso>}
    </li>
  );
}
