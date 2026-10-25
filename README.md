# 🏐 Vôlei Alamedas Jardins

Sistema web para organizar o vôlei amador do condomínio **Alamedas Jardins**: eventos, confirmação de presença, check-in (inclusive por QR Code), montagem de times, fila de revezamento (linha-fora), placar, estatísticas, ranking, enquetes com troféus, cards para compartilhar, caixa de doações por Pix e um painel de gestão para o admin.

Foi pensado para ser usado **no celular, dentro da quadra**, com botões e cards grandes, poucas telas e nenhum cadastro complicado. A identidade visual (cores, fontes e ícones) parte da logo oficial do grupo.

<!-- Sugestão: adicione capturas de tela em docs/ e referencie aqui. -->

---

## ✨ Funcionalidades

### Eventos
- A **quinta-feira** da semana é criada automaticamente; o admin cria eventos extras (por exemplo, um sábado) pela própria tela.
- Situações: agendado, em andamento, encerrado e **cancelado com motivo obrigatório** (chuva, quadra ocupada, poucas pessoas ou texto livre), com o motivo visível na lista de eventos passados.
- **Iniciar o evento abre o check-in.** Antes disso ninguém consegue marcar presença. O tamanho dos times é **livre** (não é definido ao iniciar).
- Tela de detalhes **pública** de cada evento: presentes, time campeão, todas as partidas (tocando numa partida aparecem os jogadores de cada time) e as premiações das enquetes. O admin corrige ou exclui partidas por ali.
- Janelas de confirmação para iniciar e encerrar o evento e para check-in e saída.
- **Transmissão**: o admin cadastra o link da live de cada evento (e, depois, o da gravação). O botão aparece **só para quem está logado**, logo abaixo do botão principal do evento, e muda conforme o momento: "Transmissão do evento", "Ao vivo agora: assistir" e "Assistir gravação".

### "Eu vou" (confirmação prévia)
- Nos eventos agendados, qualquer jogador logado tem o botão **"Eu vou"** / **"Não vou mais"** (no card do evento, à direita, e no detalhe do evento). Visitantes que tocam nele são levados ao login e a presença é confirmada ao entrar.
- Confirmar **não é estar presente**: a presença continua sendo o check-in, feito só depois que o evento começa.
- **Só o admin** vê a quantidade e os nomes de quem confirmou. Jogadores e operadores veem apenas o botão.
- No dia do evento, o admin tem o painel **"Confirmados que ainda não chegaram"**: marca a presença de cada um ou usa **"Marcar todos como presentes"**. Nada é automático.

### Check-in e moderação
- Cada pessoa faz o próprio check-in, ou qualquer participante o faz por quem está sem celular.
- **QR Code de check-in**: admin e operadores geram, no Perfil, um QR **fixo** para baixar ou imprimir como cartaz. Ao escanear, a pessoa entra (se preciso) e o check-in do evento em andamento é feito sozinho, com opção de desfazer.
- Operadores e admin cadastram **novos jogadores** (nome e celular) sem sair da própria conta, com a opção de já fazer o check-in.
- Operadores e admin podem **remover alguém do evento e bloquear novo check-in** (útil contra check-ins feitos fora da quadra), com opção de liberar depois. Quem já entrou em partidas não pode ser removido, para preservar as estatísticas.

### Quadra (times e fila)
- **Montagem manual** dos times por quem opera a quadra: arrastar o card do jogador ou tocar nele e escolher **"Mover para…"** (inclusive **"Novo time com…"**). Nome do time opcional e tamanho livre.
- **Fila linha-fora** com as regras do grupo:
  - ganhou, fica; o perdedor vai para o fim da fila;
  - na **2ª vitória seguida**, saem o vencedor e o perdedor, jogam os dois primeiros da fila e o time que venceu 2x volta logo em seguida.
- Quando **2 ou mais vagas** de um time ficam abertas por saídas, o time é desfeito e o novo herda a posição na fila.
- Partidas com **placar final obrigatório** e placar ponto a ponto opcional. A tela atualiza sozinha para vários operadores usarem ao mesmo tempo.
- **Correções**: operadores e admin podem **cancelar a partida em andamento** (os times voltam ao topo da fila); **corrigir o placar** de partida encerrada (operador: só a última; admin: qualquer, com selo "corrigida"); e o admin pode **excluir** uma partida encerrada.

### Quadra livre
- Na aba Quadra, **quando não há evento em andamento**, quem está logado pode brincar de montar **duas linhas de 3 a 6 jogadores** numa quadra de vôlei desenhada em SVG (rede, linhas de ataque a 3 m e jogadores em formação).
- Tocar num jogador mostra as estatísticas do perfil e os troféus; abaixo da quadra ficam a **comparação** das linhas, a **química** (duplas e linha completa que já jogaram juntas), o **confronto direto** no histórico e o botão **"Equilibrar times"**, que divide os escolhidos em duas linhas parelhas.
- A quadra montada pode ser compartilhada como card. É só diversão: não grava nada nem altera o ranking.

