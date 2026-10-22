@echo off
chcp 65001 >nul
title 小游戏花园 - 部署到 Cloudflare Pages
echo ============================================
echo   小游戏花园  一键部署到 Cloudflare Pages
echo   项目：kkk（预览域名 kkk-99o.pages.dev）
echo ============================================
echo.

set NODE_OPTIONS=--dns-result-order=ipv4first

echo [1/2] 正在同步站点到暂存目录 .kkko-deploy-staging（约 2.5GB）...
robocopy "C:\Users\hld\Desktop\KKKO" "C:\Users\hld\Desktop\.kkko-deploy-staging" /MIR /XD .workbuddy .wrangler .git /XF *.zip /MT:16 /R:2 /W:2 /NFL /NDL /NP
if errorlevel 8 (
    echo 同步失败，请检查磁盘空间后重试。
    pause
    exit /b 1
)
echo 同步完成。
echo.

echo [2/2] 正在上传到 Cloudflare Pages...
echo 上传过程中请不要关闭本窗口。
echo.

cd /d "C:\Users\hld\Desktop\.kkko-deploy-staging"

call wrangler pages deploy "." --project-name kkk --branch main --commit-message deploy

echo.
echo ============================================
echo   部署命令执行完毕
echo   如果上面没有红色错误，就说明成功了。
echo   稍等 1-2 分钟证书生效后即可访问预览域名。
echo ============================================
echo.
pause
