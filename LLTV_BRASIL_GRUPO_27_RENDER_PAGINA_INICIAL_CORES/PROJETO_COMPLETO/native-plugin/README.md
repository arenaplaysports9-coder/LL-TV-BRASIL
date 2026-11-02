# Plugin nativo LLTV Brasil para OBS Studio

## Preparacao automatizada no Windows 10/11 x64

1. Instale o OBS Studio normalmente.
2. Execute `PREPARAR-AMBIENTE.bat` como usuario administrador quando solicitado.
3. O assistente instala **Visual Studio 2022 Build Tools** com a carga de trabalho C++ e **CMake** usando o Windows Package Manager (winget).
4. O detector procura automaticamente `obs64.exe`, lê a versao instalada e verifica os locais conhecidos de SDK.
5. Reinicie o terminal/Windows se o instalador solicitar.
6. Execute `BUILD-WINDOWS.bat` para compilar.

## Deteccao de versao e SDK

O script `DETECTAR-AMBIENTE.ps1` identifica o OBS por caminhos padrao e pelo Registro do Windows e lê `ProductVersion` do executavel instalado. Ele também procura os pacotes CMake `libobsConfig.cmake` e `obs-frontend-apiConfig.cmake`.

**Importante:** a instalacao normal do OBS Studio nao garante a presenca do SDK de desenvolvimento, dos headers e dos pacotes Qt/CMake. Detectar a versao do OBS nao equivale a possuir o SDK. O script nao baixa um SDK presumidamente compativel nem substitui arquivos por versoes aleatorias. Instale o pacote de desenvolvimento correspondente a versao/arquitetura do OBS e configure `OBS_SDK_DIR` para a pasta que contém os pacotes CMake. O Qt 6 deve ser compativel com a mesma distribuicao de desenvolvimento.

Para definir a pasta do SDK no Windows (exemplo):

```bat
setx OBS_SDK_DIR "C:\caminho\para\obs-sdk"
```

Abra um novo terminal depois de usar `setx`.

## Compilacao

Execute `BUILD-WINDOWS.bat`. O script detecta Visual Studio, CMake, OBS e SDK e interrompe com uma mensagem clara se faltar algum requisito. A geracao usa Visual Studio 2022 x64.

## Compatibilidade

O código do plugin utiliza a API frontend do OBS e foi direcionado a OBS 30+. A deteccao da versao instalada é automatica, mas a compilacao final precisa ser validada contra os headers, bibliotecas e Qt da versao instalada. Uma DLL nao deve ser copiada para outra versao/arquitetura sem teste.

## O que o dock controla

- Abrir painel LLTV e overlay local.
- Iniciar/parar transmissao e gravacao pelo frontend API.
- Salvar replay quando Replay Buffer estiver ativo.
- Mostrar estado de transmissao e gravacao.

A edicao do placar, equipes, escalações, estatisticas e artes continua na Central web LLTV.

## Solucao de problemas do instalador (versao 4.2)

O assistente agora localiza o executavel `winget.exe`, executa as instalacoes pelo caminho encontrado, atualiza as fontes, registra a saida em `INSTALACAO-AMBIENTE.log` e verifica novamente as ferramentas. Se o Windows informar que nao consegue executar o programa, atualize o **Aplicativo Instalador (App Installer)** pela Microsoft Store, reinicie o Windows e execute `PREPARAR-AMBIENTE.bat` novamente.

A compilacao do plugin nativo e opcional para usar o placar LLTV como fonte de navegador no OBS. O SDK/headers do OBS continua sendo um requisito separado para compilar o plugin; a instalacao comum do OBS 30.2.3 nao garante esses arquivos.
