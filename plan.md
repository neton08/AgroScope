# Plano de implementação — AgroScope

## Objetivo e decisões aprovadas

Reconstruir o painel de gestão de equipe e atendimento a fazendas usando a captura enviada como referência funcional. O painel e o código são públicos. O usuário autorizou publicar somente nomes de colaboradores, gestores e regionais; clientes, fazendas/unidades e cidades atendidas; coordenadas existentes de bases e fazendas; distâncias cadastradas, raio, rota e tempo estimado; área em hectares e indicadores de serviço/unidades. A chave ORS pode ser pública no JavaScript compilado; o usuário aceitou a cota gratuita.

A interface pública não mostra e-mails, telefones, responsáveis fiscais/financeiros, logins, IDs internos, ARR, valores ou datas de contrato, chaves SGPA ou outras colunas não autorizadas. A permissão pública do arquivo operacional completo é separada da publicação do site; o site lê somente uma saída curada.

## Arquitetura e fluxo de dados

- Aplicação frontend estática com React, TypeScript e Vite, uma rota (`/`) e URLs de assets relativas. Sem backend próprio, autenticação ou escrita no site.
- A base operacional atual no Google Planilhas possui a aba `Projetos`. O arquivo Excel reenviado contém uma aba `Projetos`, uma aba `Contato Clientes Pesquisas NPS` e uma aba `Orientação` vazia. A aba de contatos é privada e não pode ser incluída no bundle público.
- O site atualmente consome uma planilha derivada separada, `PAINEL_PUBLICO`, via CSV público CORS. Ela guarda somente valores curados dos 22 campos aprovados. O código não deve guardar fórmula nem ID da planilha operacional completa. O botão manual, horário da consulta e erros ficam visíveis; até que a nova sincronização seja ajustada e autorizada, não se deve prometer atualização automática.
- Proposta pendente de confirmação: consolidar as abas privadas de entrada (`Projetos` e `Contato Clientes Pesquisas NPS`) e a aba derivada `PAINEL_PUBLICO` em um único arquivo Google Planilhas, mantendo somente a aba curada publicada para leitura pelo site. Publicar a aba pública não equivale a liberar edição do arquivo inteiro. A integração de 15 minutos depende de ajustar o Apps Script para o novo destino e de autorização do usuário.
- O reenvio tem 191 linhas preenchidas em `Projetos` e 43 colunas; a aba de contatos contém 293 linhas preenchidas e 7 colunas. A base operacional online tem 191 linhas preenchidas em `Projetos`, com as mesmas 43 colunas. Foram encontrados cinco projetos que não coincidem pela chave de colaborador/cliente/fazenda/cidade e diferenças em dados operacionais, incluindo coordenadas, regional, área, distância, raio, CB e Solinfnet. Nenhuma substituição ou mesclagem será feita até o usuário indicar qual arquivo é a fonte correta.
- O usuário pediu que o arquivo seja editável somente por pessoas autorizadas e permaneça sob seu controle de propriedade. A mudança para acesso restrito depende dos endereços Google dos editores ou de um Google Group. Não embutir links privados nem IDs da base operacional no repositório público.
- GitHub Pages está configurado para repositório público, branch `main`, pasta `/docs`; a URL pública respondeu HTTP 200. O repositório canônico do projeto WebDev continua no espaço gerenciado Manus e o repositório GitHub AgroScope é o destino público separado; após cada edição, atualizar o build `docs/` e a cópia de publicação conforme o fluxo de Git aceito.
- O Apps Script privado e o sincronizador foram preparados em etapa anterior, mas a autorização e o acionador ainda não foram confirmados. Não afirmar que a sincronização de 15 minutos está ativa até verificar uma execução e um acionador efetivamente instalados.

## Mapa, localidades e rotas

