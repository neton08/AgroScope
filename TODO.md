# Entregas do painel AgroScope

## Mapa, filtros e visão geral — concluído
- Reconstruir a web para gerenciar a equipe, mostrando a localidade da equipe/base e a localidade das fazendas atendidas por cada colaborador.
- Mostrar rota de atendimento, raio de atendimento e quantidade de unidades atendidas por colaborador.
- Usar a captura fornecida como referência de consulta: barra de controles, seletores de gestor e especialista/colaborador, opções de exibição de bases/especialistas, fazendas, rotas e áreas/raios, comando para resetar filtros, indicadores de unidades atendidas, especialistas e distância média, opções de camadas do mapa e legenda.
- Modernizar a interface para apresentar informações claras; filtros, mapa, listagem e indicadores refletem a mesma seleção.
- Incluir cobertura por regional/gestor e qualidade/completude das coordenadas, sem inventar valores ausentes.
- A fonte não tem coluna `CIDADE BASE`: exibe `REGIONAL` e coordenada exata da base; quando ORS reverse geocoding confirmar município no Brasil, mostrar a localidade derivada como aproximada. Ao buscar fazenda sem coordenada, reconhecer UFs isoladas e nomes completos de estado e extraí-las também do sufixo de `CIDADE`; confirmar que resultado Pelias corresponde ao mesmo UF. Distinguir município não confirmado de chave inválida, cota excedida ou serviço indisponível; se não confirmar, manter regional e coordenada.

## Detalhe de colaborador, fazenda e deslocamento — concluído
- Ao clicar no colaborador/projeto/fazenda, abrir popup ou painel com a distância que ele percorre da base até o projeto e o tempo estimado de viagem.
- Mostrar rota no mapa e distinguir a distância cadastrada na planilha da distância rodoviária calculada.
- Exibir base, fazenda/unidade, cidade atendida, raio de atuação, hectares e indicadores de serviço/unidades disponíveis.
- Identificar distância/tempo/rota como estimativas, sem declarar tráfego em tempo real. Se não houver coordenadas exatas da fazenda, não apresentá-las como se existissem: usar estimativa até o centro da cidade apenas quando houver localização inequívoca e sinalizá-la; caso contrário, informar que não há coordenada suficiente para calcular.
- O usuário escolheu OpenRouteService gratuito e aceitou a chave visível no JavaScript publicado e a cota consultada de direções (2.000/dia e 40/minuto). Calcular sob demanda, usar cache e informar erros/limites.

## Fonte única Google Planilhas e permissões — em andamento
- O usuário confirmou `PROJETOSGERENCIA.xlsx` como fonte de verdade: usar exatamente o conjunto de dados e manter todas as informações/abas para uso privado por ele e pelos gestores, sem mesclar com o snapshot online divergente.
- A planilha operacional única deverá conter `Projetos`, `Contato Clientes Pesquisas NPS` e `Orientação` (aba vazia no anexo), além de `PAINEL_PUBLICO` como aba derivada. O anexo possui 191 linhas preenchidas e 43 colunas em `Projetos`, 293 linhas e 7 colunas em `Contato Clientes Pesquisas NPS`; essas abas privadas não serão adicionadas ao bundle público.
- Expor publicamente somente `PAINEL_PUBLICO`, contendo os 22 campos autorizados: nomes de colaboradores, gestores e regionais; clientes, fazendas/unidades e cidades atendidas; coordenadas existentes de base e fazenda; distância cadastrada, raio, rota e tempo estimado; área em hectares e indicadores de serviço/unidades, incluindo ponto focal de campo. Publicar só essa aba não deve liberar edição nem acesso público às demais abas.
- Não mostrar no painel público e-mails, telefones, responsáveis fiscais/financeiros, IDs internos, ARR, valores/datas de contrato, logins/chaves SGPA ou outras colunas não autorizadas. No painel privado, permitir os campos de negócio usados pelo HTML legado após autenticação; nunca mostrar senhas, logins, tokens, chaves ou identificadores técnicos.
- Campos ausentes exibem “Não informado”; nunca inventar coordenadas exatas. Um colaborador sem unidade continua aparecendo com zero unidades sem inflar métricas de unidades, área, distância média ou coordenadas ausentes.
- O usuário pediu que somente ele possa excluir a planilha e que a edição seja feita apenas por pessoas autorizadas. Compartilhar com e-mails Google ou um Google Group nomeado; não usar “qualquer pessoa com o link pode editar”. A lista de gestores autorizados ainda não foi informada; até recebê-la, não conceder acesso a novos editores.
- A planilha pertence ao usuário. Cópias de segurança anteriores permanecem privadas; a fonte operacional completa não deve ser versionada no repositório público.

