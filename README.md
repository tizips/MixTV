# MixTV

MixTV 是一个基于 Next.js 16 构建的单体式影视站点，中文说明为“影视聚合播放平台”，围绕内容聚合、在线播放、收藏、观看历史、搜索和后台配置展开。

## 功能概览

- 首页内容聚合与模块开关配置
- 影视搜索与搜索历史
- 在线播放与播放进度记录
- 收藏管理与继续观看
- 观看历史与历史更新检查
- 管理后台：站点配置、首页配置、视频源、缓存、用户与统计
- 登录鉴权与访问控制

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Ant Design
- HeroUI
- Redis / Upstash
- Vitest

## 项目结构

- `src/app`：路由、页面和 API 入口
- `src/modules`：按业务域拆分的核心逻辑
- `src/infrastructure`：具体基础设施适配器
- `src/shared`：跨模块共享契约
- `src/integrations`：第三方数据源适配

## 开发运行

```bash
bun install
bun run dev
```

开发服务器默认运行在 `http://localhost:3000`。

## 常用脚本

- `bun run dev`：启动开发环境
- `bun run build`：构建生产版本
- `bun run start`：启动生产服务
- `bun run lint`：运行 ESLint
- `bun run test`：运行 Vitest
- `bun run test:ui`：运行 Vitest UI

## 环境变量

至少需要配置以下变量：

- `NEXT_PUBLIC_SITE_NAME`：站点名称
- `USERNAME`：管理员账号
- `PASSWORD`：管理员密码
- `AUTH_SECRET`：鉴权密钥
- `STORAGE_TYPE`：`redis` 或 `upstash`
- `REDIS_URL`：Redis 模式地址
- `UPSTASH_REDIS_REST_URL`：Upstash 模式地址
- `UPSTASH_REDIS_REST_TOKEN`：Upstash 模式令牌

## 相关文档

- [首页模块说明](docs/features/HOME_PAGE_MODULES.md)
- [单体架构设计](docs/superpowers/specs/2026-05-09-mixtv-nextjs-monolith-design.md)
