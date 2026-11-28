# Worker API 契约

> 文档类型：API 参考。复核日期：2026-11-28。以 `apps/worker/src/index.ts`、`admin-routes.ts` 和 `packages/shared` 的实现为准。本文记录当前路由，不承诺尚未实现的 API。

## 1. 通用约定

- Base URL：对应环境的 Worker HTTPS origin。
- API 请求与响应使用 JSON。所有带 `Origin` 的请求（包括健康检查）都会经过 Worker CORS allowlist 校验；未携带 `Origin` 的服务端请求不执行浏览器跨域校验。
- 管理接口使用 `Authorization: Bearer <ADMIN_API_TOKEN>`。
- 管理配置读取响应带 ETag；写入时必须通过 `If-Match` 发送当前版本。
- 管理 JSON 请求体受 Worker 通用 64 KiB 流式读取上限约束。
- 错误通常采用 `{ "error": { "code": "...", "message": "..." } }` 结构。

## 2. 公共接口

### `GET /api/health`

返回服务健康标记：

```json
{ "status": "ok", "service": "aio-resource-search-api" }
```

它只证明 Worker 正在响应，不证明 KV、Durable Object、Provider 或前端可用。

### `GET /api/sources`

返回启用的数据源公开信息：

```json
{ "version": 1, "sources": [] }
```

响应只包含启用来源，并省略管理员备注和 Secret binding 元数据。

### `GET /api/adapters`

返回启用且已实现的适配器公开信息：

```json
{ "version": 1, "adapters": [] }
```

### `POST /api/search`

请求：

```json
{
  "query": "ABP-123",
  "mode": "number",
  "contentCategory": "jav"
}
```

字段：
- `query`：必填，去除首尾空格后 1–120 字符。
- `mode`：必填，`number` 或 `keyword`。
- `contentCategory`：可选，`all` 或共享类型中定义的分类；省略时使用默认行为。

Worker 根据分类、来源启用状态、搜索模式和适配器兼容性执行搜索。单来源失败、超时不会使整个聚合请求直接中断。响应结构由共享类型定义和搜索实现共同决定。

## 3. 管理接口认证

以下接口均要求管理员 Bearer token。若 Worker 未配置 `ADMIN_API_TOKEN`，返回 503 `admin_not_configured`；令牌缺失或错误返回 401 `unauthorized`。

### 数据源

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/admin/sources` | 读取完整来源配置和版本 |
| POST | `/api/admin/sources` | 新增单个来源，或批量导入禁用的 external-search 来源 |
| PATCH | `/api/admin/sources/:sourceId` | 更新来源 |
| DELETE | `/api/admin/sources/:sourceId` | 删除来源 |
| PATCH | `/api/admin/sources/settings/field-priorities` | 更新字段来源优先级 |
| POST | `/api/admin/sources/:sourceId/test-connection` | 固定探测词单源 smoke search |
| POST | `/api/admin/sources/:sourceId/test-search` | 指定查询词和模式的单源测试 |

单源搜索测试请求：

```json
{ "query": "ABP-123", "mode": "number" }
```

测试响应包含 `sourceId`、`kind`、`status`、`elapsedMs`、`resultCount`、最多三个 `sampleResults`，失败时包含安全诊断字段。测试只允许已启用的 Provider；external-search 不能由 Worker 抓取或测试。

### 适配器

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/admin/adapters` | 读取完整适配器配置和版本 |
| POST | `/api/admin/adapters` | 新增适配器元数据 |
| POST | `/api/admin/adapters/register-implemented` | 登记当前 Worker 编译实现的适配器 |
| PATCH | `/api/admin/adapters/:adapterId` | 更新适配器管理字段 |
| DELETE | `/api/admin/adapters/:adapterId` | 删除未被来源引用的适配器 |

适配器登记不会生成 Worker 代码。只有编译时 Provider registry 中存在实现的适配器才能被标记为已实现并启用。

## 4. ETag 与并发控制

所有管理配置写入都要求当前 ETag：

- 缺少 `If-Match`：428 `precondition_required`。
- 版本已变化：409 `version_conflict`，响应包含当前版本。
- 收到冲突后重新 GET，基于最新配置重新应用修改；不要盲目重试旧请求。

ETag 用于避免常见的陈旧编辑覆盖，不是 KV 分布式锁。避免多个管理员同时修改同一配置。

## 5. 常见错误码

| HTTP | 错误码示例 | 含义 |
|---|---|---|
| 400 | `invalid_json`、`invalid_search_request` | JSON 无效、请求体超限或搜索请求结构无效 |
| 401 | `unauthorized` | 管理员令牌缺失或无效 |
| 403 | `origin_not_allowed` | 请求来源不在 Worker CORS allowlist 中 |
| 404 | `not_found`、`source_not_found`、`adapter_not_found` | 路由或资源不存在 |
| 405 | `method_not_allowed` | 路由不支持该 HTTP 方法 |
| 409 | `version_conflict`、`source_disabled`、`adapter_unavailable`、`adapter_in_use` | 配置版本冲突、来源未启用或适配器状态冲突 |
| 422 | `invalid_query`、`invalid_search_mode`、`invalid_content_category`、`invalid_source`、`unsupported_search_mode`、`external_search_not_testable` | 输入、来源配置或操作不符合契约 |
| 428 | `precondition_required` | 管理配置写操作缺少有效的 `If-Match` |
| 500 | `internal_error` | Worker 未预期的内部错误 |
| 503 | `admin_not_configured` | Worker 未配置管理员 Secret |

以上为常见错误示例，不是穷尽列表；适配器和数据源管理还会返回 `adapter_exists`、`adapter_limit`、`adapter_incompatible`、`invalid_adapter`、`invalid_source_batch`、`source_exists`、`source_limit`、`invalid_field_priorities` 等具体校验错误。

## 6. 安全边界

不要把管理员令牌放入前端构建变量、来源配置、日志或文档示例以外的真实配置。Secret 值只存在 Worker Secret；KV 仅允许保存必要的 Secret binding 名称。来源测试样例刻意限制字段，不返回完整媒体链接或凭据。
