-- Regra no banco (não só na tela): uma turma não aceita mais matrículas ativas do que tem de vagas.
create function public.matricula_respeita_vagas()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total smallint;
  v_ocupadas integer;
begin
  if new.status <> 'ativa' then
    return new;
  end if;

  -- trava a linha da turma para duas matrículas simultâneas não passarem do limite
  select t.vagas_total into v_total from public.turmas t where t.id = new.turma_id for update;

  select count(*) into v_ocupadas
  from public.matriculas m
  where m.turma_id = new.turma_id and m.status = 'ativa' and m.id <> new.id;

  if v_ocupadas >= v_total then
    raise exception 'Turma lotada: todas as % vagas já estão ocupadas.', v_total
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger matricula_vagas
before insert or update of status, turma_id on public.matriculas
for each row execute function public.matricula_respeita_vagas();
