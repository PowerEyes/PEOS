Get-Content -Path "C:\Users\Public\Documents\PowerOSC\apps\erp\src\app\(app)\sales\pos.tsx" | Out-File -Encoding utf8 pos_full.txt
Write-Output done
Remove-Item -Force -ErrorAction SilentlyContinue "C:/Users/Public/Documents/PowerOSC/check_rx.ps1"