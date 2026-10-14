param([switch]$AllowMutations, [string]$ServerLog)

$ErrorActionPreference = "Continue"
$BaseUrl = "http://localhost:3000"
$EnvPath = "C:\projects\ppf-profi-v2\.env.local"

$script:Passed  = 0
$script:Failed  = 0
$script:Skipped = 0
$script:FailDetails = @()

function Section($t) {
    Write-Host ""
    Write-Host ("=== " + $t + " ===") -ForegroundColor Cyan
}

function Check($name, $ok, $detail) {
    if ($ok) {
        Write-Host "  PASS  $name" -ForegroundColor Green
        $script:Passed++
    } else {
        Write-Host "  FAIL  $name" -ForegroundColor Red
        $script:Failed++
        $msg = $name
        if ($detail) { $msg = "$name  [$detail]" }
        $script:FailDetails += $msg
    }
}

function Skip($name, $reason) {
    Write-Host "  SKIP  $name  ($reason)" -ForegroundColor Yellow
    $script:Skipped++
}

function New-Sess {
    return [PSCustomObject]@{ Cookies = New-Object System.Net.CookieContainer }
}

function Req {
    param(
        [string]$Method,
        [string]$Path,
        $Sess,
        $Body,
        [hashtable]$Headers = @{}
    )

    $uri = "$BaseUrl$Path"
    $req = [System.Net.HttpWebRequest]::Create($uri)
    $req.Method = $Method
    $req.Timeout = 30000
    $req.AllowAutoRedirect = $false
    $req.UserAgent = "PPF-Test/1.0"
    $req.Accept = "application/json"

    if ($Sess -and $Sess.Cookies) {
        $req.CookieContainer = $Sess.Cookies
    }

    foreach ($k in $Headers.Keys) {
        if ($k -eq "Content-Type") { continue }
        if ($k -eq "Accept") { $req.Accept = $Headers[$k]; continue }
        if ($k -eq "User-Agent") { $req.UserAgent = $Headers[$k]; continue }
        $req.Headers[$k] = [string]$Headers[$k]
    }

    if ($null -ne $Body) {
        $jsonText = $Body | ConvertTo-Json -Depth 10 -Compress
        $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonText)
        $req.ContentType = "application/json; charset=utf-8"
        $req.ContentLength = $jsonBytes.Length
        $stream = $req.GetRequestStream()
        $stream.Write($jsonBytes, 0, $jsonBytes.Length)
        $stream.Close()
    }

    $status = 0
    $text = ""

    try {
        $resp = $req.GetResponse()
        $status = [int]$resp.StatusCode
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(), [System.Text.Encoding]::UTF8)
        $text = $reader.ReadToEnd()
        $reader.Close()
        $resp.Close()
    } catch [System.Net.WebException] {
        $ex = $_.Exception
        if ($ex.Response) {
            $resp = $ex.Response
            $status = [int]$resp.StatusCode
            try {
                $reader = New-Object System.IO.StreamReader($resp.GetResponseStream(), [System.Text.Encoding]::UTF8)
                $text = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
            $resp.Close()
        } else {
            $status = 0
            $text = $ex.Message
        }
    } catch {
        $status = 0
        $text = $_.Exception.Message
    }

    $json = $null
    if ($text -and $text.Trim().Length -gt 0) {
        try { $json = $text | ConvertFrom-Json } catch {}
    }

    return [PSCustomObject]@{ Status = $status; Body = $text; Json = $json }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor White
Write-Host "  PPF PROFI API - тестирование" -ForegroundColor White
Write-Host "  База: $BaseUrl" -ForegroundColor White
Write-Host "  Мутации: $(if ($AllowMutations) {'ДА'} else {'НЕТ'})" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor White

$ping = Req "GET" "/" $null
Check "Сервер отвечает (GET /)" ($ping.Status -eq 200) "status=$($ping.Status)"

$anon     = New-Sess
$partnerA = New-Sess
$partnerB = New-Sess
$masterA  = New-Sess
$admin    = New-Sess
$rl       = New-Sess


function LoginWithRetry {
    param($Path, $Sess, $Body, [int]$MaxAttempts = 6)
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $r = Req "POST" $Path $Sess $Body
        if ($r.Status -ne 429) { return $r }
        $wait = [Math]::Min(1000 * [Math]::Pow(2, $i - 1), 8000)
        Write-Host ("    [retry] 429, ждём {0}ms (попытка {1}/{2})" -f $wait, $i, $MaxAttempts) -ForegroundColor DarkYellow
        Start-Sleep -Milliseconds $wait
    }
    return $r
}

