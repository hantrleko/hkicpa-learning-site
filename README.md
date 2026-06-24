# HKICPA LP+Past Paper 学习网站

这是一个 **离线抽题站**：先把 `F:\hkicpa LP+Past paper` 扫一遍，生成 `data/resources.js`（题目数据 + 题号 + 题目页码 + OCR 标记）。  
上线后网站只读这个静态数据，不再在用户端重新扫描，不依赖你本机的 PDF 解析。

你可以把它部署成普通静态站点，手机也能访问。

## 目录结构

```text
hkicpa-learning-site/
├─ index.html
├─ styles.css
├─ app.js
├─ data/
│  └─ resources.js
├─ scripts/
│  ├─ build-study-index.js
│  └─ prepare-deploy-site.js
└─ dist/                  # 通过 npm run prepare:deploy 生成
```

## 本地开发（当前机器）

### 1) 生成索引

```powershell
npm run build
```

> 先从仓库根目录执行（否则会报 `package.json` 找不到）。

关键说明：**只要 `data/resources.js` 在本地已经生成，打开网站不需要再跑 build**。

打开网站只做“读静态数据 + 页面渲染”，不是“扫 PDF”。

为了让你后续每次更新都快，默认会启用增量模式（只重算变化文件）：

```powershell
Set-Location "F:\\Hermes\\Github\\hkicpa-learning-site"
npm run build:fast
```

如果你第一次初始化（把所有 OCR 一次性前置）建议执行一次：

```powershell
$env:HKICPA_FORCE_REBUILD = "1"
npm run build:full
```

`build:fast` 已默认走“轻量模式”：保留文本提取路径，默认不做 OCR；用于内容更新频繁时快速出站点（通常 1-2 分钟级）。  
`build:full` 则会做 OCR 前置（强制重算当前文件），并把结果写入 `.build-cache.json`。  
之后你只要文档不变，再跑 `build:fast`，系统会优先复用已解析（含 OCR）的缓存，**不会重复做 OCR**。  

实际建议流程：

- 第一次或数据大更新：`npm run build:bootstrap`（这一步会把 OCR 做完）  
- 每次小更新：`npm run build:fast`（优先走缓存）

### 2) 本地预览

```powershell
npm run start
```

或

```powershell
npm run start:dist
```

建议本机先用 `http://localhost:4173` 查看，避免 `file://` 资源访问限制。

### 3) 站点更新策略（不要每次全量 OCR）

**日常更新（推荐）**

```powershell
npm run build:fast
npm run prepare:deploy:fast
```

`build:fast` 默认关闭 OCR，只走文本提取 + 增量复用。
只要题库文件没大改，后续通常会很快（取决于新文件数量）。

**首次全量预处理（一次性）**

```powershell
npm run build:bootstrap
npm run prepare:deploy:bootstrap
```

`build:bootstrap` 会尽量把缺失文本的文件补 OCR 前置，适合首次上线或大规模变更前。
后续更新仍然可用 `build:fast`，一般不需要再重复 OCR。

## 部署成在线站点（你关机后别人仍能看）

### 1) 先用公开根链接生成可访问资源 ID

```powershell
$env:HKICPA_PUBLIC_ROOT = "https://your-domain.com/hkicpa-papers"
npm run build:bootstrap
```

`HKICPA_PUBLIC_ROOT` 会把所有题目资源 id 改为：

- `https://your-domain.com/hkicpa-papers/M1-10LP+Past%20paper/...pdf`

### 2) 打包可发布目录（含索引 + 依赖 PDF）

```powershell
$env:HKICPA_DEPLOY_DIR = "F:\your\deploy\path\dist"
$env:HKICPA_DEPLOY_PAPERS = "hkicpa-papers"   # 可改成你的上线路径名
npm run prepare:deploy:fast
```

产物大致为：

```text
dist/
├─ index.html
├─ app.js
├─ styles.css
├─ data/resources.js
└─ hkicpa-papers/
   └─ M1-10LP+Past paper/
      └─ ...
```

### 3) 把 dist 部署到站点

把整个 `dist` 目录上传到你的托管服务即可（Nginx / Vercel / Cloudflare Pages / GitHub Pages）。  
只要域名与 `HKICPA_PUBLIC_ROOT` 的站点/目录一致，题目“查看原题页”和“打开原题”就会用线上 PDF，不依赖你的本地电脑。

手机端只要访问你部署的域名（如 `https://learn.your-domain.com`）即可，站点是纯静态，不需要你的电脑在线。

### 4) 一键流程（上线常用）

```powershell
# 生成并打包
$env:HKICPA_PUBLIC_ROOT = "https://your-domain.com/hkicpa-papers"
$env:HKICPA_DEPLOY_DIR = "F:\your\deploy\path\dist"
npm run prepare:deploy:bootstrap

# 本机校验
npm run start:dist
```

## 一键推送到 GitHub Pages（可选）

如果你已经把 GitHub Pages 源设置到 `gh-pages` 分支，可以直接用：

```powershell
$env:HKICPA_PUBLIC_ROOT = "https://hantrleko.github.io/hkicpa-learning-site"
npm run deploy:gh:fast
```

它会自动完成：

1. 预构建并打包 `dist`
2. 刷新 `.gh-pages` 工作树
3. 提交并推送到 `gh-pages` 分支

首次大更新建议用：

```powershell
npm run deploy:gh
```

> 注意：仓库里 `gh-pages` 分支是否启用需要在 GitHub Settings → Pages 手动开启一次即可，后续可每次命令更新。

## 页面功能

- 资料浏览：关键词、阶段、资料类型、内容类型筛选。
- 题库练习：关键词/阶段/模块/年份/场次/有无答案筛选。
- 随机抽题、下一题。
- 每题可展开/收起答案。
- 每题显示来源页码（`sourcePage`）和解析来源（文本提取/OCR）。
- 支持“查看原题页”弹层：在线/本地均可定位到对应页。

## 脚本说明

- `npm run build`：默认增量 + 平衡 OCR（兼顾速度和准确率，首次仍可能较慢）。
- `npm run build:fast`：推荐日常，默认跳过 OCR，先文本提取，速度快；适合你每次新增/更改少量文件后快速更新。
- `npm run build:bootstrap`：完整前置 OCR，一次性生成高质量题库缓存（推荐初次部署或数据大量变化后执行）。
- `npm run build:full`：强制全量重建 + OCR 兜底，适合每周或每月做一次完整质量补齐。
- `npm run prepare:deploy:fast`：先 `build:fast`，再生成线上发布目录（默认 `dist`）。
- `npm run prepare:deploy:full`：先 `build:full`，再生成线上发布目录（默认 `dist`）。
- `npm run prepare:deploy:bootstrap`：先 `build:bootstrap`，再生成线上发布目录（默认 `dist`）。
- `npm run prepare:deploy`：先执行默认 `build`，再生成线上发布目录（默认 `dist`）。
- `npm run deploy:fast`：同 `prepare:deploy:fast`。
- `npm run deploy:full`：同 `prepare:deploy:full`。
- `npm run deploy:bootstrap`：同 `prepare:deploy:bootstrap`。
- `npm run deploy`：同 `prepare:deploy`。
- `npm run start:dist`：启动部署目录预览服务器。
