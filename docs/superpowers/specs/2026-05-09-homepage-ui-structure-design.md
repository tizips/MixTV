# MixTV 首页UI结构设计

**日期：** 2026-05-09  
**状态：** 已批准  
**目标：** 实现首页UI结构和布局，使用Mock数据，采用Netflix风格加磨砂玻璃效果

## 1. 设计目标

基于 `docs/features/HOME_PAGE_MODULES.md` 的产品需求，实现首页的UI结构和视觉呈现。本阶段重点是：

1. 建立清晰的模块化架构，为后续接入真实数据预留接口
2. 实现Netflix风格的视觉设计，包含磨砂玻璃效果
3. 使用Mock数据完成首页可配置模块和欢迎横幅开关的UI展示
4. 保持代码结构符合项目的模块化单体架构原则

## 2. 架构方案

### 2.1 模块位置

创建 `src/modules/homepage` 模块，遵循项目的模块化单体架构。

### 2.2 模块内部结构

```
src/modules/homepage/
├── domain/
│   ├── homepage-config.ts      # 首页配置类型（9个开关，含欢迎横幅）
│   ├── content-types.ts        # 内容类型定义（电影、剧集、动漫、综艺、短剧）
│   └── section-types.ts        # 区块类型（Hero、Carousel等）
├── application/
│   ├── homepage-service.ts     # 首页数据聚合服务
│   └── mock-data-provider.ts   # Mock数据提供者
├── ui/
│   ├── hero-banner.tsx         # Hero轮播组件
│   ├── content-carousel.tsx    # 横向滚动卡片组件
│   ├── content-section.tsx     # 内容区块容器
│   ├── content-card.tsx        # 单个内容卡片
│   ├── loading-overlay.tsx     # Cinematic Loading动画
│   ├── welcome-banner.tsx      # 欢迎横幅
│   └── homepage-shell.tsx      # 首页整体布局
└── index.ts                    # 公开API
```

### 2.3 分层职责

**Domain层：**
- 定义首页配置类型（`HomepageConfig`），包含8个布尔开关
- 定义内容类型（`Movie`, `TVShow`, `Anime`, `Variety`, `ShortDrama`）
- 定义区块类型（`HeroItem`, `CarouselSection`）
- 不依赖任何外部实现，纯类型定义

**Application层：**
- `homepage-service.ts`：提供 `getHomepageData()` 方法，聚合所有首页数据
- `mock-data-provider.ts`：生成Mock数据，模拟真实API返回结构
- 当前返回硬编码数据，未来替换为真实API调用

**UI层：**
- 所有React组件，只依赖domain类型和application服务
- 组件接收props，保持纯展示逻辑
- 使用Tailwind CSS实现样式

## 3. 数据流设计

```
src/app/page.tsx (Server Component)
    ↓
调用 homepage-service.getHomepageData()
    ↓
mock-data-provider 返回Mock数据
    ↓
传递给 homepage-shell.tsx (Client Component)
    ↓
渲染各个UI组件（Hero、Carousel等）
```

**关键决策：**
1. `page.tsx` 作为Server Component获取数据，利用Next.js的服务端渲染能力
2. `homepage-shell.tsx` 作为Client Component处理交互（轮播、滚动、悬停）
3. 所有UI组件接收props，不直接调用服务
4. Mock数据结构与未来真实API保持一致

## 4. 首页模块清单

根据产品文档，首页包含以下内容：

### 4.1 固定展示区域（不受配置控制）

1. **加载态遮罩**：Cinematic Loading动画
2. **欢迎横幅**：顶部问候语和站点视觉横幅，可由 `showWelcomeBanner` 控制显示
3. **Telegram欢迎弹窗**：（本阶段暂不实现）
4. **公告弹窗**：（本阶段暂不实现）

### 4.2 可配置模块区域（受配置控制）

按默认展示顺序：

1. **Hero Banner 轮播**：`showHeroBanner`
2. **继续观看**：`showContinueWatching`
3. **即将上映**：`showUpcomingReleases`
4. **热门电影**：`showHotMovies`
5. **热门剧集**：`showHotTvShows`
6. **新番放送**：`showNewAnime`
7. **热门综艺**：`showHotVariety`
8. **热门短剧**：`showHotShortDramas`

### 4.3 配置逻辑

- 每个模块和欢迎横幅分别对应一个布尔开关
- 模块开启但数据为空时，不展示空白模块
- 本阶段所有开关默认为 `true`，Mock数据保证每个模块都有内容

## 5. UI设计规范

### 5.1 整体风格

**Netflix风格 + 磨砂玻璃效果**