Section "1. АНОНИМНЫЙ ДОСТУП"
Check "GET  /api/orders -> 401"  ((Req "GET"    "/api/orders" $anon).Status -eq 401)
Check "POST /api/orders -> 401"  ((Req "POST"   "/api/orders" $anon @{carCode="BMW_X5_G05"}).Status -eq 401)
Check "DEL  /api/orders?id=0 -> 403"  ((Req "DELETE" "/api/orders?id=0" $anon).Status -eq 403)
Check "DEL  /api/orders -> 403"  ((Req "DELETE" "/api/orders?id=0" $anon).Status -eq 403)
Check "PATCH /api/orders/1 -> 401"  ((Req "PATCH"  "/api/orders/1" $anon @{status="NEW"}).Status -eq 401)
Check "GET  /api/masters -> 403"  ((Req "GET"    "/api/masters" $anon).Status -eq 403)
Check "POST /api/quote -> 401"  ((Req "POST"   "/api/quote" $anon @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD"}).Status -eq 401)
Check "GET  /api/me -> 200"  ((Req "GET" "/api/me" $anon).Status -eq 200)
Check "GET  /api/me session null"  ($null -eq (Req "GET" "/api/me" $anon).Json.session)
Check "POST /api/logout -> 200"  ((Req "POST"   "/api/logout" $anon @{}).Status -eq 200)

Section "2. ЛОГИН ПАРТНЁРА A"
$r = LoginWithRetry "/api/partners/login" $partnerA @{ slug="detailing-moscow"; pin="123456" }
Check "login -> 200" ($r.Status -eq 200) "status=$($r.Status)"
Check "response.partner.id > 0" ($r.Json -and $r.Json.partner.id -gt 0)
Check "response.partner.slug верный" ($r.Json -and $r.Json.partner.slug -eq "detailing-moscow")
$partnerAId = if ($r.Json) { $r.Json.partner.id } else { 0 }

Section "3. ЛОГИН ПАРТНЁРА B"
Start-Sleep -Milliseconds 3000   # обход rate-limit между логинами A и B
$r = LoginWithRetry "/api/partners/login" $partnerB @{ slug="auto-plus"; pin="654321" }
Check "login -> 200" ($r.Status -eq 200) "status=$($r.Status)"
$partnerBId = if ($r.Json) { $r.Json.partner.id } else { 0 }
Check "partnerB.id != partnerA.id" ($partnerBId -ne $partnerAId)

Section "4. ЛОГИН МАСТЕРА"
$r = Req "POST" "/api/masters/login" $masterA @{ slug="ilya"; pin="111111" }
Check "login -> 200" ($r.Status -eq 200) "status=$($r.Status)"

Section "5. ЛОГИН АДМИНА"
$adminPass = $null
if (Test-Path $EnvPath) {
    $line = Get-Content $EnvPath | Where-Object { $_ -match '^ADMIN_PASSWORD=' } | Select-Object -First 1
    if ($line) { $adminPass = $line.Substring("ADMIN_PASSWORD=".Length) }
}
Check ".env.local читается" ($null -ne $adminPass)
Check "ADMIN_PASSWORD непустой" ($adminPass -and $adminPass.Length -gt 5)
$r = Req "POST" "/api/admin/login" $admin @{ password=$adminPass }
Check "admin login -> 200" ($r.Status -eq 200) "status=$($r.Status)"

Section "6. /api/me РОЛИ"
$r = Req "GET" "/api/me" $partnerA
Check "partner role=partner" ($r.Json.session.role -eq "partner")
$r = Req "GET" "/api/me" $masterA
Check "master role=master" ($r.Json.session.role -eq "master")
$r = Req "GET" "/api/me" $admin
Check "admin role=admin" ($r.Json.session.role -eq "admin")

Section "7. ИЗОЛЯЦИЯ"
$r = Req "GET" "/api/orders" $partnerA
Check "partner A GET orders -> 200" ($r.Status -eq 200)
if ($r.Json -and $r.Json.orders) {
    $foreign = @($r.Json.orders | Where-Object { $_.partnerId -ne $partnerAId })
    Check "partner A не видит чужих" ($foreign.Count -eq 0)
}
$r = Req "GET" "/api/orders" $masterA
Check "master GET orders -> 200" ($r.Status -eq 200)
if ($r.Json -and $r.Json.orders) {
    $leaked = @($r.Json.orders | Where-Object { $_.clientPrice -ne $null -or $_.partnerName -ne $null })
    Check "master не видит clientPrice" ($leaked.Count -eq 0)
}

Section "8. ПАРТНЁР - ЗАПРЕЩЁННЫЕ"
Check "partner GET masters -> 403" ((Req "GET" "/api/masters" $partnerA).Status -eq 403)
Check "partner DELETE order -> 403" ((Req "DELETE" "/api/orders?id=0" $partnerA).Status -eq 403)
Check "partner PATCH order -> 403" ((Req "PATCH" "/api/orders/1" $partnerA @{status="COMPLETED"}).Status -eq 403)

Section "9. QUOTE API"
$cars = @(
    @{ code="GEELY_MONJARO"; label="Monjaro" },
    @{ code="BMW_X5_G05";    label="X5" }
)
$scenarios = @("FULL","RISK_ZONES")
$films = @("PPF_STANDARD","SPECTROLL_PREMIUM")

foreach ($c in $cars) {
    foreach ($s in $scenarios) {
        foreach ($f in $films) {
            $q = Req "POST" "/api/quote" $partnerA @{ carCode=$c.code; scenario=$s; filmCode=$f }
            $name = "quote $($c.label) / $s / $f"
            if ($q.Status -eq 200 -and $q.Json.pp -gt 0) {
                Check $name $true
            } else {
                Check $name $false "status=$($q.Status)"
            }
        }
    }
}

$q1 = Req "POST" "/api/quote" $partnerA @{ carCode="BMW_X5_G05"; scenario="FULL"; filmCode="PPF_STANDARD" }
$q2 = Req "POST" "/api/quote" $partnerA @{ carCode="BMW_X5_G05"; scenario="FULL"; filmCode="SPECTROLL_PREMIUM" }
$q3 = Req "POST" "/api/quote" $partnerA @{ carCode="BMW_X5_G05"; scenario="RISK_ZONES"; filmCode="PPF_STANDARD" }
$q4 = Req "POST" "/api/quote" $partnerA @{ carCode="GEELY_MONJARO"; scenario="FULL"; filmCode="PPF_STANDARD" }

Check "low < high" ($q1.Json.low -lt $q1.Json.high)
Check "Premium > Standard" ($q2.Json.pp -gt $q1.Json.pp)
Check "RISK_ZONES < FULL" ($q3.Json.pp -lt $q1.Json.pp)
Check "Monjaro < X5" ($q4.Json.pp -lt $q1.Json.pp)
Check "low  > pp"  ($q1.Json.low  -gt $q1.Json.pp)
Check "high > low" ($q1.Json.high -gt $q1.Json.low)

Check "quote fake car -> 404" ((Req "POST" "/api/quote" $partnerA @{carCode="FAKE";scenario="FULL";filmCode="PPF_STANDARD"}).Status -eq 404)
Check "quote fake scenario -> 404" ((Req "POST" "/api/quote" $partnerA @{carCode="BMW_X5_G05";scenario="HACK";filmCode="PPF_STANDARD"}).Status -eq 404)
Check "quote fake film -> 404" ((Req "POST" "/api/quote" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="FAKE"}).Status -eq 404)
Check "quote empty carCode -> 404" ((Req "POST" "/api/quote" $partnerA @{carCode="";scenario="FULL";filmCode="PPF_STANDARD"}).Status -eq 404)

if ($AllowMutations) {
    Section "10. ВАЛИДАЦИЯ POST"
    $targetX5 = $q1.Json.pp
    $phone = "+79990001122"
    $key1 = [guid]::NewGuid().ToString()
    Check "price=1 -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";price=1;clientPrice=1;clientName="X";clientPhone=$phone} @{"Idempotency-Key"=$key1}).Status -eq 400)
    Check "clientPrice=0 -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";clientPrice=0;clientName="X";clientPhone=$phone} @{"Idempotency-Key"=$key1}).Status -eq 400)
    Check "clientPrice=target -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";clientPrice=$targetX5;clientName="X";clientPhone=$phone} @{"Idempotency-Key"=$key1}).Status -eq 400)
    Check "fake car -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="FAKE_CAR";scenario="FULL";filmCode="PPF_STANDARD";clientPrice=999000;clientName="X";clientPhone=$phone} @{"Idempotency-Key"=$key1}).Status -eq 400)
    Check "short phone -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";clientPrice=999000;clientName="X";clientPhone="123"} @{"Idempotency-Key"=$key1}).Status -eq 400)

    Section "11. СОЗДАНИЕ И IDEMPOTENCY"
    $key1 = [guid]::NewGuid().ToString()
    $body = @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";price=1;clientPrice=($targetX5+5000);clientName="ZZ Test";clientPhone=$phone;comment="auto";partnerId=999}
    $r1 = Req "POST" "/api/orders" $partnerA $body @{"Idempotency-Key"=$key1}
    Check "POST order -> 200" ($r1.Status -eq 200) "status=$($r1.Status)"
    $testId = if ($r1.Json -and $r1.Json.order) { $r1.Json.order.id } else { $null }
    Check "price = target X5" ($r1.Json.order.price -eq $targetX5)
    Check "partnerId из сессии" ($r1.Json.order.partnerId -eq $partnerAId)
    Check "status = NEW" ($r1.Json.order.status -eq "NEW")

    $r2 = Req "POST" "/api/orders" $partnerA $body @{"Idempotency-Key"=$key1}
    Check "повтор = тот же id" ($r2.Json.order.id -eq $testId)

    Section "12. АДМИН"
    if ($testId) {
        Check "PATCH NEEDS_CHECK -> 200" ((Req "PATCH" "/api/orders/$testId" $admin @{status="NEEDS_CHECK"}).Status -eq 200)
        Check "PATCH HACK -> 400" ((Req "PATCH" "/api/orders/$testId" $admin @{status="HACK"}).Status -eq 400)
        Check "DELETE test -> 200" ((Req "DELETE" "/api/orders?id=$testId" $admin).Status -eq 200)
    }
}

