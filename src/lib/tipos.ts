export type PerfilTipo = 'coordenacao' | 'secretaria' | 'professor';

export interface Perfil {
  id: string;
  nome: string;
  perfil: PerfilTipo;
  ativo: boolean;
}

export interface Horario {
  id?: string;
  dia_semana: number; // 1 = segunda ... 7 = domingo
  inicio: string; // "14:00:00"
  fim: string;
}

export interface Sala {
  id: string;
  nome: string;
  cor: string;
}

export interface Curso {
  id: string;
  nome: string;
}

export interface TurmaLinha {
  id: string;
  nome: string;
  idade_min: number | null;
  idade_max: number | null;
  vagas_total: number;
  publicada_no_site: boolean;
  ativa: boolean;
  professor_id: string | null;
  sala_id: string | null;
  curso_id: string;
  cursos: { nome: string } | null;
  salas: { nome: string; cor: string } | null;
  perfis: { nome: string } | null;
  horarios: Horario[];
  matriculas: { status: string }[];
}

export interface Responsavel {
  id: string;
  nome: string;
  parentesco: string | null;
  whatsapp: string | null;
  email: string | null;
}

export interface Aluno {
  id: string;
  nome: string;
  nascimento: string | null;
  contato_emergencia_nome: string | null;
  contato_emergencia_telefone: string | null;
  observacoes: string | null;
  ativo: boolean;
  aluno_desde: string;
}

export interface MatriculaComTurma {
  id: string;
  status: string;
  data_inicio: string;
  turma_id: string;
  turmas: {
    nome: string;
    vagas_total: number;
    cursos: { nome: string } | null;
    salas: { nome: string } | null;
    perfis: { nome: string } | null;
    horarios: Horario[];
  } | null;
}

export const ROTULO_PERFIL: Record<PerfilTipo, string> = {
  coordenacao: 'Coordenação',
  secretaria: 'Secretaria',
  professor: 'Professor',
};
