# Plano de implementação — Gestão de Atuação

## Objetivo e decisões aprovadas

Reconstruir o painel de gestão de equipe e atendimento a fazendas usando a captura enviada como referência funcional. O painel e o código serão públicos. O usuário autorizou publicar somente nomes de colaboradores/gestores/regionais; clientes, fazendas/unidades e cidades atendidas; coordenadas existentes de bases e fazendas; distâncias cadastradas, raio, rota e tempo estimado; área em hectares e indicadores de serviço/unidades. A chave ORS também pode ser pública no JavaScript compilado; o usuário aceitou a cota gratuita.

A interface não mostrará e-mails, telefones, responsáveis fiscais/financeiros, logins, IDs internos, ARR, valores ou datas de contrato, chaves SGPA ou outras colunas não autorizadas. A permissão pública do arquivo operacional completo é uma decisão separada: o usuário escolheu “qualquer pessoa com o link pode editar”. Para reduzir a descoberta desse link, ele será fornecido diretamente ao usuário, não embutido no site público. O painel exibirá apenas a planilha derivada curada em modo de leitura.

## Arquitetura e fluxo de dados

- Aplicação frontend estática com React, TypeScript e Vite, uma rota (`/`) e URLs de assets relativas. Sem backend próprio, autenticação ou escrita no site.
- O Excel completo foi copiado para Google Planilhas como “Gestão de Atuação — Base operacional”, aba `Projetos`. Foi aplicada a permissão do Google Drive `type=anyone`, `role=writer`, `allowFileDiscovery=false`, conforme confirmação explícita do usuário: qualquer pessoa que receber o link pode editar a planilha completa. O link não será mostrado na interface pública.
- O site consome uma segunda planilha, `Gestão de Atuação — PAINEL_PUBLICO`, via CSV público CORS. Ela guarda somente valores curados dos 22 campos aprovados (sem fórmula/ID da base editável): gestor, regional, colaborador, coordenada da base, cliente, fazenda, coordenada da fazenda, cidade atendida, indicador de ponto focal de campo, área, distância, raio, serviços e dados de unidade SGPA. Botão manual, horário da consulta e erros ficam visíveis. A atualização de origem a cada 15 minutos só será prometida e habilitada depois que o usuário autorizar o consentimento do Apps Script; enquanto isso, o painel identifica a saída como snapshot e permite atualização manual.
- GitHub Pages gratuito requer repositório público no GitHub Free. A conexão canônica WebDev prepara um novo repositório privado e não permite ajustar visibilidade ou adotar um existente; a publicação dependerá da etapa posterior de mudar a visibilidade do repositório para público e habilitar Pages (branch `main`, pasta `/docs`). Até a confirmação de publicação, Preview/checkpoint não serão descritos como site publicado.
- Google Workspace está conectado. O Apps Script privado e o sincronizador estão salvos, mas a execução foi cancelada e ainda não há acionador; o OAuth pode conceder acesso amplo a planilhas da conta e gerir acionadores. O usuário informou que fará essa autorização no próprio Google e avisará quando concluir; até lá, a saída permanece snapshot e sem sincronização programada. A integração GitHub disponível é a conexão canônica do projeto. Não solicitar senhas ou tokens em conversa. A chave ORS foi inserida pelo fluxo protegido, mas será incluída no bundle estático público conforme autorização explícita; não será escrita no fonte versionado.

## Mapa, localidades e rotas

