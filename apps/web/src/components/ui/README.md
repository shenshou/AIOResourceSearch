# 全局 UI 组件

这里存放 AIOResourceSearch 前端共用的基础 UI 组件。组件只负责通用展示与交互，数据请求、业务校验和状态管理仍由页面或 composable 负责。

## 组件清单

| 组件 | 用途 |
| --- | --- |
| `UiButton` | 主按钮、次按钮、危险按钮、幽灵按钮；支持尺寸、加载和块级布局 |
| `UiInput` | 单行输入，支持标签、提示、错误和原生 input 属性透传 |
| `UiSelect` | 原生下拉选择，支持 v-model、标签和选项插槽 |
| `UiTextarea` | 多行输入，支持标签、提示和错误 |
| `UiCard` | 统一卡片容器 |
| `UiEmptyState` | 空状态 |
| `UiModal` | 统一弹窗容器，支持标题、内容和 footer 插槽 |
| `UiBadge` | 状态标签 |
| `UiAlert` | 信息、成功、警告和错误提示 |

从 `components/ui` 统一导入：

```ts
import { UiButton, UiInput, UiSelect, UiTextarea, UiCard, UiEmptyState, UiModal, UiBadge, UiAlert } from "../../components/ui";
```

## 约定

- 优先使用 `v-model` 管理输入值。
- 按钮默认 `type="button"`，只有表单提交按钮显式设置 `type="submit"`。
- 组件不直接访问 API、KV、Worker 或 localStorage。
- 页面不重复定义基础颜色；样式统一使用 `theme.css` 的语义化颜色与组件类。
- 需要新增基础控件时，先检查本目录是否已有可扩展组件，避免出现同类组件多套实现。
