# Frontend Component Reference

This document records reusable Vue components with a stable cross-module interface. It is intentionally a small inventory, not a requirement to turn every page fragment into a shared component.

## Shared components

### AdminLoginPanel

**File:** `apps/web/src/components/AdminLoginPanel.vue`

**Purpose:** Shared administrator-token entry UI used by source and adapter management. It keeps the unsubmitted token and show/hide toggle local to the component; the token is emitted to the owning manager and is not written to browser storage.

**Props**

| Prop | Type | Required | Description |
|---|---|---:|---|
| `loading` | `boolean` | Yes | Disables submission and changes the submit label while authentication is in progress. |
| `authenticated` | `boolean` | Yes | Clears the local input after the parent confirms authentication. |
| `description` | `string` | Yes | Context-specific explanatory text shown below the heading. |

**Events**

| Event | Payload | Description |
|---|---|---|
| `submit` | `token: string` | Emits the trimmed token when the form is submitted and is not already loading. |

**Slots:** None.

**Usage**

```vue
<AdminLoginPanel
  :loading="manager.loading.value"
  :authenticated="manager.authenticated.value"
  description="请输入 Worker 管理令牌。令牌仅保存在当前页面内存中。"
  @submit="manager.login"
/>
```

## Extraction criteria

Extract a component when at least one of these is true:

- The same interaction or visual unit is repeated across independent modules.
- It has a stable, meaningful props/events/slots contract.
- It owns a coherent interaction that should be tested or maintained independently.

Do not extract solely because a template block is long. Keep one-off domain forms and result-specific markup with their owning page until a real reuse boundary appears.
