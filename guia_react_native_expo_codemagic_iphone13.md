# Guia completo: desenvolver com React Native + Expo, compilar IPA no Codemagic e instalar no iPhone 13

**Objetivo:** desenvolver no Windows 11, testar durante o desenvolvimento no iPhone 13 com Expo Go, compilar um aplicativo iOS independente na nuvem com Codemagic, baixar o arquivo `.ipa` e instalá-lo no iPhone usando um Apple ID gratuito e uma ferramenta de sideload no Windows.

> **Escopo e premissas**
>
> - O projeto é React Native com Expo (não um site/PWA).
> - O computador de desenvolvimento é Windows 11, sem Mac físico.
> - O aparelho de destino é um iPhone 13.
> - O usuário não pretende contratar o Apple Developer Program neste momento.
> - O Codemagic será usado como ambiente macOS/Xcode remoto para compilar.
> - O fluxo de instalação particular será por sideload, não pela App Store.
>
> Este guia descreve o fluxo técnico. Limites de planos gratuitos, versões de ferramentas e regras de assinatura podem mudar. Confira os links oficiais antes de cada configuração.

---

## 1. Entenda os três artefatos diferentes

É importante não confundir estes itens:

1. **Expo Go:** aplicativo pronto, publicado pela Expo, instalado no iPhone. Ele carrega o código JavaScript do projeto durante o desenvolvimento. Não é o seu aplicativo final.
2. **Development Build:** uma versão nativa própria do seu aplicativo, com ferramentas de desenvolvimento e suporte a módulos nativos personalizados. É instalada no iPhone e pode se conectar ao servidor Metro.
3. **IPA de distribuição/instalação:** pacote do aplicativo iOS compilado. Para instalar no iPhone, ele precisa ter uma assinatura e um perfil de provisionamento aceitos pelo iOS. Um IPA não assinado não é instalável diretamente.

O fluxo deste documento usa Expo Go para o ciclo inicial de desenvolvimento e Codemagic para gerar o binário iOS. Como o objetivo é não pagar a assinatura Apple, a proposta é gerar um pacote sem assinatura no ambiente de build e fazer a assinatura pessoal no Windows com uma ferramenta de sideload compatível.

**Atenção:** a geração de um IPA sem assinatura e sua posterior assinatura com Apple ID gratuito é diferente do fluxo oficial de distribuição da Apple. O processo pode exigir ajustes conforme a versão do Xcode, Expo e da ferramenta de sideload.

## 2. Arquitetura do processo

```text
Windows 11
  ├─ Visual Studio Code
  ├─ Node.js (LTS)
  ├─ Git
  ├─ Projeto React Native + Expo
  └─ Expo CLI / Metro
        │
        ├── Rede local / QR Code
        ▼
iPhone 13
  └─ Expo Go (visualização durante desenvolvimento)

Código-fonte
  │
  ▼
GitHub (repositório privado ou público)
  │
  ▼
Codemagic (máquina macOS na nuvem)
  ├─ instala dependências Node
  ├─ gera projeto nativo iOS com Expo Prebuild
  ├─ instala CocoaPods
  ├─ compila com Xcode
  └─ empacota o aplicativo como IPA sem assinatura
        │
        ▼
Download do IPA no Windows
  │
  ▼
Sideloadly (ou ferramenta equivalente)
  ├─ autentica com Apple ID
  ├─ assina para uso pessoal
  └─ instala no iPhone 13
```

O notebook não precisa executar macOS, Xcode, KVM ou máquina virtual. O Xcode roda na infraestrutura macOS do Codemagic.

---

## 3. Preparar o iPhone 13

1. Atualize o iOS para uma versão compatível com a versão atual do Expo Go.
2. Abra a App Store no iPhone.
3. Pesquise por **Expo Go**.
4. Instale o aplicativo oficial publicado pela Expo.
5. Deixe o iPhone e o notebook conectados à mesma rede Wi-Fi durante os testes locais, quando possível.
6. Mantenha o iPhone desbloqueado durante a primeira conexão.

