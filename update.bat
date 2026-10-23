@echo off
chcp 65001 >nul
title 更新小游戏并部署到 kkko.fun

echo ============================================
echo   更新并部署到 kkko.fun
echo ============================================
echo.

echo [1/3] 同步文件到部署目录...
robocopy "C:\Users\hld\Desktop\KKKO" "C:\Users\hld\Desktop\.kkko-deploy-staging" /MIR /XD .workbuddy .wrangler .git .github /XF *.zip /MT:16 /R:2 /W:2 /NFL /NDL /NP
if errorlevel 8 (
    echo 同步失败,请检查磁盘空间后重试。
    pause
    exit /b 1
)
echo 同步完成。
echo.

echo [2/3] 提交并推送到 GitHub...
cd /d "C:\Users\hld\Desktop\.kkko-deploy-staging"
git add -A
git commit -m "update site"
git push origin main

echo.
echo [3/3] 完成!
echo GitHub 会自动部署,约 1-2 分钟后 https://kkko.fun/ 生效。
echo.
pause
