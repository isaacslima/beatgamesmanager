# Especificação Técnica: Expansão do Sistema "Beat Games"

Este documento detalha os requisitos para a expansão do sistema **Beat Games**, evoluindo a inserção simples atual para uma plataforma completa de gerenciamento de biblioteca de jogos (inspirada em planilhas de controle avançadas, com múltiplos CRUDEs, status flexíveis, histórico e painéis dedicados).

---

## 1. Arquitetura de Navegação e Menus
O sistema deve conter um menu lateral atualizado com acesso direto às seguintes seções (cada uma com seu respectivo CRUD e DataTable dedicado com paginação, ordenação e filtros):

1. **Dashboard** (Tela inicial com estatísticas e gráficos)
2. **Jogos** (Listagem principal com filtros por Nome, Plataforma, Status, Período)
3. **Plataformas** (Gerenciamento de consoles/plataformas - ex: Switch, PC, NDS, SG-1000)
4. **Gêneros** (Gerenciamento de gêneros dos jogos)
5. **Tipos** (Subcategorias ou subtipos de gêneros - ex: Ação RPG, Exploratório, Vida)
6. **Notas / Avaliações** (Tabela de referência e pontuação - de 1 a 11, ex: "Jogo da vida" até "Tragédia")
7. **Níveis de Dificuldade** (Configuração de dificuldades - ex: C/Fácil, B/Médio, A/Complicado, AA/Difícil, AAA/Imperdoável)

---

## 2. Entidade Principal: Jogo (`Game`)
Cada registro na tabela de Jogos deve conter os seguintes campos baseados na planilha de referência:

* **Nome do Jogo** (`title` - String, obrigatório)
* **Plataforma** (`platform_id` - Relacionamento com o CRUD de Plataformas)
* **Gênero** (`genre_id` - Relacionamento com o CRUD de Gêneros)
* **Tipo** (`type_id` - Relacionamento com o CRUD de Tipos)
* **Status** (`status` - Enum/Select, obrigatório):
  * `Lista de Desejo`
  * `Planejado para Jogar`
  * `Zerado`
  * `Dropado`
* **Data de Início** (`start_date` - Date, opcional)
* **Data de Término / Finalizado** (`end_date` - Date, opcional. *Nota: não obrigatório, pois o jogo pode estar na lista de desejos ou planejado*).
* **Tempo Total** (`play_time` - Formato HH:MM:SS ou horas decimais)
* **Nota** (`score` - Inteiro de 1 a 11, associado à tabela/escala de pontuação)
* **Dificuldade** (`difficulty` - Chave/Escala de C até AAA)
* **Condição de Zeramento** (`completion_condition` - Texto livre/Campo aberto).
  * *Feature de IA/Histórico:* Ao preencher ou focar neste campo, o sistema deve sugerir/consultar na base histórica de jogos já preenchidos condições semelhantes para dar ideias (ex: "Veja os créditos", "Conquiste as 80 estrelas", "Vença o chefe final").
* **Destaque / GOTY** (`is_goty` - Booleano, para destacar o "Meu jogo do ano").

---

## 3. Requisitos de Telas e Componentes

### 3.1. DataTable Dedicado (Para cada CRUD)
* **Paginação:** Controles de página (Anterior, Próxima, itens por página).
* **Filtros Avançados:** Filtro por texto (busca), filtros suspensos por plataforma, gênero, status e intervalo de datas.
* **Ações por Linha:** Botões de Edição e Exclusão rápidos.

### 3.2. Dashboard Atualizado
O Dashboard inicial deve ser expandido para exibir cartões de resumo e gráficos inspirados na segunda imagem de referência:
* **Cards de Totais:** Total de jogos, plataformas cadastradas, jogos zerados, lista de desejo.
* **Gráficos de Pontuação:** Distribuição visual dos jogos por nota (de 11 - Jogo da vida até 1 - Tragédia) com contagem total.
* **Gráficos de Dificuldade:** Distribuição por nível de dificuldade (C até AAA).
* **Gráficos de Plataformas:** Top plataformas mais usadas.

---

## 4. Instruções para Implementação (Claude Code)

Ao executar a criação destas features, certifique-se de:
1. Manter a identidade visual limpa e moderna.
2. Garantir validações flexíveis para datas e status (permitindo salvar jogos na "Lista de Desejo" sem data de início/fim).
3. Implementar o autocomplete ou busca inteligente no campo de "Condição de Zeramento" utilizando o histórico existente na base de dados.