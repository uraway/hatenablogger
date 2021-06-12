'use strict'
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import Hatenablog from './hatenablog'
import Hatenafotolife from './hatenafotolife'
import { basename } from 'path'
import open from 'open'

const contextCommentRegExp = /^<!--([\s\S]*?)-->\n\n?/
type Context = {
  id: string
  title: string
  categories: string[]
  draft: 'yes' | 'no'
  updated: string
  edited: string
}

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

  context.subscriptions.concat(disposables)
}

// this method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate(): void {}

const retrieveEntry = async () => {
  const hatenablog = new Hatenablog()
  const textEditor = vscode.window.activeTextEditor
  if (!textEditor) {
    console.error('TextEditor not found')
    return
  }
  const content = textEditor.document.getText()
  const context = parseContext(content)
  const id = context?.id
  if (!id) {
    showErrorMessage('ID is required in context.')
    return
  }

  try {
    const res = await hatenablog.getEntry(id)
    const content = res.entry.content._

    saveContext(
      {
        id,
        title: res.entry.title._,
        categories: Array.isArray(res.entry.category)
          ? res.entry.category.map((c) => c.$.term)
          : [res.entry.category.$.term],
        updated: res.entry.updated._,
        edited: res.entry['app:edited']._,
        draft: res.entry['app:control']['app:draft']._,
      },
      content
    )

    vscode.window.showInformationMessage(`Successfully retrieved Entry content (ID: ${id})`)
  } catch (err) {
    console.error(err)
    showErrorMessage(String(err))
  }
}

const postOrUpdate = async () => {
  const hatenablog = new Hatenablog()

  const textEditor = vscode.window.activeTextEditor
  if (!textEditor) {
    showErrorMessage('TextEditor was not found.')
    return
  }
  const content = textEditor.document.getText()
  const context = parseContext(content)

  const titleValue = context?.title ?? ''
  const categoriesValue = context?.categories.toString() ?? ''

  const inputTitle = await vscode.window.showInputBox({
    placeHolder: 'Entry title',
    prompt: 'Please input an entry title',
    value: titleValue,
  })

  if (!inputTitle) {
    showErrorMessage('Title is required')
    return
  }

  const inputCategories = await vscode.window.showInputBox({
    placeHolder: 'Categories',
    prompt: 'Please input categories. (Comma deliminated)',
    value: categoriesValue,
  })

  if (inputCategories === undefined) {
    showErrorMessage('ESC was pressed.')
    return
  }

  /**
   * if context exists, use context.updated as default value.
   * unless, use now as default value
   */
  const now = new Date().toISOString()
  let inputUpdated = await vscode.window.showInputBox({
    placeHolder: now,
    prompt: 'Please input `updated at`',
    value: context?.updated ?? now,
  })
  if (!inputUpdated) {
    inputUpdated = now
  }

  const inputPublished = await vscode.window.showInputBox({
    placeHolder: 'yes',
    prompt: 'Do you want to publish it? Type "yes" or save as draft',
  })

  if (inputPublished === undefined) {
    showErrorMessage('ESC was pressed.')
    return
  }

  const categories = inputCategories ? inputCategories.split(',') : []
  const draft: 'yes' | 'no' = inputPublished === 'yes' ? 'no' : 'yes'

  const options = {
    id: context?.id,
    title: inputTitle,
    content: removeContextComment(content),
    categories,
    updated: inputUpdated,
    draft,
  }

  try {
    const res = await hatenablog.postOrUpdate(options)
    const id = res.entry.id._.match(/^tag:[^:]+:[^-]+-[^-]+-\d+-(\d+)$/)?.[1]

    const { hatenaId, blogId, openAfterPostOrUpdate } = vscode.workspace.getConfiguration('hatenablogger')

    if (!id) {
      throw new Error('ID not retrieved.')
    }
    const entryURL =
      draft !== 'yes' ? res.entry.link[1].$.href : `http://blog.hatena.ne.jp/${hatenaId}/${blogId}/edit?entry=${id}`

    saveContext({
      id,
      title: res.entry.title._,
      categories,
      updated: res.entry.updated._,
      edited: res.entry['app:edited']._,
      draft,
    })

    vscode.window.showInformationMessage(`Successfully ${context ? 'updated' : 'posted'} at ${entryURL}`)

    if (openAfterPostOrUpdate) {
      await open(entryURL)
    }
  } catch (err: unknown) {
    console.error(err)
    showErrorMessage(String(err))
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
  const comment = content.match(contextCommentRegExp)
  if (comment) {
    return JSON.parse(comment[1])
  }
  return null
}

function removeContextComment(content: string) {
  return content.replace(contextCommentRegExp, '')
}

const uploadImage = async () => {
  const hatenafotolife = new Hatenafotolife()

  const uri = await vscode.window.showOpenDialog({})
  if (!uri) {
    return
  }
  const file = uri[0]
  const textEditor = vscode.window.activeTextEditor

  if (textEditor && textEditor.selection.isEmpty) {
    const position = textEditor.selection.active
    vscode.window.showInformationMessage('Uploading image...')

    let title = await vscode.window.showInputBox({
      placeHolder: 'Title',
      prompt: 'Please input title',
      value: basename(file.fsPath),
    })
    title = title ?? basename(file.fsPath)

    const { alwaysAskCaption } = vscode.workspace.getConfiguration('hatenablogger')
    let caption: string | undefined
    if (alwaysAskCaption) {
      caption = await vscode.window.showInputBox({
        placeHolder: 'Caption',
        prompt: 'Please input caption if needed',
        value: '',
      })
    }

    try {
      const res = await hatenafotolife.upload({
        file: file.fsPath,
        title,
      })
      const imageurl = res.entry['hatena:imageurl']._
      let markdown = `![${title}](${imageurl})`

      if (caption) {
        markdown = `<figure class="figure-image figure-image-fotolife" title="${caption}">

${markdown}

<figcaption>${caption}</figcaption></figure>
          `
      }

      textEditor.edit((edit) => edit.insert(position, markdown))
      vscode.window.showInformationMessage('Successfully image uploaded!')
    } catch (err) {
      console.error(err)
      showErrorMessage(String(err))
    }
  }
}

const showErrorMessage = async (text: string) => {
  await vscode.window.showErrorMessage(`HatenaBlogger was canceled. ${text}`)
}
