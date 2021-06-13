'use strict'
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import Hatenablog, { ResponseBody } from './hatenablog'
import Hatenafotolife from './hatenafotolife'
import { basename } from 'path'
import open from 'open'
import * as fs from 'fs'
import dayjs from 'dayjs'

const CONTEXT_COMMENT_RegExp = /^<!--([\s\S]*?)-->\n\n?/
const ID_RegExp = /^tag:[^:]+:[^-]+-[^-]+-\d+-(\d+)$/
const DATE_RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2}$/
type Context = {
  id: string
  title: string
  categories: string[]
  draft: 'yes' | 'no'
  updated: string
  edited: string
}

const hatenablog = new Hatenablog()
const hatenafotolife = new Hatenafotolife()

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): void {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "hatenablogger" is now active!')

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  const disposables = []
  disposables.push(vscode.commands.registerCommand('extension.postOrUpdate', postOrUpdate))
  disposables.push(vscode.commands.registerCommand('extension.uploadImage', uploadImage))
  disposables.push(vscode.commands.registerCommand('extension.retrieveEntry', retrieveEntry))
  disposables.push(vscode.commands.registerCommand('extension.dumpAllEntries', dumpAllEntries))
  disposables.push(vscode.commands.registerCommand('extension.replaceContentInAllEntries', replaceContentInAllEntries))

  context.subscriptions.concat(disposables)
}

// this method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate(): void {}

async function dumpAllEntries() {
  try {
    const dirPath = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
    })

    const entries = await hatenablog.allEntries(/** Discard cache */ true)
    const isConfirmed = await vscode.window.showInformationMessage(
      `${entries.length} entries were Found. Dump all entries into md files?`,
      'OK',
      'Cancel'
    )
    if (!dirPath?.[0] || isConfirmed !== 'OK') {
      throw new Error('Abort dump process.')
    }
    for (const entry of entries) {
      const id = getId(entry)
      const filePath = `${dirPath?.[0].path}/${entry.updated._}-${id}-${encodeURIComponent(entry.title._)}.md`

      const context = createContext(entry, { id })
      const content = `\n\n${entry.content._}` ?? ''
      const data = `<!--\n${JSON.stringify(context)}\n-->${content}`
      fs.writeFileSync(filePath, data)
    }
  } catch (err) {
    showErrorMessage(err)
  }
}

async function replaceContentInAllEntries() {
  try {
    const findTextInput = await vscode.window.showInputBox({
      prompt: 'Find this pattern using RegExp in all entries',
    })
    if (!findTextInput) {
      throw new Error('Abort find process')
    }
    const entries = await hatenablog.allEntries(/** Discard cache */ true)
    const regexp = new RegExp(findTextInput)
    const filteredEntries = entries.filter((entry) => {
      return entry.content._?.match(regexp)
    })

    if (filteredEntries?.length === 0) {
      throw new Error('No entry was found')
    }

    const replaceTextInput = await vscode.window.showInputBox({
      prompt: `${filteredEntries.length} entries were found. Enter this to use for replacement`,
    })

    if (!replaceTextInput) {
      throw new Error('Abort find process')
    }

    let count = 0
    for (const entry of filteredEntries) {
      const options = {
        ...createContext(entry),
        content: entry.content?._?.replace(regexp, replaceTextInput) ?? '',
      }
      await hatenablog.postOrUpdate(options)
      count += 1
    }

    await vscode.window.showInformationMessage(
      `Successfully replaced ${findTextInput} with ${replaceTextInput} in ${count} entries`
    )
  } catch (err) {
    showErrorMessage(err)
  }
}

async function retrieveEntry() {
  try {
    const id = getContext()?.id ?? (await pickEntryId())
    if (!id) {
      throw new Error('ID is required in context.')
    }

    const { entry } = await hatenablog.getEntry(id)
    const content = entry.content._

    const context = createContext(entry, { id })
    saveContext(context, content)

    vscode.window.showInformationMessage(`Successfully retrieved Entry content (ID: ${id})`)
  } catch (err) {
    showErrorMessage(err)
  }
}