Section "13. RATE LIMIT"
for ($i=0; $i -lt 11; $i++) {
    Req "POST" "/api/partners/login" $rl @{ slug="zz-rate-limit-probe"; pin="000000" } | Out-Null
}
Check "rate limit -> 429" ((Req "POST" "/api/partners/login" $rl @{ slug="zz-rate-limit-probe"; pin="000000" }).Status -eq 429)

Section "14. ПОДДЕЛКА СЕССИИ"
$fake = New-Sess
$fake.Cookies.Add((New-Object System.Net.Cookie("session","fake.sig","/","localhost")))
Check "fake cookie -> 401" ((Req "GET" "/api/orders" $fake).Status -eq 401)

Section "15. LOGOUT"
$tmp = New-Sess
Req "POST" "/api/partners/login" $tmp @{ slug="detailing-moscow"; pin="123456" } | Out-Null
Check "logout -> 200" ((Req "POST" "/api/logout" $tmp @{}).Status -eq 200)
Check "после logout -> 401" ((Req "GET" "/api/orders" $tmp).Status -eq 401)

# ==========================================================
#  content-v2: публичные страницы, утечки цены партнёра, заявки
# ==========================================================

function Norm($t) { if ($null -eq $t) { return "" }; return ($t -replace '[\s  ]', '') }
function NoScripts($html) { return [regex]::Replace($html, '(?s)<script.*?</script>', '') }
function DbLead($num) {
    $out = & node (Join-Path $PSScriptRoot "tests\db-leads.cjs") get $num
    try { return ($out | Out-String | ConvertFrom-Json) } catch { return $null }
}
$PP = "243500"
$TargetField = '\?"target\?"\s*:\s*(?!\?"_blank)'
$PpField = '\?"pp\?"\s*:'

