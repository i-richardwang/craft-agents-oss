# DataPilot Branch Guide

> Branch: `feature/data-analysis-agent`
> Base: `main` (commit `0a778e2`)
> Purpose: 将 Craft Agent 改造为面向数据分析场景的垂直 Agent — **DataPilot**
>
> **Last updated:** 2026-03-11

## 目标

基于 Craft Agent 开源项目，构建一个专注于数据分析的垂直 Agent。改造分阶段进行，优先处理用户感知层（提示词、品牌），再逐步深入到内部标识和功能增强。

---

## 已完成的改动

### P0 — 品牌提示词层（用户直接感知）

将 Agent 的身份从 "Craft Agent" 替换为 "DataPilot"。

| 文件 | 改动内容 |
|------|----------|
| `packages/shared/src/prompts/system.ts` | 身份定义、自称指令、Git co-author、CLI 章节标题及命令、配置文档表格、Mini agent 提示词、文档搜索引用、开发者反馈团队名、环境标记注释（共 11 处） |
| `packages/shared/src/prompts/print-system-prompt.ts` | 调试脚本标题和注释（5 处） |
| `packages/shared/src/auth/oauth.ts` | `CLIENT_NAME = 'DataPilot'` |
| `packages/shared/src/branding.ts` | 品牌注释 |

**合并关注点:** 上游频繁修改 `system.ts`。合并时需检查：
- 上游是否新增了包含 "Craft Agent" 的提示词段落（需同步替换）
- 上游是否重写了我们已修改的行（需保留 DataPilot 版本）
- `print-system-prompt.ts` 冲突风险低，主要是注释文本

### P1（部分）— 数据目录 & 环境变量

将用户数据目录从 `~/.craft-agent/` 改为 `~/.datapilot/`，环境变量 `CRAFT_CONFIG_DIR` 改为 `DATAPILOT_CONFIG_DIR`。涉及 83 个文件。

| 改动类别 | 涉及文件 | 说明 |
|----------|----------|------|
| 核心路径常量 | `config/paths.ts`、`workspaces/storage.ts` 及 12 个本地定义 | `CONFIG_DIR` 从 `.craft-agent` → `.datapilot` |
| 环境变量 | `paths.ts`、`permissions-config.ts`、`electron-dev.ts`、`session-mcp-server` 等 6 处 | `CRAFT_CONFIG_DIR` → `DATAPILOT_CONFIG_DIR` |
| 正则 & 路径匹配 | `config-validator.ts`（9 个正则）、`path-processor.ts`（4 个）、`mode-manager.ts`（3 处）、`UserMessageBubble.tsx`（1 处） | `\.craft-agent` → `\.datapilot`，静默失败风险高 |
| 变量名 | `logo.ts`、`config-validate.ts`、`config-validator.ts` | `CRAFT_AGENT_DIR` → `DATAPILOT_DIR`、`craftAgentRoot` → `datapilotRoot`、`CRAFT_AGENT_CONFIG_PATTERNS` → `DATAPILOT_CONFIG_PATTERNS`、`isCraftAgentConfig` → `isDataPilotConfig` |
| MCP & 插件标识 | `validation.ts`、`workspaces/storage.ts` | `craft-agent-validator` → `datapilot-validator`、`craft-workspace-` → `datapilot-workspace-` |
| UI 组件 | `EditPopover.tsx`、`AppearanceSettingsPage.tsx`、`PermissionsSettingsPage.tsx` 等 8 个 | 用户可见的路径引导文本 |
| 测试文件 | `mode-manager.test.ts`（34 处）等 12 个测试文件 | mock 路径和环境变量 |
| 文档 | `README.md`、`CLAUDE.md`、`resources/docs/*.md`、release notes 等 | 所有 `.craft-agent` 路径引用（含 `dist/` 编译版本） |
| 脚本 & 工具 | `electron-dev.ts`、`build-server.ts`、ESLint 规则等 | 多实例开发、Docker、错误信息 |

**未改动：** 加密存储中的 `MAGIC_BYTES`（`CRAFT01`）和密钥派生盐（`craft-agent-v2`）保持原值，仅改了路径。

**合并关注点:** 上游新增包含 `.craft-agent` 路径的代码需同步替换。重点关注：
- `config/paths.ts` — 核心路径定义
- `agent/core/config-validator.ts` — 正则模式，上游可能新增 config 类型
- `agent/mode-manager.ts` — 路径匹配逻辑
- `agent/permissions-config.ts` — 权限目录解析

---

## 已知问题

