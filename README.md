# Papyrus

把多个 GitHub repo 里的 markdown 笔记，零运维地聚合成一个静态博客。

详见 `docs/superpowers/specs/2026-06-05-papyrus-design.md`。

## 开发

```bash
pnpm install
cp .env.example .env  # 填入 GITHUB_TOKEN
pnpm dev
```

## 构建

```bash
pnpm build
```
