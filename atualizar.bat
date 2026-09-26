@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Atualizando dados do dashboard RH - HE Belem ===
python -m pip install -r requirements.txt --quiet
python scripts\atualizar_dados.py
if errorlevel 1 (
  echo.
  echo Ocorreu um erro. Veja a mensagem acima.
  pause
  exit /b 1
)
start "" index.html
pause
