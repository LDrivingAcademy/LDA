param([Parameter(Mandatory = $true)][int]$QueueProcessId)
$ErrorActionPreference = 'Stop'
$queueInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $QueueProcessId"
if (-not $queueInfo -or $queueInfo.Name -ne 'node.exe' -or $queueInfo.CommandLine -notlike '*scripts/render-hazard-bank.mjs*') {
    throw 'The specified process is not the LDA hazard render queue.'
}
$queueStarted = (Get-Process -Id $QueueProcessId).StartTime
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LdaRenderPowerHold {
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern uint SetThreadExecutionState(uint flags);
    public static uint Hold() { return SetThreadExecutionState(0x80000001u); }
    public static uint Release() { return SetThreadExecutionState(0x80000000u); }
}
'@
try {
    if ([LdaRenderPowerHold]::Hold() -eq 0) { throw 'Could not request temporary sleep prevention.' }
    Write-Output 'Temporary system sleep prevention is active only while the LDA render queue runs (maximum four hours). Display and lock settings are unchanged.'
    $deadline = (Get-Date).AddHours(4)
    while ((Get-Date) -lt $deadline) {
        $currentQueue = Get-Process -Id $QueueProcessId -ErrorAction SilentlyContinue
        if (-not $currentQueue -or $currentQueue.StartTime -ne $queueStarted) { break }
        Start-Sleep -Seconds 15
    }
} finally {
    [LdaRenderPowerHold]::Release() | Out-Null
    Write-Output 'LDA render sleep prevention released; normal system sleep behaviour restored.'
}
