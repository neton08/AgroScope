# Plano de implementação — AgroScope

## Objetivo e decisões aprovadas

Reconstruir e ampliar o painel de equipe agrícola a partir da captura e do HTML anexados. O usuário confirmou que `PROJETOSGERENCIA.xlsx` é a versão de referência, completa e sem limitação de colunas para uso privado por ele e pelos gestores, e escolheu **Google Sign-In** para o painel privado.

O site público continuará no GitHub Pages gratuito e mostrará somente os campos previamente autorizados. O painel privado permitirá consultar dados empresariais adicionais após autenticação e acesso Google ao arquivo. A casca e o código do GitHub Pages continuam públicos; dados privados não serão incluídos no bundle nem entregues antes da autorização Google. Se a exigência for ocultar também o endereço/código do site de visitantes, será necessário hospedar a aplicação inteira atrás de um servidor privado.

## Arquitetura e fluxo de dados

- Manter um código React/TypeScript/Vite com duas experiências: resumo público estático em `/docs` e painel privado desbloqueado por Google Sign-In. Não duplicar o app nem embutir dados operacionais no HTML/JavaScript publicado.
- Usar Google Identity Services e Google Picker com o escopo de menor privilégio `drive.file`: cada usuário autorizado escolhe a planilha AgroScope e, em seguida, o app lê as abas necessárias pela Google Sheets API com o access token mantido somente em memória. Não persistir tokens em `localStorage`, não enviar a planilha ao servidor do site e descartar o token ao sair. A API do Google e as permissões da planilha são o controle de acesso: usuário sem permissão no arquivo recebe erro de acesso e nenhum dado.
- O Client ID OAuth e a API key do Picker são configurações públicas do app, não segredos; restringir a origem JavaScript ao domínio do GitHub Pages e a API key por HTTP referrer/serviços necessários. Não embutir client secret, dados de colaboradores ou chaves de API confidenciais no bundle.
- O endereço do painel e o código fonte permanecem públicos. Isso não expõe a base: a leitura completa só ocorre após consentimento Google e autorização explícita do arquivo. A chave ORS pode aparecer no bundle compilado conforme autorização prévia do usuário.
- Usar o anexo reenviado como fonte operacional exata, sem mesclar com os valores divergentes da versão online. Manter todas as abas/colunas/dados do arquivo numa única planilha Google de trabalho: `Projetos`, `Contato Clientes Pesquisas NPS` e `Orientação` (vazia no anexo). O arquivo pertence ao usuário e deve ficar com acesso restrito a ele e às contas Google autorizadas pelos gestores; não usar “qualquer pessoa com o link pode editar”. O owner mantém controle do arquivo; editores nomeados não se tornam proprietários.
- Incluir na mesma planilha uma aba derivada `PAINEL_PUBLICO` com valores curados dos 22 campos já aprovados. Publicar somente essa aba para leitura pública; manter as abas operacionais e de contatos protegidas pela permissão restrita do arquivo. A permissão de publicação da aba não concede edição do arquivo inteiro.
- A versão pública continua lendo somente `PAINEL_PUBLICO`. A versão privada, depois de o usuário escolher o arquivo no Picker, lê as abas `Projetos` e `Contato Clientes Pesquisas NPS`. Não exibir senhas/logins, tokens, chaves SGPA, identificadores técnicos ou outras credenciais mesmo no painel privado.
- O usuário confirmou o anexo reenviado como fonte de verdade. Não fazer reconciliação linha a linha com o snapshot anterior nem descartar a planilha anterior sem necessidade; manter um backup privado até validar a nova base e sincronização.
- `PAINEL_PUBLICO` foi criado na planilha operacional única como projeção por fórmula das colunas aprovadas. O proprietário publicou somente essa guia em CSV e enviou o link; ele foi validado com HTTP 200, 22 cabeçalhos aprovados e 191 registros. O código do site já aponta para essa fonte; após o build e a publicação no GitHub Pages, as edições em `Projetos` recalculam a projeção, a atualização pública pode levar alguns minutos e o mapa oferece atualização manual. O Apps Script/trigger de 15 minutos preparado anteriormente não é necessário e não deve ser autorizado nem executado para esse fim.

## Mapa, localidades e rotas