Section "16. ПУБЛИЧНЫЕ СТРАНИЦЫ: ТЕКСТЫ"
foreach ($p in @("/", "/partners", "/calculator")) {
    $r = Req "GET" $p $anon
    Check "GET $p -> 200" ($r.Status -eq 200) "status=$($r.Status)"
    $raw = $r.Body -replace '\$undefined', ''
    Check "$p нет 'по запросу'" (-not ($r.Body -match 'по запросу'))
    Check "$p нет '[N]'" (-not $r.Body.Contains('[N]'))
    Check "$p нет 'undefined'" (-not ($raw -cmatch 'undefined'))
    Check "$p нет 'мкм' (страница и метаданные)" (-not $r.Body.Contains('мкм'))
    Check "$p нет 'Standard' / 'полностью защищает'" (-not ($r.Body -cmatch 'Standard|полностью защищает'))
    Check "$p нет '1000+' / 'Выездн'" (-not ($r.Body -match '1000\+|Выездн'))
    Check "$p нет 'на работу и материал' / 'гарантия 10 лет'" (-not ($r.Body -match 'на работу и материал|гарантия 10 лет'))
}
foreach ($p in @("/", "/calculator")) {
    $r = Req "GET" $p $anon
    Check "$p нет поля 'год'" (-not ($r.Body -match 'Год выпуска|[?&]year='))
}

