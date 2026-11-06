param(
  [Parameter(Mandatory)][string]$ReferenceDirectory,
  [Parameter(Mandatory)][string]$CaptureDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies @(
  [Drawing.Bitmap].Assembly.Location
  [Drawing.Color].Assembly.Location
  [System.ComponentModel.Component].Assembly.Location
  (Join-Path $PSHOME 'ref/System.Runtime.dll')
) -TypeDefinition @'
using System;
using System.Drawing;
public static class MidouPixelAudit {
    public static double Match(Bitmap a, Bitmap b) {
        long matches = 0;
        int width = a.Width, height = a.Height;
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                Color p = a.GetPixel(x, y), q = b.GetPixel(x, y);
                if (Math.Abs(p.R - q.R) <= 32 && Math.Abs(p.G - q.G) <= 32
                    && Math.Abs(p.B - q.B) <= 32) matches++;
            }
        }
        return 100.0 * matches / ((long)width * height);
    }
}
'@

# The RGB tolerance matches the historical navigation-only comparison.
# Do not rescale or crop: those operations can hide real layout differences.
$pairs = [ordered]@{
  'SCOUTOPS选品工作台总览-1.png' = 'workbench-reference.png'
  '市场情报与选品详情-2.png' = 'intelligence-reference.png'
  '选品库已完成分析空状态-3.png' = 'completed-empty-reference.png'
  '1688找货任务详情-4.png' = 'sourcing-progress-reference.png'
  '选品库候选商品列表-5.png' = 'candidate-reference.png'
  '米兜组织治理概览-6.png' = 'organization-reference.png'
  'SCOUTOPS平台运行概览-7.png' = 'platform-reference.png'
  'SCOUTOPS 通知中心仪表盘-8.png' = 'notification-two-row-reference.png'
  '个人中心·基本资料与安全-9.png' = 'personal-profile-reference.png'
}
$captures = @(Get-ChildItem -LiteralPath $CaptureDirectory -Recurse -File -Filter '*.png')
$references = @(Get-ChildItem -LiteralPath $ReferenceDirectory -Recurse -File -Filter '*.png')
$results = foreach ($entry in $pairs.GetEnumerator()) {
  $reference = @($references | Where-Object Name -eq $entry.Key)
  $capture = @($captures | Where-Object Name -eq $entry.Value)
  $result = [ordered]@{ reference = $entry.Key; capture = $entry.Value }
  if ($reference.Count -ne 1 -or $capture.Count -ne 1) {
    $result.status = 'missing_or_ambiguous'
    $result.referenceCount = $reference.Count
    $result.captureCount = $capture.Count
    if ($capture.Count -eq 1) {
      $result.captureSha256 = (Get-FileHash -LiteralPath $capture[0].FullName).Hash
      $bitmap = [Drawing.Bitmap]::new($capture[0].FullName)
      try { $result.captureSize = "$($bitmap.Width)x$($bitmap.Height)" }
      finally { $bitmap.Dispose() }
    }
    [pscustomobject]$result
    continue
  }
  $a = [Drawing.Bitmap]::new($reference[0].FullName)
  try {
    $b = [Drawing.Bitmap]::new($capture[0].FullName)
    try {
      $result.referenceSize = "$($a.Width)x$($a.Height)"
      $result.captureSize = "$($b.Width)x$($b.Height)"
      $result.referenceSha256 = (Get-FileHash -LiteralPath $reference[0].FullName).Hash
      $result.captureSha256 = (Get-FileHash -LiteralPath $capture[0].FullName).Hash
      if ($a.Size -ne $b.Size) {
        $result.status = 'size_mismatch'
      } else {
        # A sparse sample is not a pixel score. Scan all pixels in native .NET code.
        $result.status = 'measured'
        $result.matchPercent = [Math]::Round([MidouPixelAudit]::Match($a, $b), 4)
      }
    } finally { $b.Dispose() }
  } finally { $a.Dispose() }
  [pscustomobject]$result
}
ConvertTo-Json -Depth 4 -InputObject @($results)
