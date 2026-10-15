# Entregas do painel Gestão de Atuação

## Mapa, filtros e visão geral — em andamento
- Reconstruir a web para gerenciar a equipe, mostrando a localidade da equipe/base e a localidade das fazendas atendidas por cada colaborador.
- Mostrar rota de atendimento, raio de atendimento e quantidade de unidades atendidas por colaborador.
- Usar a captura fornecida como referência de consulta: barra de controles, seletores de gestor e especialista/colaborador, opções de exibição de bases/especialistas, fazendas, rotas e áreas/raios, comando para resetar filtros, indicadores de unidades atendidas, especialistas e distância média, opções de camadas do mapa e legenda.
- Modernizar a interface para apresentar informações claras; filtros, mapa, listagem e indicadores refletem a mesma seleção.
- Incluir cobertura por regional/gestor e qualidade/completude das coordenadas, sem inventar valores ausentes.
- A fonte não tem coluna `CIDADE BASE`: exibe `REGIONAL` e coordenada exata da base; quando ORS reverse geocoding confirmar município no Brasil, mostrar a localidade derivada como aproximada. Ao buscar fazenda sem coordenada, reconhecer UFs isoladas e nomes completos de estado e extraí-las também do sufixo de `CIDADE`; confirmar que resultado Pelias corresponde ao mesmo UF. Distinguir município não confirmado de chave inválida, cota excedida ou serviço indisponível; se não confirmar, manter regional e coordenada.

## Detalhe de colaborador, fazenda e deslocamento — em andamento
- Ao clicar no colaborador/projeto/fazenda, abrir popup ou painel com a distância que ele percorre da base até o projeto e o tempo estimado de viagem.
- Mostrar rota no mapa e distinguir a distância cadastrada na planilha da distância rodoviária calculada.
- Exibir base, fazenda/unidade, cidade atendida, raio de atuação, hectares e indicadores de serviço/unidades disponíveis.
- Identificar distância/tempo/rota como estimativas, sem declarar tráfego em tempo real. Se não houver coordenadas exatas da fazenda, não apresentá-las como se existissem: usar estimativa até o centro da cidade apenas quando houver localização inequívoca e sinalizá-la; caso contrário, informar que não há coordenada suficiente para calcular.
- O usuário escolheu OpenRouteService gratuito e aceitou a chave visível no JavaScript publicado e a cota consultada de direções (2.000/dia e 40/minuto). Calcular sob demanda, usar cache e informar erros/limites.

## Fonte de dados e Google Planilhas — em andamento
- Usar as informações do anexo `PROJETOSGERENCIA.xlsx`, normalizadas sem alterar os dados de registro; fonte original possui a aba `Projetos` com gestores, regionais, colaboradores, base, clientes/fazendas, cidade, coordenadas, métricas e serviços.
- Hospedar a fonte completa no Google Planilhas para edição compartilhativa e automatizar a leitura pelo site.
- O usuário escolheu explicitamente que **qualquer pessoa com o link pode editar a planilha completa**. A permissão aplicada é `anyone/writer`, `allowFileDiscovery=false`. A planilha completa contém colunas de contato/identificação/credenciais que não serão exibidas no painel público. Para não distribuir o link de edição a todo visitante do site, o aplicativo público não terá link para a fonte completa; o link será entregue diretamente ao usuário.
- Expor ao site somente a planilha derivada `PAINEL_PUBLICO`, pública para leitura e com 22 campos expressamente autorizados: nomes de colaboradores, gestores e regionais; clientes, fazendas/unidades e cidades atendidas; coordenadas existentes de base e fazenda; distância cadastrada, raio, rota e tempo estimado; área em hectares e indicadores de serviço/unidades, incluindo ponto focal de campo. Essa saída guarda **valores curados**, sem fórmula nem ID da planilha completa. O sincronizador está escrito, mas sua execução/acionador ainda depende da autorização Google descrita abaixo; sem ela, o painel deve indicar snapshot e atualização manual, sem prometer sincronização automática.
- Não mostrar no painel público e-mails, telefones, responsáveis fiscais/financeiros, IDs internos, ARR, valores de contrato, datas/vigência, logins/chaves SGPA ou outras colunas não autorizadas. O usuário concedeu edição pública por link à fonte completa separadamente; a interface do site continua limitada aos campos curados.
- Tratar campos ausentes claramente; nunca inventar coordenadas exatas.
- Progresso: Excel copiado para Google Sheets como “Gestão de Atuação — Base operacional”; permissão `anyone/writer` por link aplicada após confirmação explícita. A planilha derivada “Gestão de Atuação — PAINEL_PUBLICO” está compartilhada como leitora e contém 22 campos de valores, incluindo ponto focal. A saída contém 191 registros; 190 estão vinculados a cliente/fazenda/unidade e um registra colaborador sem unidade. Esse colaborador deve aparecer com zero unidades sem inflar o total. O Apps Script privado e o código do sincronizador estão salvos; o primeiro consentimento foi interrompido. Ainda não há acionador nem sincronização programada. O usuário informou que concederá a autorização de conta pelo Google e avisará quando terminar; até lá, a aplicação lê o snapshot público atual e o rotula como atualização manual.

## Publicação pública gratuita no GitHub — pendente
- Deixar o site online no GitHub Pages gratuito, com código e somente os dados/campos que o usuário autorizou exibir no painel.
- Integrar a leitura do site à planilha derivada pública sem incluir as colunas privadas da fonte completa no bundle.
- Manter a experiência utilizável em desktop e celular, comunicando carregamento, erros e dados ausentes.
- O GitHub Free exige repositório público para Pages; o fluxo canônico WebDev cria um repositório privado e não aceita configurar visibilidade. A etapa de Pages dependerá de mudar a visibilidade para pública e habilitar Pages em `main`/`docs`. A chave ORS estará no bundle compilado e isso foi aceito pelo usuário.
