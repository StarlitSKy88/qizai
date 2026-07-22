#!/bin/bash
set -e

echo "🚀 部署 qizai 到 Cloudflare..."

# 1. 设置 secrets（仅首次）
if [ -n "$ALIBABA_BAILIAN_API_KEY" ]; then
  echo "设置 ALIBABA_BAILIAN_API_KEY..."
  echo "$ALIBABA_BAILIAN_API_KEY" | npx wrangler secret put ALIBABA_BAILIAN_API_KEY
fi

if [ -n "$FIREWORKS_API_KEY" ]; then
  echo "设置 FIREWORKS_API_KEY..."
  echo "$FIREWORKS_API_KEY" | npx wrangler secret put FIREWORKS_API_KEY
fi

if [ -n "$DEEPSEEK_API_KEY" ]; then
  echo "设置 DEEPSEEK_API_KEY..."
  echo "$DEEPSEEK_API_KEY" | npx wrangler secret put DEEPSEEK_API_KEY
fi

# 2. 部署 API（Cloudflare Workers）
echo "部署 API..."
cd /Users/opc-1/Downloads/O/qizai/apps/api
npx wrangler deploy

# 3. 构建 + 部署 Web（Cloudflare Pages）
echo "构建并部署 Web..."
cd /Users/opc-1/Downloads/O/qizai/apps/web
pnpm run build
npx wrangler pages deploy ../web/dist --project-name qizai-web

echo "✅ 部署完成！"