Link oficial: https://expo.dev/go

O Expo Go é suficiente para começar e testar APIs e bibliotecas incluídas no próprio Expo Go. Se o projeto passar a exigir módulos nativos que não estejam incluídos nele, será necessário criar um Development Build próprio.

---

## 4. Preparar o Windows 11

### 4.1 Instalar Node.js

1. Acesse https://nodejs.org/
2. Baixe a versão **LTS** para Windows.
3. Execute o instalador.
4. Mantenha a opção de adicionar Node ao `PATH`.
5. Conclua a instalação.
6. Feche e abra novamente o PowerShell.

Verifique:

```powershell
node --version
npm --version
```

Os comandos devem retornar números de versão. Se aparecer “comando não reconhecido”, reabra o terminal ou revise a instalação/PATH.

### 4.2 Instalar Git

1. Acesse https://git-scm.com/download/win
2. Baixe e instale o Git for Windows.
3. As opções padrão do instalador normalmente são suficientes.

Verifique:

```powershell
git --version
```

### 4.3 Instalar Visual Studio Code

1. Acesse https://code.visualstudio.com/
2. Baixe a versão para Windows.
3. Instale.
4. Abra o VS Code.
5. Instale as extensões:
   - ESLint
   - Prettier - Code formatter
   - Expo Tools (opcional, conforme disponibilidade)

### 4.4 Verificar o ambiente

Execute:

```powershell
node --version
npm --version
git --version
```

Não é necessário instalar Xcode no Windows. Também não é necessário instalar Android Studio se o objetivo imediato for testar no iPhone com Expo Go e compilar iOS na nuvem.

---

## 5. Criar o projeto React Native com Expo

Escolha uma pasta de projetos, por exemplo `C:\Projetos`.

```powershell
cd C:\Projetos
npx create-expo-app@latest MeuAplicativo
cd MeuAplicativo
```

O comando cria um projeto Expo com estrutura inicial. O template padrão pode mudar entre versões do Expo. Siga as instruções exibidas no terminal caso sejam diferentes.

Abra o projeto no VS Code:

```powershell
code .
```

Se o comando `code` não estiver disponível, abra o VS Code manualmente e selecione **File > Open Folder**.

### 5.1 Iniciar o servidor de desenvolvimento

No terminal integrado do VS Code:

```powershell
npx expo start
```

O Expo iniciará o Metro Bundler e exibirá um QR Code.

No iPhone:

1. Abra o aplicativo **Câmera** ou Expo Go.
2. Leia o QR Code exibido no terminal/navegador.
3. Se solicitado, abra o link no Expo Go.
4. Aguarde o carregamento do projeto.

Se o aparelho não conectar:
- confirme que notebook e iPhone estão na mesma rede Wi-Fi;
- desative temporariamente VPN apenas se isso for permitido e necessário;
- verifique se o firewall permite a comunicação do Node/Metro na rede privada;
- tente o modo túnel:

```powershell
npx expo start --tunnel
```

O modo túnel pode depender de serviços externos e ser mais lento. Não é necessário mantê-lo se a conexão local funcionar.

### 5.2 Testar alterações

Edite uma tela do projeto e salve. O Expo Go deve atualizar a interface usando Fast Refresh.

Esse ciclo permite desenvolver sem gerar um IPA a cada alteração.

### 5.3 Limites do Expo Go

Expo Go não é o aplicativo final e não permite incorporar qualquer módulo nativo arbitrário. Ele contém um conjunto pré-compilado de bibliotecas nativas.

Quando o projeto precisar de:
- módulo nativo que não esteja incluído no Expo Go;
- configuração nativa específica;
- extensão nativa própria;
- comportamento que exija um binário personalizado;

será necessário criar um **Development Build** do próprio aplicativo. Esse build é diferente do IPA de produção e também precisa ser instalado/assinado no iPhone.

Documentação: https://docs.expo.dev/develop/development-builds/introduction/

