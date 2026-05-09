# MixTV Next.js 单体新项目架构

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设计一套适合长期演进的 MixTV 新项目架构，保持单一 Next.js 部署单体，但在代码内部做到结构清晰、模块解耦、边界稳定。

**Architecture:** 采用 Next.js Modular Monolith。对外只有一个 Next.js 应用，对内按领域模块拆分，页面只做编排，业务逻辑进入模块内部。共享能力收敛到少量稳定的 shared kernel 和 infrastructure 层，外部平台统一通过 integration adapter 接入。

**Tech Stack:** Next.js, React, TypeScript, TanStack Query, Zod, TailwindCSS, Web Worker, Fetch API, 可选播放器库（ArtPlayer / HLS.js / Vidstack）。

---

## 1. 架构目标

这个新项目不继承旧代码结构，不保留 `src/lib` 这种大杂烩式组织方式，也不沿用历史兼容包袱。目标是从第一天开始就建立一套适合长期演进的结构：

- 保持单体部署，降低运维和调试复杂度。
- 保持模块边界清晰，避免页面、组件、数据层互相缠绕。
- 保持外部依赖隔离，便于替换数据源、缓存、存储实现。
- 保持业务可测试、可替换、可迁移。
- 保持未来可拆分能力，但不提前引入微服务复杂度。

## 2. 架构原则

1. 业务按领域组织，不按技术类型组织。
2. 页面只做组合和跳转，不承载核心业务规则。
3. 每个模块都要有清晰入口和稳定公开接口。
4. 外部平台接入必须通过 adapter，不允许散落在页面里。
5. 存储、缓存、配置、认证统一抽象，禁止业务代码直接耦合具体实现。
6. 共享能力尽量少，避免形成“全局万能工具层”。
7. 任何跨模块通信优先通过事件或公开 API，不直接调用内部实现。
8. 先保证清晰和稳定，再谈性能优化和进一步拆分。

## 3. 总体分层

推荐的层次如下：

### 3.1 App Shell

负责 Next.js 路由、布局、全局 Provider、SEO、导航、认证跳转、页面壳子。它是“壳”，不是业务层。

### 3.2 Shared Kernel

放最稳定、最底层、跨模块共享的能力：

- 基础类型
- 错误模型
- 通用工具函数
- 环境变量访问
- 统一日志
- 统一配置读取接口
- 统一认证上下文
- 统一缓存接口
- 统一存储接口
- 统一事件定义

### 3.3 Feature Modules

每个业务域一个模块，例如：

- `auth`
- `search`
- `playback`
- `favorites`
- `reminders`
- `watch-room`
- `live`
- `shortdrama`
- `ai-recommend`
- `admin`
- `stats`
- `tvbox`
- `download`

每个模块内部都采用相同的组织方式：`domain`、`application`、`infrastructure`、`ui`、`server`。

### 3.4 Integrations

用于封装外部平台和第三方数据源：

- Douban
- TMDB
- Bangumi
- YouTube
- Bilibili
- Emby
- IPTV
- 网盘搜索
- 短剧源

### 3.5 Infrastructure

用于承载具体技术实现：

- Redis / Upstash / Kvrocks
- WebSocket
- Web Worker
- 代理与转发
- 下载实现
- 遥测与监控
- 文件或 blob 存储

## 4. 建议目录结构

```text
src/
  app/
    layout.tsx
    page.tsx
    api/
      ...route.ts
    (route groups)/
      login/
      register/
      watch-room/
      search/
      play/
      admin/

  modules/
    auth/
      domain/
      application/
      infrastructure/
      server/
      ui/
      index.ts
    search/
    playback/
    favorites/
    reminders/
    watch-room/
    live/
    shortdrama/
    ai-recommend/
    admin/
    stats/
    tvbox/
    download/

  integrations/
    douban/
    tmdb/
    bangumi/
    youtube/
    bilibili/
    emby/
    iptv/
    netdisk/
    shortdrama-sources/

  shared/
    auth/
    cache/
    config/
    constants/
    errors/
    events/
    logger/
    storage/
    types/
    utils/

  infrastructure/
    db/
    redis/
    upstash/
    kvrocks/
    workers/
    websocket/
    proxy/
    telemetry/
    fetch/

  components/
    ui/
    layout/
    common/

  styles/
  tests/
```

