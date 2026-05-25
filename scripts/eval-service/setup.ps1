# setup.ps1 - One-time setup for the lm-eval sidecar on Windows
# Run from the project root: .\scripts\eval-service\setup.ps1

$ErrorActionPreference = "Stop"
$serviceDir = Join-Path $PSScriptRoot "."

Write-Host "Setting up Grimoire lm-eval sidecar..." -ForegroundColor Cyan

# -- Check Python ------------------------------------------------------------
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3\.(1[0-9]|[89])") {
            $pythonCmd = $cmd
            Write-Host "  Found: $ver" -ForegroundColor Green
            break
        }
    } catch {}
}

if (-not $pythonCmd) {
    Write-Error "Python 3.9+ is required. Install from https://www.python.org/downloads/"
    exit 1
}

# -- Create virtual environment ----------------------------------------------
$venvPath = Join-Path $serviceDir ".venv"
if (-not (Test-Path $venvPath)) {
    Write-Host "Creating virtual environment at $venvPath..." -ForegroundColor Yellow
    & $pythonCmd -m venv $venvPath
} else {
    Write-Host "Virtual environment already exists." -ForegroundColor DarkGray
}

# -- Activate and install dependencies --------------------------------------
$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
. $activateScript

Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet

Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Yellow
pip install -r (Join-Path $serviceDir "requirements.txt") --quiet

# -- Copy .env if it doesn't exist ------------------------------------------
$envFile = Join-Path $serviceDir ".env"
$envExample = Join-Path $serviceDir ".env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host ""
    Write-Host "  Created .env from .env.example" -ForegroundColor Yellow
    Write-Host "  IMPORTANT: Edit scripts/eval-service/.env and fill in your keys!" -ForegroundColor Red
} else {
    Write-Host "  .env already exists - skipping." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the sidecar, run:" -ForegroundColor Cyan
Write-Host "  npm run eval:service" -ForegroundColor White
Write-Host ""
Write-Host "Or manually:" -ForegroundColor Cyan
Write-Host "  cd scripts/eval-service" -ForegroundColor White
Write-Host "  .venv\Scripts\Activate.ps1" -ForegroundColor White
Write-Host "  python main.py" -ForegroundColor White
