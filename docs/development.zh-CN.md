# 开发

在本地改 [pi-language-tutor](../README.zh-CN.md)。

使用 Node.js 22.19.0 或更高版本，以及 Pi 1.3.0。三个 Pi SDK 包的开发依赖与对等依赖均固定为 1.3.0；采用新 Pi release 时应一起升级。

## 环境

```sh
git clone https://github.com/SunsetWan/pi-language-tutor.git
cd pi-language-tutor
npm ci
ln -s "$(pwd)" ~/.pi/agent/extensions/pi-language-tutor
```

没有构建步骤：pi 通过 package.json 的 `pi.extensions` 直接加载 TypeScript。改完后在 TUI 里 `/reload` 即可。

## 脚本

```sh
npm run check      # Typecheck
npm test           # Unit and offline Pi SDK integration tests
npm run lint       # oxlint
npm run fmt        # oxfmt
npm run fmt:check  # Format check
```

开 PR 前，`npm run check`、`npm test`、`npm run lint` 与 `npm run fmt:check` 必须全部通过（见 [AGENTS.md](../AGENTS.md)）。

测试覆盖核心行为、FSRS 调度、Pi provider 分发、完整会话重放、渲染器、生命周期事件和持久化。SDK 测试使用 Pi 的 `fauxProvider` 与内存凭据，不需要 API key，也不产生模型调用费用。持久化测试使用临时的 `PI_CODING_AGENT_DIR`。

## 目录

| 路径                        | 职责                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `src/core.ts`               | 纯逻辑：跳过判定、prompt、解析、卡片拼装。**不 import 任何 pi 包**——单元测试只依赖它 |
| `src/config.ts`             | 配置读写（`~/.pi/agent/language-learn.json`）                                        |
| `src/llm.ts`                | 模型解析、LLM 调用、会话 fork 捕获                                                   |
| `src/grammar.ts`            | 统一检查入口：分发 Writing check 与 Writing tutor                                    |
| `src/tutor.ts`              | 写作辅导渲染                                                                         |
| `src/translate.ts`          | 双语卡片                                                                             |
| `src/flashcards.ts`         | 记忆卡片持久化与 FSRS 调度                                                           |
| `src/flashcard-settings.ts` | 记忆卡片复习设置                                                                     |
| `src/learn.ts`              | `/flashcards` 复习窗口控制器                                                         |
| `src/settings.ts`           | `/lang` 命令与设置菜单                                                               |
| `src/index.ts`              | 组装根                                                                               |
| `web/flashcards.html`       | 自包含的记忆卡片复习界面                                                             |
| `types/glimpseui.d.ts`      | 复习窗口依赖的本地类型声明                                                           |
| `language-learn.ts`         | 包入口：导出 core + 默认扩展                                                         |

特性模块保持单向依赖；不需要 pi API 的新逻辑放进 `core.ts`。

额外模型请求统一走 `modelRegistry.streamSimple()`，完整请求记录通过 `context_with_system` 捕获，翻译卡使用 `registerEntryRenderer()`，自动翻译监听 `agent_settled`，模型提醒监听 `model_select`。旧版 Pi 与 OMP 的适配代码已移除。

## 手动验收

设置临时的 `PI_CODING_AGENT_DIR`，再执行 `pi install /path/to/clone` 安装本地仓库。使用 Pi 1.3.0 和预设检查、翻译响应的离线 `fauxProvider`，将测试配置和卡片保存在这个独立目录。

1. 打开 `/lang`，提交带拼写错误的英语消息，检查 Writing check 面板。
2. 提交母语消息，检查 Writing tutor 面板和已保存的词汇。
3. 执行 `/translate`，再启用 `/lang auto on`，检查段落对照与短代码块。
4. 开启两种上下文模式，检查额外请求是否包含系统消息、工具声明和会话 ID；执行 `/reload`，确认设置与翻译卡仍在。
5. 打开 `/flashcards`，显示答案，先评 Again 再评 Good；确认 Again 会重复卡片，Good 会保存下次复习时间。

这套流程验收运行时集成与界面行为。预设响应不用于评估真实模型质量或服务商的缓存计费。

## 产品图

| 资源                      | 说明                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `docs/writing-check.png`  | 真实终端截图                                                  |
| `docs/bilingual-card.png` | 真实终端截图                                                  |
| `docs/writing-tutor.png`  | 真机截图（`docs/_shots/writing-tutor.html` 仍保留作备用模板） |
| `docs/demo.gif`           | 三块面板轮播，供 README 门面使用                              |
| `docs/logo.png`           | 256×256，README 标题用                                        |
| `docs/icon.png`           | 完整 app icon 源图                                            |

重新生成 tutor mock：

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --window-size=1642,1169 \
  --screenshot="$(pwd)/docs/writing-tutor.png" \
  "file://$(pwd)/docs/_shots/writing-tutor.html"
```

若要用真实终端录屏替换门面 GIF，见 [recording-demo.md](./recording-demo.md)。

## 相关

- [进阶说明](./advanced.zh-CN.md)
- [AGENTS.md](../AGENTS.md) — 分支、提交与发版约定
