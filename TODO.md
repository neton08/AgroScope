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

## Fonte de dados e Google Planilhas — em andamento
- Usar as informações do anexo `PROJETOSGERENCIA.xlsx`, normalizadas sem alterar os dados de registro; a aba `Projetos` contém gestores, regionais, colaboradores, base, clientes/fazendas, cidade, coordenadas, métricas e serviços.
- Hospedar a fonte completa no Google Planilhas para edição compartilhativa e automatizar a leitura pelo site.
- Expor ao site somente a planilha derivada `PAINEL_PUBLICO`, pública para leitura e com 22 campos expressamente autorizados: nomes de colaboradores, gestores e regionais; clientes, fazendas/unidades e cidades atendidas; coordenadas existentes de base e fazenda; distância cadastrada, raio, rota e tempo estimado; área em hectares e indicadores de serviço/unidades, incluindo ponto focal de campo. Essa saída guarda valores curados, sem fórmula nem ID da base editável.
- Não mostrar no painel público e-mails, telefones, responsáveis fiscais/financeiros, IDs internos, ARR, valores de contrato, datas/vigência, logins/chaves SGPA ou outras colunas não autorizadas. As permissões da planilha completa são independentes da saída pública; o site nunca deve embutir um link privado de edição.
- Tratar campos ausentes claramente; nunca inventar coordenadas exatas.
- Progresso: existe uma base operacional no Google Planilhas e uma planilha pública derivada com 191 registros e os 22 campos autorizados. Um colaborador sem unidade continua aparecendo com zero unidades sem inflar o total. O Apps Script e o código do sincronizador estão salvos, mas a execução/acionador de 15 minutos ainda depende de confirmar a autorização e verificar um acionador instalado; até lá, o painel identifica o snapshot e permite atualização manual.
- O anexo reenviado possui uma aba `Projetos` com 191 linhas preenchidas e 43 colunas e uma aba `Contato Clientes Pesquisas NPS` com 293 linhas e 7 colunas; a aba `Orientação` está vazia. A aba de contatos contém dados pessoais e permanece privada. A base `Projetos` online também tem 191 linhas e as mesmas 43 colunas, porém cinco projetos não coincidem pela chave de colaborador/cliente/fazenda/cidade e vários valores de campos operacionais diferem. Não substituir nem mesclar a base até o usuário indicar qual versão é a fonte correta.
- O usuário pediu “Quero colocar uma trava na planilha também, onde somente eu posso excluí-la, mas a edição apenas com quem possui autorização.” Restringir o acesso a pessoas autorizadas e manter a propriedade sob controle do usuário; a execução da mudança depende da lista de e-mails Google ou do Google Group a manter como editores. Manter a URL/identificador da base fora do repositório público; se solicitado, proteger abas/intervalos contra exclusão acidental de conteúdo.
- O usuário pediu: “Podemos deixar uma única base para as duas.” Proposta pendente: uma única planilha com abas operacionais privadas e uma aba curada `PAINEL_PUBLICO`, publicando só essa aba. Não publicar contatos, finanças, credenciais ou IDs internos na versão aberta sem autorização específica.

## Publicação pública gratuita no GitHub — concluída
- Deixar o site online no GitHub Pages gratuito, com código e somente os dados/campos que o usuário autorizou exibir no painel.
- Integrar a leitura do site à planilha derivada pública sem incluir as colunas privadas da fonte completa no bundle.
- Manter a experiência utilizável em desktop e celular, comunicando carregamento, erros e dados ausentes.
- O repositório AgroScope está público e o GitHub Pages publica a branch `main`, pasta `/docs`; a URL pública respondeu HTTP 200. A chave ORS está no bundle compilado conforme autorização explícita do usuário.

## Marca e legibilidade — em andamento
- O usuário informou: “Essa aba ficou com as letras pequenas.” Aumentar a tipografia do painel de detalhes, em especial rótulos, localidades, distâncias, indicadores de serviço e notas; preservar quebra de texto e navegação em telas estreitas.
- O usuário pediu: “Mude o nome onde está Gestão de Atuação para AgroScope.” Atualizar o nome visível, título do navegador, metadados, favicon acessível e manifesto de rotas; manter a identidade visual cartográfica aprovada.

## Integração do HTML legado e consolidação da base — aguardando decisões do usuário
- O usuário pediu: “Também gostaria de deixar esse html que está em anexo junto a esse site que criamos agora, é possível fazer isso?” e “A planilha que iremos utilizar é a mesma, só que com mais informações, vou anexá-la novamente.” Reaproveitar no AgroScope os recursos úteis do HTML antigo como componentes React, conectados à mesma fonte de dados; não duplicar a aplicação nem usar importação local como sincronização.
- O HTML legado inclui visão geral, fila de atenção, pulso da operação, indicadores por gestor, análises de ARR e valores/vencimentos contratuais, filtros e tabela. O site público permanece limitado aos campos autorizados; definir com o usuário quais novos campos operacionais serão exibidos. Dados financeiros, contatos, logins, chaves e identificadores internos ficam privados; exibi-los exigiria uma interface privada autenticada e backend, não apenas esconder elementos no site estático.
- Aguardar a decisão do usuário sobre usar o anexo para substituir os dados atuais de `Projetos` ou reconciliar diferenças antes. Aguardar também a lista de editores autorizados e a confirmação dos campos adicionais do site.
