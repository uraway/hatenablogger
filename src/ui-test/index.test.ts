import {
  Notification,
  VSBrowser,
  Workbench,
  WebDriver,
  InputBox,
  NotificationType,
  TextEditor,
} from 'vscode-extension-tester'
import { DialogHandler } from 'vscode-extension-tester-native'
import { MacOpenDialog } from 'vscode-extension-tester-native/out/openDialog'
import { expect } from 'chai'
import { dialogSellectPath } from './utils/dialogSelectPath'

// Test suite is in standard Mocha BDD format
describe('UI Tests', () => {
  let driver: WebDriver

  before(async () => {
    // Retrieve a handle for the internal WebDriver instance so
    // we can use all its functionality along with the tester API
    driver = VSBrowser.instance.driver

    await setConfiguration({
      hatenaId: process.env.HATENA_ID,
      blogId: process.env.BLOG_ID,
      apiKey: process.env.API_KEY,
    })

    // wait for activation
    await sleep(5000)
  })

  describe('Hatenablogger: Post or Update Command', () => {
    it('succssfully posts', async () => {
      await openFile('post.md')
      await new Workbench().executeCommand('Hatenablogger: Post or Update')

      await inputPostEntryFieldsWithTests({
        title: 'new entry',
        categories: ['category1', 'カテゴリー2'],
        publicationStatus: 'no',
      })

      const notification = (await driver.wait(() => {
        return notificationExists('Successfully')
      }, 2000)) as Notification

      expect(await notification.getMessage()).match(/Successfully posted at/)
      expect(await notification.getType()).equals(NotificationType.Info)

      const editor = new TextEditor()
      const hasChanges = await editor.isDirty()
      const text = await editor.getText()

      expect(hasChanges).to.equals(true)
      expect(text).match(
        /^<!--\n{"id":"\d*","title":"new entry","categories":\["category1","カテゴリー2"\],"updated":".*","draft":"yes"}\n-->\n/
      )
    })

    it('successfully updates', async () => {
      await openFile('update.md')
      await new Workbench().executeCommand('Hatenablogger: Post or Update')

      await inputPostEntryFieldsWithTests({
        title: 'updated entry',
        categories: ['new category'],
        publicationStatus: 'no',
      })

      const notification = (await driver.wait(() => {
        return notificationExists('Successfully')
      }, 2000)) as Notification

      expect(await notification.getMessage()).match(/Successfully posted at/)
      expect(await notification.getType()).equals(NotificationType.Info)

      const editor = new TextEditor()
      const text = await editor.getText()
      expect(text).match(
        /^<!--\n{"id":"\d*","title":"updated entry","categories":\["new category"\],"updated":".*","draft":"yes"}\n-->\n.*/
      )
    })

    it('successfully uploads a image', async () => {
      await openFile('post.md')
      await new Workbench().executeCommand('Hatenablogger: Upload Image')

      const dialog = await DialogHandler.getOpenDialog()
      await dialogSellectPath(
        dialog as MacOpenDialog,
        `${process.cwd()}/src/ui-test/fixture/screenshot.png`
      )
      await dialog.confirm()

      const loadingNotification = (await driver.wait(() => {
        return notificationExists('Uploading image...')
      }, 2000)) as Notification

      expect(await loadingNotification.getMessage()).to.be('Uploading image...')
      expect(await loadingNotification.getType()).equals(NotificationType.Info)

      const titleInput = await InputBox.create()
      expect(await titleInput.getPlaceHolder()).to.be('Title')
      expect(await titleInput.getText()).to.be('screenshot.png')
      expect(await titleInput.getMessage()).to.be(
        "Please input title (Press 'Enter' to confirm or 'Escape' to cancel)"
      )
      await titleInput.confirm()

      await sleep(10000)

      const notification = (await driver.wait(() => {
        return notificationExists('Successfully image uploaded!')
      }, 2000)) as Notification

      expect(await notification.getMessage()).to.be(
        'Successfully image uploaded!'
      )
      expect(await notification.getType()).equals(NotificationType.Info)

      const editor = new TextEditor()
      const hasChanges = await editor.isDirty()
      const text = await editor.getText()

      expect(hasChanges).to.equals(true)
      expect(text).match(/!\[screenshot\.png]\(https:\/\/.*\)/)
    })
  })
})

const openFile = async (filename: string) => {
  await new Workbench().executeCommand('Extest: Open File')
  const input = await InputBox.create()
  await input.setText(`${process.cwd()}/src/ui-test/fixture/${filename}`)
  await input.confirm()
}

const setConfiguration = async ({
  hatenaId,
  blogId,
  apiKey,
}: {
  hatenaId?: string
  blogId?: string
  apiKey?: string
}) => {
  const settingsEditor = await new Workbench().openSettings()

  hatenaId &&
    (await (
      await settingsEditor.findSetting('Hatena ID', 'Hatenablogger')
    ).setValue(hatenaId))
  blogId &&
    (await (
      await settingsEditor.findSetting('Blog ID', 'Hatenablogger')
    ).setValue(blogId))
  apiKey &&
    (await (
      await settingsEditor.findSetting('Api Key', 'Hatenablogger')
    ).setValue(apiKey))
}

async function notificationExists(
  text: string
): Promise<Notification | undefined> {
  const notifications = await new Workbench().getNotifications()
  for (const notification of notifications) {
    const message = await notification.getMessage()
    if (message.indexOf(text) >= 0) {
      return notification
    }
  }
}

async function inputPostEntryFieldsWithTests({
  title,
  categories,
  publicationStatus,
}: {
  title: string
  categories: string[]
  publicationStatus: 'yes' | 'no'
}) {
  const titleInput = await InputBox.create()
  expect(await titleInput.getPlaceHolder()).to.be.equal('Entry title')
  expect(await titleInput.getMessage()).to.be.equal(
    "Please input an entry title (Press 'Enter' to confirm or 'Escape' to cancel)"
  )

  await titleInput.setText(title)
  await titleInput.confirm()

  const categoryInput = await InputBox.create()
  expect(await categoryInput.getPlaceHolder()).to.be.equal('Categories')
  expect(await categoryInput.getMessage()).to.be.equal(
    "Please input categories. (Comma deliminated) (Press 'Enter' to confirm or 'Escape' to cancel)"
  )
  await categoryInput.setText(`${categories.join(',')}`)
  await categoryInput.confirm()

  const publicationInput = await InputBox.create()
  expect(await publicationInput.getMessage()).to.be.equal(
    "Do you want to publish it? Type \"yes\" or save as draft (Press 'Enter' to confirm or 'Escape' to cancel)"
  )
  await publicationInput.setText(publicationStatus)
  await publicationInput.confirm()
}

const sleep = async (ms: number) => {
  return await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms)
  })
}
