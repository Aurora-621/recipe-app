# 家庭食谱 App - 一键部署指南

## 方案 A:部署到 Render(推荐,URL 永久固定)

### 步骤 1:注册 GitHub 账号(如已有跳过)
访问 https://github.com 注册(免费)

### 步骤 2:注册 Render 账号
访问 https://render.com 用 GitHub 账号登录(免费)

### 步骤 3:上传代码到 GitHub
1. 在 GitHub 创建新仓库,名字如 `recipe-app`
2. 把 `/workspace/recipe-app/` 目录所有文件上传到仓库

### 步骤 4:在 Render 部署
1. Render 控制台点击 "New +" → "Web Service"
2. 连接你的 GitHub 仓库
3. 配置:
   - **Name**: `family-recipe`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
   - **Plan**: Free
4. 点击 "Create Web Service"
5. 等待 2-3 分钟构建完成

### 步骤 5:获取固定 URL
Render 会给你一个永久 URL,如 `https://family-recipe.onrender.com`

### 步骤 6:添加到 iPhone 主屏幕
1. iPhone Safari 打开 Render 给的 URL
2. 点分享按钮 → "添加到主屏幕"
3. 完成!

---

## 方案 B:部署到 Railway(URL 永久固定,不休眠)

### 步骤 1:访问 https://railway.app 用 GitHub 登录
### 步骤 2:New Project → Deploy from GitHub repo
### 步骤 3:选择你的 `recipe-app` 仓库
### 步骤 4:Railway 自动检测 Python,设置:
- Start Command: `python app.py`
- 注意:Railway 需要 `PORT` 环境变量,app.py 已兼容
### 步骤 5:部署完成,获取 `xxx.up.railway.app` URL

---

## 方案 C:保持当前 Cloudflare 隧道(临时,无需账号)

**当前 URL**: https://maintaining-resolved-enhancements-chocolate.trycloudflare.com

特点:
- ✅ 现在就能用
- ✅ 免费、免注册
- ⚠️ 沙箱休眠后 URL 可能变化
- ⚠️ 适合短期测试,不适合长期使用

---

## 已准备的部署文件

`/workspace/recipe-app/` 目录下已包含:
- `requirements.txt` - Python 依赖
- `Procfile` - 启动命令(兼容 Render/Heroku)
- `app.py` - 绑定 `0.0.0.0:$PORT`,兼容云平台
- `README.md` - 完整文档
