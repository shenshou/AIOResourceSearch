# 文档中心

> 文档入口与状态说明。项目代码和运行配置是行为事实来源；本目录中的状态报告不能替代实时 Cloudflare / GitHub 状态。

## 按主题阅读

| 主题 | 文档 | 适用对象 |
|---|---|---|
| 产品 | [产品概览与用户指南](product/user-guide.md) | 所有使用者 |
| 管理 | [管理员操作手册](product/admin-guide.md) | 管理员 |
| 设计 | [UI 设计与全局组件规范](design/ui-system.md) | 前端开发者 |
| API | [Worker API 契约](api/worker-api.md) | 前后端开发者、集成者 |
| 运维 | [部署与运维手册](operations/runbook.md) | 项目维护者 |
| 文档治理 | [文档维护规范](governance/documentation-standards.md) | 所有贡献者 |

## 现有专项文档

### 架构与开发

- [系统架构](architecture.md)
- [开发规范](development-standards.md)
- [开发路线图](development-roadmap.md)
- [前端组件参考](frontend-components.md)
- [Cloudflare 部署指南](cloudflare-deployment.md)
- [Provider 共享限流设计](provider-rate-limiting.md)
- [JAV 元数据聚合、字段优先级与来源归属](providers/jav-metadata-aggregation.md)

### 数据源目录与审查

- [数据源目录](source-catalog.md)
- [数据源目录治理政策](source-catalog-policy.md)
- [数据源审查记录](source-review.md)
- [数据源测试说明](source-testing.md)
- [延后研究的来源清单](deferred-source-backlog.md)
- [JAV 来源状态记录](jav-source-status.md)
- [资源链接来源状态记录](resource-link-source-status.md)
- [Provider 接入准备度](provider-integration-readiness.md)
- [年龄保障准备度](age-assurance-readiness.md)

### Provider 专项

见 [providers/](providers/) 目录，包括每个 Provider 的协议、字段映射、限流、测试和启用边界。

## 历史状态与研究快照

以下文件包含特定分支、提交或日期的状态结论，阅读时必须同时查看其基准信息；不能直接视为当前实时状态：

- `jav-source-status.md`：基于指定历史分支和 commit 的 JAV 来源核验盘点。
- `resource-link-source-status.md`：基于 2026-11-27 基线的资源链接能力盘点。
- `source-review.md`：最近审查日期为 2026-11-27 的候选来源审查日志。
- `age-assurance-readiness.md`：2026-11-26 的年龄保障法律/政策研究基线。
- `provider-integration-readiness.md`：Provider 接入准备度研究，必须逐项复核上游接口和政策。
- `deferred-source-backlog.md`：持续维护的暂缓开发清单，不代表永久排除。

## 文档状态约定

- **规范 / 契约**：描述当前必须遵守的规则；变更代码或接口时同步更新。
- **操作手册**：描述可重复执行的操作步骤；界面或部署流程变化时同步更新。
- **研究记录 / 状态快照**：记录某个时间点的调查结论，不代表当前实时可用性。标题或开头必须注明记录日期、适用范围和复核要求。
- **候选目录**：保留尚未实现、尚未验证或暂缓的来源，不代表已经登记、启用或获准抓取。

## 目录迁移说明

本次先建立主题化文档入口和新手册目录。现有根目录及 `providers/` 下的专项研究文档暂时保留原路径，以免一次性移动造成大量相对链接失效；后续在逐份校验链接和内容归属后再迁移。不要仅凭文件所在目录推断文档是否过期。