async function postOrUpdate() {
  try {
    const textEditor = vscode.window.activeTextEditor
    if (!textEditor) {
      throw new Error('TextEditor was not found')
    }
    const content = textEditor.document.getText()
    const previousContext = getContext()

    const inputTitle = await vscode.window.showInputBox({
      placeHolder: 'Entry title',
      prompt: 'Please input an entry title',
      value: previousContext?.title ?? '',
    })

    if (!inputTitle) {
      throw new Error('Title is required')
    }

    let defaultCategoriesValue = previousContext?.categories ?? []

    /**
     * カテゴリAPIからカテゴリ一覧を取得して選択
     */
    const { askCategory } = getConfiguration()
    if (askCategory) {
      const allCategories = await hatenablog.allCategories()
      const categoriesItems = allCategories['app:categories']['atom:category']
      const selectedCategories = await vscode.window.showQuickPick(
        Array.isArray(categoriesItems) ? categoriesItems.map((c) => c.$.term) : [categoriesItems.$.term],
        {
          canPickMany: true,
          ignoreFocusOut: true,
          placeHolder: 'Select category',
        }
      )
      if (selectedCategories) {
        defaultCategoriesValue = [...defaultCategoriesValue, ...selectedCategories]
      }
    }

    const inputCategories = await vscode.window.showInputBox({
      placeHolder: 'Categories',
      prompt: 'Please input categories. (Comma deliminated)',
      value: defaultCategoriesValue.join(', '),
    })

    if (inputCategories === undefined) {
      throw new Error('Abort process')
    }

    /**
     * if context exists, use context.updated as default value.
     * unless, use now as default value
     */
    const now = dayjs().format()
    const inputUpdated = await vscode.window.showInputBox({
      placeHolder: now,
      prompt: 'Please input `updated at`',
      value: previousContext?.updated ?? now,
      validateInput: (text: string) => {
        if (DATE_RegExp.test(text)) {
          return undefined
        }
        return 'Invaild format'
      },
    })
    if (inputUpdated === undefined) {
      throw new Error('Abort process')
    }

    const inputPublished = await vscode.window.showInputBox({
      placeHolder: 'yes',
      prompt: 'Do you want to publish it? Type "yes" or save as draft',
    })

    if (inputPublished === undefined) {
      throw new Error('Abort process')
    }

    const categories = inputCategories ? inputCategories.split(',') : []
    const draft: 'yes' | 'no' = inputPublished === 'yes' ? 'no' : 'yes'

    const options = {
      id: previousContext?.id,
      title: inputTitle,
      content: removeContextComment(content),
      categories,
      updated: inputUpdated,
      draft,
    }

    const { entry } = await hatenablog.postOrUpdate(options)
    const id = getId(entry)

    const { hatenaId, blogId, openAfterPostOrUpdate } = getConfiguration()

    if (!id) {
      throw new Error('ID not retrieved.')
    }
    const entryURL =
      draft !== 'yes' ? entry.link[1].$.href : `http://blog.hatena.ne.jp/${hatenaId}/${blogId}/edit?entry=${id}`

    const context = createContext(entry, {
      id,
      categories,
      draft,
    })
    saveContext(context)

    vscode.window.showInformationMessage(`Successfully ${previousContext?.id ? 'updated' : 'posted'} at ${entryURL}`)

    if (openAfterPostOrUpdate) {
      await open(entryURL)
    }
  } catch (err: unknown) {
    showErrorMessage(err)
  }
}

function saveContext(context: Context, content?: string) {
  const textEditor = vscode.window.activeTextEditor
  if (!textEditor) {
    return
  }
  const fileContent = content ?? removeContextComment(textEditor.document.getText())

  const comment = `<!--\n${JSON.stringify(context)}\n-->\n\n${fileContent}`

  const firstPosition = new vscode.Position(0, 0)
  const lastPosition = new vscode.Position(textEditor.document.lineCount, 0)
  textEditor.edit((edit) => edit.replace(new vscode.Range(firstPosition, lastPosition), comment))
}

function parseContext(content: string): null | Context {
  const comment = content.match(CONTEXT_COMMENT_RegExp)
  if (comment) {
    return JSON.parse(comment[1])
  }
  return null
}

function removeContextComment(content: string) {
  return content.replace(CONTEXT_COMMENT_RegExp, '')
}

