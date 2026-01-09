import { getAppConfig } from '../config'
import dayjs from 'dayjs'
import AdmZip from 'adm-zip'
import path from 'path'
import {
  appConfigPath,
  controledMihomoConfigPath,
  dataDir,
  overrideConfigPath,
  overrideDir,
  profileConfigPath,
  profilesDir,
  subStoreDir,
  themesDir
} from '../utils/dirs'

function isValidFilename(filename: string): boolean {
  const normalized = path.normalize(filename)
  // 确保规范化后路径与原始输入一致，防止任何形式的路径遍历
  return (
    !normalized.includes('..') &&
    !path.isAbsolute(normalized) &&
    normalized === filename &&
    !filename.includes('/') &&
    !filename.includes('\\')
  )
}

function isValidWebdavUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export async function webdavBackup(): Promise<boolean> {
  const { createClient } = await import('webdav/dist/node/index.js')
  const {
    webdavUrl = '',
    webdavUsername = '',
    webdavPassword = '',
    webdavDir = 'sparkle'
  } = await getAppConfig()

  if (!isValidWebdavUrl(webdavUrl)) {
    throw new Error('Invalid WebDAV URL')
  }

  const zip = new AdmZip()

  zip.addLocalFile(appConfigPath())
  zip.addLocalFile(controledMihomoConfigPath())
  zip.addLocalFile(profileConfigPath())
  zip.addLocalFile(overrideConfigPath())
  zip.addLocalFolder(themesDir(), 'themes')
  zip.addLocalFolder(profilesDir(), 'profiles')
  zip.addLocalFolder(overrideDir(), 'override')
  zip.addLocalFolder(subStoreDir(), 'substore')
  const date = new Date()
  const zipFileName = `${process.platform}_${dayjs(date).format('YYYY-MM-DD_HH-mm-ss')}.zip`

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword
  })
  try {
    await client.createDirectory(webdavDir)
  } catch {
    // ignore
  }

  return await client.putFileContents(`${webdavDir}/${zipFileName}`, zip.toBuffer())
}

export async function webdavRestore(filename: string): Promise<void> {
  if (!isValidFilename(filename)) {
    throw new Error('Invalid filename')
  }

  const { createClient } = await import('webdav/dist/node/index.js')
  const {
    webdavUrl = '',
    webdavUsername = '',
    webdavPassword = '',
    webdavDir = 'sparkle'
  } = await getAppConfig()

  if (!isValidWebdavUrl(webdavUrl)) {
    throw new Error('Invalid WebDAV URL')
  }

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword
  })
  const zipData = await client.getFileContents(`${webdavDir}/${filename}`)
  const zip = new AdmZip(zipData as Buffer)
  const targetDir = dataDir()
  for (const entry of zip.getEntries()) {
    const normalized = path.normalize(entry.entryName)
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error(`Invalid path in archive: ${entry.entryName}`)
    }
  }
  zip.extractAllTo(targetDir, true)
}

export async function listWebdavBackups(): Promise<string[]> {
  const { createClient } = await import('webdav/dist/node/index.js')
  const {
    webdavUrl = '',
    webdavUsername = '',
    webdavPassword = '',
    webdavDir = 'sparkle'
  } = await getAppConfig()

  if (!isValidWebdavUrl(webdavUrl)) {
    throw new Error('Invalid WebDAV URL')
  }

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword
  })
  const files = await client.getDirectoryContents(webdavDir, { glob: '*.zip' })
  const fileList = Array.isArray(files) ? files : files.data
  return fileList.map((file) => file.basename).sort((a, b) => b.localeCompare(a))
}

export async function webdavDelete(filename: string): Promise<void> {
  if (!isValidFilename(filename)) {
    throw new Error('Invalid filename')
  }

  const { createClient } = await import('webdav/dist/node/index.js')
  const {
    webdavUrl = '',
    webdavUsername = '',
    webdavPassword = '',
    webdavDir = 'sparkle'
  } = await getAppConfig()

  if (!isValidWebdavUrl(webdavUrl)) {
    throw new Error('Invalid WebDAV URL')
  }

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword
  })
  await client.deleteFile(`${webdavDir}/${filename}`)
}

