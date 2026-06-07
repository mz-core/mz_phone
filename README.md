# mz_phone

Resource de celular integrado ao `mz_core`.

## Antes de iniciar

1. Importe `sql/mz_phone.sql` no banco.
2. Garanta que o item `cellphone` existe no `mz_core`.
3. Garanta que o player de teste possui `cellphone`.
4. Nao inicie `mz_phone_core` junto.
5. Inicie `mz_phone` depois do `mz_core`.

## Identidade e SQL

O `mz_phone` usa o `citizenid` da tabela `mz_players` como dono oficial de numeros, contatos, conversas, mensagens, settings e notificacoes. A `license` fica somente no server do `mz_core`, usada para resolver o player em `mz_players`.

O SQL atual usa colunas `citizenid` e `owner_citizenid`. Se o banco ja tiver sido criado com `character_id`, o `Repository.Prepare()` tenta renomear as colunas antigas automaticamente no start do resource.

## Ordem recomendada no server.cfg

```cfg
ensure oxmysql
ensure ox_lib
ensure mz_core
ensure mz_notify
ensure mz_phone
```

## Debug

Ative em `shared/config.lua`:

```lua
Config.Debug.Enabled = true
Config.Debug.NuiMessages = true -- opcional
```

Comandos de teste:

```txt
/celular
/mzphone_debug
```

O comando `/mzphone_debug` exige `Config.Debug.AllowCommand = true` e permissao `mz_phone.debug` via `mz_core`, ou `Config.Debug.Enabled = true`.
