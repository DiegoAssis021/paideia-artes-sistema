// Ícones do protótipo (traço de 1.8, 24x24).
export const ICONES = {
  turmas: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18M9 4v16"></path>',
  alunos:
    '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"></path><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2"></path>',
  usuarios:
    '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"></path><path d="M9 12l2 2 4-4"></path>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"></rect><path d="M11 18.5h2"></path>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
  warn: '<path d="M12 3l9.5 17h-19z"></path><path d="M12 10v4M12 17.5v.5"></path>',
  voltar: '<path d="M15 18l-6-6 6-6"></path>',
  palco: '<path d="M3 21h18"></path><path d="M5 21V8l7-4 7 4v13"></path><path d="M9 21v-7h6v7"></path>',
  sobe: '<path d="M6 15l6-6 6 6"></path>',
  desce: '<path d="M6 9l6 6 6-6"></path>',
  x: '<path d="M6 6l12 12M18 6L6 18"></path>',
  relogio: '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>',
} as const;

export type NomeIcone = keyof typeof ICONES;

export function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: ICONES[nome] }}
    />
  );
}
