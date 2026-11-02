# CHECKLIST-PC: what Ishaan runs on his own PC

Every step here is yours to run. No session deletes anything. Steps are in order of hours saved. Read each "list" command's
output before you run the step after it.

## What the PC looks like (audit, 2026-11-02 15:40 IST)

| Part | Measured | What it means |
|---|---|---|
| Machine | HP Laptop 15-fc0xxx, Ryzen 5 7520U, 4 cores / 8 threads | a thin-laptop chip |
| GPU | AMD Radeon integrated graphics (2 compute units), 512 MB dedicated plus shared RAM; no NVIDIA | about 220 ms to render one 3D Stickman frame; the hardware encoder is `h264_amf`, not NVENC |
| RAM | 15.2 GB usable, **two soldered 8 GB LPDDR5 chips (cannot be upgraded)**; 1.8 GB free at audit; commit 25.3 of 30.5 GB | RAM is the hard ceiling on parallel sessions |
| What holds RAM | Claude app: 18 processes, 3.5 GB. Chrome: 27 processes, 3.3 GB. Windows services: 1.4 GB. Node: 1.2 GB, including **5 copies of the REA reverse-engineering MCP server, about 220 MB each (one per session)**. ChatGPT 0.7 GB, Wispr Flow 0.6 GB, Edge WebView 0.5 GB, Defender 0.4 GB, Notion 0.3 GB, Cognee helpers about 0.15 GB | idle sessions and apps cost more RAM than one export does |
| Docker / WSL | stopped at audit (no vmmem); **its disk file is 35.1 GB** (`AppData\Local\Docker\wsl\disk\docker_data.vhdx`, last written 20 Oct); no `.wslconfig` | the biggest single thing on the disk |
| Disk C: (only drive) | 476 GB, **14.6 GB free** at 15:40, 13.5 GB at 16:20 | under the 25 GB a long-form export wants |
| Biggest folders measured | Docker WSL 33.6 GB, Downloads 29.5 GB, Claude app data 9.9 GB (`vm_bundles` 7.9 GB), Moovi `data/` 8.2 GB, `~/.claude` 7.2 GB (session transcripts 6.9 GB), `~/.cache` 5.6 GB, npm cache 1.2 GB. Too slow to count: Temp (947 entries), pnpm store, Chrome profile, the repo's `.claude/worktrees` (6 worktrees, about 15 GB at the last check) | |
| Power | Windows "Balanced" scheme | on a laptop, "Best performance" mode while plugged in lets the chip boost longer (not measured here) |
| Pagefile | system managed, 15.6 GB, 2.0 GB used (peak 2.8) | fine as it is |
| Defender | real-time scanning on; the exclusion list needs an admin window to read | scanning a render's thousands of temp files costs CPU (not measured here) |

## 1. How many sessions at once (the rule that stops one session starving another)

- **One GPU owner at a time.** Only the session holding `preflight.mjs gpu take` exports or batch-captures. Measured: the same
  export ran at 224 ms a frame on a quiet PC and 417 ms with other work running.
- **At most 2 building sessions and 1 export,** each with up to about 3 builders. On 16 GB, every open Claude session costs about
  0.4-0.6 GB even when idle, and a capture page costs about 1-1.5 GB.
- **Who wins the GPU:** the film closest to its export (the one that has passed its scene judges). Everyone else builds on
  their warm page and queues.
- **Archive idle sessions.** Today 8 linked sessions sat idle, holding about 3.5 GB between the Claude processes and the REA servers.

## 2. Free disk (biggest first)

Step 2a: look at Downloads, biggest first. It is 29.5 GB, mostly installers (.exe) and old videos.

```powershell
Get-ChildItem "$env:USERPROFILE\Downloads" -File | Sort-Object Length -Descending | Select-Object -First 30 Name, @{n='MB';e={[math]::Round($_.Length/1MB)}}, LastWriteTime
```

Move the videos you want to keep to the external drive (step 6). Delete installers you have already installed by hand in Explorer.

Step 2b: see what Docker holds before touching it. FalkorDB for local tests lives here, and the server's graph does not.

```powershell
docker system df
```

Step 2c (only when Docker Desktop is running and you are fine re-pulling images): remove unused images and build cache. Containers and volumes in use stay.

```powershell
docker system prune -a
```

Step 2d: shrink the 35 GB disk file after a prune. Quit Docker Desktop first, then run these in an **admin** PowerShell, one at a time.

```powershell
wsl --shutdown
```