- Mapa interativo do Brasil com camadas OpenStreetMap, relevo e satélite; marcadores de bases agrupados quando compartilham coordenadas; fazendas com coordenada exata; rotas e círculos de raio. Para evitar sobreposição inicial, o mapa começa sem todos os círculos: ao selecionar projeto mostra exatamente o raio cadastrado naquele projeto; sem colaborador selecionado, o controle `Raios` pode exibir os raios distintos cadastrados.
- Clique em colaborador, fazenda ou projeto abre detalhes com base, destino, gestor, região, cidade atendida, hectares, unidades, raio, dados de serviço, distância cadastrada, rota rodoviária e tempo estimado. Separar a distância cadastrada do percurso rodoviário; identificar rotas/tempos como aproximações, sem tráfego em tempo real.
- Rotas sob demanda com OpenRouteService (ORS): `https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson`. Fazer chamadas somente por seleção/cálculo solicitado, usar cache de sessão e informar cota, chave inválida e indisponibilidade com mensagens claras.
- Quando a coordenada exata da fazenda (`LAT LONG - FAZ`) existir, usá-la. Sem coordenada, usar `https://api.heigit.org/pelias/v1/search` para localizar a cidade atendida e UF no Brasil; aceitar apenas uma correspondência única nas camadas `locality/localadmin`, validar o estado devolvido e mostrar o centro municipal como aproximação. Extrair UF de abreviatura isolada, nome completo do estado (`REGIONAL`) ou sufixo do campo `CIDADE`. Avisar que o centro municipal não representa a sede da fazenda; caso não haja correspondência segura, não traçar a rota.
- A planilha não possui coluna textual separada `CIDADE BASE`: traz `REGIONAL` e `LAT LONG - BASE`. Ao selecionar colaborador, consultar o endpoint oficial de geocodificação reversa `https://api.heigit.org/pelias/v1/reverse` na coordenada informada da base; exigir resultado único `locality/localadmin` no Brasil e rotular o município como **aproximado por coordenada**. Diferenciar “município não confirmado” de erro da chave, cota ou serviço, exibindo o aviso do geocodificador. Se não houver resultado, manter a regional e a coordenada da base, sem inventar cidade.
- Tiles do OpenStreetMap no endereço oficial `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, atribuição legível “© OpenStreetMap contributors”, respeitando cache HTTP e sem pré-carregar tiles; disponibilidade é best-effort, sem SLA.

## Painel público e privado

- A barra superior usa a marca “AgroScope”; filtros de gestor, regional e colaborador, busca por fazenda/cliente/cidade e controles para bases, fazendas, rotas e raios.
- Indicadores públicos: unidades/vínculos únicos, colaboradores, área em hectares, média da distância registrada e registros sem coordenada exata; filtros atualizam mapa, métricas e lista simultaneamente.
- A página pública oferece a ação “Entrar no painel privado”. Sem autenticação Google e sem acesso ao arquivo, manter somente o resumo público; não baixar as abas privadas em segundo plano.
- Após login e autorização Google, o painel privado integra os recursos do HTML legado como componentes React: visão geral, fila de atenção, pulso da operação, recortes por gestor, status, filtros e tabelas; incluir dados contratuais/financeiros e contatos/NPS pertinentes ao HTML dentro da sessão privada. Nunca mostrar logins, senhas, chaves, tokens ou IDs técnicos.
- Layout responsivo desktop/celular; lista lateral de colaboradores/fazendas, detalhes com estados vazio/erro/carregamento e botão para resetar filtros. Campos vazios exibem “Não informado”; normalizar formatos sem modificar o conteúdo-fonte. O logout elimina o token da sessão em memória.
- O HTML legado é referência de funcionalidades/organização, não será embutido como arquivo bruto nem continuará dependendo de importar um Excel local.

## Dados, planilha e acesso

- Os 22 campos autorizados para a versão pública são: nomes de colaboradores, gestores e regionais; clientes, fazendas/unidades e cidades atendidas; coordenadas existentes de base e fazenda; distância cadastrada, raio, rota e tempo estimado; área em hectares e indicadores de serviço/unidades, incluindo ponto focal de campo.
- A aba pública não contém e-mails, telefones, responsáveis fiscais/financeiros, ARR, valores ou datas de contrato, IDs internos, logins/chaves SGPA ou demais campos privados. Esses campos só aparecem no painel privado autenticado e autorizado, conforme as áreas do HTML legado.
- O usuário pediu que somente ele possa excluir a planilha e que a edição seja restrita às pessoas autorizadas. A planilha será compartilhada a editores Google nomeados; a lista de e-mails/Google Group ainda precisa ser informada. A permissão geral por link não deve ser usada. O usuário continua proprietário; cópias de segurança ficam privadas.
- O anexo reenviado possui `Projetos` com 191 linhas preenchidas e 43 colunas, `Contato Clientes Pesquisas NPS` com 293 linhas preenchidas e 7 colunas e uma aba `Orientação` vazia. O snapshot online antigo também tinha 191 linhas, mas diverge em cinco projetos e em valores operacionais; usar o anexo confirmado como fonte de verdade.
- O parser de dados confirma 191 registros: 190 unidades e 47 colaboradores identificados, dos quais 46 possuem unidades e um aparece com zero. Esse colaborador continua na equipe, mas não aumenta métricas de unidades, área, distância média ou coordenadas de fazenda ausentes.

## Direção visual

- **Movimento:** dashboard cartográfico de operações, com disciplina suíça/industrial e referências discretas ao campo.
- **Princípios:** leitura imediata; mapa como instrumento central; densidade controlada; incompletudes claramente assinaladas.
- **Paleta:** azul-marinho para navegação/confiança; branco e cinzas frios para legibilidade; verde profundo como cor de marca/território; âmbar para dados aproximados; vermelho para falhas.
- **Layout:** barra superior compacta, métricas horizontais, canvas cartográfico amplo e painéis laterais; em telas pequenas, painéis empilhados/gavetas.
- **Elementos-assinatura:** rotas em verde territorial; círculos de raio translúcidos; chips de qualidade/coordenada.
- **Interação/animação:** filtros sem recarga, seleção que centraliza/realça, transições discretas de 150–220 ms, sem movimento contínuo.
- **Tipografia:** DM Sans para interface e Manrope para títulos/valores, com hierarquia curta, contraste legível e valores tabulares. Na ficha de atendimento, rótulos, localidades e notas devem permanecer legíveis em telas estreitas, sem microtexto.
- **Essência da marca:** “AgroScope — visão territorial clara para coordenar equipes, fazendas e atendimento”; personalidade objetiva, confiável e prática.
- **Tom de voz:** direto e operacional. Exemplos: “Equipe no território, em um só mapa.”; “Rota estimada até o destino — confira a qualidade da coordenada.”
- **Marca/logotipo:** manter o pin geométrico combinado a linhas de talhão/rota, junto ao wordmark “AgroScope”.
- **Cor-assinatura:** verde territorial `#197A5B`.

