# ==============================================================================
# Dockerfile متعدد المراحل لإنتاج الموسوعة العُمانية الرقمية الذكية
# متوافق مع Render, Railway, Fly.io, CapRover, Coolify, وأي خادم VPS
# ==============================================================================

# مرحلة 1: بناء التبعيات
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# مرحلة 2: بناء تطبيق Next.js
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# تعطيل جمع الإحصائيات لـ Next.js أثناء البناء
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# تهيئة قاعدة البيانات والتأكد من وجود البيانات قبل البناء
RUN node scripts/init-db-and-test.mjs
RUN npm run build

# مرحلة 3: صورة التشغيل الإنتاجية النهائية
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# إنشاء مستخدم غير ذي صلاحيات جذرية لأمان الخادم
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# نسخ الملفات الضرورية
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/data ./data
COPY --from=builder /app/scripts ./scripts

# تعيين صلاحيات مجلد البيانات ليتمكن التطبيق من الكتابة فيه
RUN chown -R nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["npm", "start"]
