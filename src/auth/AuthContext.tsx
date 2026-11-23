import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { erroDeConfiguracao, supabase, traduzirErro } from '../lib/supabase';
import type { Perfil } from '../lib/tipos';

interface Auth {
  carregando: boolean;
  sessao: Session | null;
  /** null = sem perfil (ainda não liberado ou erro ao ler) */
  perfil: Perfil | null;
  entrar: (email: string, senha: string) => Promise<string | null>;
  sair: () => Promise<void>;
  eEquipe: boolean;
  eCoordenacao: boolean;
}

const Contexto = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(!erroDeConfiguracao);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);

  useEffect(() => {
    if (erroDeConfiguracao) return;
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregandoSessao(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nova) => setSessao(nova));
    return () => data.subscription.unsubscribe();
  }, []);

  const idUsuario = sessao?.user.id ?? null;
  useEffect(() => {
    if (!idUsuario) {
      setPerfil(null);
      return;
    }
    let vivo = true;
    setCarregandoPerfil(true);
    supabase
      .from('perfis')
      .select('id, nome, perfil, ativo')
      .eq('id', idUsuario)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        setPerfil((data as Perfil | null) ?? null);
        setCarregandoPerfil(false);
      });
    return () => {
      vivo = false;
    };
  }, [idUsuario]);

  const valor = useMemo<Auth>(() => {
    const ativo = perfil?.ativo === true;
    return {
      carregando: carregandoSessao || carregandoPerfil,
      sessao,
      perfil,
      eEquipe: ativo && (perfil?.perfil === 'coordenacao' || perfil?.perfil === 'secretaria'),
      eCoordenacao: ativo && perfil?.perfil === 'coordenacao',
      entrar: async (email, senha) => {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        return error ? traduzirErro(error.message) : null;
      },
      sair: async () => {
        await supabase.auth.signOut();
      },
    };
  }, [carregandoSessao, carregandoPerfil, sessao, perfil]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): Auth {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAuth fora do AuthProvider');
  return c;
}
