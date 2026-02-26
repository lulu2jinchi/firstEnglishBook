#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
用法:
  bash scripts/deploy-aliyun.sh --host <user@ip> --path <remote_path> [options]

必选参数:
  --host      服务器地址（示例: root@1.2.3.4）
  --path      服务器部署目录（示例: /opt/firstEnglishBook）

可选参数:
  --restart   部署后执行的重启命令
              默认: systemctl restart server
  --start     当重启命令失败时执行的启动命令（用于首发部署）
  --port      SSH 端口（默认 22）
  --key       SSH 私钥文件路径（也可通过环境变量 ALIYUN_SSH_KEY 传入）
  --skip-build 跳过本地 npm run build
  -h, --help  查看帮助

示例:
  npm run deploy:aliyun -- \
    --host root@1.2.3.4 \
    --path /opt/firstEnglishBook \
    --restart "pm2 restart server" \
    --start "pm2 start .output/server/index.mjs --name server --update-env"
USAGE
}

HOST=""
REMOTE_PATH=""
RESTART_CMD="systemctl restart server"
START_CMD=""
SSH_PORT="22"
SSH_KEY="${ALIYUN_SSH_KEY:-}"
SKIP_BUILD="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --path)
      REMOTE_PATH="${2:-}"
      shift 2
      ;;
    --restart)
      RESTART_CMD="${2:-}"
      shift 2
      ;;
    --start)
      START_CMD="${2:-}"
      shift 2
      ;;
    --port)
      SSH_PORT="${2:-}"
      shift 2
      ;;
    --key)
      SSH_KEY="${2:-}"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$HOST" || -z "$REMOTE_PATH" ]]; then
  echo "错误: --host 和 --path 为必填参数" >&2
  usage
  exit 1
fi

if [[ -z "$SSH_KEY" && -t 0 ]]; then
  read -r -p "未传 --key。请输入私钥路径（回车使用默认 ~/.ssh 配置）: " INPUT_KEY
  if [[ -n "${INPUT_KEY:-}" ]]; then
    SSH_KEY="$INPUT_KEY"
  fi
fi

if [[ -n "$SSH_KEY" && ! -f "$SSH_KEY" ]]; then
  echo "错误: 私钥文件不存在: $SSH_KEY" >&2
  exit 1
fi

if [[ "$SKIP_BUILD" != "true" ]]; then
  echo "[1/6] 本地构建中: npm run build"
  npm run build
else
  echo "[1/6] 已跳过本地构建"
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARTIFACT_NAME="nuxt-output-${TIMESTAMP}.tar.gz"
ARTIFACT_PATH="/tmp/${ARTIFACT_NAME}"

cleanup() {
  rm -f "$ARTIFACT_PATH"
}
trap cleanup EXIT

echo "[2/6] 打包构建产物: .output -> $ARTIFACT_PATH"
tar -czf "$ARTIFACT_PATH" .output

SSH_OPTS=(-p "$SSH_PORT")
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
fi
SCP_OPTS=(-P "$SSH_PORT")
if [[ -n "$SSH_KEY" ]]; then
  SCP_OPTS+=(-i "$SSH_KEY")
fi

echo "[3/6] 校验 SSH 连通性: $HOST"
if ! ssh "${SSH_OPTS[@]}" -o ConnectTimeout=10 "$HOST" "echo connected" >/dev/null 2>&1; then
  echo "错误: 无法通过 SSH 连接到 $HOST" >&2
  echo "请确认密钥是否正确，并使用如下方式重试：" >&2
  echo "npm run deploy:aliyun -- --host $HOST --path $REMOTE_PATH --key ~/.ssh/<your-key>" >&2
  exit 1
fi

echo "[4/6] 上传产物到服务器: $HOST:$REMOTE_PATH/$ARTIFACT_NAME"
ssh "${SSH_OPTS[@]}" "$HOST" "mkdir -p '$REMOTE_PATH'"
scp "${SCP_OPTS[@]}" "$ARTIFACT_PATH" "$HOST:$REMOTE_PATH/$ARTIFACT_NAME"

echo "[5/6] 服务器解压并重启服务"
ssh "${SSH_OPTS[@]}" "$HOST" "set -e; cd '$REMOTE_PATH'; rm -rf .output; tar -xzf '$ARTIFACT_NAME'; rm -f '$ARTIFACT_NAME'; if $RESTART_CMD; then echo '远程服务重启成功'; else echo '远程服务重启失败'; if [ -n \"$START_CMD\" ]; then echo '尝试执行启动命令'; $START_CMD; else echo '未提供 --start，部署已完成但服务未启动'; echo '可重试并增加参数：--start \"pm2 start .output/server/index.mjs --name server --update-env\"'; exit 1; fi; fi"

echo "[6/6] 同步备案页面到 /var/www/html/index.html"
ssh "${SSH_OPTS[@]}" "$HOST" "set -e; REMOTE_PATH='$REMOTE_PATH' bash -s" <<'EOF'
set -euo pipefail

SRC_PATH="${REMOTE_PATH}/.output/public/beian-love-record.html"
DEST_PATH="/var/www/html/index.html"

if [[ ! -f "$SRC_PATH" ]]; then
  echo "错误: 未找到备案页面文件: $SRC_PATH" >&2
  exit 1
fi

if [[ "$(id -u)" -eq 0 ]]; then
  install -m 644 "$SRC_PATH" "$DEST_PATH"
elif command -v sudo >/dev/null 2>&1; then
  sudo install -m 644 "$SRC_PATH" "$DEST_PATH"
else
  echo "错误: 复制到 $DEST_PATH 需要 root 或 sudo 权限" >&2
  exit 1
fi

echo "备案页面已同步: $DEST_PATH"
EOF

echo "部署完成: $HOST:$REMOTE_PATH"
