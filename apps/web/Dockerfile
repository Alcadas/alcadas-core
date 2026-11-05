# ==========================================
# Estágio 1: Build do Frontend Angular SPA
# ==========================================
FROM node:24.21.0-alpine AS builder

WORKDIR /app

# Manifestos para cache eficiente de camadas Docker
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit

# Código-fonte completo necessário para compilação do Nx
COPY . .

# Compilação da aplicação Angular em modo de produção
ENV NODE_ENV=production
RUN npx nx build web --configuration=production

# ==========================================
# Estágio 2: Nginx Web Server Enxuto
# ==========================================
FROM nginx:1.27.4-alpine AS runner

# Copia os artefatos compilados do Angular SPA
COPY --from=builder /app/dist/apps/web/browser /usr/share/nginx/html

# Configuração com suporte a fallback de rotas SPA (index.html)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
