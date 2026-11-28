# 部署与运维手册

> 文档类型：运维手册。复核日期：2026-11-28。当前工作重点为 Staging；Production 章节是发布规范，不代表 Production 已部署或获准操作。

## 1. 环境拓扑

| 资源 | Staging | Production |
|---|---|---|
| Pages | `aio-resource-search-staging` | `aio-resource-search` |
| Pages 分支 | `develop` | `main` |
| Worker | `aio-resource-search-api-staging` | `aio-resource-search-api` |
| KV | 独立 Staging namespace | 独立 Production namespace |
| 管理员 Secret | 独立 Staging token | 独立 Production token |

两个环境的 Worker、KV、Durable Object 存储和令牌必须隔离。不要复制 Staging KV 或 Secret 到 Production。

## 2. Staging 变更流程

1. 功能分支通过 PR 合并到 `develop`。
2. Cloudflare Pages 从 `develop` 构建 Staging 前端。
3. Worker 部署工作流对 Worker 相关改动执行检查、测试、构建和 dry-run，再部署 Staging Worker。
4. 打开 Staging 页面，确认前端 API 地址指向 Staging Worker。
5. 运行只读 smoke test，检查 health、CORS、公开接口和未授权管理请求。
6. 管理员登录后登记内置适配器；登记结果默认禁用。
7. 逐个登记来源，保持禁用，完成来源审查后再按明确授权启用。
8. 记录测试结果、时间、分支/commit 和环境。

Staging Worker 模板不配置 Production Cron。不要通过 Staging 测试消耗来源配额或绕过来源访问控制。

## 3. 当前已知的 Staging 初始状态

此节是 2026-11-28 的项目交接快照，不是实时监控：

- Staging Pages 和 Worker 已完成首次部署。
- Pages 的 `VITE_API_BASE_URL` 已配置为 Staging Worker HTTPS origin。
- Staging 管理页面可以认证。
- 新建 KV namespace 初始为空；`/api/sources` 和 `/api/adapters` 返回空列表属于预期初始状态。
- Perverzija DB 曾登记用于验证关键词搜索，当前应保持禁用；其实现只支持 keyword 模式。
- PR #5 当时仍处于打开状态，未合并；其中的前端主题/组件和 Perverzija keyword-only 改动尚不能视为 Staging 已部署。

每次后续交接必须重新查询 GitHub PR/Actions 和 Cloudflare 实际状态，不能仅凭本快照判断当前部署版本。

## 4. 只读诊断顺序

1. `GET /api/health`：确认 Worker 正常响应。
2. `GET /api/sources`：检查公开来源配置；空数组可能是首次初始化。
3. `GET /api/adapters`：检查公开适配器配置；空数组可能是尚未登记或启用。
4. 检查 Pages 环境变量 `VITE_API_BASE_URL` 是否为对应环境的 Worker HTTPS origin。
5. 检查浏览器网络请求的状态码和 CORS，不要公开管理员令牌。
6. 检查 GitHub Actions 对应 commit 的 CI / deploy 工作流。
7. 对单个已启用 Provider 执行管理员测试；注意测试会请求上游来源。

## 5. 常见故障定位

### 页面提示未配置 VITE_API_BASE_URL

在对应 Cloudflare Pages 项目的正确构建环境设置 `VITE_API_BASE_URL` 为该环境 Worker 的 HTTPS origin，然后重新构建 Pages。不要填写路径、查询参数或管理员令牌。

### 管理页面显示需要令牌或认证失败

确认访问的是正确环境的 Pages，并使用对应 Worker 的管理员 token。不要在聊天中发送 token。若 Worker Secret 未配置，需要由维护者按部署手册设置；`wrangler secret put` 会创建并部署新 Worker 版本，不是只读操作。

### 搜索结果为 0 条

先确认 KV 中是否有启用的数据源、适配器是否启用且已实现、来源分类与搜索模式是否兼容。0 条不自动等于 Worker 故障。

### 连接测试成功但结果为 0

连接测试是固定探测词 smoke search。有效上游响应即可能成功，不要求返回结果。要确认某个查询是否能命中，使用「测试搜索」输入真实查询词。

### 409 version_conflict

重新读取当前配置，检查是否有其他管理员更新，再基于最新版本重做编辑。不要重放旧 ETag。

### 429 或来源超时

遵守来源返回的 Retry-After 和项目共享限流协调器策略。不要增加重试风暴、代理轮换或其他规避访问限制的行为。

## 6. Production 发布门槛

Production 发布是单独的受控操作，必须经过明确授权。发布前至少确认：

- Staging 功能验收通过；
- CI 对准备发布的精确 commit 成功；
- Production Pages、Worker、KV、Durable Object 和 Secrets 已独立配置；
- Production 部署 guard 已由维护者在授权后开启；
- Production 的来源与适配器配置独立审查，不复制 Staging KV；
- 回滚目标和配置恢复方式已准备。

发布流程为 develop → release PR → main；Production Worker 工作流仅针对 main 上通过 CI 的精确 commit。不要把 Staging Worker 手动部署命令改成 Production 目标。

## 7. 回滚原则

- **前端**：在 Cloudflare Pages 回滚到已知稳定部署，或通过修复 PR 恢复代码。
- **Worker**：使用已知稳定 commit 重新运行对应部署流程；先核对目标 Worker 名称和 GitHub Environment。
- **KV 配置**：代码回滚不会自动回滚 KV。修改前应记录配置版本和必要的非敏感配置快照；恢复时使用管理 API 的版本控制流程。
- **Secret**：不得通过 Git 回滚恢复 Secret。按独立的 Secret 轮换/恢复流程操作。
- 回滚后重新执行 health、CORS、公开接口和关键单源验证。

所有 Production 回滚、Secret 轮换、KV 大规模恢复都属于高影响操作，必须先获得明确授权。
