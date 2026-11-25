import type { ReactNode } from 'react';
import type { TomSelo } from '../lib/formatar';

export function Selo({ tom, children }: { tom: TomSelo | 'neutro' | 'nao' | 'azul'; children: ReactNode }) {
  return <span className={`selo selo--${tom}`}>{children}</span>;
}

export function Stat({
  rotulo,
  valor,
  nota,
  tom,
}: {
  rotulo: string;
  valor: ReactNode;
  nota?: ReactNode;
  tom?: 'verde' | 'vermelho';
}) {
  return (
    <div className="card stat">
      <span>{rotulo}</span>
      <b className={tom}>{valor}</b>
      {nota ? <small>{nota}</small> : null}
    </div>
  );
}

export function Topo({ titulo, subtitulo, acoes }: { titulo: string; subtitulo?: string; acoes?: ReactNode }) {
  return (
    <div className="topo">
      <div>
        <h1>{titulo}</h1>
        {subtitulo ? <p>{subtitulo}</p> : null}
      </div>
      {acoes ? <div className="topo__acoes">{acoes}</div> : null}
    </div>
  );
}

export function Erro({ texto }: { texto: string }) {
  return (
    <div className="alerta alerta--bad" role="alert">
      <span>{texto}</span>
    </div>
  );
}

export function Carregando() {
  return (
    <div className="vazio" role="status">
      <p>Carregando...</p>
    </div>
  );
}

export function Vazio({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <p>{texto}</p>
      {children}
    </div>
  );
}

export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      {rotulo}
      {children}
    </label>
  );
}
