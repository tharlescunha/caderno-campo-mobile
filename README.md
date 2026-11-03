# Caderno de Campo — app (Expo / React Native)

App do celular (offline primeiro). Veja `docs/plano-de-desenvolvimento.md`, `docs/telas.md` e `docs/offline.md`.

## Rodar no iPhone (Expo Go)

```
npm install
npx expo start --clear
```

Abra o app **Expo Go** no iPhone (mesmo Wi‑Fi do computador) e leia o QR code que aparece no terminal.
Cada arquivo salvo atualiza o app na hora.

## Estrutura

- `app/` — telas (Expo Router). `app/(tabs)/` são as 6 abas: Hoje, Agenda, Relatórios, Notas, Matérias, Mercado.
- `src/theme/` — cores e fontes da marca (claro/escuro, segue o aparelho).
- `src/components/` — ícones e componentes comuns (cartão, chip, botão, estado vazio).

## Observações

- `.npmrc` tem `legacy-peer-deps=true` porque o `expo-router` tem um conflito de versões de pacotes de interface que o npm recusa.
- A tela **Hoje** usa dados de exemplo; os dados reais chegam na etapa 2.4.