## Painel privado, login Google e integração do HTML — em andamento
- O usuário escolheu “Google Sign-In — gestores usarão contas Google” e confirmou uma versão privada para consultar mais informações. Implementar uma ação de login Google no site e carregar as abas privadas somente depois de o usuário autenticar e autorizar o arquivo no Google Picker; usar o escopo de menor privilégio `drive.file`, sem persistir access tokens em `localStorage`.
- Se a conta Google não tiver permissão no arquivo selecionado, mostrar erro de acesso e não retornar nem renderizar os dados privados. O site e o código podem continuar públicos no GitHub Pages, mas o bundle não contém dados da planilha nem credenciais; a autorização Google e as permissões da planilha controlam o acesso aos registros.
- Reaproveitar no AgroScope recursos do HTML legado — visão geral, fila de atenção, pulso da operação, indicadores por gestor, análises de status/contratos, filtros e tabela — como componentes integrados à aplicação React e conectados à mesma planilha, não como HTML independente.
- Incluir dados empresariais e de contato/contratos do HTML legado somente dentro da sessão autorizada. Excluir logins, senhas, tokens, chaves SGPA e IDs técnicos mesmo da experiência privada.
- Login e acesso ao painel não devem depender de importar Excel manualmente nem deixar cópias de dados no navegador após sair. Logout limpa o token em memória.
- A configuração do OAuth Client ID, Google Picker/API key, origem autorizada e e-mails dos gestores ainda precisa ser concluída.

## Atualização da aba pública — em andamento
- `PAINEL_PUBLICO` foi criada dentro da planilha operacional única como projeção por fórmula dos campos públicos aprovados. Alterações em `Projetos` recalculam a projeção; o Google pode levar alguns minutos para refletir a saída publicada.
- O site ainda consulta o snapshot público anterior. Trocar a fonte somente após o proprietário publicar em CSV **apenas** a aba `PAINEL_PUBLICO`, testar que a resposta contém somente os 22 campos liberados e configurar `VITE_PUBLIC_SHEET_CSV_URL` no build do Pages.
- O Apps Script e o acionador de 15 minutos preparados anteriormente não são necessários para este fluxo; não autorizar nem executar `syncPublicData` para atualizar a projeção. O botão **Atualizar dados** consulta novamente a fonte pública disponível.

## Publicação pública gratuita no GitHub — concluído
- Deixar o resumo público online no GitHub Pages gratuito, branch `main`, pasta `/docs`, com somente os campos que o usuário autorizou exibir.
- Integrar a leitura do site à aba pública curada sem incluir as colunas privadas da fonte completa no bundle.
- O repositório AgroScope está público e o GitHub Pages publica a branch `main`, pasta `/docs`; a URL pública respondeu HTTP 200.
- A chave ORS pode estar no bundle compilado conforme autorização explícita do usuário; client secret OAuth, API key restrita, dados da planilha e tokens não devem ser embutidos.

## Marca e legibilidade — concluído
- O usuário informou: “Essa aba ficou com as letras pequenas.” A tipografia do painel de detalhes foi aumentada, com rótulos, localidades, distâncias, indicadores de serviço e notas mais legíveis, preservando a responsividade.
- O usuário pediu: “Mude o nome onde está Gestão de Atuação para AgroScope.” Nome visível, título do navegador, metadados, favicon acessível, README e manifesto foram atualizados; o novo build foi enviado ao GitHub Pages.