// 本地备份功能
export async function localBackup(targetPath: string): Promise<string> {
  const fs = await import('fs/promises')

  // 验证目标路径是否为可写目录
  try {
    await fs.access(targetPath, (await import('fs')).constants.W_OK)
    const stat = await fs.stat(targetPath)
    if (!stat.isDirectory()) {
      throw new Error('目标路径必须是目录')
    }
  } catch (error) {
    if (error instanceof Error && error.message === '目标路径必须是目录') {
      throw error
    }
    throw new Error('目标目录不可写或不存在')
  }

  const zip = new AdmZip()
  let hasContent = false

  // 添加文件，检查存在性
  const filesToAdd = [
    { path: appConfigPath(), name: undefined },
    { path: controledMihomoConfigPath(), name: undefined },
    { path: profileConfigPath(), name: undefined },
    { path: overrideConfigPath(), name: undefined }
  ]

  for (const file of filesToAdd) {
    try {
      await fs.access(file.path)
      try {
        zip.addLocalFile(file.path)
        hasContent = true
      } catch (addError) {
        // 文件添加失败（可能被锁定或权限不足），记录但继续
        console.warn(`Failed to add file to backup: ${file.path}`, addError)
      }
    } catch {
      // 文件不存在，跳过
      continue
    }
  }

  // 添加文件夹，检查存在性
  const foldersToAdd = [
    { path: themesDir(), name: 'themes' },
    { path: profilesDir(), name: 'profiles' },
    { path: overrideDir(), name: 'override' },
    { path: subStoreDir(), name: 'substore' }
  ]

  for (const folder of foldersToAdd) {
    try {
      const stat = await fs.stat(folder.path)
      if (stat.isDirectory()) {
        try {
          zip.addLocalFolder(folder.path, folder.name)
          hasContent = true
        } catch (addError) {
          // 文件夹添加失败，记录但继续
          console.warn(`Failed to add folder to backup: ${folder.path}`, addError)
        }
      }
    } catch {
      // 文件夹不存在，跳过
      continue
    }
  }

  // 检查是否有内容可备份
  if (!hasContent) {
    throw new Error('没有可备份的内容')
  }

  const date = new Date()
  const zipFileName = `${process.platform}_${dayjs(date).format('YYYY-MM-DD_HH-mm-ss')}.zip`
  const fullPath = path.join(targetPath, zipFileName)

  // 写入文件，失败时清理
  try {
    await fs.writeFile(fullPath, zip.toBuffer())
    return fullPath
  } catch (error) {
    // 尝试清理可能创建的不完整文件
    try {
      await fs.unlink(fullPath)
    } catch (cleanupError) {
      // 清理失败，记录错误信息
      console.error('Failed to cleanup incomplete backup file:', fullPath, cleanupError)
    }
    throw error
  }
}

