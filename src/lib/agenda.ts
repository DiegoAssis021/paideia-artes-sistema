// Datas e horários da agenda. Tudo em horário local (Rio): nunca usar toISOString()
// para "hoje", porque depois das 21h ele já devolve o dia seguinte (UTC).

import { DIAS_CURTOS, DIAS_LONGOS } from './formatar';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Date local para "AAAA-MM-DD". */
export function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function hojeIso(): string {
  return isoLocal(new Date());
}

/** "AAAA-MM-DD" para Date local, ao meio-dia (evita surpresas com horário de verão). */
export function deIso(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

export function somarDias(iso: string, n: number): string {
  const d = deIso(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

/** 1 = segunda ... 7 = domingo (igual a horarios.dia_semana). */
export function diaSemanaIso(iso: string): number {
  const js = deIso(iso).getDay();
  return js === 0 ? 7 : js;
}

/** Segunda-feira da semana da data. */
export function inicioDaSemana(iso: string): string {
  return somarDias(iso, 1 - diaSemanaIso(iso));
}

export type Relativo = 'passado' | 'hoje' | 'futuro';

export function relativo(iso: string, hoje = hojeIso()): Relativo {
  return iso < hoje ? 'passado' : iso === hoje ? 'hoje' : 'futuro';
}

export interface DiaDaSemana {
  iso: string;
  dia: number; // 1..6
  curto: string; // "Seg"
  num: number; // 26
  rel: Relativo;
}

/** Segunda a sábado (a escola não abre domingo). */
export function diasDaSemana(segunda: string): DiaDaSemana[] {
  const hoje = hojeIso();
  return [1, 2, 3, 4, 5, 6].map((dia) => {
    const iso = somarDias(segunda, dia - 1);
    return { iso, dia, curto: DIAS_CURTOS[dia], num: deIso(iso).getDate(), rel: relativo(iso, hoje) };
  });
}

/** "Quinta, 29 de outubro". */
export function dataLonga(iso: string): string {
  const d = deIso(iso);
  return `${DIAS_LONGOS[diaSemanaIso(iso)]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "26 a 31 de outubro" ou "28 de outubro a 2 de novembro". */
export function faixaDeDatas(ini: string, fim: string): string {
  const a = deIso(ini);
  const b = deIso(fim);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} a ${b.getDate()} de ${MESES[b.getMonth()]}`;
  return `${a.getDate()} de ${MESES[a.getMonth()]} a ${b.getDate()} de ${MESES[b.getMonth()]}`;
}

/** "19:30:00" vira 19.5. */
export function horaDecimal(h: string): number {
  const [hh, mm] = h.split(':').map(Number);
  return hh + (mm || 0) / 60;
}

/** 19.5 vira "19h30"; 19 vira "19h". */
export function horaTexto(dec: number): string {
  const h = Math.floor(dec + 1e-6);
  const m = Math.round((dec - h) * 60);
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** "14:05" a partir de um timestamp. */
export function horaMinuto(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * Aulas que se sobrepõem no mesmo dia ficam lado a lado.
 * Devolve, para cada aula (na mesma ordem), a faixa (0..) e o total de faixas do seu grupo.
 */
export function distribuirFaixas<T extends { ini: number; fim: number }>(
  aulas: T[],
): (T & { faixa: number; faixas: number })[] {
  const ordem = aulas.map((a, i) => ({ a, i })).sort((x, y) => x.a.ini - y.a.ini || x.a.fim - y.a.fim);
  const saida = new Array<T & { faixa: number; faixas: number }>(aulas.length);
  let grupo: { i: number; faixa: number }[] = [];
  let fimGrupo = -Infinity;
  let finsPorFaixa: number[] = [];

  const fecharGrupo = () => {
    const total = finsPorFaixa.length || 1;
    for (const g of grupo) saida[g.i] = { ...aulas[g.i], faixa: g.faixa, faixas: total };
    grupo = [];
    finsPorFaixa = [];
  };

  for (const { a, i } of ordem) {
    if (a.ini >= fimGrupo) fecharGrupo();
    let faixa = finsPorFaixa.findIndex((fim) => fim <= a.ini);
    if (faixa === -1) {
      faixa = finsPorFaixa.length;
      finsPorFaixa.push(a.fim);
    } else {
      finsPorFaixa[faixa] = a.fim;
    }
    grupo.push({ i, faixa });
    fimGrupo = Math.max(fimGrupo, a.fim);
  }
  fecharGrupo();
  return saida;
}

export function textoContagem(presentes: number, faltas: number): string {
  return `${presentes} ${presentes === 1 ? 'presente' : 'presentes'}, ${faltas} ${faltas === 1 ? 'falta' : 'faltas'}`;
}
