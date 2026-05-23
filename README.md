# 习思想复习闪卡 PWA

手机端复习闪卡应用，适合期末前快速刷主观题和客观题。打开即可使用，支持离线、添加到桌面、本地保存学习记录。

访问地址：<https://nuki019.github.io/xg-flashcards-pwa/>

访问统计：<https://hits.sh/nuki019.github.io/xg-flashcards-pwa/>

使用说明 PDF：<https://nuki019.github.io/xg-flashcards-pwa/docs/usage-guide.pdf>


如果发现题目、答案、格式有问题，欢迎在 GitHub 提 issue，或者直接提 PR 修改题库。

## 反馈和共建

欢迎大家帮忙改题库、修错别字、补充遗漏内容。

- 提问题：<https://github.com/nuki019/xg-flashcards-pwa/issues>
- 提修改：<https://github.com/nuki019/xg-flashcards-pwa/pulls>
- 题库 CSV：`data/flashcards-review.csv`
- 应用题库：`data/cards.js`

反馈时建议写清楚：

1. 题号，例如 `S009` 或 `O020`。
2. 问题类型，例如答案错配、表述不准、重复、格式不清。
3. 建议修改后的题干或答案。

## 使用方式

iPhone：

1. 用 Safari 打开访问地址。
2. 点击分享按钮。
3. 选择“添加到主屏幕”。

Android：

1. 用 Chrome 或 Edge 打开访问地址。
2. 选择“安装应用”或“添加到主屏幕”。

## 数据和隐私

学习记录只保存在当前设备和当前浏览器中，不会上传服务器，也不会进入 GitHub。

本项目使用 `hits.sh` 做公开访问量统计，只用于查看页面访问次数。统计入口是：

<https://hits.sh/nuki019.github.io/xg-flashcards-pwa/>

访问统计不会记录你的题目得分、学习进度或“会”的题目。

## 文件说明

- `index.html`：应用入口
- `app.js`：闪卡逻辑和本地学习记录
- `styles.css`：手机端样式
- `data/cards.js`：应用读取的题库
- `data/cards.json`：JSON 题库备份
- `data/flashcards-review.csv`：便于审阅和修改的 CSV 题库
- `docs/usage-guide.pdf`：使用说明文档
