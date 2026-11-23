# Sistema da Paideia Artes

Sistema de gestão da escola: turmas, calendário e salas, chamada no celular, alunos, financeiro, espetáculos e biblioteca.

O protótipo clicável (dados de exemplo, nada é salvo) está em `../referencia/prototipo-sistema.html` e é a especificação visual.

## Estado (fase B)
Prontos: login, perfis (coordenação, secretaria, professor), turmas (lista, filtros, criar e editar), alunos (lista, ficha, responsáveis), matrículas (com limite de vagas) e usuários. Calendário, chamada, financeiro, espetáculos e biblioteca vêm nas próximas fases.

## Stack
React 19 + TypeScript (Vite), React Router, Supabase (Postgres, Auth), deploy na Vercel. Sem biblioteca de UI: o visual vem do protótipo (`src/estilos/prototipo.css`, fontes em `public/fontes`).

## Rodar no seu computador
```powershell
npm install
Copy-Item .env.example .env.local   # depois preencha as duas variáveis
npm run dev                          # http://localhost:5173
npm run build                        # confere tipos e gera a versão de produção
```

## Banco de dados (Supabase)
As migrations estão em `supabase/migrations`, em ordem:

1. `..._estrutura.sql`: tabelas e tipos.
2. `..._rls.sql`: RLS em todas as tabelas, por perfil, e a view `vw_alunos_do_professor`.
3. `..._dados_base.sql`: as 7 salas e os 8 cursos da escola.
4. `..._limite_de_vagas.sql`: o banco recusa matrícula além das vagas da turma.

`supabase/seed.sql` tem só dados fictícios (turmas, horários, 13 alunos, matrículas). Não rodar em produção.

Para aplicar no projeto de desenvolvimento: no painel do Supabase, abra SQL Editor, cole e rode cada arquivo na ordem acima e, por último, o `seed.sql`. (Ou use a CLI do Supabase com `supabase db push`.)

**Cuidado com acentos no Windows:** os arquivos são UTF-8. Ao copiar pelo PowerShell 5.1, use sempre `Get-Content -Raw -Encoding UTF8 arquivo.sql | Set-Clipboard`. Sem `-Encoding UTF8` o texto vira `DanÃ§a`, `MÃºsica`. Se isso acontecer no banco, rode `supabase/2-reparo-acentos.sql` (local, não versionado) ou refaça o seed com a codificação correta.

### Primeiro acesso
1. No Supabase: Authentication, Users, Add user. Crie o seu usuário com e-mail e senha.
2. No SQL Editor, promova esse usuário a coordenação (troque o e-mail):
   ```sql
   update public.perfis set perfil = 'coordenacao', ativo = true
   where id = (select id from auth.users where email = 'seu-email@exemplo.com');
   ```
3. Entre no sistema. Os outros usuários são criados no Supabase e liberados na tela Usuários.
4. Em Authentication, Sign In / Providers, desligue "Allow new users to sign up": o sistema não tem cadastro aberto, só convite da coordenação.

### Como a segurança funciona
- Toda tabela tem RLS ligada. Sem política, ninguém acessa; o papel `anon` não lê nada.
- Quem se cadastra entra inativo e sem acesso até a coordenação liberar. Ninguém consegue alterar o próprio perfil.
- Professor só lê as próprias turmas, e dos alunos só enxerga nome, idade e contato de emergência (pela view). Financeiro e fichas completas são só da equipe.
- Nenhum número de cartão é guardado: `forma_pagamento` é texto livre (Pix, dinheiro...).

## Segurança
- Repositório público: nenhum segredo no Git. Use `.env.local` (ignorado) e as variáveis de ambiente da Vercel.
- Só a chave `anon`/pública do Supabase vai para o front. O app recusa iniciar se detectar a chave `service_role`.
- Dados reais de alunos (muitos menores) só entram em produção, nunca em desenvolvimento.
- GitHub Actions está desativado neste repositório (para não consumir cota paga).