- 深色主题：`bg-gray-900` 或 `bg-black`
- 磨砂玻璃效果：`backdrop-blur-md` + `bg-black/30`
- 大图背景，渐变遮罩
- 横向滚动卡片，隐藏滚动条
- 悬停交互：放大、阴影、信息显示

### 5.2 Hero Banner

**布局：**
- 全屏或接近全屏高度（`h-[80vh]` 或 `h-[600px]`）
- 背景大图，渐变遮罩（从透明到黑色）
- 左侧或中央信息卡片

**信息卡片：**
- 磨砂玻璃背景：`backdrop-blur-md bg-black/30`
- 包含：标题、简介、评分、播放按钮、详情按钮
- 文字颜色：`text-white`
- 按钮：主按钮（播放）使用高亮色，次按钮（详情）使用透明边框

**轮播控制：**
- 底部指示器（小圆点）
- 自动轮播，间隔5秒
- 支持手动切换（左右箭头或点击指示器）

### 5.3 Content Carousel

**布局：**
- 区块标题：`text-2xl font-bold text-white mb-4`
- 横向滚动容器：`flex overflow-x-auto scrollbar-hide gap-4`
- 卡片宽度：`w-[200px]` 或 `w-[250px]`，根据内容类型调整

**卡片设计：**
- 封面图：`aspect-[2/3]`（竖版海报）或 `aspect-video`（横版）
- 磨砂玻璃背景：`backdrop-blur-sm bg-black/20`
- 悬停效果：
  - 放大：`hover:scale-105 transition-transform duration-300`
  - 阴影：`hover:shadow-2xl`
  - 显示更多信息（标题、评分、简介）

**内容信息：**
- 标题：`text-white font-semibold truncate`
- 评分：星星图标 + 数字
- 类型/年份：`text-gray-400 text-sm`

### 5.4 Welcome Banner

**布局：**
- 顶部横幅，高度 `h-[200px]` 或 `h-[150px]`
- 背景渐变或图片
- 左侧问候语：`text-3xl font-bold text-white`
- 右侧装饰图案或留白

**内容：**
- 问候语：`欢迎回来，{用户昵称}` 或 `欢迎来到 MixTV`
- 副标题：`发现你喜欢的内容`

### 5.5 Loading Overlay

**设计：**
- 全屏遮罩：`fixed inset-0 bg-black z-50`
- 中央动画：
  - 可以是Logo渐入渐出
  - 或者进度条动画
  - 或者电影胶片效果
- 渐出动画：`opacity-0 transition-opacity duration-500`

### 5.6 响应式设计

**断点：**
- 移动端（`< 768px`）：
  - Hero Banner高度减小：`h-[400px]`
  - 卡片宽度减小：`w-[150px]`
  - 单列或双列布局
- 平板（`768px - 1024px`）：
  - 卡片宽度：`w-[180px]`
  - 三列或四列布局
- 桌面（`> 1024px`）：
  - 卡片宽度：`w-[200px]` 或 `w-[250px]`
  - 五列或六列布局

## 6. Mock数据结构

### 6.1 内容类型

```typescript
interface ContentItem {
  id: string;
  title: string;
  coverUrl: string;
  backdropUrl?: string;
  rating?: number;
  year?: number;
  type: 'movie' | 'tv' | 'anime' | 'variety' | 'shortdrama';
  description?: string;
  genres?: string[];
}
```

### 6.2 Hero Banner数据

```typescript
interface HeroItem {
  id: string;
  title: string;
  description: string;
  backdropUrl: string;
  rating: number;
  trailerUrl?: string;
  type: 'movie' | 'tv' | 'anime' | 'variety';
}
```

### 6.3 Carousel Section数据

```typescript
interface CarouselSection {
  id: string;
  title: string;
  items: ContentItem[];
  moreLink?: string;
}
```

### 6.4 首页数据

```typescript
interface HomepageData {
  config: HomepageConfig;
  heroBanner?: HeroItem[];
  continueWatching?: ContentItem[];
  upcomingReleases?: ContentItem[];
  hotMovies?: ContentItem[];
  hotTvShows?: ContentItem[];
  newAnime?: ContentItem[];
  hotVariety?: ContentItem[];
  hotShortDramas?: ContentItem[];
}
```

### 6.5 Mock数据生成规则

- 每个Hero Banner项目：6个
- 每个Carousel区块：10-15个内容项
- 封面图：使用占位图服务（如 `https://via.placeholder.com/200x300`）或本地占位图
- 标题：中文电影/剧集名称
- 评分：7.0 - 9.5 之间的随机数
- 年份：2020 - 2026

