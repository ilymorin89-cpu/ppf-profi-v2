param([switch]$AllowMutations)

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
Write-Host "  PPF PROFI API - ÚÂÒÚËÓ‚‡ÌËÂ" -ForegroundColor White
Write-Host "  ¡‡Á‡: $BaseUrl" -ForegroundColor White
Write-Host "  ÃÛÚ‡ˆËË: $(if ($AllowMutations) {'ƒ¿'} else {'Õ≈“'})" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor White

$ping = Req "GET" "/" $null
Check "—Â‚Â ÓÚ‚Â˜‡ÂÚ (GET /)" ($ping.Status -eq 200) "status=$($ping.Status)"

$anon     = New-Sess
$partnerA = New-Sess
$partnerB = New-Sess
$masterA  = New-Sess
$admin    = New-Sess
$rl       = New-Sess

Section "1. ¿ÕŒÕ»ÃÕ€… ƒŒ—“”œ"
Check "GET  /api/orders -> 401"  ((Req "GET"    "/api/orders" $anon).Status -eq 401)
Check "POST /api/orders -> 401"  ((Req "POST"   "/api/orders" $anon @{carCode="BMW_X5_G05"}).Status -eq 401)
Check "DEL  /api/orders?id=1 -> 403"  ((Req "DELETE" "/api/orders?id=1" $anon).Status -eq 403)
Check "DEL  /api/orders -> 403"  ((Req "DELETE" "/api/orders" $anon).Status -eq 403)
Check "PATCH /api/orders/1 -> 401"  ((Req "PATCH"  "/api/orders/1" $anon @{status="NEW"}).Status -eq 401)
Check "GET  /api/masters -> 403"  ((Req "GET"    "/api/masters" $anon).Status -eq 403)
Check "POST /api/quote -> 401"  ((Req "POST"   "/api/quote" $anon @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD"}).Status -eq 401)
Check "GET  /api/me -> 200"  ((Req "GET" "/api/me" $anon).Status -eq 200)
Check "GET  /api/me session null"  ($null -eq (Req "GET" "/api/me" $anon).Json.session)
Check "POST /api/logout -> 200"  ((Req "POST"   "/api/logout" $anon @{}).Status -eq 200)

Section "2. ÀŒ√»Õ œ¿–“Õ®–¿ A"
$r = Req "POST" "/api/partners/login" $partnerA @{ slug="detailing-moscow"; pin="123456" }
Check "login -> 200" ($r.Status -eq 200) "status=$($r.Status)"
Check "response.partner.id > 0" ($r.Json -and $r.Json.partner.id -gt 0)
Check "response.partner.slug ‚ÂÌ˚È" ($r.Json -and $r.Json.partner.slug -eq "detailing-moscow")
$partnerAId = if ($r.Json) { $r.Json.partner.id } else { 0 }

Section "3. ÀŒ√»Õ œ¿–“Õ®–¿ B"
$r = Req "POST" "/api/partners/login" $partnerB @{ slug="auto-plus"; pin="654321" }
Check "login -> 200" ($r.Status -eq 200) "status=$($r.Status)"
$partnerBId = if ($r.Json) { $r.Json.partner.id } else { 0 }
Check "partnerB.id != partnerA.id" ($partnerBId -ne $partnerAId)

Section "4. ÀŒ√»Õ Ã¿—“≈–¿"
$r = Req "POST" "/api/masters/login" $masterA @{ slug="ilya"; pin="111111" }
Check "login -> 200" ($r.Status -eq 200) "status=$($r.Status)"

Section "5. ÀŒ√»Õ ¿ƒÃ»Õ¿"
$adminPass = $null
if (Test-Path $EnvPath) {
    $line = Get-Content $EnvPath | Where-Object { $_ -match '^ADMIN_PASSWORD=' } | Select-Object -First 1
    if ($line) { $adminPass = $line.Substring("ADMIN_PASSWORD=".Length) }
}
Check ".env.local ˜ËÚ‡ÂÚÒˇ" ($null -ne $adminPass)
Check "ADMIN_PASSWORD ÌÂÔÛÒÚÓÈ" ($adminPass -and $adminPass.Length -gt 5)
$r = Req "POST" "/api/admin/login" $admin @{ password=$adminPass }
Check "admin login -> 200" ($r.Status -eq 200) "status=$($r.Status)"

Section "6. /api/me –ŒÀ»"
$r = Req "GET" "/api/me" $partnerA
Check "partner role=partner" ($r.Json.session.role -eq "partner")
$r = Req "GET" "/api/me" $masterA
Check "master role=master" ($r.Json.session.role -eq "master")
$r = Req "GET" "/api/me" $admin
Check "admin role=admin" ($r.Json.session.role -eq "admin")

Section "7. »«ŒÀﬂ÷»ﬂ"
$r = Req "GET" "/api/orders" $partnerA
Check "partner A GET orders -> 200" ($r.Status -eq 200)
if ($r.Json -and $r.Json.orders) {
    $foreign = @($r.Json.orders | Where-Object { $_.partnerId -ne $partnerAId })
    Check "partner A ÌÂ ‚Ë‰ËÚ ˜ÛÊËı" ($foreign.Count -eq 0)
}
$r = Req "GET" "/api/orders" $masterA
Check "master GET orders -> 200" ($r.Status -eq 200)
if ($r.Json -and $r.Json.orders) {
    $leaked = @($r.Json.orders | Where-Object { $_.clientPrice -ne $null -or $_.partnerName -ne $null })
    Check "master ÌÂ ‚Ë‰ËÚ clientPrice" ($leaked.Count -eq 0)
}

Section "8. œ¿–“Õ®– - «¿œ–≈Ÿ®ÕÕ€≈"
Check "partner GET masters -> 403" ((Req "GET" "/api/masters" $partnerA).Status -eq 403)
Check "partner DELETE order -> 403" ((Req "DELETE" "/api/orders?id=1" $partnerA).Status -eq 403)
Check "partner PATCH order -> 403" ((Req "PATCH" "/api/orders/1" $partnerA @{status="COMPLETED"}).Status -eq 403)

Section "9. QUOTE API"
$cars = @(
    @{ code="GEELY_MONJARO"; label="Monjaro" },
    @{ code="BMW_X5_G05";    label="X5" },
    @{ code="BMW_X7_G07";    label="X7" },
    @{ code="MB_GLE_V167";   label="GLE" },
    @{ code="PORSCHE_CAYENNE_E3"; label="Cayenne" },
    @{ code="TOYOTA_LC300";  label="LC300" }
)
$scenarios = @("FULL","RISK_ZONES","FRONT")
$films = @("PPF_STANDARD","SPECTROLL_PREMIUM")

foreach ($c in $cars) {
    foreach ($s in $scenarios) {
        foreach ($f in $films) {
            $q = Req "POST" "/api/quote" $partnerA @{ carCode=$c.code; scenario=$s; filmCode=$f }
            $name = "quote $($c.label) / $s / $f"
            if ($q.Status -eq 200 -and $q.Json.target -gt 0) {
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
$q5 = Req "POST" "/api/quote" $partnerA @{ carCode="TOYOTA_LC300"; scenario="FULL"; filmCode="PPF_STANDARD" }

Check "autoApprove < target" ($q1.Json.autoApprove -lt $q1.Json.target)
Check "Premium > Standard" ($q2.Json.target -gt $q1.Json.target)
Check "RISK_ZONES < FULL" ($q3.Json.target -lt $q1.Json.target)
Check "Monjaro < X5" ($q4.Json.target -lt $q1.Json.target)
Check "LC300 > X5" ($q5.Json.target -gt $q1.Json.target)
Check "costFloor ÌÂ ÓÚ‰‡∏ÚÒˇ" ($null -eq $q1.Json.costFloor)
Check "breakdown ÌÂ ÓÚ‰‡∏ÚÒˇ" ($null -eq $q1.Json.breakdown)

Check "quote fake car -> 400" ((Req "POST" "/api/quote" $partnerA @{carCode="FAKE";scenario="FULL";filmCode="PPF_STANDARD"}).Status -eq 400)
Check "quote fake scenario -> 400" ((Req "POST" "/api/quote" $partnerA @{carCode="BMW_X5_G05";scenario="HACK";filmCode="PPF_STANDARD"}).Status -eq 400)
Check "quote fake film -> 400" ((Req "POST" "/api/quote" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="FAKE"}).Status -eq 400)
Check "quote empty carCode -> 400" ((Req "POST" "/api/quote" $partnerA @{carCode="";scenario="FULL";filmCode="PPF_STANDARD"}).Status -eq 400)

if ($AllowMutations) {
    Section "10. ¬¿À»ƒ¿÷»ﬂ POST"
    $targetX5 = $q1.Json.target
    $phone = "+79990001122"
    $key1 = [guid]::NewGuid().ToString()
    Check "price=1 -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";price=1;clientPrice=1;clientName="X";clientPhone=$phone} @{"Idempotency-Key"=$key1}).Status -eq 400)
    Check "clientPrice=0 -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";clientPrice=0;clientName="X";clientPhone=$phone} @{"Idempotency-Key"=$key1}).Status -eq 400)
    Check "clientPrice=target -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";clientPrice=$targetX5;clientName="X";clientPhone=$phone} @{"Idempotency-Key"=$key1}).Status -eq 400)
    Check "fake car -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="FAKE_CAR";scenario="FULL";filmCode="PPF_STANDARD";clientPrice=999000;clientName="X";clientPhone=$phone} @{"Idempotency-Key"=$key1}).Status -eq 400)
    Check "short phone -> 400" ((Req "POST" "/api/orders" $partnerA @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";clientPrice=999000;clientName="X";clientPhone="123"} @{"Idempotency-Key"=$key1}).Status -eq 400)

    Section "11. —Œ«ƒ¿Õ»≈ » IDEMPOTENCY"
    $key1 = [guid]::NewGuid().ToString()
    $body = @{carCode="BMW_X5_G05";scenario="FULL";filmCode="PPF_STANDARD";price=1;clientPrice=($targetX5+5000);clientName="ZZ Test";clientPhone=$phone;comment="auto";partnerId=999}
    $r1 = Req "POST" "/api/orders" $partnerA $body @{"Idempotency-Key"=$key1}
    Check "POST order -> 200" ($r1.Status -eq 200) "status=$($r1.Status)"
    $testId = if ($r1.Json -and $r1.Json.order) { $r1.Json.order.id } else { $null }
    Check "price = target X5" ($r1.Json.order.price -eq $targetX5)
    Check "partnerId ËÁ ÒÂÒÒËË" ($r1.Json.order.partnerId -eq $partnerAId)
    Check "status = NEW" ($r1.Json.order.status -eq "NEW")

    $r2 = Req "POST" "/api/orders" $partnerA $body @{"Idempotency-Key"=$key1}
    Check "ÔÓ‚ÚÓ = ÚÓÚ ÊÂ id" ($r2.Json.order.id -eq $testId)

    Section "12. ¿ƒÃ»Õ"
    if ($testId) {
        Check "PATCH NEEDS_CHECK -> 200" ((Req "PATCH" "/api/orders/$testId" $admin @{status="NEEDS_CHECK"}).Status -eq 200)
        Check "PATCH HACK -> 400" ((Req "PATCH" "/api/orders/$testId" $admin @{status="HACK"}).Status -eq 400)
        Check "DELETE test -> 200" ((Req "DELETE" "/api/orders?id=$testId" $admin).Status -eq 200)
    }
}

Section "13. RATE LIMIT"
for ($i=0; $i -lt 11; $i++) {
    Req "POST" "/api/partners/login" $rl @{ slug="auto-plus"; pin="000000" } | Out-Null
}
Check "rate limit -> 429" ((Req "POST" "/api/partners/login" $rl @{ slug="auto-plus"; pin="000000" }).Status -eq 429)

Section "14. œŒƒƒ≈À ¿ —≈——»»"
$fake = New-Sess
$fake.Cookies.Add((New-Object System.Net.Cookie("session","fake.sig","/","localhost")))
Check "fake cookie -> 401" ((Req "GET" "/api/orders" $fake).Status -eq 401)

Section "15. LOGOUT"
$tmp = New-Sess
Req "POST" "/api/partners/login" $tmp @{ slug="detailing-moscow"; pin="123456" } | Out-Null
Check "logout -> 200" ((Req "POST" "/api/logout" $tmp @{}).Status -eq 200)
Check "ÔÓÒÎÂ logout -> 401" ((Req "GET" "/api/orders" $tmp).Status -eq 401)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor White
Write-Host "  –≈«”À‹“¿“€" -ForegroundColor White
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
    Write-Host "  ƒ≈“¿À» œ–Œ¬¿ÀŒ¬:" -ForegroundColor Red
    foreach ($d in $script:FailDetails) {
        Write-Host "   - $d" -ForegroundColor Red
    }
}
Write-Host ""