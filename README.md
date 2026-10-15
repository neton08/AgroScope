# AgroScope

Painel territorial para gestão de atendimento agrícola. O GitHub Pages apresenta o mapa público com os campos aprovados; a área de gestores usa Google Sign-In e só lê a planilha depois que a pessoa escolhe o arquivo no Google Drive e a conta possui permissão nele.

## Privacidade e fonte de dados

- O workbook operacional contém as abas privadas `Projetos` e `Contato Clientes Pesquisas NPS`, além de `Orientação`; a aba `PAINEL_PUBLICO` é uma projeção dos 22 campos liberados para o resumo aberto.
- A versão pública do site nunca busca nem empacota contatos, dados financeiros, logins, chaves ou identificadores técnicos da base. A chave ORS é a única exceção previamente autorizada para inclusão no bundle.
- A área de gestores usa Google Identity Services, Google Picker e Sheets API no navegador, com escopo `drive.file`. O token OAuth permanece somente em memória; após a seleção do workbook, o navegador solicita do Google apenas as colunas permitidas para o painel. A aba `Projetos` não envia valores das colunas de e-mail, telefone, IDs, logins ou chaves técnicas ao navegador. O arquivo não é enviado ao servidor do site nem salvo no repositório.
- Compartilhe o workbook somente com contas Google autorizadas. Quem não tiver permissão no arquivo não poderá ler suas abas, mesmo conhecendo o endereço do site. A seleção de uma planilha no Picker não concede acesso adicional.
- E-mails, telefones, ARR e dados contratuais aparecem somente dentro da sessão autorizada. Senhas, logins, tokens, chaves SGPA e IDs técnicos não são exibidos.

## Configurar Google Sign-In e Google Picker

Os valores abaixo são identificadores/chaves de frontend e aparecem no JavaScript publicado; **não use client secret** no site estático. Restrinja-os na Google Cloud Console.

1. Em um projeto Google Cloud, habilite **Google Sheets API** e **Google Picker API** e configure a tela de consentimento OAuth para as contas dos gestores.
2. Crie um **OAuth Client ID** do tipo **Web application**. Adicione como origens JavaScript autorizadas `https://neton08.github.io` e, para desenvolvimento, `http://localhost:3000` — informe somente as origens, sem caminho `/AgroScope/`.
3. Crie uma API key para o Picker. Restrinja-a a HTTP referrers `https://neton08.github.io/*`, `http://localhost:3000/*` e `https://docs.google.com/*` (necessário porque o Picker é exibido dentro de um iframe do Google); limite as APIs habilitadas à **Google Picker API**.
4. Anote o número do projeto Google Cloud — não o Client ID — para `VITE_GOOGLE_APP_ID`.
5. Copie `.env.example` para `.env.local` e preencha `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_PICKER_API_KEY`, `VITE_GOOGLE_APP_ID` e `OPENROUTESERVICE_API_KEY`. `.env.local` é ignorado pelo Git. Não crie nem compartilhe um client secret; este app não usa um.
6. Faça o build do Pages localmente com essas variáveis no ambiente e envie a nova saída `docs/` para a branch `main`. Os valores OAuth/Picker são identificadores públicos, mas devem permanecer restritos às origens e APIs indicadas.

Depois de entrar, escolha no Picker a planilha AgroScope. Cada gestor precisa ter acesso explícito a esse mesmo arquivo antes de selecioná-lo. Se o app OAuth estiver em modo de teste, inclua as contas Google dos gestores entre os usuários de teste.

## Desenvolvimento local

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# preencha os valores Google/ORS em .env.local
pnpm dev
```

O painel fica disponível em `http://localhost:3000`.

## Build para GitHub Pages

O site estático gera os arquivos em `docs/`, compatíveis com Pages em `main` + `/docs`:

```bash
GITHUB_PAGES_BUILD=1 pnpm run build
```

O repositório precisa ser público no GitHub Free para usar Pages. Nas configurações do repositório, selecione **Deploy from a branch**, branch `main`, pasta `/docs`.

A chave ORS incluída no bundle é pública, pode consumir a cota gratuita e foi autorizada pelo usuário. Restrinja-a às origens/endpoints necessários sempre que a conta ORS oferecer essa opção. Nunca coloque dados da planilha, tokens de usuário, client secrets ou chaves privadas em `docs/`.

## Publicar a aba pública no Google Planilhas

A saída do workbook operacional único deve ser publicada como CSV **somente** da aba `PAINEL_PUBLICO`:

1. No Google Planilhas, abra o workbook AgroScope.
2. Use **Arquivo → Compartilhar → Publicar na Web**.
3. No seletor, escolha a aba `PAINEL_PUBLICO`, e não `Documento inteiro`.
4. Publique em CSV. O link gerado é de leitura pública; ele não concede edição.
5. Teste o link e confirme que ele retorna apenas os 22 campos públicos. Configure essa URL como `VITE_PUBLIC_SHEET_CSV_URL` antes de trocar a fonte do mapa público.

Mantenha o acesso geral do workbook como **Restrito** e compartilhe o arquivo completo somente com pessoas autorizadas. Publicar uma aba é diferente de disponibilizar o documento inteiro. **Não publique o documento inteiro**, pois isso revelaria as abas privadas.

## Dados e atualização

- O site público consulta somente a saída `PAINEL_PUBLICO`; o botão **Atualizar dados** refaz a consulta manual.
- A aba derivada usa uma fórmula que projeta apenas colunas permitidas da aba `Projetos`. Alterações na base recalculam a projeção; o Google pode levar alguns minutos para refletir o conteúdo publicado.
- O projeto Apps Script antigo não é necessário para este fluxo; não autorize nem instale o trigger antigo `syncPublicData` para atualizar a aba pública.
- Rotas e localidades são estimativas feitas sob demanda pelo OpenRouteService. O mapa base atribui os dados ao OpenStreetMap.
