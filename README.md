# Selfhost Website

**Painel self-hosted para hospedar múltiplos sites estáticos a partir de uma única pasta.**

Crie pastas em `sites/`, faça deploy via rsync e os sites aparecem automaticamente no painel — sem cadastro manual, sem banco de dados, sem complexidade.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Por que usar?

Se você tem um VPS ou servidor em casa e quer hospedar vários sites estáticos (landing pages, portfolios, projetos HTML) com um painel simples, o Website Manager resolve isso em um único container Docker.

| Recurso | Descrição |
|---------|-----------|
| **Detecção automática** | Toda pasta em `sites/` vira um site publicado em `/{slug}` |
| **Gerenciador de arquivos** | Upload, download, criar pastas e excluir arquivos pelo painel |
| **Deploy via rsync** | Comandos prontos para copiar do Mac/Linux para o servidor |
| **Multi-site** | Um domínio, vários sites — cada um com sua URL |
| **Zero dependências externas** | Sem PostgreSQL, Redis ou S3 — só Node.js e o filesystem |
| **Interface terminal** | Painel admin com visual dark/neon, animado e responsivo |

---

## Como funciona

```
website-manager/
├── app/              # Código do painel (Express + SPA)
├── sites/            # Seus sites estáticos
│   ├── portfolio/
│   │   └── index.html
│   └── landing/
│       └── index.html
├── docker-compose.yml
└── Dockerfile
```

1. Você cria `sites/meu-site/index.html` localmente
2. Envia a pasta (ou o projeto inteiro) para o servidor via rsync
3. O site aparece no painel — acesse `https://seu-dominio.com/meu-site`
4. Alterou só arquivos? **Não precisa reiniciar** o container

---

## Início rápido

### Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose
- (Opcional) Traefik ou nginx como reverse proxy

### 1. Clone o repositório

```bash
git clone https://github.com/guianayans/selfhost-website.git
cd selfhost-website
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com seus valores:

```env
ADMIN_USER=admin
ADMIN_PASSWORD=sua-senha-forte
SESSION_SECRET=um-segredo-longo-e-aleatorio

PUBLIC_DOMAIN=https://sites.seudominio.com
MAX_UPLOAD_MB=50

# Caminhos para gerar comandos rsync no painel
RSYNC_SSH_HOST=servidor.seudominio.com
RSYNC_LOCAL_PATH=/caminho/local/website-manager
RSYNC_REMOTE_PATH=/opt/website-manager
RSYNC_REMOTE_SITES=/opt/website-manager/sites
```

> **Importante:** nunca commite o arquivo `.env` com credenciais reais.

### 3. Suba com Docker

```bash
docker compose up -d --build
```

O painel ficará disponível na porta **4050**. Configure seu reverse proxy para apontar para ela.

### Login padrão (altere imediatamente)

| Campo | Valor inicial |
|-------|---------------|
| Usuário | `admin` |
| Senha | valor de `ADMIN_PASSWORD` no `.env` |

---

## Deploy de sites

> **Erro `Dockerfile: no such file or directory`?**  
> O build precisa rodar na **raiz do projeto**, onde existem `Dockerfile`, `docker-compose.yml` e a pasta `app/`.  
> Se você colou só o compose no Coolify ou fez rsync só de `sites/`, o Dockerfile não chegou no servidor.  
> Confira no servidor: `ls -la /pendriver/website-manager/Dockerfile`  
> Valide localmente: `sh scripts/check-deploy.sh`

### Projeto completo (app + sites)

```bash
rsync -avz --delete \
  -e "ssh" \
  ./ \
  usuario@servidor:/opt/website-manager/
```

Se alterou código do app:

```bash
ssh usuario@servidor "cd /opt/website-manager && docker compose up -d --build"
```

### Apenas um site

```bash
rsync -avz --delete \
  -e "ssh" \
  ./sites/meu-site/ \
  usuario@servidor:/opt/website-manager/sites/meu-site/
```

O painel gera esses comandos automaticamente para cada site — basta copiar e colar.

---

## Configuração com Traefik

O `docker-compose.yml` inclui labels Traefik prontas. Ajuste o host:

```yaml
labels:
  - traefik.http.routers.website-manager.rule=Host(`sites.seudominio.com`)
```

Também há um exemplo em `dynamic-proxy.yaml` para configuração estática.

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `4050` | Porta interna do app |
| `SITES_ROOT` | `/app/sites` | Pasta dos sites no container |
| `DATA_DIR` | `/app/data` | Metadados do painel |
| `ADMIN_USER` | `admin` | Usuário do painel |
| `ADMIN_PASSWORD` | — | Senha do painel (**obrigatório alterar**) |
| `SESSION_SECRET` | — | Segredo da sessão (**obrigatório alterar**) |
| `MAX_UPLOAD_MB` | `50` | Limite de upload por arquivo |
| `PUBLIC_DOMAIN` | — | URL pública (usada nos links do painel) |
| `RSYNC_SSH_HOST` | — | Host SSH para comandos rsync |
| `RSYNC_LOCAL_PATH` | — | Caminho local do projeto |
| `RSYNC_REMOTE_PATH` | — | Caminho remoto do projeto |
| `RSYNC_REMOTE_SITES` | — | Caminho remoto da pasta `sites/` |

---

## API

Todas as rotas `/api/*` exigem autenticação por sessão (cookie `wm_session`).

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/login` | Autenticar |
| `POST` | `/api/logout` | Encerrar sessão |
| `GET` | `/api/me` | Dados do usuário e ambiente |
| `GET` | `/api/sites` | Listar sites detectados |
| `DELETE` | `/api/sites/:slug` | Excluir site |
| `GET` | `/api/sites/:slug/files` | Listar arquivos |
| `POST` | `/api/sites/:slug/files/upload` | Upload |
| `POST` | `/api/sites/:slug/files/mkdir` | Criar pasta |
| `DELETE` | `/api/sites/:slug/files` | Excluir arquivo/pasta |
| `GET` | `/health` | Health check |

---

## Desenvolvimento local

```bash
cd app
npm install
cp ../.env.example ../.env   # ajuste SITES_ROOT se necessário
SITES_ROOT=../sites DATA_DIR=./data node server.js
```

Acesse `http://localhost:4050`.

---

## Backup

```bash
tar -czf sites-backup-$(date +%Y%m%d).tar.gz /opt/website-manager/sites
```

---

## Segurança

- Altere `ADMIN_PASSWORD` e `SESSION_SECRET` antes de expor na internet
- O painel valida slugs e caminhos para evitar path traversal
- Arquivos ocultos (`.env`, etc.) não são servidos publicamente
- Uploads têm limite de tamanho configurável
- Recomendado: HTTPS via reverse proxy + firewall no SSH

---

## Stack

- **Backend:** Node.js 20, Express, express-session, multer
- **Frontend:** HTML/CSS/JS vanilla (sem build step)
- **Deploy:** Docker, Traefik (opcional)

---

## Licença

MIT — use, modifique e distribua livremente.

---

## Contribuindo

Issues e pull requests são bem-vindos. Para mudanças grandes, abra uma issue antes para alinhar a direção.
