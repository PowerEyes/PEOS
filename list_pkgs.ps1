Get-ChildItem -Path "C:\Users\Public\Documents\PowerOSC\packages" -Filter "*.ts" -Recurse -Name | Select-Object -First 40
Write-Output done
Remove-Item -Force -ErrorAction SilentlyContinue "C:/Users/Public/Documents/PowerOSC/grep_rxstatus.ps1"