- Mapa interativo do Brasil com camadas OpenStreetMap, relevo e satélite; marcadores de bases agrupados quando compartilham coordenadas; fazendas com coordenada exata; rotas e círculos de raio. Para evitar sobreposição inicial, o mapa começa sem todos os círculos: ao selecionar projeto mostra exatamente o raio cadastrado naquele projeto; sem colaborador selecionado, o controle `Raios` pode exibir os raios distintos cadastrados.
- Clique em colaborador, fazenda ou ponto abre detalhes com base, destino, gestor, região, cidade atendida, hectares, unidades, raio, dados de serviço, distância cadastrada, rota rodoviária e tempo estimado. A distância da planilha e o percurso rodoviário são sempre separados. Rotas/tempos são aproximações sem tráfego em tempo real.
- Rotas sob demanda com OpenRouteService (ORS): `https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson`. Fazer chamadas somente por seleção/cálculo solicitado, usar cache de sessão e informar cota, chave inválida e indisponibilidade com mensagens claras.
- Quando a coordenada exata da fazenda (`LAT LONG - FAZ`) existir, usá-la. Sem coordenada, usar `https://api.heigit.org/pelias/v1/search` para localizar a cidade atendida e UF no Brasil; aceitar apenas uma correspondência única nas camadas `locality/localadmin`, validar o estado devolvido e mostrar o centro municipal como aproximação. Extrair UF de abreviatura isolada, nome completo do estado (`REGIONAL`) ou sufixo do campo `CIDADE`. Avisar que o centro municipal não representa a sede da fazenda; caso não haja correspondência segura, não traçar a rota.
- A planilha não possui coluna separada `CIDADE BASE`: traz `REGIONAL` e `LAT LONG - BASE`. Ao selecionar colaborador, consultar o endpoint oficial de geocodificação reversa `https://api.heigit.org/pelias/v1/reverse` na coordenada informada da base; exigir resultado único `locality/localadmin` no Brasil e rotular o município como **aproximado por coordenada**. Diferenciar “município não confirmado” de erro da chave, cota ou serviço, exibindo o aviso do geocodificador. Se não houver resultado, manter a regional e a coordenada da base, sem inventar cidade.
- A fonte não possui coluna textual separada para localidade-base. A interface identifica campos ausentes e diferencia coordenada exata de cidade aproximada.
- Tiles do OpenStreetMap no endereço oficial `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, atribuição legível “© OpenStreetMap contributors”, respeitando cache HTTP e sem pré-carregar tiles; disponibilidade é best-effort, sem SLA.

## Painel e interação

- Faixa superior escura com marca “AgroScope”, filtros de gestor, regional e colaborador, busca por fazenda/cliente/cidade e controles de visibilidade para bases, fazendas, rotas e raios.
- Indicadores: unidades/vínculos únicos, colaboradores, área em hectares, média da distância registrada e registros sem coordenada exata. Filtros atualizam mapa, métricas e lista simultaneamente.
- Mapa como área principal, lista lateral de colaboradores/fazendas e painel lateral de detalhes com estados vazio/erro/carregamento; layout responsivo desktop/celular; controle para resetar filtros e seletor de camada cartográfica.
- Campos vazios exibem “Não informado”; normalizar formatos de coordenadas/números e valores SIM/NÃO sem modificar o conteúdo-fonte. Contar unidades por vínculo/projeto de forma consistente, incluindo alternativa SGPA disponível, sem duplicar linhas idênticas. O parser confirma 191 registros: 190 unidades e 47 colaboradores identificados, dos quais 46 possuem unidades e um aparece com zero. Esse colaborador continua na equipe, mas não aumenta métricas de unidades, área, distância média ou coordenadas de fazenda ausentes.
- Revisão visual aprovada: substituir o nome visível “Gestão de Atuação” por “AgroScope” e aumentar a tipografia do painel de detalhes, que ficou pequena, mantendo o conteúdo legível em telas estreitas e sem esconder informações por falta de espaço.

## Direção visual

- **Movimento:** dashboard cartográfico de operações, com disciplina suíça/industrial e referências discretas ao campo.
- **Princípios:** leitura imediata; mapa como instrumento central; densidade controlada; incompletudes claramente assinaladas.
- **Paleta:** azul-marinho para navegação/confiança; branco e cinzas frios para legibilidade; verde profundo como cor de marca/território; âmbar para dados aproximados; vermelho para falhas.
- **Layout:** barra superior compacta, métricas horizontais, canvas cartográfico amplo e painéis laterais; em telas pequenas, painéis empilhados/gavetas.
- **Elementos-assinatura:** rotas em verde territorial; círculos de raio translúcidos; chips de qualidade/coordenada.
- **Interação/animação:** filtros sem recarga, seleção que centraliza/realça, transições discretas de 150–220 ms, sem movimento contínuo.
- **Tipografia:** DM Sans para interface e Manrope para títulos/valores, com hierarquia curta, contraste legível e valores tabulares. Na ficha de atendimento, não usar microtexto: rótulos e texto de apoio devem ser maiores e os valores devem continuar fáceis de comparar.
- **Essência da marca:** “AgroScope — visão territorial clara para coordenar equipes, fazendas e atendimento”; personalidade objetiva, confiável e prática.
- **Tom de voz:** direto e operacional. Exemplos: “Equipe no território, em um só mapa.”; “Rota estimada até o destino — confira a qualidade da coordenada.”
- **Marca/logotipo:** manter o pin geométrico combinado a linhas de talhão/rota, agora junto ao wordmark “AgroScope”.
- **Cor-assinatura:** verde territorial `#197A5B`.

