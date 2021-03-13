import * as pathj from 'path'
import * as fs from 'fs-extra'
import * as clipboard from 'clipboardy'
import { Key } from '@nut-tree/nut-js'
import { LinuxOpenDialog } from 'vscode-extension-tester-native/out/openDialog'

export const dialogSellectPath = async (
  dialog: LinuxOpenDialog,
  path: string
): Promise<void> => {
  const absolutePath = pathj.resolve(path)
  console.log(`Path: ${absolutePath}`)
  if (!fs.existsSync(absolutePath)) {
    throw new Error('The selected path does not exist')
  }
  await clipboard.write(absolutePath)
  await dialog.tapKey(Key.Down)
  await new Promise((res) => {
    setTimeout(res, 500)
  })
  await dialog.tapKey(Key.Down)
  await new Promise((res) => {
    setTimeout(res, 500)
  })
  await dialog.tapKey(Key.Enter)
  await new Promise((res) => {
    setTimeout(res, 500)
  })
  await dialog.tapKey(Key.Enter)
  await new Promise((res) => {
    setTimeout(res, 5000)
  })

  await dialog.tapKey(Key.LeftSuper, Key.LeftShift, Key.G)
  await new Promise((res) => {
    setTimeout(res, 500)
  })
  await dialog.tapKey(Key.LeftSuper, Key.V)
  await dialog.tapKey(Key.Enter)
  clipboard.writeSync('')
}
