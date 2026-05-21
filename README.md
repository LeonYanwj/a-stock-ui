# A 股量化工作台前端

这是为 [`LeonYanwj/a-stock-analyzer`](https://github.com/LeonYanwj/a-stock-analyzer) 配套的前端项目。后端仓库已经提供 FastAPI 接口，前端默认连接 `http://localhost:8000`。

## 功能

- 系统总览：API/DB 健康检查、模拟盘权益、持仓、最近任务
- 多因子选股：调用 `POST /api/screen/async` 并轮询 `/api/tasks/{task_id}`
- 单股评级：调用 `GET /api/rate/{code}`
- 模拟盘：调用账户、持仓、交易、权益曲线、止损、快照、自动调仓、每日流程接口
- 回测表现：调用 `GET /api/backtest` 和 `POST /api/backtest/run/async`

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

## 连接真实后端

创建 `.env.local`：

```bash
VITE_API_BASE_URL=http://localhost:8000
```

前端 API 入口在 `src/lib/api.ts`，接口契约来自后端的 `a-stock-analyzer/API.md`。