---

## 6. Configurar a identidade do aplicativo

Abra `app.json` (ou `app.config.js`/`app.config.ts`, se o projeto usar configuração dinâmica).

Exemplo de configuração:

```json
{
  "expo": {
    "name": "MeuAplicativo",
    "slug": "meu-aplicativo",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "ios": {
      "bundleIdentifier": "br.com.seudominio.meuaplicativo",
      "buildNumber": "1",
      "supportsTablet": false
    }
  }
}
```

Ajuste:
- `name`: nome mostrado no dispositivo;
- `slug`: identificador do projeto Expo;
- `version`: versão visível do aplicativo;
- `ios.bundleIdentifier`: identificador único do aplicativo;
- `ios.buildNumber`: número interno da compilação.

Use um identificador que você controle, em formato semelhante a domínio invertido, por exemplo `br.com.tharles.meuapp`. Não use espaços ou acentos. O Bundle Identifier deve permanecer consistente entre builds do mesmo aplicativo.

O `bundleIdentifier` é a identidade técnica do app no ecossistema Apple. Ele não é necessariamente o nome que aparece sob o ícone.

Documentação: https://docs.expo.dev/versions/latest/config/app/

---

## 7. Criar uma conta GitHub e enviar o projeto

O Codemagic precisa acessar o código-fonte. A forma mais simples é manter o projeto no GitHub.

### 7.1 Criar o repositório

1. Acesse https://github.com/
2. Entre ou crie sua conta.
3. Clique em **New repository**.
4. Dê um nome, por exemplo `meu-aplicativo`.
5. Escolha **Private** para manter o código privado (recomendado).
6. Crie o repositório vazio.

### 7.2 Enviar o projeto pelo PowerShell

Na pasta do projeto:

```powershell
git init
git add .
git commit -m "Versao inicial do aplicativo"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/meu-aplicativo.git
git push -u origin main
```

Substitua `SEU_USUARIO` pelo seu usuário GitHub e ajuste a URL do repositório.

Se o Git solicitar autenticação, conclua o login pelo navegador ou use o mecanismo de autenticação oferecido pelo GitHub. Não coloque senha ou token diretamente no código.

### 7.3 Não enviar segredos

Antes de enviar:
- não inclua senhas, tokens, chaves privadas ou arquivos `.env` com credenciais;
- confira o `.gitignore`;
- não comite certificados Apple, arquivos `.p12`, chaves `.p8` ou senhas;
- use variáveis de ambiente/segredos do serviço de CI quando houver necessidade.

---

## 8. Criar a conta e conectar o Codemagic

Site: https://codemagic.io/

Documentação de inclusão de aplicativos: https://docs.codemagic.io/getting-started/adding-apps/

1. Entre na conta Codemagic.
2. Na página de aplicações, clique em **Add application** ou **Adicione seu primeiro aplicativo**.
3. Selecione GitHub como provedor.
4. Autorize o Codemagic a acessar o GitHub.
5. Se possível, limite a autorização ao repositório do aplicativo, em vez de liberar todos os repositórios.
6. Selecione o repositório `meu-aplicativo`.
7. Escolha o tipo **React Native** ou a opção equivalente para projeto Expo/React Native.
8. Finalize a inclusão.

O nome exato dos botões pode variar com a interface atual do Codemagic.

**Importante:** conectar o repositório não significa que o build já esteja configurado. O workflow precisa saber como preparar o projeto Expo, gerar o projeto iOS e compilar.

---

## 9. Configurar o workflow do Codemagic

A abordagem recomendada é versionar um arquivo `codemagic.yaml` na raiz do repositório. Assim, a configuração de build fica junto do código e pode ser revisada.

A documentação oficial do Codemagic tem uma seção específica para React Native e Expo:

https://docs.codemagic.io/getting-started/building-a-react-native-app/

### 9.1 Como o build Expo funciona no Codemagic