Section "17. УТЕЧКА ЦЕНЫ ПАРТНЁРА"
foreach ($p in @("/", "/calculator")) {
    foreach ($mode in @("HTML", "RSC")) {
        $h = if ($mode -eq "RSC") { @{ "RSC" = "1" } } else { @{} }
        $path = if ($mode -eq "RSC") { "$p" + "?_rsc" } else { $p }   # Next 16: RSC-ответ отдаётся по ?_rsc
        $r = Req "GET" $path $anon $null $h
        Check "$p [$mode] -> 200" ($r.Status -eq 200) "status=$($r.Status)"
        Check "$p [$mode] нет $PP" (-not (Norm $r.Body).Contains($PP))
        Check "$p [$mode] нет costFloor/autoApprove" (-not ($r.Body -cmatch 'costFloor|autoApprove'))
        Check "$p [$mode] нет полей target/pp" (-not ($r.Body -cmatch $TargetField -or $r.Body -cmatch $PpField))
    }
}
$q = Req "POST" "/api/public-quote" $anon @{ carCode="BMW_X5_G05"; scenario="FULL"; filmCode="PPF_STANDARD" }
Check "public-quote X5 -> 200 ok" ($q.Status -eq 200 -and $q.Json.ok -eq $true) "status=$($q.Status)"
Check "public-quote нет $PP" (-not (Norm $q.Body).Contains($PP))
$keys = (@($q.Json.PSObject.Properties.Name) | Sort-Object) -join ","
Check "public-quote отдаёт только ok,low,high" ($keys -eq "high,low,ok") "keys=$keys"
Check "public-quote нет costFloor/autoApprove/target/pp" (-not ($q.Body -cmatch 'costFloor|autoApprove|target|"pp"'))

$r = Req "GET" "/partners" $anon
$visible = NoScripts $r.Body
$econ = [regex]::Match($visible, '(?s)<section[^>]*id="economics".*?</section>')
Check "/partners есть блок «Экономика сделки»" $econ.Success
Check "/partners $PP есть в блоке «Экономика сделки»" ($econ.Success -and (Norm $econ.Value).Contains($PP))
$outside = if ($econ.Success) { $visible.Remove($econ.Index, $econ.Length) } else { $visible }
Check "/partners $PP нет вне блока «Экономика сделки»" (-not (Norm $outside).Contains($PP))
Check "/partners нет costFloor/autoApprove" (-not ($r.Body -cmatch 'costFloor|autoApprove'))