- Mapa interativo do Brasil com camadas OpenStreetMap, relevo e satélite; marcadores de bases agrupados quando compartilham coordenadas; fazendas com coordenada exata; rotas e círculos de raio. Para evitar sobreposição inicial, o mapa começa sem todos os círculos: ao selecionar projeto mostra exatamente o raio cadastrado naquele projeto; sem colaborador selecionado, o controle `Raios` pode exibir os raios distintos cadastrados.
- Clique em colaborador, fazenda ou ponto abre detalhes com base, destino, gestor, região, cidade atendida, hectares, unidades, raio, dados de serviço, distância cadastrada, rota rodoviária e tempo estimado. A distância da planilha e o percurso rodoviário são sempre separados. Rotas/tempos são aproximações sem tráfego em tempo real.
- Rotas sob demanda com OpenRouteService (ORS): `https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson`. O plano Standard consultado é gratuito, com cota consultada de 2.000 direções/dia e 40/minuto; limites podem mudar. Fazer chamadas somente por seleção/cálculo solicitado, usar cache de sessão e espaçamento entre pedidos; informar cota, chave inválida e indisponibilidade com mensagens claras.
- Quando a coordenada exata da fazenda (`LAT LONG - FAZ`) existir, usá-la. Sem coordenada, usar `https://api.heigit.org/pelias/v1/search` para localizar a cidade atendida e UF no Brasil; aceitar apenas uma correspondência única nas camadas `locality/localadmin`, validar o estado devolvido e mostrar o centro municipal como aproximação. Extrair UF de abreviatura isolada, nome completo do estado (`REGIONAL`) ou sufixo do campo `CIDADE`. Avisar que o centro municipal não representa a sede da fazenda; caso não haja correspondência segura, não traçar a rota.
- A planilha não possui coluna separada `CIDADE BASE`; traz `REGIONAL` e `LAT LONG - BASE`. Ao selecionar colaborador, consultar o endpoint oficial de geocodificação reversa `https://api.heigit.org/pelias/v1/reverse` na coordenada informada da base; exigir resultado único `locality/localadmin` no Brasil e rotular o município como **aproximado por coordenada**. Diferenciar “município não confirmado” de erro da chave, cota ou serviço, exibindo o aviso do geocodificador. Se não houver resultado, manter a regional e a coordenada da base, sem inventar cidade.
- O Excel `Projetos` tem 696 linhas de dados e 43 colunas; a leitura estrutural encontrou 147 linhas com coordenada da base e somente 2 com coordenada exata da fazenda. A coluna textual da localidade-base não existe. A interface identifica campos ausentes e diferencia coordenada exata de cidade aproximada.
- Tiles do OpenStreetMap no endereço oficial `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, atribuição legível “© OpenStreetMap contributors”, respeitando cache HTTP e sem pré-carregar tiles; disponibilidade é best-effort, sem SLA.

## Painel e interação

- Faixa superior escura com marca “Gestão de Atuação”, filtros de gestor, regional e colaborador, busca por fazenda/cliente/cidade e controles de visibilidade para bases, fazendas, rotas e raios.
- Indicadores: unidades/vínculos únicos, colaboradores, área em hectares, média da distância registrada e registros sem coordenada exata. Filtros atualizam mapa, métricas e lista simultaneamente.
- Mapa como área principal, lista lateral de colaboradores/fazendas e painel lateral de detalhes com estados vazio/erro/carregamento; layout responsivo desktop/celular; controle para resetar filtros e seletor de camada cartográfica.
- Campos vazios exibem “Não informado”; normalizar formatos de coordenadas/números e valores SIM/NÃO sem modificar o conteúdo-fonte. Contar unidades por vínculo/projeto de forma consistente, incluindo alternativa SGPA disponível, sem duplicar linhas idênticas. O próprio parser da aplicação confirma 191 registros: 190 unidades e 47 colaboradores identificados, dos quais 46 possuem unidades e um aparece com zero. Esse colaborador continua na equipe, mas não aumenta métricas de unidades, área, distância média ou coordenadas de fazenda ausentes.

## Direção visual

- **Movimento:** dashboard cartográfico de operações, com disciplina suíça/industrial e referências discretas ao campo.
- **Princípios:** leitura imediata; mapa como instrumento central; densidade controlada; incompletudes claramente assinaladas.
- **Paleta:** azul-marinho para navegação/confiança; branco e cinzas frios para legibilidade; verde profundo como cor de marca/território; âmbar para dados aproximados; vermelho para falhas.
- **Layout:** barra superior compacta, métricas horizontais, canvas cartográfico amplo e painéis laterais; em telas pequenas, painéis empilhados/gavetas.
- **Elementos-assinatura:** rotas em verde territorial; círculos de raio translúcidos; chips de qualidade/coordenada.
- **Interação/animação:** filtros sem recarga, seleção que centraliza/realça, transições discretas de 150–220 ms, sem movimento contínuo.
- **Tipografia:** DM Sans para interface e Manrope para títulos/valores, com hierarquia curta, contraste legível e valores tabulares.
- **Essência da marca:** “Visão territorial clara para coordenar quem atende cada fazenda”; personalidade objetiva, confiável e prática.
- **Tom de voz:** direto e operacional. Exemplos: “Equipe no território, em um só mapa.”; “Rota estimada até o destino — confira a qualidade da coordenada.”
- **Marca/logotipo:** pin geométrico combinado a linhas de talhão/rota, junto ao wordmark “Gestão de Atuação”.
- **Cor-assinatura:** verde territorial `#197A5B`.

## Estrutura do projeto

- `src/data/`: tipos, parser/validação de CSV público, adaptador Google Sheets e métricas.
- `src/components/`: barra de navegação/filtros, indicadores, lista/equipe, painel de detalhes e `MapView.tsx`.
- `src/lib/`: geocodificação/roteamento ORS, cache de sessão, formatação pt-BR e utilitários.
- `public/`: favicon SVG, ícones e manifesto estático `manus-routes.json`.
- `scripts/`: dados controlados/anônimos de demonstração; nunca copiar a planilha bruta para o repositório.
- raiz: `plan.md`, `TODO.md`, package/lockfile pnpm, configuração Vite/TypeScript e saída estática `docs/` para GitHub Pages.

## Dependências e operação

React/TypeScript/Vite, Leaflet/react-leaflet e PapaParse são usados no frontend. Google Sheets fornece os registros curados; OpenStreetMap fornece tiles; ORS fornece geocodificação e rotas sob demanda. O build padrão gera `dist/`; `build:pages` gera `docs/` para branch `main`/pasta `/docs`. A chave ORS não aparece no fonte, mas o bundle final revela a chave e pode consumir a cota; isso foi explicitamente aceito. A planilha completa é editável por qualquer pessoa que receba seu link por decisão expressa do usuário, porém a interface pública não expõe esse link. A publicação só estará concluída quando o repositório público e GitHub Pages forem habilitados; até lá, entregar o Preview com esse rótulo.