Em um projeto Expo gerenciado, normalmente a pasta `ios/` não fica versionada no Git. Durante o build, o Codemagic precisa:

1. instalar dependências JavaScript;
2. executar `npx expo prebuild --platform ios` para gerar o projeto nativo iOS;
3. instalar dependências CocoaPods;
4. compilar com Xcode;
5. coletar o artefato produzido.

A documentação do Codemagic descreve o uso de Expo Prebuild no CI. O projeto nativo pode ser gerado no servidor sem você manter a pasta `ios/` no repositório.

### 9.2 Primeiro objetivo: validar a compilação

A primeira compilação deve validar que o projeto:
- instala as dependências;
- gera a estrutura nativa;
- resolve os Pods;
- compila para iOS.

Não comece configurando distribuição App Store. Essa distribuição exige assinatura e associação com o Apple Developer Program.

### 9.3 Atenção sobre assinatura

Há dois fluxos diferentes:

**Fluxo oficial Codemagic + Apple Developer Program**
- Codemagic integra com App Store Connect;
- utiliza certificados e perfis de provisionamento;
- gera IPA assinado para distribuição oficial, TestFlight ou App Store;
- exige membership ativa do Apple Developer Program para assinatura de distribuição.

**Fluxo pessoal sem assinatura paga**
- compila o aplicativo sem assinatura de distribuição;
- empacota o `.app` em um arquivo `.ipa`;
- baixa o IPA;
- usa uma ferramenta de sideload no Windows para assinar com o Apple ID gratuito e instalar no aparelho;
- fica sujeito às limitações do provisionamento gratuito da Apple.

Não selecione `distribution_type: app_store` nem tente criar certificados de distribuição App Store usando uma conta gratuita. Isso não é o fluxo deste guia.

### 9.4 Exemplo de configuração de build sem assinatura

O exemplo abaixo ilustra a sequência de preparação. A etapa de seleção do workspace/scheme e o empacotamento podem precisar de ajuste conforme o `slug`, a versão do Expo e o projeto nativo gerado. Primeiro faça uma compilação de diagnóstico e consulte os logs.

```yaml
workflows:
  ios-unsigned:
    name: iOS - Expo - unsigned IPA
    max_build_duration: 120
    instance_type: mac_mini_m2

    environment:
      node: latest
      xcode: latest
      cocoapods: default

    scripts:
      - name: Install JavaScript dependencies
        script: |
          npm ci

      - name: Generate native iOS project
        script: |
          npx expo prebuild --platform ios --clean

      - name: Install CocoaPods
        script: |
          cd ios
          pod install

      - name: Show available Xcode schemes
        script: |
          cd "$CM_BUILD_DIR/ios"
          xcodebuild -list

      - name: Build iOS app without code signing
        script: |
          cd "$CM_BUILD_DIR/ios"
          xcodebuild \
            -workspace "*.xcworkspace" \
            -scheme "MeuAplicativo" \
            -configuration Release \
            -sdk iphoneos \
            -derivedDataPath "$CM_BUILD_DIR/ios-build" \
            CODE_SIGNING_ALLOWED=NO \
            build

    artifacts:
      - ios-build/Build/Products/Release-iphoneos/*.app
      - /tmp/xcodebuild_logs/*.log
```

**Este YAML é um ponto de partida, não uma configuração universal pronta para copiar sem conferir.** Em particular:
- `xcodebuild -workspace "*.xcworkspace"` pode não expandir o wildcard como esperado; use o nome exato do workspace encontrado em `ios/`;
- o scheme precisa corresponder ao scheme gerado pelo projeto Expo;
- a localização do `.app` depende do `-derivedDataPath`;
- coletar apenas `.app` não gera ainda o `.ipa`.

### 9.5 Empacotar o `.app` em `.ipa`

Um IPA é essencialmente um arquivo ZIP com a estrutura `Payload/NomeDoApp.app`. Para o fluxo sem assinatura, após compilar, é necessário copiar o `.app` para uma pasta `Payload` e compactá-la.

