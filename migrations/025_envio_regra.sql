-- Envio AUTOMÁTICO recorrente de formulários (desempenho, clima, etc.): uma regra
-- por formulário que o app materializa em campanhas (envio/envio_destinatario,
-- migration 013) na periodicidade escolhida. É o irmão recorrente do envio pontual
-- da tela; a experiência tem trilha própria (rh_experiencia) e não passa por aqui.
--
-- Dois eixos, iguais aos do modal manual: QUEM responde (destinatario_tipo) e,
-- quando o gestor responde, SOBRE quem (escopo). O ALVO decide quais setores/
-- colaboradores entram. O job (processarRegrasRecorrentes) resolve o alvo no
-- disparo e avança proximo_disparo — o scheduler embutido bate a cada 15 min.
create table envio_regra (
  id                serial primary key,
  formulario_id     integer not null references formulario (id),
  titulo            text,                 -- assunto/título (default = nome do formulário)
  mensagem          text,                 -- texto opcional no corpo do e-mail
  destinatario_tipo text not null
                      check (destinatario_tipo in ('gestores', 'colaboradores')),
  escopo            text not null default 'generico'
                      check (escopo in ('generico', 'sobre_colaborador')),
  alvo_tipo         text not null
                      check (alvo_tipo in ('todos', 'setores', 'colaboradores')),
  -- setores: ['CLASSIF1', ...]; colaboradores: [{empresa, contrato}, ...]; todos: []
  alvo              jsonb not null default '[]'::jsonb,
  freq_tipo         text not null check (freq_tipo in ('dias', 'mensal')),
  freq_valor        integer not null,     -- dias: a cada N dias; mensal: dia do mês (1-28)
  ativo             boolean not null default true,
  ultimo_disparo    timestamptz,
  proximo_disparo   timestamptz not null,
  criado_por        text,                 -- usuario.id (audit, sem FK cruzada)
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create index envio_regra_prox_idx on envio_regra (proximo_disparo) where ativo;

create trigger envio_regra_touch before update on envio_regra
  for each row execute function conf_touch();