### Perfis, estatísticas e ranking
- Perfil com foto e nome, **públicos** (não exigem login).
- Estatísticas: eventos, partidas, vitórias, derrotas, aproveitamento e maior sequência de vitórias, sempre calculadas sobre todo o histórico.
- **Ranking top 10** de jogadores e de times que mais venceram, filtrável por mês, ano ou geral. O admin pode alternar para a lista completa.

### Enquetes e troféus
- Ao encerrar o evento, abrem votações por 24 horas, uma para cada categoria ativa (as categorias são editáveis pelo admin; há as clássicas e as de brincadeira, como "Rádio Quadra" e "O chão é lava"). O **(?)** ao lado do título explica cada uma.
- **Voto secreto**, um por pessoa e por categoria, podendo ser trocado até o fechamento. Só vota quem participou do evento, e ninguém vota em si mesmo nem no próprio time. Cada pessoa vê **apenas o próprio voto** ("Seu voto" em cada enquete e o resumo "Seus votos neste evento").
- Em caso de empate, todos os empatados recebem o troféu; em "Melhor time do dia", todos que jogaram pelo time vencedor. Os troféus aparecem no perfil.
- Os resultados ficam agrupados **por evento**, com o mais recente aberto. O admin pode fechar, prorrogar, remover, **encerrar todas de uma vez** e criar enquetes avulsas.

### Cards para compartilhar
- Imagens em **9:16** (status do WhatsApp, stories e reels) geradas no próprio celular: **card do jogador**, **card do troféu**, **resumo do evento**, **resultados das enquetes** (foto, nome e troféu de cada categoria) e a **quadra livre** montada.

### Caixa de doações (Pix)
- O admin liga ou desliga o botão de doações e configura a **chave Pix** (de preferência aleatória), o nome do titular, a cidade e um valor sugerido.
- Quando ligado, a tela inicial mostra o card **"Caixa do grupo"** com o botão **Doar**: a pessoa escolhe o valor sugerido ou **outro valor**, recebe o **QR Code Pix** (BR Code padrão do Banco Central) e o **"Pix copia e cola"**. A chave não é exibida em texto; o Pix é feito em nome do titular cadastrado.
- Quem está **logado** vê o saldo e o **histórico** de entradas e saídas (com o uso do dinheiro nas saídas). Visitantes veem só o botão.
- O saldo é **manual**: o admin registra entradas, saídas, ajustes e pode excluir lançamentos. O sistema não recebe nem confirma pagamentos.

### Informações, links e regras
- Três janelas na tela inicial com textos editados pelo admin em texto simples:
  - `1. item` para numeração e `- item` para marcadores;
  - `"Texto amigável"[https://endereço]` para links;
  - `*negrito*` e `_itálico_`;
  - o resto vira parágrafo.

### Administração (admin)
O Perfil do admin reúne blocos que se abrem com um toque:
- **Operadores**: promover e rebaixar, gerar códigos de primeiro acesso, ver o telefone de cada jogador, **inativar/reativar** jogadores (saem do login e do check-in, mas permanecem no ranking e nas estatísticas) e **redefinir a senha** de jogadores comuns.
- **QR de check-in**, **Conteúdo da tela inicial** e **Doações e caixa**.
- **Estatísticas do grupo**: período "Este ano", "Geral" ou **personalizado**; números do período, gráficos de presença e de pontos por evento (SVG próprio), mais assíduos, melhores duplas, saldo de pontos em quadra (aproximação) e participação nas votações.

---

## 👥 Papéis

| Papel | O que pode |
| --- | --- |
| **Visitante** (sem login) | Ver eventos e resumos, ranking, perfis, os textos de informações, links e regras, e doar por Pix |
| **Jogador** | Confirmar presença, fazer check-in (o seu ou de outra pessoa, ou pelo QR), votar, ver o caixa, assistir à transmissão, usar a quadra livre, editar o próprio perfil e compartilhar cards |
| **Operador** | Iniciar e encerrar eventos, montar times, controlar fila e placar, remover/bloquear check-ins, cadastrar jogadores, cancelar partida e corrigir a última |
| **Admin** | Tudo acima, mais criar e cancelar eventos, gerenciar operadores e jogadores, enquetes, conteúdo, doações, link da transmissão, estatísticas e exclusão de partidas |

---

## 🔐 Acesso e segurança