Exemplo de etapa de script, depois do build:

```bash
set -e

APP_PATH="$(find "$CM_BUILD_DIR/ios-build/Build/Products/Release-iphoneos" -maxdepth 1 -name '*.app' -print -quit)"

if [ -z "$APP_PATH" ]; then
  echo "Erro: arquivo .app não encontrado."
  exit 1
fi

mkdir -p "$CM_BUILD_DIR/ipa/Payload"
cp -R "$APP_PATH" "$CM_BUILD_DIR/ipa/Payload/"

cd "$CM_BUILD_DIR/ipa"
zip -r "$CM_BUILD_DIR/MeuAplicativo-unsigned.ipa" Payload

test -s "$CM_BUILD_DIR/MeuAplicativo-unsigned.ipa"
```

Adicione o IPA aos artefatos:

```yaml
artifacts:
  - MeuAplicativo-unsigned.ipa
  - /tmp/xcodebuild_logs/*.log
```

Ajuste o caminho conforme o local em que o script foi executado. Em um workflow real, mantenha a etapa de empacotamento no mesmo caminho utilizado para criar o arquivo.

**Limitação importante:** esse empacotamento apenas cria o contêiner IPA. Ele não assina o aplicativo, não cria perfil de provisionamento e não garante que todas as versões do Sideloadly aceitem o artefato sem ajustes. Se o app tiver extensões, App Groups, notificações push ou outros recursos que dependam de entitlements/perfis, a assinatura pessoal poderá exigir configuração adicional ou não atender ao recurso.

### 9.6 Configuração de build mais segura

Para evitar erros por nomes de scheme:
1. execute `npx expo prebuild --platform ios`;
2. liste os arquivos `.xcworkspace` em `ios/`;
3. execute `xcodebuild -list -workspace "CAMINHO_DO_WORKSPACE.xcworkspace"`;
4. copie o nome exato do scheme;
5. use esse nome na etapa `xcodebuild`.

Não adivinhe o nome do workspace ou scheme.

### 9.7 Salvar e enviar o YAML

Depois de criar `codemagic.yaml` na raiz:

```powershell
git add codemagic.yaml
git commit -m "Adiciona workflow iOS no Codemagic"
git push
```

No Codemagic, configure o workflow para usar a configuração YAML do repositório, se a interface solicitar.

---

## 10. Executar a compilação

1. Abra o aplicativo no painel Codemagic.
2. Abra **Start new build**.
3. Selecione a branch `main`.
4. Selecione o workflow `ios-unsigned`.
5. Inicie o build.
6. Acompanhe os logs.

Etapas esperadas:
- checkout do Git;
- instalação Node/npm;
- `expo prebuild`;
- instalação CocoaPods;
- compilação Xcode;
- empacotamento IPA;
- publicação dos artefatos.

Se falhar, abra a etapa vermelha e leia a primeira mensagem de erro real. Não tente corrigir apenas a última linha do log: frequentemente ela é consequência de um erro anterior.

Erros comuns:
- **`npm ci` falha:** `package-lock.json` ausente ou divergente. Gere/atualize o lockfile localmente com `npm install` e comite-o.
- **Expo Prebuild falha:** dependência ou configuração incompatível. Rode `npx expo-doctor` localmente e corrija os avisos relevantes.
- **Pod install falha:** dependência nativa/CocoaPods incompatível. Consulte a mensagem do Pod que falhou.
- **Workspace/scheme não encontrado:** confirme os nomes produzidos pelo Prebuild.
- **Build exige assinatura:** confira se `CODE_SIGNING_ALLOWED=NO` está aplicado e se algum script/plugin está forçando signing.
- **IPA não aparece:** confirme se o `.app` foi encontrado e se o caminho do artefato está correto.

---

## 11. Baixar o IPA

Quando o build terminar:
1. abra a página do build concluído;
2. localize a seção **Artifacts**;
3. baixe `MeuAplicativo-unsigned.ipa`;
4. salve em uma pasta local, por exemplo `C:\Projetos\MeuAplicativo\builds`.

