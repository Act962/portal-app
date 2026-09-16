# Ajustes de capa e proteção de mídia

Escopo autorizado pelo cliente em 16/09/2026.

- Recusar exclusão individual e em lote de mídia referenciada na capa ou em blocos de imagem de qualquer matéria, incluindo rascunhos e arquivadas. A proteção existente em `MediaUsage` continua aplicada pelo servidor antes de remover o registro ou arquivo.
- No cartão de capa do editor, abrir um diálogo amplo com a imagem inteira, seleção em 16:9, máscara escura fora do recorte e grade de composição. Arrastar a seleção reposiciona; arrastar as quatro alças de canto redimensiona mantendo a proporção (ampliação de 1× a 3×). Mouse, toque e ajustes por teclado suportados. A barra de ações informa as dimensões finais.
- Cancelar descarta os ajustes; redefinir centraliza e remove a ampliação.
- Aplicar gera uma nova mídia JPEG no servidor, com os metadados de autoria e acessibilidade do original, e seleciona essa mídia como capa pelo autosave existente. O arquivo original e suas referências permanecem preservados.
- Falha no processamento ou upload mantém a capa selecionada e apresenta uma mensagem de erro.

Validação: testes de geometria do recorte e testes existentes de exclusão individual/em lote de mídia em uso; checagem de tipos e arquitetura.
