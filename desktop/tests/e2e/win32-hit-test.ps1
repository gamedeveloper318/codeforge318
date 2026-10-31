# Asks Windows how it would treat a mouse click at each screen point of a
# window: 1 = HTCLIENT (the page receives the click), 2 = HTCAPTION (the click
# drags the window instead). This is the same WM_NCHITTEST question Windows asks
# for real mouse input, so it shows whether title-bar menus are clickable
# without moving the user's mouse.
#   win32-hit-test.ps1 -Hwnd 123456 -Points "100,20;300,40"
param([Int64]$Hwnd, [string]$Points)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class CfHitTest {
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hwnd, uint msg, IntPtr wParam, IntPtr lParam);
}
"@
$results = @()
foreach ($pair in $Points.Split(";")) {
  $xy = $pair.Split(",")
  $x = [int]$xy[0]
  $y = [int]$xy[1]
  $lParam = [IntPtr](($y -shl 16) -bor ($x -band 0xFFFF))
  $results += [int64][CfHitTest]::SendMessage([IntPtr]$Hwnd, 0x0084, [IntPtr]::Zero, $lParam)
}
Write-Output ($results -join ",")
