# 🏐 Vôlei Alamedas Jardins

Sistema web para organizar o vôlei amador do condomínio **Alamedas Jardins**: eventos, check-in, montagem de times, fila de revezamento (linha-fora), placar, estatísticas, ranking, enquetes com troféus e cards para compartilhar nas redes.

Foi pensado para ser usado **no celular, dentro da quadra**, com botões e cards grandes, poucas telas e nenhum cadastro complicado. A identidade visual (cores, fontes e ícones) parte da logo oficial do grupo.

---

## ✨ Funcionalidades

### Eventos
- A **quinta-feira** da semana é criada automaticamente; o admin cria eventos extras (por exemplo, um sábado) pela tela.
- Situações: agendado, em andamento, encerrado e **cancelado com motivo obrigatório** (chuva, quadra ocupada, poucas pessoas ou texto livre).
- **Iniciar o evento abre o check-in.** Antes disso ninguém consegue marcar presença.
- Tela de detalhes pública de cada evento: jogadores presentes, time campeão, todas as partidas (tocando numa partida aparecem os jogadores de cada time) e as premiações das enquetes.
- Janelas de confirmação para iniciar e encerrar o evento e para check-in e saída.

### Check-in e moderação
- Cada pessoa faz o próprio check-in, ou qualquer participante o faz por quem está sem celular.
- Operadores e admin podem **remover alguém do evento e bloquear novo check-in** (útil contra check-ins feitos fora da quadra), com opção de liberar depois.
- Quem já entrou em partidas não pode ser removido, para preservar as estatísticas.

### Quadra (times e fila)
- **Montagem manual** dos times por quem opera a quadra: arrastar o card do jogador ou tocar nele e escolher "Mover para…". Nome do time opcional e **tamanho livre**.
- **Fila linha-fora** com as regras do grupo:
  - ganhou, fica; o perdedor vai para o fim da fila;
  - na **2ª vitória seguida**, saem o vencedor e o perdedor, jogam os dois primeiros da fila e o time que venceu 2x volta logo em seguida.
- Quando **2 ou mais vagas** de um time ficam abertas por saídas, o time é desfeito e o novo herda a posição na fila.
- Partidas com **placar final obrigatório** e placar ponto a ponto opcional. A tela atualiza sozinha para vários operadores usarem ao mesmo tempo.

### Perfis, estatísticas e ranking
- Perfil com foto e nome, **públicos** (não exigem login).
- Estatísticas: eventos, partidas, vitórias, derrotas, aproveitamento e maior sequência de vitórias, sempre calculadas sobre todo o histórico.
- **Ranking top 10** de jogadores e de times que mais venceram, filtrável por mês, ano ou geral.

### Enquetes e troféus
- Ao encerrar o evento, abrem votações por 24 horas, uma para cada categoria ativa (as categorias são editáveis pelo admin; há as clássicas e as de brincadeira, como "Rádio Quadra" e "O chão é lava").
- **Voto secreto**, um por pessoa e por categoria, podendo ser trocado até o fechamento. Só vota quem participou do evento, e ninguém vota em si mesmo nem no próprio time.
- Em caso de empate, todos os empatados recebem o troféu; em "Melhor time do dia", todos que jogaram pelo time vencedor.
- Os troféus aparecem no perfil. O admin pode fechar, prorrogar, remover, **encerrar todas de uma vez** e criar enquetes avulsas.

### Cards para compartilhar
- Imagens em **9:16** (status do WhatsApp, stories e reels) geradas no próprio celular: **card do jogador**, **card do troféu** e **resumo do evento**.

### Informações, links e regras
- Três janelas na tela inicial com textos editados pelo admin em texto simples:
  - `1. item` para numeração e `- item` para marcadores;
  - `"Texto amigável"[https://endereço]` para links;
  - `*negrito*` e `_itálico_`;
  - o resto vira parágrafo.

### Administração
- Promover e rebaixar **operadores**, gerar códigos de primeiro acesso e **inativar/reativar jogadores** (a pessoa sai do login e do check-in, mas permanece no ranking e nas estatísticas).
- Edição das categorias de enquete e dos textos da tela inicial.

---

## 👥 Papéis

| Papel | O que pode |
| --- | --- |
| **Visitante** (sem login) | Ver eventos, resumos, ranking, perfis e os textos de informações, links e regras |
| **Jogador** | Fazer check-in (o seu ou de outra pessoa), votar, editar o próprio perfil e compartilhar cards |
| **Operador** | Iniciar e encerrar eventos, montar times, controlar fila e placar, remover/bloquear check-ins |
| **Admin** | Tudo acima, mais criar e cancelar eventos, gerenciar operadores e jogadores, enquetes e conteúdo |

