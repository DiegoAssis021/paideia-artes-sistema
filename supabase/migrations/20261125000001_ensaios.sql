-- Espetáculos: ensaios do evento e exposição associada (ex.: desenhos no hall).
alter table public.espetaculos add column exposicao text;

create table public.ensaios (
  id uuid primary key default gen_random_uuid(),
  espetaculo_id uuid not null references public.espetaculos (id) on delete cascade,
  titulo text not null,
  data date,
  hora_inicio time,
  hora_fim time,
  local text,
  observacao text,  -- ex.: "Nas aulas de novembro"
  criado_em timestamptz not null default now()
);
create index ensaios_espetaculo_idx on public.ensaios (espetaculo_id, data);

alter table public.ensaios enable row level security;
create policy ensaios_ler on public.ensaios for select to authenticated
  using ((select public.usuario_ativo()));
create policy ensaios_escrever on public.ensaios for all to authenticated
  using ((select public.eh_equipe())) with check ((select public.eh_equipe()));
