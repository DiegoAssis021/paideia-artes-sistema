import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Trava de segurança: a chave service_role/secreta jamais pode ir para o navegador. */
function chaveSecreta(k: string): boolean {
  if (k.startsWith('sb_secret_')) return true;
  try {
    const carga = JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return carga.role === 'service_role';
  } catch {
    return false;
  }
}

export const erroDeConfiguracao: string | null = !url || !chave
  ? 'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Copie .env.example para .env.local e preencha.'
  : chaveSecreta(chave)
    ? 'A chave configurada é secreta (service_role). Use somente a chave anon/pública no front-end.'
    : null;

export const supabase = createClient(
  erroDeConfiguracao ? 'http://localhost:54321' : url!,
  erroDeConfiguracao ? 'sem-chave' : chave!,
);

/** Lê o resultado de uma consulta e lança erro (em português) se falhar. */
export async function ler<T>(
  consulta: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await consulta;
  if (error) throw new Error(traduzirErro(error.message));
  return data as T;
}

/** Executa uma escrita e lança erro (em português) se falhar. */
export async function executar(
  consulta: PromiseLike<{ error: { message: string } | null }>,
): Promise<void> {
  const { error } = await consulta;
  if (error) throw new Error(traduzirErro(error.message));
}

export function traduzirErro(msg: string): string {
  if (msg.includes('Turma lotada')) return msg;
  if (msg.includes('matriculas_ativa_unica')) return 'Este aluno já está matriculado nesta turma.';
  if (msg.includes('row-level security')) return 'Seu perfil não tem permissão para fazer isso.';
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Failed to fetch')) return 'Sem conexão com o servidor. Verifique a internet.';
  if (msg.includes('duplicate key')) return 'Já existe um registro com esses dados.';
  return msg;
}