## Estrutura do projeto

- `src/data/`: tipos, parser/validação de CSV público, adaptador Google Sheets e métricas.
- `src/components/`: barra de navegação/filtros, indicadores, lista/equipe, painel de detalhes e `MapView.tsx`.
- `src/lib/`: geocodificação/roteamento ORS, cache de sessão, formatação pt-BR e utilitários.
- `public/`: favicon SVG, ícones e manifesto estático `manus-routes.json`.
- `scripts/`: dados controlados/anônimos de demonstração; nunca copiar a planilha bruta para o repositório.
- raiz: `plan.md`, `TODO.md`, package/lockfile pnpm, configuração Vite/TypeScript e saída estática `docs/` para GitHub Pages.

## Dependências e operação

React/TypeScript/Vite, Leaflet/react-leaflet e PapaParse são usados no frontend. Google Sheets fornece os registros curados; OpenStreetMap fornece tiles; ORS fornece geocodificação e rotas sob demanda. O build padrão gera `dist/`; `build:pages` gera `docs/` para branch `main`/pasta `/docs`. A chave ORS não aparece no fonte, mas o bundle final a revela e isso foi explicitamente aceito. A versão pública atual é servida por GitHub Pages. A base operacional deve permanecer restrita a pessoas autorizadas; o site público lê somente uma aba com campos expressamente autorizados.

## Solicitações adicionais — decisões pendentes

- O HTML legado é um painel independente que importa arquivo Excel localmente e guarda estado no navegador. Ele inclui indicadores de ARR, valores e vencimentos contratuais, filtros de contrato e dados de contatos. A integração planejada é refatorar recursos úteis como componentes React que leiam a mesma fonte curada, não publicar o HTML bruto nem reintroduzir upload local. A seleção de recursos e campos para o site público depende da resposta do usuário.
- Campos financeiros, de contato, credenciais ou identificadores internos permanecem fora do site público. Se o usuário quiser esses campos em uma interface, o produto precisará de uma versão autenticada com backend; não basta escondê-los em uma tela de um site estático.
- A adoção do anexo como fonte, a migração para uma única planilha, a lista de editores autorizados e a autorização do Apps Script aguardam decisão/ação do usuário. Até lá, não substituir nem mesclar os dados, não alterar permissões e não afirmar sincronização automática.