async function uploadImage() {
  const { allowedImageExtensions } = getConfiguration()

  const uri = await vscode.window.showOpenDialog({
    filters: {
      Image: allowedImageExtensions ?? [],
    },
  })
  if (!uri) {
    return
  }
  const { fsPath } = uri[0]
  const textEditor = vscode.window.activeTextEditor

  if (textEditor && textEditor.selection.isEmpty) {
    const position = textEditor.selection.active

    let title = await vscode.window.showInputBox({
      placeHolder: 'Title',
      prompt: 'Please input title',
      value: basename(fsPath),
    })
    title = title ?? basename(fsPath)

    const { askCaption } = getConfiguration()
    let caption: string | undefined
    if (askCaption) {
      caption = await vscode.window.showInputBox({
        placeHolder: 'Caption',
        prompt: 'Please input caption if needed',
        value: '',
      })
    }

    try {
      vscode.window.showInformationMessage('Uploading image...')

      const { entry } = await hatenafotolife.upload({
        file: fsPath,
        title,
      })

      const imageurl = entry['hatena:imageurl']._

      /**
       * デフォルトURL
       */
      let markdown = `![${title}](${imageurl})`

      /**
       * キャプション付きのURL
       */
      if (caption) {
        markdown = `<figure class="figure-image figure-image-fotolife" title="${caption}">

${markdown}

<figcaption>${caption}</figcaption></figure>
          `
      }

      textEditor.edit((edit) => edit.insert(position, markdown))
      vscode.window.showInformationMessage('Successfully image uploaded!')
    } catch (err) {
      showErrorMessage(err)
    }
  }
}

async function showErrorMessage(err: unknown) {
  console.error(err)
  await vscode.window.showErrorMessage(`HatenaBlogger was canceled. ${String(err)}`)
}

function createContext(entry: ResponseBody['entry'], context?: Partial<Context>): Context {
  const id = getId(entry)
  return {
    id,
    title: entry.title._,
    categories: Array.isArray(entry.category) ? entry.category.map((c) => c.$.term) : [entry.category.$.term],
    updated: entry.updated._,
    edited: entry['app:edited']._,
    draft: entry['app:control']['app:draft']._,
    ...context,
  }
}

function getContext() {
  const textEditor = vscode.window.activeTextEditor
  if (!textEditor) {
    console.error('TextEditor not found')
    return
  }

  const content = textEditor.document.getText()
  return parseContext(content)
}

async function pickEntryId() {
  const SYNC = 'Sync $(sync)'
  const LOAD_MORE = 'Load more $(arrow-down)'
  let input:
    | undefined
    | null
    | {
        label: string
        detail: string
      } = null

  while (input === null || input?.label === SYNC || input?.label === LOAD_MORE) {
    const getItems = async () => {
      const discardCache = input?.label === SYNC
      const loadMore = input?.label === LOAD_MORE

      let options = [
        {
          label: SYNC,
          detail: 'Discard cache',
        },
      ]
      if (loadMore || discardCache) {
        const entries = await hatenablog.allEntries(discardCache)
        options = [
          ...entries.map((entry) => ({
            label: entry.title._,
            detail: getId(entry),
          })),
        ]
      } else {
        const entries = (await hatenablog.listEntry())['feed']['entry']
        options = [
          ...entries.map((entry) => ({
            label: entry.title._,
            detail: getId(entry),
          })),
          {
            label: LOAD_MORE,
            detail: '',
          },
        ]
      }
      return options
    }
    input = await vscode.window.showQuickPick(getItems())
  }

  return input?.detail
}

function getConfiguration(): {
  hatenaId: string
  blogId: string
  apiKey: string
  allowedImageExtensions: string[]
  openAfterPostOrUpdate: boolean
  askCaption: boolean
  askCategory: boolean
} {
  const { hatenaId, blogId, apiKey, allowedImageExtensions, openAfterPostOrUpdate, askCaption, askCategory } =
    vscode.workspace.getConfiguration('hatenablogger')
  return {
    hatenaId,
    blogId,
    apiKey,
    allowedImageExtensions,
    openAfterPostOrUpdate,
    askCaption,
    askCategory,
  }
}

function getId(entry: ResponseBody['entry']) {
  return entry.id._.match(ID_RegExp)?.[1] ?? 'ID Not Found'
}
