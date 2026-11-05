# ==========================================
# Estágio 1: Build da Aplicação no Monorepo
# ==========================================
FROM node:24.21.0-alpine AS builder

WORKDIR /app

# Manifestos para cache eficiente de camadas Docker
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# Código-fonte completo necessário para compilação do Nx
COPY . .

# Compilação da API em modo de produção
ENV NODE_ENV=production
RUN npx nx build api --configuration=production

# ==========================================
# Estágio 2: Runtime Mínimo e Não-Privilegiado
# ==========================================
FROM node:24.21.0-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copia artefato compilado e o package.json podado pelo Nx
COPY --chown=node:node --from=builder /app/dist/apps/api ./

# Instalação apenas das dependências de runtime e higienização de cache
RUN npm install --omit=dev --no-audit && \
    npm cache clean --force && \
    rm -rf /root/.npm && \
    chown -R node:node /app

# Execução estrita sob usuário não-root (UID 1000)
USER node

EXPOSE 3000

# Verificação de liveness local no contêiner
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/healthz || exit 1

CMD ["node", "main.js"]
