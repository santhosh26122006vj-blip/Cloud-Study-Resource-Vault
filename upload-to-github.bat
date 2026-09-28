@echo off
title Upload Cloud Study Resource Vault to GitHub
echo ======================================================================
echo       Cloud Study Resource Vault - Upload & Deploy to GitHub
echo ======================================================================
echo.
echo This tool will push your project to GitHub and give you a live link.
echo.
echo Step 1: Go to https://github.com/new in your browser
echo Step 2: Create a repository (e.g., named "cloud-study-vault")
echo         (Leave "Initialize this repository with a README" UNCHECKED)
echo Step 3: Copy your repository URL from GitHub.
echo.
echo ======================================================================
set /p REPO_URL="Paste your GitHub Repository URL here and press Enter: "

if "%REPO_URL%"=="" (
    echo Error: No URL provided. Please run this script again and paste your URL.
    pause
    exit /b
)

echo.
echo Connecting to GitHub repository: %REPO_URL%...
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git branch -M main
git add .
git commit -m "Deploy Cloud Study Resource Vault" >nul 2>&1

echo.
echo Pushing project files to GitHub...
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ======================================================================
    echo   SUCCESS! Your project is now on GitHub!
    echo ======================================================================
    echo.
    echo NOW GET YOUR 100%% FREE LIVE WEBSITE LINK:
    echo 1. Open your repository on GitHub.
    echo 2. Click "Settings" (top menu of your repository).
    echo 3. Click "Pages" (in the left sidebar menu).
    echo 4. Under "Branch", change "None" to "main" and click "Save".
    echo 5. In 1 minute, GitHub will give you a live website link:
    echo    https://yourusername.github.io/your-repository-name/
    echo.
    echo Anyone can now open your project on any phone or laptop!
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo If GitHub asked you to sign in, please complete the sign-in prompt.
    echo If it failed, you can also push manually using:
    echo   git remote add origin %REPO_URL%
    echo   git push -u origin main
    echo ======================================================================
)

echo.
pause
