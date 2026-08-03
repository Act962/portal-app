# Architecture Decision Records (ADRs)

Um ADR registra **uma decisão arquitetural relevante**: o contexto em que foi tomada, as
alternativas consideradas, a escolha e suas consequências.

## Por que mantemos ADRs

Em um projeto de anos, o custo maior não é decidir — é o desenvolvedor que chega em 2028, não
entende **por que** algo foi feito daquele jeito, e "conserta" o que não estava quebrado.
Código mostra *o que* o sistema faz; o ADR mostra *por que* ele é assim.

Um ADR não é apagado nem reescrito quando a decisão muda. Ele é marcado como **Substituído** e um
novo ADR é criado, referenciando o anterior. O histórico do raciocínio é o valor.

## Quando escrever um ADR

Escreva quando a decisão for **cara de reverter** ou **não óbvia** para quem chega depois:

- Escolha ou troca de tecnologia estrutural (banco, framework, provedor)
- Padrão arquitetural adotado (camadas, comunicação entre contextos, eventos)
- Decisão de modelagem com efeito amplo (formato do conteúdo, estratégia de identificadores)
- Trade-off deliberado (aceitar duplicação, abrir mão de consistência forte)

**Não** escreva ADR para escolha de biblioteca pequena, formatação de código ou detalhe de
implementação local — isso vive no próprio código.

## Formato

Arquivo `NNNN-titulo-em-kebab-case.md`, numeração sequencial, nunca reaproveitada.

```markdown
# NNNN — Título da decisão

- **Status:** Proposto | Aceito | Substituído por [NNNN](./NNNN-...md) | Descontinuado
- **Data:** AAAA-MM-DD
- **Decisores:** quem participou

## Contexto
Qual problema ou força motivou a decisão. Fatos, não opinião.

## Alternativas consideradas
O que foi avaliado e por que foi descartado. Esta seção é a que mais envelhece bem.

## Decisão
O que foi decidido, de forma direta.

## Consequências
O que passa a ser mais fácil, o que passa a ser mais difícil, e o que fica para monitorar.
Inclui as consequências negativas aceitas conscientemente.
```

## ADRs previstos

Serão escritos no início da **Fase 0**, quando a implementação começar. As decisões em si já estão
tomadas e justificadas em `../stack.md` e `../architecture.md`; os ADRs as formalizam no formato
acima.

| # | Título | Referência |
|---|---|---|
| `0001` | Monólito modular em vez de microsserviços | `architecture.md` §1 |
| `0002` | PostgreSQL como banco principal (migração a partir do MongoDB do scaffold) | `stack.md` Decisão 1 |
| `0003` | Corpo da matéria em blocos JSON em vez de HTML | `stack.md` Decisão 5 |
| `0004` | Autorização como domínio, não como middleware | `architecture.md` §2.3 |
| `0005` | Outbox transacional para eventos de domínio | `architecture.md` §5 |
| `0006` | Busca atrás de porta: Postgres full-text no MVP, Meilisearch depois | `stack.md` Decisão 2 |
| `0007` | Inngest para jobs em background e despacho de eventos | `stack.md` Decisão 6 |
| `0008` | Docker Compose como ambiente de desenvolvimento padrão | `stack.md` Decisão 4a |