---

## 🔐 Acesso e segurança

- **Jogadores** escolhem o nome na lista e digitam os 4 últimos dígitos do celular (cadastro com nome e celular com DDD).
- **Admin e operadores** entram com **senha própria** (PBKDF2 com sal, via Web Crypto). O primeiro acesso usa um código: o do admin vem de uma variável de ambiente, e os dos operadores são gerados pelo admin e valem 24 horas.
- Sessões em cookie `HttpOnly`/`Secure`, limite de tentativas erradas por conta (e por IP nas contas com senha) e encerramento das outras sessões ao trocar a senha.
- Contas de gestão sem senha não têm nenhum privilégio até criá-la.
- Os links digitados nos textos são validados (esquemas perigosos como `javascript:` não viram link) e a interface nunca injeta HTML cru.

---

## 🛠️ Tecnologias

| Camada | Ferramentas |
| --- | --- |
| Interface | **React 19** + **Vite**, CSS próprio (mobile-first, tema claro/escuro automático com botão de troca), ícones SVG |
| Arrastar e soltar | **@dnd-kit/core** (mouse e toque) |
| API | **Cloudflare Pages Functions** (rotas em `functions/api`) |
| Banco de dados | **Neon PostgreSQL** (driver serverless `@neondatabase/serverless`) |
| Hospedagem e deploy | **Cloudflare Pages**, direto do repositório **GitHub** |
| Migrações | Arquivos SQL versionados, aplicados por **GitHub Actions** (`scripts/migrate.mjs`, biblioteca `pg`) |
| Recursos do navegador | Canvas (cards), Web Share API, Web Crypto, manifesto de aplicativo (instalável na tela inicial) |
| Tipografia | Bowlby One (títulos) e Nunito (texto), com alternativas locais |

Não há servidor próprio: tudo roda no Cloudflare e no Neon.

---

## 🧱 Arquitetura e organização

```
.
├── db/migrations/        # esquema do banco, em ordem (001, 002, ...)
├── functions/
│   ├── _lib/             # utilitários: banco, sessão, senhas, regras de quadra e enquetes
│   └── api/              # rotas: auth, events, players, profile, polls, ranking, content
├── public/               # logo, ícones e manifesto
├── scripts/migrate.mjs   # aplica as migrações pendentes
├── src/                  # telas e componentes React, cards (cards.js) e interpretador de texto (richcore.js)
└── .github/workflows/    # migração automática do banco
```

**Banco de dados** (principais tabelas): `players`, `sessions`, `events`, `checkins`, `checkin_blocks`, `teams`, `team_members`, `matches`, `match_players`, `poll_categories`, `polls`, `poll_options`, `votes`, `awards`, `player_photos` e `site_content`, além das views `player_stats` e `team_stats`.

### Decisões de projeto
- **Estatísticas sempre calculadas** a partir das partidas registradas (`match_players`), então nada "expira" e corrigir um dado corrige tudo.
- **Sem tarefas agendadas**: a quinta é criada na primeira consulta da semana e as votações fecham quando alguém abre o app depois do prazo.
- **Fotos no próprio banco**, já recortadas e reduzidas no celular (JPEG de cerca de 30 KB), sem serviço extra de armazenamento.
- **Cards gerados no navegador**, sem custo de servidor e sem depender de bibliotecas pesadas.
- **Voto secreto de verdade**: a API nunca devolve quem votou em quem, e a contagem só aparece após o fechamento.

---

## ⚙️ Configuração

O projeto usa três variáveis de ambiente no Cloudflare Pages:

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Conexão com o Neon (também usada pela GitHub Action de migração, como segredo) |
| `ADMIN_PHONE` | Celular (só dígitos) que, ao se cadastrar, recebe o papel de admin |
| `ADMIN_SETUP_CODE` | Código secreto para o admin criar ou redefinir a própria senha |

---

## 🎨 Identidade visual

Todo o visual parte da logo oficial: verde vivo das letras e da faixa, verde-petróleo do laço, verde-escuro do escudo e a flor como inspiração para os detalhes. O modo escuro usa tons de verde-floresta.

---

## 👤 Autoria

Desenvolvido por Alex ([@soumaisalex](https://instagram.com/soumaisalex)) para a comunidade do condomínio Alamedas Jardins.