## 7. 组件接口设计

### 7.1 HeroBanner

```typescript
interface HeroBannerProps {
  items: HeroItem[];
  autoPlayInterval?: number; // 默认5000ms
}
```

### 7.2 ContentCarousel

```typescript
interface ContentCarouselProps {
  title: string;
  items: ContentItem[];
  moreLink?: string;
}
```

### 7.3 ContentCard

```typescript
interface ContentCardProps {
  item: ContentItem;
  onClick?: () => void;
}
```

### 7.4 HomepageShell

```typescript
interface HomepageShellProps {
  data: HomepageData;
}
```

### 7.5 LoadingOverlay

```typescript
interface LoadingOverlayProps {
  isLoading: boolean;
}
```

### 7.6 WelcomeBanner

```typescript
interface WelcomeBannerProps {
  userName?: string;
}
```

## 8. 实现优先级

### Phase 1：核心结构（必须）

1. 创建模块目录结构
2. 定义domain类型
3. 实现mock-data-provider
4. 实现homepage-service
5. 创建homepage-shell布局

### Phase 2：基础组件（必须）

1. ContentCard组件
2. ContentCarousel组件
3. WelcomeBanner组件
4. LoadingOverlay组件

### Phase 3：Hero Banner（必须）

1. HeroBanner组件
2. 轮播逻辑
3. 自动播放和手动控制

### Phase 4：集成和优化（必须）

1. 更新 `src/app/page.tsx`
2. 响应式调整
3. 磨砂玻璃效果优化
4. 动画和过渡效果

## 9. 技术约束

### 9.1 依赖

- Next.js 16.2.6（App Router）
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4

### 9.2 不使用的库

本阶段不引入额外依赖：
- 不使用Swiper或其他轮播库（手动实现）
- 不使用图标库（使用SVG或Tailwind内置）
- 不使用动画库（使用CSS transition和Tailwind）

### 9.3 性能考虑

- 图片使用Next.js的 `<Image>` 组件，启用懒加载
- 横向滚动使用CSS，不使用JavaScript监听
- 避免过度的重渲染，使用 `React.memo` 优化

## 10. 测试策略

### 10.1 单元测试

- 测试mock-data-provider生成的数据结构
- 测试homepage-service的数据聚合逻辑
- 测试组件props验证

### 10.2 集成测试

- 测试首页完整渲染
- 测试模块配置开关生效
- 测试响应式布局

### 10.3 视觉测试

- 手动验证磨砂玻璃效果
- 验证悬停动画
- 验证轮播功能

## 11. 未来扩展点

本设计为未来扩展预留接口：

1. **真实数据接入**：替换 `mock-data-provider.ts`，调用真实API
2. **配置管理**：接入后台配置接口，动态控制模块开关
3. **用户个性化**：根据用户偏好调整内容推荐
4. **性能优化**：引入虚拟滚动、懒加载、缓存策略
5. **A/B测试**：支持不同布局和样式的实验

## 12. 验收标准

1. 所有8个可配置模块和欢迎横幅开关的UI结构完整实现
2. Hero Banner轮播功能正常，自动播放和手动控制都可用
3. 横向滚动卡片流畅，悬停效果符合设计
4. 磨砂玻璃效果在支持的浏览器中正常显示
5. 响应式布局在移动端、平板、桌面都正常
6. 加载态和欢迎横幅在开启时正常显示
7. 代码结构符合模块化单体架构原则
8. 所有组件有清晰的TypeScript类型定义

## 13. 风险和缓解

### 风险1：磨砂玻璃效果浏览器兼容性

**缓解：**
- 使用 `backdrop-filter` 的同时提供降级方案（纯色背景）
- 在不支持的浏览器中使用半透明黑色背景

### 风险2：横向滚动性能问题

**缓解：**
- 使用CSS的 `scroll-snap` 提升体验
- 限制每个区块的内容数量（10-15个）
- 使用 `will-change` 优化动画性能

### 风险3：Mock数据与真实API结构不一致

**缓解：**
- 参考产品文档定义数据结构
- 在domain层明确定义类型契约
- 预留扩展字段，避免后续破坏性变更

## 14. 交付物

1. `src/modules/homepage/` 完整模块代码
2. 更新后的 `src/app/page.tsx`
3. 单元测试和集成测试
4. 本设计文档

## 15. 时间估算

- Phase 1（核心结构）：2小时
- Phase 2（基础组件）：3小时
- Phase 3（Hero Banner）：2小时
- Phase 4（集成和优化）：2小时
- 测试和调试：1小时

**总计：约10小时**
