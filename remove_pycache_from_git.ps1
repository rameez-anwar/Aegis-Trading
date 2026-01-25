# Script to remove __pycache__ files from Git tracking
# Run this after closing VS Code or any Git clients

Write-Host "Removing __pycache__ files from Git tracking..." -ForegroundColor Yellow

# Remove lock file if it exists
if (Test-Path .git\index.lock) {
    Write-Host "Removing Git lock file..." -ForegroundColor Yellow
    Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# Get all tracked __pycache__ files
$pycacheFiles = git ls-files | Select-String "__pycache__"

if ($pycacheFiles) {
    Write-Host "Found $($pycacheFiles.Count) __pycache__ files to remove from tracking" -ForegroundColor Cyan
    
    # Remove each file from Git index
    foreach ($file in $pycacheFiles) {
        git rm --cached $file.ToString().Trim() 2>&1 | Out-Null
    }
    
    Write-Host "`nSuccessfully removed __pycache__ files from Git tracking!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "1. Run: git status (to see the changes)" -ForegroundColor White
    Write-Host "2. Run: git commit -m 'Remove __pycache__ files from tracking'" -ForegroundColor White
} else {
    Write-Host "No __pycache__ files found in Git tracking." -ForegroundColor Green
}
