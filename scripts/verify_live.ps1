<#
.SYNOPSIS
    STEELSCAN Live Deployment Security & Health Verification Script.

.DESCRIPTION
    Validates deployment health, unauthenticated route protection,
    hardcoded password refusal, and optional administrator login.

.EXAMPLE
    .\scripts\verify_live.ps1 -BaseUrl "https://steelscan-backend-e2ub.onrender.com"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0, HelpMessage = "Backend base URL (e.g. https://steelscan-backend-e2ub.onrender.com)")]
    [string]$BaseUrl
)

# Normalize BaseUrl (strip trailing slashes)
$BaseUrl = $BaseUrl.TrimEnd('/')

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "         STEELSCAN PRODUCTION DEPLOYMENT VERIFICATION           " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl`n" -ForegroundColor Yellow

$results = [System.Collections.Generic.List[PSCustomObject]]::new()

function Record-Check {
    param(
        [string]$CheckName,
        [bool]$Passed,
        [string]$Details
    )
    $status = if ($Passed) { "PASS" } else { "FAIL" }
    $color = if ($Passed) { "Green" } else { "Red" }
    Write-Host "[$status] $CheckName - $Details" -ForegroundColor $color
    $results.Add([PSCustomObject]@{
        Check = $CheckName
        Status = $status
        Details = $Details
    })
}

function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [int]$TimeoutSec = 15
    )
    $uri = "$BaseUrl$Path"
    $params = @{
        Uri = $uri
        Method = $Method
        TimeoutSec = $TimeoutSec
        SkipHttpErrorCheck = $true
    }
    if ($Headers.Count -gt 0) {
        $params.Headers = $Headers
    }
    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Compress)
    }
    try {
        return Invoke-RestMethod @params -ResponseHeadersVariable respHeaders -StatusCodeVariable statusCode
    } catch {
        # Fallback for older PowerShell versions
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
            return @{ _StatusCode = $code; _Error = $_.Exception.Message }
        }
        return @{ _StatusCode = 0; _Error = $_.Exception.Message }
    }
}

# -------------------------------------------------------------
# 1. Health Check & Cold Start Handler (Up to 90s)
# -------------------------------------------------------------
Write-Host "[1/8] Checking /health (waiting up to 90s for cold start)..." -ForegroundColor Yellow
$healthOk = $false
$maxAttempts = 18
$attempt = 1

while ($attempt -le $maxAttempts) {
    try {
        $resp = Invoke-WebRequest -Uri "$BaseUrl/health" -Method Get -TimeoutSec 10 -SkipHttpErrorCheck -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $healthOk = $true
            break
        }
    } catch {
        # Backend still spinning up
    }
    Write-Host "  ... waiting for server to wake up (attempt $attempt/$maxAttempts)..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
    $attempt++
}

if ($healthOk) {
    Record-Check "1. GET /health" $true "200 OK (Backend is awake and responding)"
} else {
    Record-Check "1. GET /health" $false "Server did not respond with 200 OK within 90 seconds"
}

# -------------------------------------------------------------
# 2. Unauthenticated POST /scan rejection
# -------------------------------------------------------------
$resScan = Invoke-WebRequest -Uri "$BaseUrl/scan" -Method Post -TimeoutSec 10 -SkipHttpErrorCheck -ErrorAction SilentlyContinue
$scanStatus = $resScan.StatusCode
if ($scanStatus -in 401, 403) {
    Record-Check "2. POST /scan (No Auth)" $true "Rejected ($scanStatus Forbidden/Unauthorized)"
} else {
    Record-Check "2. POST /scan (No Auth)" $false "Expected 401/403, received $scanStatus"
}

# -------------------------------------------------------------
# 3. Unauthenticated POST /upload rejection
# -------------------------------------------------------------
$resUpload = Invoke-WebRequest -Uri "$BaseUrl/upload" -Method Post -TimeoutSec 10 -SkipHttpErrorCheck -ErrorAction SilentlyContinue
$uploadStatus = $resUpload.StatusCode
if ($uploadStatus -in 401, 403) {
    Record-Check "3. POST /upload (No Auth)" $true "Rejected ($uploadStatus Forbidden/Unauthorized)"
} else {
    Record-Check "3. POST /upload (No Auth)" $false "Expected 401/403, received $uploadStatus"
}

# -------------------------------------------------------------
# 4. Unauthenticated GET /records rejection
# -------------------------------------------------------------
$resRecords = Invoke-WebRequest -Uri "$BaseUrl/records" -Method Get -TimeoutSec 10 -SkipHttpErrorCheck -ErrorAction SilentlyContinue
$recordsStatus = $resRecords.StatusCode
if ($recordsStatus -in 401, 403) {
    Record-Check "4. GET /records (No Auth)" $true "Rejected ($recordsStatus Forbidden/Unauthorized)"
} else {
    Record-Check "4. GET /records (No Auth)" $false "Expected 401/403, received $recordsStatus"
}

# -------------------------------------------------------------
# 5. Unauthenticated GET /auth/users rejection
# -------------------------------------------------------------
$resUsers = Invoke-WebRequest -Uri "$BaseUrl/auth/users" -Method Get -TimeoutSec 10 -SkipHttpErrorCheck -ErrorAction SilentlyContinue
$usersStatus = $resUsers.StatusCode
if ($usersStatus -in 401, 403) {
    Record-Check "5. GET /auth/users (No Auth)" $true "Rejected ($usersStatus Forbidden/Unauthorized)"
} else {
    Record-Check "5. GET /auth/users (No Auth)" $false "Expected 401/403, received $usersStatus"
}

# -------------------------------------------------------------
# 6. Refuse Default Admin Password (admin / admin123)
# -------------------------------------------------------------
$bodyAdmin = @{ username = "admin"; password = "admin123" } | ConvertTo-Json -Compress
$resDefaultAdmin = Invoke-WebRequest -Uri "$BaseUrl/auth/login" -Method Post -Body $bodyAdmin -ContentType "application/json" -TimeoutSec 10 -SkipHttpErrorCheck -ErrorAction SilentlyContinue
if ($resDefaultAdmin.StatusCode -eq 401) {
    Record-Check "6. Default Admin Rejection" $true "401 Unauthorized (Hardcoded 'admin123' refused)"
} else {
    Record-Check "6. Default Admin Rejection" $false "Received status $($resDefaultAdmin.StatusCode) instead of 401"
}

# -------------------------------------------------------------
# 7. Refuse Default Employee Password (employee / employee123)
# -------------------------------------------------------------
$bodyEmp = @{ username = "employee"; password = "employee123" } | ConvertTo-Json -Compress
$resDefaultEmp = Invoke-WebRequest -Uri "$BaseUrl/auth/login" -Method Post -Body $bodyEmp -ContentType "application/json" -TimeoutSec 10 -SkipHttpErrorCheck -ErrorAction SilentlyContinue
if ($resDefaultEmp.StatusCode -eq 401) {
    Record-Check "7. Default Employee Rejection" $true "401 Unauthorized (Hardcoded 'employee123' refused)"
} else {
    Record-Check "7. Default Employee Rejection" $false "Received status $($resDefaultEmp.StatusCode) instead of 401"
}

# -------------------------------------------------------------
# 8. Optional: Authenticated Admin Login Verification
# -------------------------------------------------------------
Write-Host "`n-----------------------------------------------------------------" -ForegroundColor Gray
$testLogin = Read-Host "Would you like to test login with your provisioned ADMIN account? (y/N)"
if ($testLogin -eq 'y' -or $testLogin -eq 'Y') {
    $adminUser = Read-Host "Enter ADMIN_USERNAME (e.g. Ashok or admin)"
    $adminPassSec = Read-Host -AsSecureString "Enter ADMIN_PASSWORD (hidden)"
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminPassSec)
    $plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    $loginPayload = @{ username = $adminUser; password = $plainPass } | ConvertTo-Json -Compress
    $plainPass = $null # Clear plaintext immediately

    try {
        $loginRes = Invoke-WebRequest -Uri "$BaseUrl/auth/login" -Method Post -Body $loginPayload -ContentType "application/json" -TimeoutSec 10 -SkipHttpErrorCheck
        if ($loginRes.StatusCode -eq 200) {
            $parsed = $loginRes.Content | ConvertFrom-Json
            $mustChange = [bool]$parsed.must_change_password
            Record-Check "8. Configured Admin Login" $true "200 OK (must_change_password: $mustChange, role: $($parsed.role))"
        } else {
            Record-Check "8. Configured Admin Login" $false "Received status $($loginRes.StatusCode)"
        }
    } catch {
        Record-Check "8. Configured Admin Login" $false "Request error: $_"
    }
}

# -------------------------------------------------------------
# Summary Report
# -------------------------------------------------------------
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "                       SUMMARY REPORT                            " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
$failedCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$passedCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count

$results | Format-Table -AutoSize

if ($failedCount -eq 0) {
    Write-Host "`n✓ ALL CHECKS PASSED ($passedCount/$passedCount). Deployment is secure and active!" -ForegroundColor Green
} else {
    Write-Host "`n✗ $failedCount CHECK(S) FAILED. Please review the table above." -ForegroundColor Red
}