Se o artefato disponível for apenas `.app`, o workflow ainda não empacotou o IPA. Corrija a etapa de empacotamento antes de prosseguir.

---

## 12. Instalar no iPhone 13 com Sideloadly

Site oficial: https://sideloadly.io/

Sideloadly é uma ferramenta de sideload para instalar aplicativos no iPhone usando um computador. Confirme que está baixando do site oficial e revise as instruções atuais do fornecedor.

### 12.1 Preparar o iPhone

1. Conecte o iPhone ao Windows com um cabo USB confiável.
2. Desbloqueie o aparelho.
3. Se aparecer **Confiar neste computador?**, toque em **Confiar**.
4. Informe o código do iPhone.
5. Mantenha o aparelho conectado durante a instalação.

Se o Windows não reconhecer o iPhone, instale/atualize os componentes oficiais de suporte a dispositivos Apple pelo canal oficial da Apple ou Microsoft Store, conforme a orientação atual da Apple.

### 12.2 Instalar Sideloadly no Windows

1. Acesse https://sideloadly.io/
2. Baixe a versão para Windows.
3. Instale e abra o programa.
4. Conecte o iPhone e confirme que ele aparece na ferramenta.
5. Se o programa solicitar componentes de suporte Apple, siga a documentação oficial do Sideloadly.

### 12.3 Selecionar o IPA

1. Na interface do Sideloadly, selecione o iPhone conectado.
2. Arraste o arquivo `MeuAplicativo-unsigned.ipa` para o campo de IPA, ou use o seletor de arquivo.
3. Informe o Apple ID quando solicitado.
4. Revise o identificador do aplicativo e as opções exibidas.
5. Inicie a instalação.

**Segurança:** nunca informe sua senha Apple em páginas desconhecidas. Use apenas o aplicativo obtido no site oficial. Se houver autenticação de dois fatores, siga o procedimento atual indicado pelo Sideloadly. Prefira uma senha específica de app quando o fluxo e o fornecedor oficialmente suportarem esse mecanismo; não compartilhe códigos de autenticação com terceiros.

### 12.4 Confiar no desenvolvedor no iPhone

Dependendo do método de assinatura e da versão do iOS, pode ser necessário confiar no perfil de desenvolvedor:

1. Abra **Ajustes**.
2. Entre em **Geral**.
3. Abra **VPN e Gerenciamento de Dispositivo** (o nome pode variar conforme o idioma/iOS).
4. Em **App de Desenvolvedor**, selecione o perfil correspondente ao Apple ID.
5. Toque em **Confiar** e confirme.

Se o menu não aparecer, abra o app instalado uma vez e confira novamente. A localização e o texto exato dos menus podem mudar entre versões do iOS.

### 12.5 Modo de Desenvolvedor

Algumas instalações/desenvolvimentos locais podem exigir o Modo de Desenvolvedor no iOS:

1. Abra **Ajustes > Privacidade e Segurança**.
2. Procure **Modo de Desenvolvedor**.
3. Ative, se a opção estiver disponível e o processo solicitar.
4. Confirme a reinicialização.
5. Após reiniciar, confirme a ativação.

Não ative opções de segurança sem entender a solicitação. Siga o aviso exibido pelo iOS e a documentação Apple atual.

---

## 13. Limitações do Apple ID gratuito

O Apple ID gratuito não equivale a uma conta Apple Developer Program paga.

Em geral, o provisionamento gratuito para desenvolvimento pessoal tem restrições, que podem incluir:
- validade curta da assinatura de desenvolvimento, normalmente sete dias;
- limite de aplicativos ativos instalados por Apple ID;
- limite de App IDs registrados em uma janela de tempo;
- recursos e entitlements indisponíveis para contas gratuitas;
- necessidade de reinstalar/assinar novamente quando a assinatura expirar.

Os limites exatos podem mudar e dependem do mecanismo de assinatura. Não considere o sideload gratuito uma instalação permanente.

