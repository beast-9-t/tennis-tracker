#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# 网球记录助手 · 阿里云服务器一键部署脚本（自托管模式）
#
# 做的事：装 Node → 拉代码 → 装依赖 → 构建前后端 → 写 .env →
#         注册 systemd 开机自启服务 → 自检接口
#
# 支持系统：Alibaba Cloud Linux 3 / CentOS 7+ / Debian 11+ / Ubuntu 20.04+
# 用法（root 身份执行）：
#   bash deploy/aliyun-setup.sh
#
# 脚本可重复执行：已有代码走 git pull，已有 .env 不会被覆盖。
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/beast-9-t/tennis-tracker.git"
# GitHub 在国内服务器上偶尔超时，按顺序兜底重试。
CLONE_URLS=(
  "${REPO_URL}"
  "https://ghfast.top/${REPO_URL}"
  "https://ghproxy.net/${REPO_URL}"
)
APP_DIR="/opt/tennis-tracker"
NODE_VERSION="22.11.0"
SERVICE_NAME="tennis-tracker"
HTTP_PORT="80"

log()  { printf '\033[1;32m[ 部署 ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[ 提示 ]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[ 失败 ]\033[0m %s\n' "$*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "请用 root 身份执行（先运行 sudo -i）"

# ---------- 1. 基础依赖 ----------
install_base_deps() {
  log "检查基础依赖…"
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq git curl xz-utils ca-certificates >/dev/null
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q git curl xz ca-certificates >/dev/null
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q git curl xz ca-certificates >/dev/null
  else
    die "未识别的包管理器，请手动安装 git / curl / xz 后重试"
  fi
}

# ---------- 2. Node.js ----------
install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -v)" == v2[0-9].* ]]; then
    log "已检测到 $(node -v)，跳过 Node 安装"
    return
  fi

  local arch node_arch tarball url downloaded
  arch="$(uname -m)"
  case "${arch}" in
    x86_64|amd64) node_arch="x64" ;;
    aarch64|arm64) node_arch="arm64" ;;
    *) die "不支持的 CPU 架构：${arch}" ;;
  esac

  tarball="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
  log "安装 Node.js v${NODE_VERSION} (${node_arch})…"
  downloaded=""
  for url in \
    "https://mirrors.aliyun.com/nodejs-release/v${NODE_VERSION}/${tarball}" \
    "https://registry.npmmirror.com/-/binary/node/v${NODE_VERSION}/${tarball}" \
    "https://nodejs.org/dist/v${NODE_VERSION}/${tarball}"
  do
    log "  下载：${url}"
    if curl -fsSL --connect-timeout 15 --retry 2 "${url}" -o "/tmp/${tarball}"; then
      downloaded="yes"
      break
    fi
    warn "  该镜像不可用，换下一个"
  done
  [[ -n "${downloaded}" ]] || die "Node.js 下载失败，请检查服务器网络后重试"

  mkdir -p /usr/local/lib/nodejs
  tar -xJf "/tmp/${tarball}" -C /usr/local/lib/nodejs
  rm -f "/tmp/${tarball}"
  ln -sf "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/node" /usr/local/bin/node
  ln -sf "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/npm" /usr/local/bin/npm
  ln -sf "/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-${node_arch}/bin/npx" /usr/local/bin/npx
  log "Node.js 安装完成：$(node -v)"
}

# ---------- 3. 拉取代码 ----------
fetch_code() {
  if [[ -d "${APP_DIR}/.git" ]]; then
    log "更新已有代码…"
    git -C "${APP_DIR}" remote set-url origin "${REPO_URL}"
    git -C "${APP_DIR}" fetch --depth 1 origin main
    git -C "${APP_DIR}" reset --hard origin/main
    return
  fi

  local url
  for url in "${CLONE_URLS[@]}"; do
    log "拉取代码：${url}"
    rm -rf "${APP_DIR}"
    if git clone --depth 1 "${url}" "${APP_DIR}" >/dev/null 2>&1; then
      log "代码已就绪"
      return
    fi
    warn "  拉取失败，换下一个地址"
  done
  die "代码拉取失败。可稍后重试，或在能访问 GitHub 的机器上打包后上传到 ${APP_DIR}"
}

# ---------- 4. 安装依赖并构建 ----------
build_app() {
  cd "${APP_DIR}"
  npm config set registry https://registry.npmmirror.com
  log "安装依赖（约 1-3 分钟）…"
  npm install --no-audit --no-fund
  log "构建前端（vue-tsc + vite）…"
  npm run build
  log "构建服务端（tsc）…"
  npm run build:api
  [[ -f "${APP_DIR}/dist/index.html" ]] || die "前端构建产物缺失：dist/index.html"
  [[ -f "${APP_DIR}/dist-server/server/index.js" ]] || die "服务端构建产物缺失：dist-server/server/index.js"
}

# ---------- 5. 配置环境变量 ----------
configure_env() {
  if [[ -f "${APP_DIR}/.env" ]]; then
    log "检测到已有 .env，保留原有配置（如需修改：nano ${APP_DIR}/.env）"
    return
  fi

  echo
  log "请输入 Supabase 配置（Supabase 控制台 → Project Settings）"
  local supa_url supa_key
  read -r -p "  Supabase Project URL（形如 https://xxxx.supabase.co）: " supa_url
  read -r -s -p "  Supabase service_role key: " supa_key
  echo
  [[ -n "${supa_url}" && -n "${supa_key}" ]] || die "两项都不能为空"

  cat > "${APP_DIR}/.env" <<EOF
DATA_STORE=supabase
SUPABASE_URL=${supa_url}
SUPABASE_SERVICE_ROLE_KEY=${supa_key}
NODE_ENV=production
PORT=${HTTP_PORT}
EOF
  chmod 600 "${APP_DIR}/.env"
  log "已写入 ${APP_DIR}/.env"
}

# ---------- 6. 注册 systemd 服务 ----------
setup_service() {
  log "注册开机自启服务…"
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Tennis Tracker (Vue + Express self-hosted)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=/usr/local/bin/node dist-server/server/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}" >/dev/null 2>&1
  systemctl restart "${SERVICE_NAME}"
}

# ---------- 7. 自检 ----------
verify() {
  sleep 4
  if ! systemctl is-active --quiet "${SERVICE_NAME}"; then
    warn "服务未处于运行状态，最近日志如下："
    journalctl -u "${SERVICE_NAME}" -n 30 --no-pager || true
    exit 1
  fi
  log "服务已启动"
  if curl -fsS --max-time 10 "http://127.0.0.1:${HTTP_PORT}/api/v1/health" >/dev/null 2>&1; then
    log "接口自检通过"
  else
    warn "接口自检未通过，查看日志：journalctl -u ${SERVICE_NAME} -f"
  fi
}

main() {
  install_base_deps
  install_node
  fetch_code
  build_app
  configure_env
  setup_service
  verify

  local ip
  ip="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
  [[ -n "${ip}" ]] || ip="<你的服务器公网IP>"

  echo
  log "部署完成"
  echo "    访问地址： http://${ip}/"
  echo "    查看日志： journalctl -u ${SERVICE_NAME} -f"
  echo "    重启服务： systemctl restart ${SERVICE_NAME}"
  echo "    更新代码： bash ${APP_DIR}/deploy/aliyun-setup.sh"
  echo
  warn "若浏览器打不开，请到阿里云控制台 → 轻量应用服务器 → 防火墙，确认已放行 TCP ${HTTP_PORT} 端口。"
}

main "$@"