if ($AllowMutations) {
    Section "18. ЗАЯВКИ /api/leads"
    $ip = "10.77.$(Get-Random -Minimum 0 -Maximum 255).$(Get-Random -Minimum 1 -Maximum 255)"
    $xff = @{ "X-Forwarded-For" = $ip }
    $low = $q.Json.low

    $r = Req "POST" "/api/leads" $anon @{ kind="client"; carCode="BMW_X5_G05"; scenario="FULL"; filmCode="PPF_STANDARD"; clientName="ZZ TEST Client"; clientPhone="+79990001122"; comment="price 1 RUB"; price=1; low=1; high=2; consent=$true } $xff
    Check "client lead -> 200" ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
    Check "ответ /api/leads без цены" ($null -eq $r.Json.price -and -not (Norm $r.Body).Contains($PP))
    $row = DbLead $r.Json.publicNumber
    Check "подделанная цена игнорируется: в БД серверная low" ($row -and $row.price -eq $low) "db=$($row.price) low=$low"
    Check "client lead kind=client" ($row -and $row.kind -eq "client")

    $r = Req "POST" "/api/leads" $anon @{ kind="partner"; company="ZZ TEST Partner"; companyType="detailing"; city="Moscow"; carsPerMonth=12; clientPhone="@zz_test_partner"; referral="test"; utm_source="test"; utm_medium="cpc"; utm_campaign="content-v2"; consent=$true } $xff
    Check "partner lead -> 200" ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
    $row = DbLead $r.Json.publicNumber
    Check "partner lead kind=partner" ($row -and $row.kind -eq "partner")
    Check "partner lead поля сохранены" ($row -and $row.company -eq "ZZ TEST Partner" -and $row.company_type -eq "detailing" -and $row.cars_per_month -eq 12)
    Check "partner lead referral и UTM сохранены" ($row -and $row.referral -eq "test" -and $row.utm_source -eq "test" -and $row.utm_campaign -eq "content-v2")
    if ($ServerLog -and (Test-Path $ServerLog)) {
        Start-Sleep -Milliseconds 1500
        $tail = Get-Content $ServerLog -Tail 200 -Encoding UTF8 | Out-String
        Check "Telegram-уведомление отправлено без ошибок" (-not ($tail -match 'Telegram notify failed|Telegram API error|Telegram send error|Telegram not configured'))
    } else {
        Skip "Telegram-уведомление" "не передан -ServerLog"
    }

    $r = Req "POST" "/api/leads" $anon @{ kind="client"; carCode="BMW_X5_G05"; scenario="FULL"; filmCode="PPF_STANDARD"; addons=@{ PILLARS=6; SILLS_INNER=1 }; clientName="ZZ TEST Addons"; clientPhone="+79990001122"; price=1; total=1; low=1; high=1; consent=$true } $xff
    Check "lead с допами -> 200" ($r.Status -eq 200) "status=$($r.Status) body=$($r.Body)"
    $row = DbLead $r.Json.publicNumber
    Check "lead с допами: подделанная сумма игнорируется, в БД 464000" ($row -and $row.price -eq 464000) "db=$($row.price)"
    Check "lead с допами: допы в комментарии" ($row -and $row.comment -match 'Стойки' -and $row.comment -match 'Пороги внутри')
    $r = Req "POST" "/api/leads" $anon @{ kind="client"; carCode="BMW_X5_G05"; scenario="FULL"; filmCode="PPF_STANDARD"; addons=@{ PILLARS=7 }; clientName="ZZ TEST Addons"; clientPhone="+79990001122"; consent=$true } $xff
    Check "lead 7 стоек -> 400 + fields.addons" ($r.Status -eq 400 -and $r.Json.fields.addons)

    $r = Req "POST" "/api/leads" $anon @{ kind="client"; carCode="FAKE_CAR"; scenario="FULL"; filmCode="PPF_STANDARD"; clientName="ZZ TEST"; clientPhone="+79990001122"; consent=$true } $xff
    Check "fake car -> 400 + fields.carCode" ($r.Status -eq 400 -and $r.Json.fields.carCode)
    $r = Req "POST" "/api/leads" $anon @{ kind="partner"; company=""; companyType="hack"; city=""; clientPhone="1"; consent=$false } $xff
    Check "partner invalid -> 400 + ошибки полей" ($r.Status -eq 400 -and $r.Json.fields.company -and $r.Json.fields.companyType -and $r.Json.fields.consent)

    Section "19. RATE LIMIT /api/leads"
    $rlXff = @{ "X-Forwarded-For" = "10.78.$(Get-Random -Minimum 0 -Maximum 255).$(Get-Random -Minimum 1 -Maximum 255)" }
    for ($i = 0; $i -lt 10; $i++) { Req "POST" "/api/leads" $anon @{} $rlXff | Out-Null }
    Check "leads 11-й запрос -> 429" ((Req "POST" "/api/leads" $anon @{} $rlXff).Status -eq 429)

    $clean = & node (Join-Path $PSScriptRoot "tests\db-leads.cjs") cleanup | Out-String | ConvertFrom-Json
    Check "тестовые заявки удалены" ($clean.deleted -ge 2) "deleted=$($clean.deleted)"
}