- **Jogadores** escolhem o nome na lista e digitam os 4 últimos dígitos do celular. Depois de entrar, recebem a sugestão de **criar uma senha própria** (opcional); quem cria passa a entrar só com a senha. A senha pode ser criada ou alterada em **Perfil → "Alterar minha senha"**.
- **Admin e operadores** entram **sempre com senha** (PBKDF2 com sal, via Web Crypto). O primeiro acesso usa um código: o do admin vem de uma variável de ambiente, e os dos operadores são gerados pelo admin e valem 24 horas.
- Sessões em cookie `HttpOnly`/`Secure`, limite de tentativas erradas por conta (e por IP nas contas com senha) e encerramento das outras sessões ao trocar a senha.
- Contas de gestão sem senha não têm nenhum privilégio até criá-la.
- O telefone dos jogadores só é visível para o admin.
- Os links digitados nos textos são validados (esquemas perigosos como `javascript:` não viram link) e a interface nunca injeta HTML cru.
- **Voto secreto**: a API nunca devolve quem votou em quem; cada pessoa recebe só o próprio voto.

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
| QR Codes | Biblioteca **qrcode** (carregada só quando necessária); o **Pix** (BR Code com CRC16) é montado no servidor, sem serviço externo |
| Recursos do navegador | Canvas (cards), Web Share API, Web Crypto, manifesto de aplicativo (instalável na tela inicial) |
| Tipografia | Bowlby One (títulos) e Nunito (texto), com alternativas locais |

Não há servidor próprio: tudo roda no Cloudflare e no Neon.

---

## 🧱 Arquitetura e organização

```
.
├── db/migrations/        # esquema do banco, em ordem (001 a 010)
├── functions/
│   ├── _lib/             # utilitários: banco, sessão, senhas, regras de quadra e enquetes, Pix
│   └── api/              # rotas: auth, checkin, events, matches, players, profile,
│                         #        polls, ranking, stats, content, donation, lab
├── public/               # logo, ícones e manifesto
├── scripts/migrate.mjs   # aplica as migrações pendentes
├── src/                  # telas e componentes React, cards (cards.js) e interpretador de texto (richcore.js)
└── .github/workflows/    # migração automática do banco
```

**Banco de dados** (principais tabelas): `players`, `sessions`, `events`, `checkins`, `checkin_blocks`, `event_rsvps`, `teams`, `team_members`, `matches`, `match_players`, `poll_categories`, `polls`, `poll_options`, `votes`, `awards`, `player_photos`, `site_content`, `donation_settings` e `donation_entries`, além das views `player_stats` e `team_stats`.

### Decisões de projeto
- **Estatísticas sempre calculadas** a partir das partidas registradas (`match_players`), então nada "expira" e corrigir um dado corrige tudo.
- **Sem tarefas agendadas**: a quinta é criada na primeira consulta da semana e as votações fecham quando alguém abre o app depois do prazo.
- **Fotos no próprio banco**, já recortadas e reduzidas no celular (JPEG de cerca de 30 KB), sem serviço extra de armazenamento.
- **Cards gerados no navegador**, sem custo de servidor e sem depender de bibliotecas pesadas.
- **Quadra livre só de leitura**: usa os dados que já existem (perfis, partidas e troféus), sem gravar nada.
- **Confirmar presença não é presença**: o "Eu vou" é só intenção e fica restrito ao admin; a presença vem do check-in.
- **Privacidade por padrão**: contagens e nomes sensíveis (confirmados, telefone, estatísticas do grupo, lista completa do ranking) só saem do servidor para o admin, e o link da transmissão e o saldo do caixa, só para quem está logado; as regras são conferidas no servidor, e não apenas na tela.

---

## ⚙️ Configuração

O projeto usa três variáveis de ambiente no Cloudflare Pages:

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | Conexão com o Neon (também usada pela GitHub Action de migração, como segredo) |
| `ADMIN_PHONE` | Celular (só dígitos) que, ao se cadastrar, recebe o papel de admin |
| `ADMIN_SETUP_CODE` | Código secreto para o admin criar ou redefinir a própria senha |

A chave Pix, o titular, a cidade e o valor sugerido são configurados dentro do app, no Perfil do admin, e ficam no banco.

---

## 🎨 Identidade visual

Todo o visual parte da logo oficial (com fundo transparente): verde vivo das letras e da faixa, verde-petróleo do laço, verde-escuro do escudo e a flor como inspiração para os detalhes. O modo escuro usa tons de verde-floresta. A navegação usa ícones, e as ações perigosas aparecem em vermelho cheio.

---

## 👤 Autoria

Desenvolvido por **Alex Passos** ([@soumaisalex](https://github.com/soumaisalex) no GitHub e no Instagram) para a comunidade do condomínio Alamedas Jardins.
