$vars=@{}
foreach($l in (Get-Content "C:\Users\Public\Documents\PowerOSC\.env" | Where-Object { $_ -match '=' -and $_ -notmatch '^\s*#' })){
  $i=$l.IndexOf('=')
  if($i -gt 0){ $vars[$l.Substring(0,$i)]=$l.Substring($i+1) }
}
$url=$vars['NEXT_PUBLIC_SUPABASE_URL']; $k=$vars['SUPABASE_SERVICE_ROLE_KEY']
$h=@{ "apikey"=$k; "Authorization"="Bearer $k" }
Write-Output "=== Cancel ORD-0001 (fully paid, status=ready) ==="
$r = Invoke-WebRequest -Method Post -Uri "$url/rest/v1/rpc/cancel_order" -Headers $h -Body '{"p_id":"983c45c9-ae92-4c8b-9b1d-1660a8e24354"}' -ContentType "application/json" -TimeoutSec 30 -UseBasicParsing
Write-Output ("STATUS " + $r.StatusCode + " BODY " + $r.Content)
Write-Output "`n=== Check order status after cancel ==="
Q "sales?id=eq.983c45c9-ae92-4c8b-9b1d-1660a8e24354&select=id,code,status,paid_total,grand_total"
Write-Output "`n=== Check stock movements ==="
Q "stock_movements?select=id,reason,delta,note&sale_id=eq.ORD-0001&order=created_at.desc"
Write-Output done
Remove-Item -Force -ErrorAction SilentlyContinue "C:/Users/Public/Documents/PowerOSC/cancel_test.ps1"