| 问题 | 说明 |
|------|------|
| `createBackend` 测试在新环境失败 | `~/.datapilot/config-defaults.json` 不存在时 `loadConfigDefaults()` 抛异常。需先启动应用创建目录，或在测试中 mock。属于环境依赖，非代码 bug。 |
| `TRADEMARK.md` 中 bundle ID 被误改 | 文档替换时将 `com.lukilabs.craft-agent` 改为了 `com.lukilabs.datapilot`，但实际 bundle ID 未改动（属于 P3 暂不改动范围）。文档与实际不一致，后续需决定是否真正修改 bundle ID。 |

---

## 未来计划的改动

### P1 剩余 — 内部标识层

| 改动项 | 涉及范围 | 风险说明 |
|--------|----------|---------|
| `@craft-agent/*` 包名 → `@datapilot/*` | 12 个 package.json + 数百个 import + tsconfig path mapping | **极高** — 破坏所有模块解析，需全量修改 |
| 其余 `CRAFT_*` 环境变量 → `DATAPILOT_*` | 12+ 个环境变量（如 `CRAFT_SERVER_TOKEN` 等） | **高** — 需同步修改所有引用点 |
| CLI wrapper 脚本 `craft-agent` → `datapilot` | `resources/bin/` 下 4 个脚本 | **中** |
| `CraftAgent` 类名 | `craft-agent.ts` 中的类和兼容别名 | **中** — 内部 API 变更 |
| `CRAFT_FEATURE_*` feature flag | `feature-flags.ts` + 引用处 | **中** |

**建议:** 剩余改动作为独立 PR，充分测试后再合并。P1 改动后与上游合并会产生大量冲突，需权衡是否值得。

### P2 剩余 — 文档 & 元数据

| 改动项 | 涉及范围 |
|--------|----------|
| 文档中的 "Craft Agent(s)" 品牌名文本 | `README.md`, `SECURITY.md`, `TRADEMARK.md` 等 |
| `.github/ISSUE_TEMPLATE/` | Issue 模板描述 |
| 根 `package.json` `"name"` 字段 | 元数据 |

### P3 — 暂不改动（依赖外部服务或影响安全）

| 改动项 | 原因 |
|--------|------|
| `craft.do` / `agents.craft.do` / `mcp.craft.do` 域名 | 后端服务地址，改了会断连 |
| `com.lukilabs.craft-agent` bundle ID | 影响签名和数据迁移 |
| `lukilabs/craft-agents-oss` GitHub 仓库引用 | 实际仓库地址 |
| `*@craft.do` 邮箱 | 真实联系方式 |

---

## 合并上游更新指南

### 关注文件

除 `FORK_MERGE_GUIDE.md` 中已列出的文件外，本分支额外需要关注：

| 文件 | 关注点 |
|------|--------|
| `packages/shared/src/prompts/system.ts` | 上游新增的 "Craft Agent" 文本需替换为 "DataPilot" |
| `packages/shared/src/prompts/print-system-prompt.ts` | 注释中的品牌名和示例路径 |
| `packages/shared/src/auth/oauth.ts` | CLIENT_NAME |
| `packages/shared/src/branding.ts` | 品牌常量 |
| `packages/shared/src/config/paths.ts` | 核心路径定义，上游可能修改注释或新增逻辑 |
| `packages/shared/src/agent/core/config-validator.ts` | 正则模式，上游可能新增 config 类型 |
| `packages/shared/src/agent/core/path-processor.ts` | 路径检测正则 |
| `packages/shared/src/agent/mode-manager.ts` | 路径匹配条件 |
| `packages/shared/src/agent/permissions-config.ts` | 权限目录路径和环境变量 |

### 合并步骤补充

在 `FORK_MERGE_GUIDE.md` 的合并检查清单基础上，额外执行：

1. **合并后全局搜索 `Craft Agent`**（区分大小写），确认提示词中无遗漏
   ```bash
   grep -rn "Craft Agent" packages/shared/src/prompts/
   ```
2. **合并后全局搜索 `.craft-agent`**，确认数据目录路径无遗漏
   ```bash
   grep -rn '\.craft-agent' --include='*.ts' --include='*.tsx' --include='*.md' . | grep -v node_modules
   ```
3. **合并后搜索 `CRAFT_CONFIG_DIR`**，确认环境变量已统一为 `DATAPILOT_CONFIG_DIR`
4. **检查上游是否新增了身份相关的提示词**，如有，需同步改为 DataPilot
5. **检查上游是否新增了 `@craft-agent/` 引用或 `CRAFT_*` 环境变量**

---

## 数据分析场景增强（规划中）

后续可考虑的数据分析专项能力：

- 增强数据源连接（数据库、CSV/Excel、API）
- 数据清洗和转换的内置 skill
- 可视化图表生成（ECharts / Matplotlib）
- 统计分析和建模辅助
- 数据质量检测
- 自动报告生成