export async function localRestore(zipPath: string): Promise<void> {
  const fs = await import('fs/promises')
  const os = await import('os')
  const { dialog, shell } = await import('electron')

  // 验证文件存在
  try {
    await fs.access(zipPath)
  } catch {
    throw new Error('备份文件不存在')
  }

  // 验证是 zip 文件
  if (!zipPath.toLowerCase().endsWith('.zip')) {
    throw new Error('只支持 .zip 格式的备份文件')
  }

  const zipData = await fs.readFile(zipPath)
  const zip = new AdmZip(zipData)
  const targetDir = dataDir()

  // 定义允许的文件和目录白名单
  const allowedPaths = new Set([
    'config.yaml',
    'mihomo.yaml',
    'profile.yaml',
    'override.yaml',
    'themes',
    'profiles',
    'override',
    'substore'
  ])

  // 安全检查：防止路径遍历并验证白名单
  for (const entry of zip.getEntries()) {
    const normalized = path.normalize(entry.entryName)
    if (normalized.includes('..') || path.isAbsolute(normalized)) {
      throw new Error(`备份文件中包含非法路径: ${entry.entryName}`)
    }

    // 检查顶级路径是否在白名单中
    const parts = normalized.split(path.sep).filter((s) => s)
    if (parts.length === 0 || !allowedPaths.has(parts[0])) {
      throw new Error(`备份文件中包含未知文件: ${entry.entryName}`)
    }
  }

  // 创建临时目录用于解压
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sparkle-restore-'))

  // 创建当前配置的备份
  const backupDir = path.join(targetDir, '.backup-' + Date.now())

  try {
    // 创建备份目录
    await fs.mkdir(backupDir, { recursive: true })

    // 解压到临时目录
    zip.extractAllTo(tempDir, true)

    // 备份现有文件
    for (const item of allowedPaths) {
      const sourcePath = path.join(targetDir, item)
      const backupPath = path.join(backupDir, item)
      try {
        const stat = await fs.stat(sourcePath)
        if (stat.isDirectory()) {
          await fs.cp(sourcePath, backupPath, { recursive: true })
        } else {
          await fs.copyFile(sourcePath, backupPath)
        }
      } catch {
        // 文件不存在，跳过
      }
    }

    // 从临时目录复制到目标目录
    const tempFiles = await fs.readdir(tempDir)
    for (const file of tempFiles) {
      const sourcePath = path.join(tempDir, file)
      const destPath = path.join(targetDir, file)
      const stat = await fs.stat(sourcePath)

      if (stat.isDirectory()) {
        // 删除旧目录（如果存在）
        try {
          await fs.rm(destPath, { recursive: true, force: true })
        } catch {
          // 忽略
        }
        await fs.cp(sourcePath, destPath, { recursive: true })
      } else {
        await fs.copyFile(sourcePath, destPath)
      }
    }

    // 恢复成功，尝试删除备份（删除失败不影响恢复结果）
    try {
      await fs.rm(backupDir, { recursive: true, force: true })
    } catch (cleanupError) {
      // 备份目录删除失败，记录日志
      console.warn('Failed to cleanup backup directory:', backupDir, cleanupError)
    }
  } catch (error) {
    // 恢复失败，尝试回滚
    let rollbackFailed = false
    try {
      // 第一步：尝试读取临时目录中的文件列表并清理
      try {
        const tempFiles = await fs.readdir(tempDir)
        // 删除所有从临时目录复制过来的文件/目录
        for (const file of tempFiles) {
          const destPath = path.join(targetDir, file)
          try {
            await fs.rm(destPath, { recursive: true, force: true })
          } catch {
            // 忽略删除失败（文件可能不存在）
          }
        }
      } catch (readTempError) {
        // 无法读取临时目录，尝试根据白名单清理
        console.warn('Failed to read temp directory, cleaning based on whitelist:', readTempError)
        for (const item of allowedPaths) {
          const destPath = path.join(targetDir, item)
          try {
            await fs.rm(destPath, { recursive: true, force: true })
          } catch {
            // 忽略删除失败
          }
        }
      }

      // 第二步：从备份恢复原始文件
      const backupFiles = await fs.readdir(backupDir)
      for (const file of backupFiles) {
        const backupPath = path.join(backupDir, file)
        const destPath = path.join(targetDir, file)
        const stat = await fs.stat(backupPath)

        if (stat.isDirectory()) {
          await fs.cp(backupPath, destPath, { recursive: true })
        } else {
          await fs.copyFile(backupPath, destPath)
        }
      }
      // 回滚成功，删除备份目录
      await fs.rm(backupDir, { recursive: true, force: true })
    } catch (rollbackError) {
      rollbackFailed = true
      console.error('Rollback failed:', rollbackError)
    }

    if (rollbackFailed) {
      // 回滚失败，弹窗提示用户并打开备份目录
      try {
        const result = await dialog.showMessageBox({
          type: 'error',
          title: '恢复失败',
          message: '配置恢复失败且自动回滚失败',
          detail: `您的原始配置已备份至:\n${backupDir}\n\n点击"打开目录"查看备份文件，您可以手动将其中的文件复制回应用数据目录进行恢复。`,
          buttons: ['打开目录', '关闭']
        })
        if (result.response === 0) {
          await shell.openPath(backupDir)
        }
      } catch (dialogError) {
        // 对话框显示失败，记录错误但不影响异常抛出
        console.error('Failed to show error dialog:', dialogError)
      }
      throw new Error(`恢复失败，请手动从备份目录恢复配置: ${backupDir}`)
    }

    throw error
  } finally {
    // 清理临时目录
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (cleanupError) {
      // 临时目录清理失败，记录完整路径方便手动清理
      console.warn(
        `Failed to cleanup temp directory. Please manually delete: ${tempDir}`,
        cleanupError
      )
    }
  }
}

export async function listLocalBackups(backupDir: string): Promise<string[]> {
  const fs = await import('fs/promises')

  // 匹配应用备份文件格式: {platform}_{YYYY-MM-DD_HH-mm-ss}.zip
  const backupFilePattern = /^(darwin|win32|linux)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.zip$/

  try {
    const stat = await fs.stat(backupDir)
    if (!stat.isDirectory()) {
      throw new Error('指定的路径不是目录')
    }
    const files = await fs.readdir(backupDir)
    const zipFiles = files.filter((file) => backupFilePattern.test(file))
    return zipFiles.sort((a, b) => b.localeCompare(a))
  } catch (error: unknown) {
    // 目录不存在
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error('备份目录不存在')
    }
    // 其他错误（如权限问题）
    if (error instanceof Error && error.message === '指定的路径不是目录') {
      throw error
    }
    throw new Error('无法读取备份目录')
  }
}

export async function localDelete(backupDir: string, filename: string): Promise<void> {
  if (!isValidFilename(filename)) {
    throw new Error('Invalid filename')
  }

  const fs = await import('fs/promises')
  const fullPath = path.join(backupDir, filename)

  // 使用 path.relative 确保文件在备份目录内（跨平台安全）
  const relativePath = path.relative(backupDir, fullPath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Invalid file path')
  }

  await fs.unlink(fullPath)
}