Section "20. ПРЯМОЙ ПРАЙС И ДОПЫ"
$pqXff = @{ "X-Forwarded-For" = "10.79.$(Get-Random -Minimum 0 -Maximum 255).$(Get-Random -Minimum 1 -Maximum 255)" }
function PQ($addons, $extra = @{}) {
    $b = @{ carCode="BMW_X5_G05"; scenario="FULL"; filmCode="PPF_STANDARD"; addons=$addons }
    foreach ($k in $extra.Keys) { $b[$k] = $extra[$k] }
    return Req "POST" "/api/public-quote" $anon $b $pqXff
}
$r = PQ @{}
Check "X5 FULL TPU-S = 349000" ($r.Status -eq 200 -and $r.Json.low -eq 349000) "low=$($r.Json.low)"
$r = PQ @{} @{ filmCode="SPECTROLL_PREMIUM" }
Check "X5 FULL Premium = 409000" ($r.Status -eq 200 -and $r.Json.low -eq 409000) "low=$($r.Json.low)"
$r = PQ @{} @{ scenario="RISK_ZONES" }
Check "X5 RISK TPU-S = 129000" ($r.Status -eq 200 -and $r.Json.low -eq 129000) "low=$($r.Json.low)"
$r = PQ @{ PILLARS=6; SILLS_INNER=1 }
Check "Full + 6 стоек + пороги = 363000 (сервер)" ($r.Status -eq 200 -and $r.Json.low -eq 363000) "low=$($r.Json.low)"
$r = PQ @{ PILLARS=6; SILLS_INNER=1; SCREENS=1; PANORAMA=1; WINDSHIELD=1; TINT=1 }
Check "все допы = от 435000" ($r.Status -eq 200 -and $r.Json.low -eq 435000) "low=$($r.Json.low)"
$r = PQ @{ PILLARS=6; SILLS_INNER=1 } @{ price=1; total=1; low=1; high=1 }
Check "подделанная сумма в теле игнорируется" ($r.Status -eq 200 -and $r.Json.low -eq 363000) "low=$($r.Json.low)"
$r = PQ @{ PILLARS=0 }
Check "стойки 0 -> 200, 349000" ($r.Status -eq 200 -and $r.Json.low -eq 349000) "status=$($r.Status) low=$($r.Json.low)"
Check "стойки 6 -> 200" ((PQ @{ PILLARS=6 }).Status -eq 200)
Check "стойки 7 -> 400" ((PQ @{ PILLARS=7 }).Status -eq 400)
Check "стойки -1 -> 400" ((PQ @{ PILLARS=-1 }).Status -eq 400)
Check "тонировка 2 -> 400" ((PQ @{ TINT=2 }).Status -eq 400)
Check "неизвестный доп -> 400" ((PQ @{ HACK=1 }).Status -eq 400)
$r = Req "POST" "/api/public-quote" $anon @{ carCode="GEELY_MONJARO"; scenario="FULL"; filmCode="PPF_STANDARD" } $pqXff
$r2 = Req "POST" "/api/public-quote" $anon @{ carCode="GEELY_MONJARO"; scenario="FULL"; filmCode="PPF_STANDARD"; addons=@{ PILLARS=6; SILLS_INNER=1 } } $pqXff
Check "допы одинаковы для других моделей (Monjaro +14000)" ($r2.Json.low - $r.Json.low -eq 14000) "diff=$($r2.Json.low - $r.Json.low)"

$Forbidden = 'лучш|№\s?1|номер один|гарантия на \d+ лет|гарантия \d+ лет|выгодн|самая низкая цена|любая степень затемнения'
foreach ($p in @("/", "/calculator")) {
    $r = Req "GET" $p $anon
    $m = [regex]::Match($r.Body, $Forbidden, 'IgnoreCase')
    Check "$p нет запрещённых слов" (-not $m.Success) "найдено: $($m.Value)"
}
$h = Norm (Req "GET" "/" $anon).Body
Check "/ есть 349 000 и вход «от 94 000» (зоны риска)" ($h.Contains("349000") -and $h.Contains("94000"))
Check "/ есть «24 месяца на работу» и «до 10 лет по данным производителя»" ($h.Contains("24месяцанаработу") -and $h.Contains("до10летподаннымпроизводителя"))
Check "/ есть плёнки Spectroll TPU-S и Premium" ($h.Contains("SpectrollTPU-S") -and $h.Contains("SpectrollPremium"))
$pb = Norm (Req "GET" "/partners" $anon).Body
Check "/partners спред 105,5 тыс. и цена партнёра 243 500" ($pb.Contains("105,5") -and $pb.Contains("243500"))
$c = (Req "GET" "/calculator" $anon).Body
Check "/calculator есть допы (стойки, крыша «если есть», тонировка)" ($c.Contains("Стойки") -and $c.Contains("если есть") -and $c.Contains("Тонировка"))