## 5. 模块边界设计

### 5.1 `auth`

职责：登录、注册、OIDC、Telegram、可信网络、权限、会话管理。

公开能力：

- `login`
- `logout`
- `getSession`
- `hasPermission`
- `requireAuth`

### 5.2 `search`

职责：统一搜索入口、搜索建议、搜索历史、多源聚合、排序和结果标准化。

它不直接负责播放，也不负责收藏，只输出标准化搜索结果。

### 5.3 `playback`

职责：播放页、播放记录、继续播放、跳过片头片尾、播放器配置、播放统计采集。

它可以调用 `integrations` 获取播放源，但不关心外部平台内部细节。

### 5.4 `favorites`

职责：收藏、取消收藏、批量操作、收藏统计、收藏分类过滤。

### 5.5 `reminders`

职责：想看、即将上映提醒、发布提醒、自动通知。

### 5.6 `watch-room`

职责：多人观影同步、聊天、屏幕共享、语音、房间状态。

这类复杂模块必须独立，不与主播放页混写。

### 5.7 `live`

职责：直播源、频道、EPG、订阅导入、直播播放兼容。

### 5.8 `shortdrama`

职责：短剧列表、详情、播放、来源切换、缓存、推荐。

### 5.9 `ai-recommend`

职责：AI 推荐、聊天式推荐、搜索增强、推荐缓存、权限校验。

### 5.10 `admin`

职责：全站配置、源管理、用户管理、缓存管理、性能监控、广告过滤、TVBox 安全设置。

### 5.11 `stats`

职责：播放统计、活跃度统计、内容热度、崩溃日志、性能面板。

### 5.12 `tvbox`

职责：TVBox 接入、订阅、安全控制、诊断、代理策略。

### 5.13 `download`

职责：下载任务、下载队列、流保存、状态持久化。

## 6. 模块内部标准结构

每个模块建议固定为以下结构：

- `domain`
  - 领域实体、业务规则、纯函数、状态类型。
- `application`
  - 用例层，负责编排领域对象与外部依赖。
- `infrastructure`
  - 数据源、持久化、外部 API、缓存、事件订阅。
- `ui`
  - 页面组件、弹窗、列表、表单、控制面板。
- `server`
  - route handler、server action、SSR 数据准备。
- `index.ts`
  - 公开模块入口，只导出允许外部使用的 API。

这样做的目的，是让模块内部可以随意重构实现，但外部调用方几乎不需要跟着改。

## 7. 目录职责约束

### 7.1 `app`

只做：

- 路由定义
- layout 组合
- 页面编排
- SEO 和 metadata
- 认证跳转
- 全局壳子

不做：

- 数据库访问
- 外部平台适配
- 复杂业务规则

### 7.2 `shared`

只放最底层且稳定的东西。`shared` 不应该知道任何具体业务模块。

### 7.3 `modules`

模块才是业务真正的主人。所有业务规则、状态流、用例、模块 UI 都应该在这里。

### 7.4 `integrations`

只解决“怎么和第三方说话”，不解决“业务怎么理解这些数据”。

### 7.5 `infrastructure`

只解决“怎么存、怎么连、怎么传输、怎么监控”，不解决业务语义。

## 8. 数据流设计

### 8.1 读数据

1. `app` 进入路由。
2. 对应模块的 `server` 层准备 SSR 初始数据。
3. 客户端通过模块自己的 query hooks 拉取增量数据。
4. `application` 聚合 `integrations` 和 `infrastructure` 的输出。
5. `ui` 只负责渲染结果。

### 8.2 写数据

1. UI 触发交互。
2. 模块的 `application` 处理用例。
3. `infrastructure` 落库或调用外部 API。
4. 通过事件或缓存失效通知相关读模型刷新。

### 8.3 跨模块通信

优先使用：

- 公开 service API
- 领域事件
- 共享的 query invalidation 机制

避免：

- 直接 import 对方内部文件
- 直接读取对方私有状态
- 通过全局变量传业务数据

## 9. 状态管理策略

- 页面级请求状态：TanStack Query
- 组件局部状态：React state / reducer
- 模块间同步：事件或 query invalidation
- 长期持久化：存储层或后端配置中心

不要把“全站状态”塞进一个超级 store。这个项目不适合再出现新的全局单点复杂状态中心。

## 10. 存储与缓存

