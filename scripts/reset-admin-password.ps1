$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
$adminFile = Join-Path $projectRoot "data\administradores.json"

if (-not (Test-Path $adminFile)) {
    throw "No se encontró data\administradores.json."
}

$admins = Get-Content $adminFile -Raw | ConvertFrom-Json
if (-not $admins -or $admins.Count -eq 0) {
    throw "No hay cuentas locales que se puedan restablecer."
}

$username = ""
if ($admins.Count -gt 1) {
    $username = Read-Host "Usuario de la cuenta que deseas restablecer"
    if ([string]::IsNullOrWhiteSpace($username)) {
        throw "Debes indicar el usuario."
    }
}

$password = Read-Host "Nueva contraseña (mínimo 12 caracteres)" -AsSecureString
$confirmation = Read-Host "Confirma la nueva contraseña" -AsSecureString
$passwordBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$confirmationBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmation)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordBstr)
    $confirmedPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmationBstr)
    if ($plainPassword -cne $confirmedPassword) {
        throw "Las contraseñas no coinciden."
    }
    if ($plainPassword.Length -lt 12) {
        throw "La contraseña debe tener al menos 12 caracteres."
    }
    if ([Text.Encoding]::UTF8.GetByteCount($plainPassword) -gt 72) {
        throw "La contraseña no puede superar 72 bytes en UTF-8."
    }

    $env:RUNNERSX_RESET_PASSWORD = $plainPassword
    $env:RUNNERSX_RESET_USERNAME = $username
    npm exec tsx -- scripts/reset-admin-password.ts
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo restablecer la contraseña."
    }
}
finally {
    Remove-Item Env:RUNNERSX_RESET_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:RUNNERSX_RESET_USERNAME -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordBstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmationBstr)
    $plainPassword = $null
    $confirmedPassword = $null
}