## Estrutura do projeto

- `src/data/`: tipos, parsers/validações, adaptador do CSV público, cliente Google Sheets API/Picker e métricas privadas.
- `src/components/`: barra de navegação/filtros, indicadores, lista/equipe, painel de detalhes, login Google, Picker e painéis do HTML legado.
- `src/lib/`: geocodificação/roteamento ORS, cache de sessão, formatação pt-BR e utilitários de autorização/token em memória.
- `public/`: favicon SVG, ícones e manifesto estático `manus-routes.json`.
- `scripts/`: dados controlados/anônimos de demonstração e geração da aba pública; nunca copiar a planilha bruta ou credenciais para o repositório.
- raiz: `plan.md`, `TODO.md`, package/lockfile pnpm, Vite/TypeScript, build `docs/` para GitHub Pages e configuração OAuth pública sem client secret.

## Dependências e operação

React/TypeScript/Vite, Leaflet/react-leaflet e PapaParse são usados no frontend. Google Identity Services autentica o usuário; Google Picker com `drive.file` limita a autorização aos arquivos escolhidos; Google Sheets API lê os dados após autorização. Google Sheets fornece os registros privados e a saída curada; OpenStreetMap fornece tiles; ORS fornece geocodificação e rotas sob demanda. O build `build:pages` gera `docs/` para branch `main`/pasta `/docs`; o bundle não contém dados privados. OAuth Client ID e Picker API key são públicos, sujeitos a restrições por origem/API. A chave ORS aparece no bundle compilado conforme autorização explícita do usuário. A aba pública é derivada por fórmula da aba `Projetos`; o site consulta o CSV publicado somente dessa aba.

## Política de privacidade pública

- Publicar `https://neton08.github.io/AgroScope/privacy.html` com a política aprovada pelo usuário e o contato `alcneto08@gmail.com`; a página inicial continua em `https://neton08.github.io/AgroScope/`.
- Informar que o usuário entra com Google e seleciona uma planilha no Picker; a aplicação lê e mostra dados no navegador sem armazená-los em servidor AgroScope; o acesso à base privada depende das permissões do Google Drive; o site público mostra somente `PAINEL_PUBLICO`; coordenadas usadas para calcular rotas são enviadas ao OpenRouteService; solicitações de privacidade podem ser encaminhadas ao e-mail de suporte.
- Disponibilizar um link para a política na página inicial e na tela de login; manter a página como HTML estático acessível sem autenticação, com título, descrição e URL canônica, sem incluir dados privados.
