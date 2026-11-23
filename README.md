# Sistema da Paideia Artes

Sistema de gestão da escola: turmas, calendário e salas, chamada no celular, alunos, financeiro, espetáculos e biblioteca.

Estado: só existe o protótipo clicável em `../referencia/prototipo-sistema.html` (dados de exemplo, nada é salvo). O código real será criado aqui.

## Stack prevista
React + TypeScript (Vite), React Router, Supabase (Postgres, Auth e Storage), deploy na Vercel.

## Segurança
- Repositório público: nenhum segredo no Git. Use `.env.local` (ignorado) e as variáveis de ambiente da Vercel.
- RLS ligada em todas as tabelas do Supabase.
- Dados reais de alunos (muitos menores) só entram em produção, nunca em desenvolvimento.
