# rate-limit-helper.ps1
# 1) находит конфиг rate limit в бэкенде
# 2) усиливает retry в test-ppf.ps1 на случай длинного окна
param([switch]$Patch)

$ErrorActionPreference = "Continue"
cd C:\projects\ppf-profi-v2

Write-Host "`n[1/2] Поиск rate-limit конфига..." -ForegroundColor Cyan
$hits = Get-ChildItem -Recurse -Include *.ts,*.js,*.mjs,*.cjs -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\(node_modules|\.next|dist|build|\.git)\\' } |
    Select-String -Pattern 'rateLimit|rate-limit|windowMs|maxAttempts|429|tooManyRequests'
if ($hits) {
    $hits | Select-Object -First 40 | ForEach-Object {
        "{0}:{1}: {2}" -f (Split-Path $_.Path -Leaf), $_.LineNumber, $_.Line.Trim()
    }
} else {
    Write-Host "  ничего не найдено (возможно, на другом языке / в другом репо)" -ForegroundColor Yellow
}

if ($Patch) {
    Write-Host "`n[2/2] Усиление retry в test-ppf.ps1..." -ForegroundColor Cyan
    $file = "test-ppf.ps1"
    if (-not (Test-Path $file)) { Write-Host "  нет $file" -ForegroundColor Red; return }
    Copy-Item $file "$file.bak-retry2" -Force
    $c = Get-Content $file
    $c = $c -replace '\[int\]\$MaxAttempts\s*=\s*\d+', '[int]$MaxAttempts = 10'
    $c = $c -replace '\[Math\]::Min\(1000 \* \[Math\]::Pow\(2, \$i - 1\),\s*\d+\)',
                     '[Math]::Min(1000 * [Math]::Pow(2, $i - 1), 20000)'
    $c | Set-Content $file -Encoding UTF8
    Write-Host "  [OK] retry: 10 попыток, до 20с каждая." -ForegroundColor Green
    Select-String -Path $file -Pattern 'MaxAttempts|Pow\(2' |
        ForEach-Object { "   L{0}: {1}" -f $_.LineNumber, $_.Line.Trim() }
}
