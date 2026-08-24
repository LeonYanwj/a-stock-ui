# A 股量化工作台前端

这是为 [`LeonYanwj/a-stock-analyzer`](https://github.com/LeonYanwj/a-stock-analyzer) 配套的 Orbit Trading Ops 前端。浏览器只在登录时向 `POST /api/auth/session` 提交固定管理员用户名和密码，之后使用 8 小时 HttpOnly Cookie；前端不会保存密码。

## 功能

- 交易运行总览、执行轨道、风险状态与审计日志
- 主/影子策略、计划窗口、人工计划生成、报价确认与成交回填
- ETF 白名单与流动性标的池
- 系统浅/深色模式和折叠侧栏

## 运行

```bash
npm install
npm run dev
```

后端启动：

```bash
cd /Users/yanweijian/Documents/a-stock-web/a-stock-analyzer
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

管理员账号保存在后端 MySQL 的 `admin_user` 表中，密码仅保存为哈希值；首次部署时使用后端提供的初始化命令创建固定账号：

```bash
python scripts/manage_admin_user.py admin
```

命令会在终端提示输入并确认密码，不会写入配置文件、命令历史或日志。`TRADE_RUN_API_KEY` 仅供受控脚本调用接口，不用于网页登录。

## 同源开发与生产

创建 `.env.local`：

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
```

Vite 会将 `/api` 与 `/health` 代理到该目标，浏览器请求始终使用同源地址。生产反向代理示例见 [deploy/nginx-orbit.conf.example](deploy/nginx-orbit.conf.example)。HTTPS 生产环境必须把后端 `TRADE_RUN_COOKIE_SECURE` 设为 `true`，同时配置 `TRADE_RUN_SESSION_SECRET`；二者均不得提交到仓库。

前端 API 入口在 `src/lib/api.ts`，接口契约来自后端的 `a-stock-analyzer/API.md`。