```powershell
"select vdisk file=`"$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx`"`r`nattach vdisk readonly`r`ncompact vdisk`r`ndetach vdisk" | Out-File -Encoding ascii "$env:TEMP\compact.txt"
```

```powershell
diskpart /s "$env:TEMP\compact.txt"
```

Or move the whole Docker disk off C: in Docker Desktop: Settings, Resources, Advanced, "Disk image location", set to the external drive.

Step 2e: list old Remotion bundles and render leftovers in Temp. The paper film cleared 650 MB of these mid-render.

```powershell
Get-ChildItem $env:TEMP -Directory | Where-Object { $_.Name -match '^(remotion|react-motion|playwright|puppeteer)' -and $_.LastWriteTime -lt (Get-Date).AddDays(-1) } | Select-Object Name, LastWriteTime
```

Step 2f: delete them, but only while no render is running.

```powershell
Get-ChildItem $env:TEMP -Directory | Where-Object { $_.Name -match '^(remotion|react-motion|playwright|puppeteer)' -and $_.LastWriteTime -lt (Get-Date).AddDays(-1) } | Remove-Item -Recurse -Force
```

Step 2g: package caches. These are safe; they re-download when needed.

```bash
pnpm store prune
```

```bash
npm cache clean --force
```

Step 2h: list the old git worktrees (about 15 GB at the last check). Remove one only after checking it has nothing uncommitted. Easiest is to ask any session to "clean up worktrees", which uses the app's own cleanup.

```bash
git -C "C:/Ishaan GPT/hackthons/moovi" worktree list
```

**Not safe to clear:**
- `~/.claude/projects` (6.9 GB): your session transcripts and memory.
- `AppData\Roaming\Claude\vm_bundles` (7.9 GB): the Claude app's VM. It comes back if you use Cowork.
- Moovi `data/`: reference media and films.
- Any `out/` folder with a final MP4: move old previews to the external drive instead of deleting them.
- The pnpm store itself: prune it, never delete it.

## 3. Free RAM before a render

Step 3a: see who holds RAM right now.

```powershell
Get-Process | Group-Object ProcessName | ForEach-Object { [pscustomobject]@{Name=$_.Name; Count=$_.Count; MB=[math]::Round(($_.Group | Measure-Object WorkingSet64 -Sum).Sum/1MB)} } | Sort-Object MB -Descending | Select-Object -First 15
```

Step 3b: close ChatGPT, Notion and Wispr Flow (about 1.6 GB together) and extra Chrome windows while a film exports.

Step 3c: turn off the REA (reverse-engineering) connector in sessions that make films. In the Claude app, open the connector/MCP
menu and switch "rea" off for the session. Each session starts its own copy, about 220 MB each.

Step 3d: stop Docker when you are not running FalkorDB tests (Docker Desktop, Quit), or cap it with step 5.

## 4. Defender: stop it scanning render temp files (admin PowerShell, one at a time)

These folders hold your own code and renders. Excluding them is a security trade-off, so it is your call. The gain was not measured here.

```powershell
Add-MpPreference -ExclusionPath "C:\Ishaan GPT\hackthons\moovi"
```

```powershell
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\Temp\claude"
```

```powershell
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\pnpm"
```

Check what is excluded:

```powershell
(Get-MpPreference).ExclusionPath
```

Do not exclude `node.exe`, `chrome.exe` or the whole Temp folder. Those are where real threats run.

## 5. Cap WSL/Docker memory

Create `C:\Users\ISHAAN\.wslconfig` (none exists today) so Docker can never take more than 3 GB.

```powershell
"[wsl2]`r`nmemory=3GB`r`nprocessors=2`r`nswap=2GB`r`n[experimental]`r`nautoMemoryReclaim=dropCache" | Out-File -Encoding ascii "$env:USERPROFILE\.wslconfig"
```

```powershell
wsl --shutdown
```

FalkorDB for local tests runs well inside 3 GB. Raise it only if a seed run fails for memory.

## 6. A second drive (the cheapest real fix)

A 1-2 TB USB-C NVMe SSD (about $70-130) for Downloads, old renders, Docker's disk image and reference media keeps C: above 25 GB.
After it is plugged in (say it is `E:`), move Docker's disk image in Docker Desktop (step 2d), and make `E:\renders` the place
old `out/` previews go.

## 7. Power while rendering

Settings, System, Power & battery, Power mode: **Best performance**, plugged in. This opens the page:

```powershell
start ms-settings:powersleep
```

## The five things that matter most

1. Free C: to 25 GB or more: Downloads (29.5 GB) and Docker's 35 GB disk (steps 2a-2d).
2. Let only one session export at a time, and archive idle sessions (section 1).
3. Cap WSL at 3 GB with `.wslconfig` (step 5), and quit Docker when you are not testing.
4. Turn off the REA connector in film sessions, and close ChatGPT, Notion and Wispr Flow during exports (step 3).
5. Decide on the external SSD, and on one paid cloud-GPU trial hour (PLAN.md section 7).
