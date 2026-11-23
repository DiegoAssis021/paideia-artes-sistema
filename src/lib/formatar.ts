import type { Horario } from './tipos';

export const DIAS_CURTOS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const DIAS_LONGOS = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export function idade(nascimento: string | null, hoje = new Date()): number | null {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.split('-').map(Number);
  let anos = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos--;
  return anos;
}

export function textoIdade(nascimento: string | null): string {
  const n = idade(nascimento);
  if (n === null) return 'Idade não informada';
  return n === 1 ? '1 ano' : `${n} anos`;
}

export function iniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** "14:00:00" vira "14h"; "10:30:00" vira "10h30". */
export function hora(h: string): string {
  const [hh, mm] = h.split(':');
  return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`;
}

function unirComE(itens: string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

export function resumoHorarios(hs: Horario[]): { dias: string; faixa: string } {
  if (hs.length === 0) return { dias: 'Sem horário', faixa: '' };
  const ordenados = [...hs].sort((a, b) => a.dia_semana - b.dia_semana || a.inicio.localeCompare(b.inicio));
  const dias = unirComE([...new Set(ordenados.map((h) => DIAS_CURTOS[h.dia_semana]))]);
  const faixas = [...new Set(ordenados.map((h) => `${hora(h.inicio)} às ${hora(h.fim)}`))];
  return { dias, faixa: faixas.join(' / ') };
}

export function faixaIdade(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min} a ${max} anos`;
  if (min !== null) return `A partir de ${min}`;
  if (max !== null) return `Até ${max} anos`;
  return 'Todas as idades';
}

export type TomSelo = 'ok' | 'warn' | 'bad';

export function situacaoVagas(total: number, ocupadas: number) {
  const livres = Math.max(total - ocupadas, 0);
  let tom: TomSelo;
  let texto: string;
  let cor: string;
  if (livres === 0) {
    tom = 'bad';
    texto = 'Lotada';
    cor = '#C8372D';
  } else if (livres <= 2) {
    tom = 'warn';
    texto = livres === 1 ? 'Última vaga' : 'Últimas 2 vagas';
    cor = '#E8B021';
  } else {
    tom = 'ok';
    texto = `${livres} vagas`;
    cor = '#2F6B4F';
  }
  return { livres, tom, texto, cor, pct: Math.round((ocupadas / total) * 100) };
}

export function ativas(ms: { status: string }[]): number {
  return ms.filter((m) => m.status === 'ativa').length;
}

export function apenasDigitos(s: string | null): string {
  return (s ?? '').replace(/\D/g, '');
}

/** Link do WhatsApp (Brasil). Sem número válido, devolve null. */
export function linkWhatsapp(telefone: string | null, texto?: string): string | null {
  let d = apenasDigitos(telefone);
  if (d.length < 10) return null;
  if (!d.startsWith('55')) d = `55${d}`;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

export function dataBr(iso: string | null): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
