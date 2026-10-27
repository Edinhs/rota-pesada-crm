@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing_node
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]===24 && v[1]>=16?0:1)"
if errorlevel 1 goto missing_node
if not exist "node_modules\tsx" goto missing_dependencies
if not exist "dist\index.html" goto missing_build
echo Rota Pesada CRM - DEMONSTRACAO
echo Abra http://127.0.0.1:3001 no navegador.
echo Dados ficticios em base separada. Para encerrar, pressione Ctrl+C.
set PORT=3001
call npm.cmd run demo
if errorlevel 1 pause
exit /b
:missing_node
echo Instale Node.js 24.16 ou superior da linha 24 antes de iniciar.
pause
exit /b 1
:missing_dependencies
echo Dependencias ausentes. Execute npm ci nesta pasta.
pause
exit /b 1
:missing_build
echo Interface compilada ausente. Execute npm run build nesta pasta.
pause
exit /b 1