Section "21. SEO: robots, sitemap, марки, noindex"
$r = Req "GET" "/robots.txt" $anon
Check "robots.txt -> 200, закрыты /admin /master /b2b /api/" ($r.Status -eq 200 -and $r.Body.Contains("Disallow: /admin") -and $r.Body.Contains("Disallow: /master") -and $r.Body.Contains("Disallow: /b2b") -and $r.Body.Contains("Disallow: /api/"))
Check "robots.txt: ссылка на sitemap ppfprofi.ru" ($r.Body.Contains("https://ppfprofi.ru/sitemap.xml"))
$r = Req "GET" "/sitemap.xml" $anon
Check "sitemap.xml -> 200, есть /ppf/bmw, нет /partners" ($r.Status -eq 200 -and $r.Body.Contains("https://ppfprofi.ru/ppf/bmw") -and -not $r.Body.Contains("/partners"))
$r = Req "GET" "/ppf" $anon
Check "/ppf -> 200" ($r.Status -eq 200)
$r = Req "GET" "/ppf/bmw" $anon
$n = Norm $r.Body
Check "/ppf/bmw -> 200, canonical, цена зон риска 129 000" ($r.Status -eq 200 -and $r.Body.Contains('rel="canonical" href="https://ppfprofi.ru/ppf/bmw"') -and $n.Contains("129000"))
Check "/ppf/bmw есть JSON-LD Service и нет цены партнёра" ($r.Body.Contains('"@type":"Service"') -and -not $n.Contains("243500"))
$r = Req "GET" "/ppf/lexus" $anon
Check "/ppf/lexus -> 200, есть LX 600 и цена" ($r.Status -eq 200 -and $r.Body.Contains("LX 600") -and (Norm $r.Body).Contains("124000"))
$r = PQ @{} @{ carCode="LR_RR_L460" }
Check "Range Rover L460 FULL TPU-S = 429000 (цена класса XL+)" ($r.Status -eq 200 -and $r.Json.low -eq 429000) "low=$($r.Json.low)"
$h1 = [regex]::Match((Req "GET" "/" $anon).Body, '(?s)<h1.*?</h1>').Value
Check "H1 главной: «цены от 94 000», без «Гарантия»" ((Norm $h1).Contains("94000") -and -not $h1.Contains("Гарантия"))
Check "/ppf/unknown -> 404" ((Req "GET" "/ppf/unknown-brand" $anon).Status -eq 404)
Check "/partners: noindex" ((Req "GET" "/partners" $anon).Body -match 'name="robots" content="noindex')
Check "/admin: noindex" ((Req "GET" "/admin" $anon).Body -match 'name="robots" content="noindex')
Check "/ canonical на ppfprofi.ru" ((Req "GET" "/" $anon).Body.Contains('rel="canonical" href="https://ppfprofi.ru"'))

Write-Host ""
Write-Host "==========================================================" -ForegroundColor White
Write-Host "  РЕЗУЛЬТАТЫ" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor White
Write-Host ("  PASSED:  " + $script:Passed) -ForegroundColor Green
Write-Host ("  FAILED:  " + $script:Failed) -ForegroundColor $(if ($script:Failed -eq 0) { "Green" } else { "Red" })
Write-Host ("  SKIPPED: " + $script:Skipped) -ForegroundColor Yellow
Write-Host ("  TOTAL:   " + ($script:Passed + $script:Failed + $script:Skipped))
$result = if ($script:Failed -eq 0) { "OK" } else { "FAIL" }
Write-Host ("  RESULT:  " + $result) -ForegroundColor $(if ($result -eq "OK") { "Green" } else { "Red" })
Write-Host "==========================================================" -ForegroundColor White

if ($script:FailDetails.Count -gt 0) {
    Write-Host ""
    Write-Host "  ДЕТАЛИ ПРОВАЛОВ:" -ForegroundColor Red
    foreach ($d in $script:FailDetails) {
        Write-Host "   - $d" -ForegroundColor Red
    }
}
Write-Host ""