Quando a assinatura expirar:
1. gere/obtenha novamente o IPA atualizado;
2. conecte o iPhone ao Windows;
3. assine e instale novamente com Sideloadly;
4. confirme a confiança do perfil se o iOS solicitar.

Os dados locais do aplicativo podem ser perdidos se você remover o app antes de reinstalar. Faça backup dos dados importantes dentro do próprio aplicativo ou em um backend.

---

## 14. Expo Go versus aplicativo instalado independentemente

| Característica | Expo Go | IPA próprio |
|---|---|---|
| Precisa gerar IPA | Não | Sim |
| Precisa de Codemagic | Não | Sim, neste cenário |
| Ícone e nome próprios | Não como app independente | Sim |
| Usa o app Expo Go como contêiner | Sim | Não |
| Pode usar qualquer módulo nativo | Não | Depende do que foi incluído no build |
| Funciona sem Metro após instalado | Não para o fluxo normal de desenvolvimento | Sim, se o bundle estiver incluído |
| Assinatura Apple para instalação | Expo Go já é distribuído pela App Store | Sim, precisa de assinatura válida |

Use Expo Go para o desenvolvimento inicial. Quando precisar validar o aplicativo como produto independente, faça um build próprio.

---

## 15. Atualizações do aplicativo

Há duas situações diferentes:

### 15.1 Alterações JavaScript/TypeScript durante desenvolvimento

Com Expo Go, salve o arquivo e veja o Fast Refresh no iPhone. Não é necessário gerar IPA.

### 15.2 Alterações que exigem novo binário nativo

Se alterar:
- ícone/nome ou configuração nativa;
- permissões nativas;
- plugins/configurações Expo que alterem o projeto iOS;
- bibliotecas que contenham código nativo;
- versão do runtime ou dependências nativas;

gere novo build nativo no Codemagic e reinstale o aplicativo.

Para um aplicativo independente já instalado, alterações no código JS só podem ser distribuídas sem novo IPA se você configurar um mecanismo de atualização OTA compatível, como Expo Updates/EAS Update, respeitando a compatibilidade do runtime. Não presuma que qualquer alteração pode ser enviada por OTA.

---

## 16. Segurança e privacidade

- Mantenha o repositório privado se o código não for público.
- Não envie senhas, tokens, certificados ou arquivos `.p8` ao GitHub.
- Use Secrets/Environment Variables do Codemagic para valores sensíveis.
- Ative autenticação em dois fatores no GitHub e Apple ID.
- Baixe Sideloadly somente do site oficial.
- Não compartilhe credenciais Apple com pessoas ou serviços desconhecidos.
- Revise permissões concedidas ao Codemagic no GitHub e limite-as ao repositório necessário.
- Evite instalar IPA de origem desconhecida.

---

## 17. Custos e limites: o que é gratuito e o que pode ter custo

| Item | Situação |
|---|---|
| React Native | Gratuito e open source |
| Expo / Expo Go | Gratuito para uso básico |
| Node.js | Gratuito |
| VS Code | Gratuito |
| GitHub | Plano gratuito disponível; limites aplicáveis |
| Codemagic | Plano gratuito/limites dependem da oferta vigente; minutos macOS podem ser limitados |
| Apple ID | Gratuito |
| Apple Developer Program | Pago; não será usado neste fluxo pessoal |
| Sideloadly | Ferramenta com uso gratuito; confira os termos atuais do fornecedor |
| iPhone 13 | Já é o aparelho de teste |

Não conte com uma franquia fixa de minutos do Codemagic sem conferir a página atual de preços. Máquinas macOS, tempo de build, concorrência e limites de plano podem mudar.

Preços e planos: https://codemagic.io/pricing/

---

## 18. Checklist completo

