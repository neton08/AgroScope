# AgroScope

Painel público para consulta territorial da equipe e dos atendimentos a fazendas. A aplicação estática lê somente os 22 campos curados da planilha `PAINEL_PUBLICO`; a planilha operacional completa não é carregada pelo navegador e seu link de edição não faz parte do site.

## Desenvolvimento

```bash
pnpm install --frozen-lockfile
pnpm dev
```

O painel fica disponível em `http://localhost:3000`.

## Build para GitHub Pages

O site é estático e gera os arquivos em `docs/`, compatíveis com Pages em `main` + `/docs`:

```bash
OPENROUTESERVICE_API_KEY=<sua-chave> pnpm run build:pages
```

O bundle publicado inclui a chave ORS no JavaScript do navegador — ela é pública, pode consumir a cota gratuita e foi aprovada para este painel. Restrinja a chave ao domínio do site e aos endpoints necessários sempre que as opções da conta ORS permitirem. Não grave a chave em arquivos versionados.

Para ativar GitHub Pages, o repositório precisa ser público no GitHub Free. Nas configurações do repositório, habilite Pages para `Deploy from a branch`, branch `main`, pasta `/docs`.

## Dados e atualização

- A interface consome apenas a saída de leitura `PAINEL_PUBLICO` do Google Planilhas.
- O snapshot público contém valores curados, não fórmula que revele o ID da base completa.
- A fonte original contém mais informações e não é buscada pela aplicação. Compartilhe o link editável da fonte somente com quem deve receber acesso.
- A sincronização programada depende da autorização Google do projeto Apps Script e da criação do acionador. Até a autorização e ativação serem confirmadas, a saída pública permanece snapshot e o botão **Atualizar dados** refaz a consulta manual.
- Rotas e localidades são estimativas feitas sob demanda pelo OpenRouteService. O mapa base atribui os dados ao OpenStreetMap.