建议做两层抽象：

### 10.1 Storage Port

定义统一接口，描述“能做什么”，不描述“怎么实现”。

### 10.2 Storage Adapter

具体实现可以是：

- Redis
- Upstash
- Kvrocks
- 本地模式

缓存策略建议：

- 配置缓存单独管理
- 内容缓存与用户缓存分开
- 搜索缓存、详情缓存、首页缓存分开
- 所有缓存 key 规范化命名

## 11. 认证与权限

认证必须作为基础设施中的核心能力，而不是页面附件。

建议支持：

- 用户名密码登录
- OIDC
- Telegram 登录
- 可信网络自动登录
- 管理员权限
- 用户组权限

权限判断建议集中在 `auth` 模块，对外提供统一 `hasPermission()` 或 `requirePermission()`。

## 12. 外部集成策略

每个第三方平台都应该有自己的 adapter 和数据规范，不允许业务层直接认识平台原始格式。

例如：

- Douban adapter 输出标准化内容详情
- TMDB adapter 输出演员、作品、推荐信息
- Bangumi adapter 输出番剧和日历结构
- YouTube / Bilibili adapter 输出视频列表、搜索结果、播放入口

业务层只消费标准化后的结果。

## 13. API 设计

建议保持一个 Next.js 单体 API，但按模块分区：

```text
src/app/api/
  auth/
  search/
  playback/
  favorites/
  reminders/
  watch-room/
  live/
  shortdrama/
  ai-recommend/
  admin/
  stats/
  tvbox/
  download/
```

每个 route handler 只做：

- 参数校验
- 调用模块 use case
- 返回标准响应

不要在 route handler 里写长业务逻辑。

## 14. 前端组件策略

组件层分成三类：

### 14.1 纯 UI 组件

例如按钮、卡片、弹窗、表格、标签、布局容器。

### 14.2 领域组件

例如搜索结果列表、播放器控制条、收藏列表、观影房面板。

### 14.3 页面编排组件

例如首页、搜索页、播放页、管理页。

原则：

- UI 组件不拉数据。
- 领域组件尽量少知道页面路由。
- 页面编排组件只负责拼装模块。

## 15. 错误处理与可观测性

建议统一错误模型：

- 错误码
- 错误分级
- 是否可重试
- 是否显示给用户
- 是否需要上报

同时建立统一的日志和监控入口：

- API 性能监控
- 前端崩溃日志
- 关键事件埋点
- 业务错误上报

这样后期排查问题会比现在清晰很多。

## 16. 测试策略

建议从一开始就形成三层测试：

1. 领域层单元测试：纯函数、规则、转换逻辑。
2. 模块层测试：用例层，mock 外部 adapter。
3. 路由/组件测试：页面编排和关键交互。

优先测试：

- 认证
- 配置合并
- 收藏/提醒/播放记录
- 搜索聚合
- 权限判断
- 缓存失效

## 17. 推荐技术选型

新项目建议起步就固定以下组合：

- Next.js App Router
- React 19
- TypeScript
- TailwindCSS
- TanStack Query
- Zod
- Web Worker
- Fetch / Request 封装
- 统一存储抽象

播放器相关按需要接入：

- ArtPlayer
- HLS.js
- Vidstack

## 18. 迁移策略

因为这是新项目，所以建议完全抛弃历史包袱：

- 不迁移旧目录结构
- 不迁移旧业务耦合方式
- 不保留旧全局工具层
- 不保留隐式依赖关系

如果将来需要迁移数据，只迁移数据，不迁移架构。

## 19. 推荐启动顺序

如果开始重做，建议按这个顺序搭建：

1. `shared`
2. `auth`
3. `config`
4. `storage`
5. `search`
6. `playback`
7. `favorites`
8. `reminders`
9. `admin`
10. `integrations`
11. `watch-room`
12. `ai-recommend`
13. `stats`
14. `tvbox`
15. `live`
16. `shortdrama`
17. `download`

## 20. 最终目标

这套架构的核心目标不是“更炫”，而是：

- 结构清晰
- 模块解耦
- 业务稳定
- 便于协作
- 便于测试
- 便于长期演进
- 便于未来按模块拆分，但不强迫现在就拆

如果要用一句话概括：

**一个 Next.js 单体，但内部像一个组织良好的平台，而不是一个堆满历史遗留的项目。**