### Preparação local
- [ ] Node.js LTS instalado
- [ ] npm funcionando
- [ ] Git instalado
- [ ] VS Code instalado
- [ ] Expo Go instalado no iPhone 13
- [ ] Projeto criado com `create-expo-app`
- [ ] Projeto abre no Expo Go
- [ ] `app.json` contém `ios.bundleIdentifier`
- [ ] `npx expo-doctor` executado e problemas relevantes corrigidos

### GitHub
- [ ] Repositório criado
- [ ] Repositório privado, se necessário
- [ ] `.gitignore` revisado
- [ ] Nenhum segredo commitado
- [ ] Código enviado para a branch `main`

### Codemagic
- [ ] Conta criada
- [ ] GitHub conectado
- [ ] Repositório adicionado
- [ ] Workflow YAML versionado
- [ ] Prebuild iOS executado no servidor
- [ ] CocoaPods instalado
- [ ] Workspace e scheme conferidos
- [ ] Build Xcode concluído
- [ ] IPA empacotado e publicado como artefato
- [ ] Logs revisados

### iPhone / instalação
- [ ] IPA baixado no Windows
- [ ] Sideloadly obtido do site oficial
- [ ] iPhone conectado por USB
- [ ] Computador confiável no iPhone
- [ ] IPA selecionado no Sideloadly
- [ ] Apple ID usado no fluxo de assinatura
- [ ] Instalação concluída
- [ ] Perfil de desenvolvedor confiado, se solicitado
- [ ] Aplicativo aberto e testado

### Manutenção
- [ ] Controlar validade da assinatura gratuita
- [ ] Reassinar/reinstalar quando necessário
- [ ] Incrementar versão/build quando apropriado
- [ ] Manter backup dos dados importantes
- [ ] Gerar novo binário quando houver mudança nativa

---

## 19. Referências oficiais

### Expo
- Expo Go: https://expo.dev/go
- Configuração do app (`app.json`): https://docs.expo.dev/versions/latest/config/app/
- Expo Go e Development Builds: https://docs.expo.dev/develop/development-builds/overview/
- Configuração de ambiente: https://docs.expo.dev/get-started/set-up-your-environment/

### Codemagic
- React Native: https://docs.codemagic.io/getting-started/building-a-react-native-app/
- Primeiro build assinado / visão geral do pipeline: https://docs.codemagic.io/yaml-quick-start/first-signed-build/
- Adicionar aplicativo: https://docs.codemagic.io/getting-started/adding-apps/
- Preços: https://codemagic.io/pricing/

### Ferramentas
- Node.js: https://nodejs.org/
- Git: https://git-scm.com/
- Visual Studio Code: https://code.visualstudio.com/
- GitHub: https://github.com/
- Sideloadly: https://sideloadly.io/

### Apple
- Apple Developer: https://developer.apple.com/
- Apple Developer Program: https://developer.apple.com/programs/

---

## 20. Observação final: sequência recomendada de execução

Não tente configurar tudo de uma vez. Faça em etapas e valide cada uma:

1. Instale Node.js, Git e VS Code.
2. Crie um projeto Expo mínimo.
3. Execute no iPhone 13 usando Expo Go.
4. Configure o `bundleIdentifier`.
5. Envie o projeto ao GitHub.
6. Conecte o repositório ao Codemagic.
7. Faça primeiro um build iOS de diagnóstico.
8. Ajuste workspace, scheme e geração do artefato.
9. Gere e baixe o IPA.
10. Faça a assinatura pessoal e a instalação com Sideloadly.
11. Teste o app instalado sem Expo Go.

**Ponto crítico:** o trecho mais sensível deste fluxo é obter um IPA que possa ser assinado por uma ferramenta externa usando Apple ID gratuito. O Codemagic documenta claramente builds iOS e builds assinados para membros do Apple Developer Program, mas o fluxo de IPA sem assinatura + sideload pessoal é uma composição de ferramentas e não uma garantia oficial de suporte ponta a ponta. Se o Sideloadly rejeitar o pacote, será necessário analisar o log e adaptar o processo; não significa necessariamente que o projeto React Native esteja errado.
