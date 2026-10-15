# Atualização da aba pública

A base operacional única do AgroScope contém a aba privada `Projetos` e a aba derivada `PAINEL_PUBLICO`. Esta última projeta apenas os 22 campos aprovados por fórmula; não é necessário copiar os registros com um Apps Script nem instalar um acionador de 15 minutos. Quando alguém autorizado altera `Projetos`, o Google Planilhas recalcula a projeção. A publicação do Google pode levar alguns minutos para refletir as alterações.

O projeto Apps Script criado anteriormente fica como legado e **não é necessário autorizar nem executar `syncPublicData` para o fluxo atual**. Não o use para substituir a fórmula ou publicar a planilha inteira. Mantenha a aba `PAINEL_PUBLICO` protegida contra edição manual e publique somente essa aba; as demais abas devem continuar restritas às contas autorizadas.

A aplicação pública lê a URL CSV da aba curada configurada em `VITE_PUBLIC_SHEET_CSV_URL`. Até que a nova aba seja publicada e testada, o build mantém o snapshot público anterior. O painel privado seleciona o workbook pelo Google Picker e lê `Projetos`/`Contato Clientes Pesquisas NPS` após consentimento Google; os dados e access tokens não são gravados no site.

Não grave planilhas brutas, contatos, dados financeiros, tokens, client secrets, senhas, chaves SGPA ou credenciais em `scripts/`, no repositório público ou em builds estáticos. Use somente dados sintéticos em testes locais.
