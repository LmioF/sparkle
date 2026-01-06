import { exec, execFile, execSync, spawn } from 'child_process'
import { app, dialog, nativeTheme, shell } from 'electron'
import { readFile, access, constants } from 'fs/promises'
import { accessSync, constants as fsConstants, existsSync } from 'fs'
import path from 'path'
import { promisify } from 'util'
import {
  dataDir,
  exePath,
  mihomoCorePath,
  overridePath,
  profilePath,
  resourcesDir,
  resourcesFilesDir,
  taskDir
} from '../utils/dirs'
import { copyFileSync, writeFileSync } from 'fs'

const execFilePromise = promisify(execFile)

export function getFilePath(ext: string[]): string[] | undefined {
  return dialog.showOpenDialogSync({
    title: '选择订阅文件',
    filters: [{ name: `${ext} file`, extensions: ext }],
    properties: ['openFile']
  })
}

export async function selectCorePath(): Promise<string | undefined> {
  const filters =
    process.platform === 'win32'
      ? [{ name: '可执行文件', extensions: ['exe'] }]
      : [{ name: '所有文件', extensions: ['*'] }]

  const result = await dialog.showOpenDialog({
    title: '选择内核文件',
    filters,
    properties: ['openFile']
  })

  if (result.canceled || !result.filePaths[0]) {
    return undefined
  }

  const selectedPath = result.filePaths[0]
  return validateCorePath(selectedPath)
}

export async function validateCorePath(filePath: string): Promise<string> {
  if (!filePath) {
    throw new Error('路径不能为空')
  }

  try {
    await access(filePath, constants.F_OK)
  } catch {
    throw new Error(`文件不存在: ${filePath}`)
  }

  if (process.platform !== 'win32') {
    try {
      await access(filePath, constants.X_OK)
    } catch {
      throw new Error('所选文件不是可执行文件')
    }
  } else {
    if (!filePath.toLowerCase().endsWith('.exe')) {
      throw new Error('所选文件不是可执行文件（需要 .exe 文件）')
    }
  }

  return filePath
}

export function validateCorePathSync(filePath: string): string {
  if (!filePath) {
    throw new Error('路径不能为空')
  }

  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }

  if (process.platform !== 'win32') {
    try {
      accessSync(filePath, fsConstants.X_OK)
    } catch {
      throw new Error('所选文件不是可执行文件')
    }
  } else {
    if (!filePath.toLowerCase().endsWith('.exe')) {
      throw new Error('所选文件不是可执行文件（需要 .exe 文件）')
    }
  }

  return filePath
}

export async function readTextFile(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf8')
}

export function openFile(type: 'profile' | 'override', id: string, ext?: 'yaml' | 'js'): void {
  if (type === 'profile') {
    shell.openPath(profilePath(id))
  }
  if (type === 'override') {
    shell.openPath(overridePath(id, ext || 'js'))
  }
}

export async function openUWPTool(): Promise<void> {
  const uwpToolPath = path.join(resourcesDir(), 'files', 'enableLoopback.exe')
  await execFilePromise(uwpToolPath)
}

export async function setupFirewall(): Promise<void> {
  const execPromise = promisify(exec)
  const removeCommand = `
  $rules = @("mihomo", "mihomo-alpha", "Sparkle")
  foreach ($rule in $rules) {
    if (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue) {
      Remove-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue
    }
  }
  `
  const mihomoPath = mihomoCorePath('mihomo').replace(/'/g, "''")
  const mihomoAlphaPath = mihomoCorePath('mihomo-alpha').replace(/'/g, "''")
  const sparklePath = exePath().replace(/'/g, "''")
  const createCommand = `
  New-NetFirewallRule -DisplayName "mihomo" -Direction Inbound -Action Allow -Program '${mihomoPath}' -Enabled True -Profile Any -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName "mihomo-alpha" -Direction Inbound -Action Allow -Program '${mihomoAlphaPath}' -Enabled True -Profile Any -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName "Sparkle" -Direction Inbound -Action Allow -Program '${sparklePath}' -Enabled True -Profile Any -ErrorAction SilentlyContinue
  `

  if (process.platform === 'win32') {
    await execPromise(removeCommand, { shell: 'powershell' })
    await execPromise(createCommand, { shell: 'powershell' })
  }
}

export function setNativeTheme(theme: 'system' | 'light' | 'dark'): void {
  nativeTheme.themeSource = theme
}

const elevateTaskXml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers />
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>3</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"${path.join(taskDir(), `sparkle-run.exe`)}"</Command>
      <Arguments>"${exePath()}"</Arguments>
    </Exec>
  </Actions>
</Task>
`

export function createElevateTaskSync(): void {
  const taskFilePath = path.join(taskDir(), `sparkle-run.xml`)
  writeFileSync(taskFilePath, Buffer.from(`\ufeff${elevateTaskXml}`, 'utf-16le'))
  copyFileSync(
    path.join(resourcesFilesDir(), 'sparkle-run.exe'),
    path.join(taskDir(), 'sparkle-run.exe')
  )
  execSync(
    `%SystemRoot%\\System32\\schtasks.exe /create /tn "sparkle-run" /xml "${taskFilePath}" /f`
  )
}

export async function deleteElevateTask(): Promise<void> {
  try {
    execSync(`%SystemRoot%\\System32\\schtasks.exe /delete /tn "sparkle-run" /f`)
  } catch {
    // ignore
  }
}

export async function checkElevateTask(): Promise<boolean> {
  try {
    execSync(`%SystemRoot%\\System32\\schtasks.exe /query /tn "sparkle-run"`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export function resetAppConfig(): void {
  const data = dataDir()
  const exe = exePath()
  if (process.platform === 'win32') {
    spawn(
      'cmd',
      [
        '/C',
        'timeout',
        '/t',
        '2',
        '/nobreak',
        '>nul',
        '&&',
        'rmdir',
        '/s',
        '/q',
        `"${data}"`,
        '&&',
        'start',
        '""',
        `"${exe}"`
      ],
      {
        shell: true,
        detached: true,
        windowsVerbatimArguments: true
      }
    ).unref()
  } else {
    const escapedData = data.replace(/'/g, "'\\''")
    const escapedArgv = process.argv.map((arg) => `'${arg.replace(/'/g, "'\\''")}'`).join(' ')
    const script = `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.1; done; rm -rf '${escapedData}'; ${escapedArgv} & disown; exit`
    spawn('sh', ['-c', script], {
      detached: true,
      stdio: 'ignore'
    }).unref()
  }
  app.quit()
}
