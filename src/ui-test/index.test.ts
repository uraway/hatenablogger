import {
  Notification,
  VSBrowser,
  Workbench,
  WebDriver,
  InputBox,
  NotificationType,
  EditorView,
} from 'vscode-extension-tester'
// import { DialogHandler } from 'vscode-extension-tester-native'
import { expect } from 'chai'

// Test suite is in standard Mocha BDD format
describe('UI Tests', () => {
  let driver: WebDriver

  before(async () => {
    // Retrieve a handle for the internal WebDriver instance so
    // we can use all its functionality along with the tester API
    driver = VSBrowser.instance.driver

    const { HATENA_ID, BLOG_ID, API_KEY } = process.env
    if (!HATENA_ID || !BLOG_ID || !API_KEY) {
      throw new Error('env not set')
    }

    await setConfiguration({
      hatenaId: HATENA_ID,
      blogId: BLOG_ID,
      apiKey: API_KEY,
    })
  })

  describe('Hatenablogger: Post or Update Command', () => {
    it('succssfully posts', async () => {
      const fileName = 'post.md'

      await openFile(fileName)
      await new Workbench().executeCommand('Hatenablogger: Post or Update')

      await inputPostEntryFieldsWithTests({
        title: 'new entry',
        categories: ['category1', 'カテゴリー2'],
        publicationStatus: 'no',
      })

      const notification = (await driver.wait(() => {
        return notificationExists('Successfully posted')
      }, 10000)) as Notification

      const message = await notification.getMessage()
      console.log(message)
      expect(message).match(/Successfully posted at/)
      expect(await notification.getType()).equals(NotificationType.Info)

      const editor = await new EditorView().openEditor(fileName)
      const text = await driver.wait(() => {
        return editor.getText()
      }, 2000)

      console.log(text)
      expect(text).match(
        /^<!--\n{"id":"\d*","title":"new entry","categories":\["category1","カテゴリー2"\],"updated":".*","edited":".*","draft":"yes"}\n-->\n/
      )
    })

    it('successfully updates', async () => {
      const fileName = 'update.md'

      await openFile(fileName)
      await new Workbench().executeCommand('Hatenablogger: Post or Update')

      await inputPostEntryFieldsWithTests({
        title: 'updated entry',
        categories: ['new category'],
        publicationStatus: 'no',
      })

      const notification = (await driver.wait(() => {
        return notificationExists('Successfully updated')
      }, 30000)) as Notification

      const message = await notification.getMessage()
      console.log(message)
      expect(message).match(/Successfully updated at/)
      expect(await notification.getType()).equals(NotificationType.Info)

      const editor = await new EditorView().openEditor(fileName)
      const text = await driver.wait(() => {
        return editor.getText()
      }, 2000)
      console.log(text)
      expect(text).match(
        /^<!--\n{"id":"\d*","title":"updated entry","categories":\["new category"\],"updated":"2021-06-12T12:00:00\+09:00","edited":".*","draft":"yes"}\n-->\n.*/
      )
    })

    it('successfully retrieves entry', async () => {
      const fileName = 'retrieve.md'
      await openFile(fileName)
      await new Workbench().executeCommand('Hatenablogger: Retrieve Entry')

      const notification = (await driver.wait(() => {
        return notificationExists('Successfully retrieved')
      }, 30000)) as Notification
      const message = await notification.getMessage()
      console.log(message)
      expect(message).match(/Successfully retrieved Entry content/)
      expect(await notification.getType()).equals(NotificationType.Info)

      const editor = await new EditorView().openEditor(fileName)
      const text = await driver.wait(() => {
        return editor.getText()
      }, 2000)
      expect(text).match(
        /^<!--\n{"id":"26006613774708000","title":"retrieved entry title","categories":\["category1","カテゴリー2"\],"updated":"2021-06-12T12:00:00\+09:00","edited":".*","draft":"no"}\n-->\n\nretrieved entry body/
      )
    })

    it('successfully uploads an image', async () => {
      const fileName = 'blank.md'

      await openFile(fileName)
      await new Workbench().executeCommand('Hatenablogger: Upload Image')

      const dialog = await InputBox.create()
      await dialog.setText(`${process.cwd()}/src/ui-test/fixture/screenshot.png`)
      await dialog.confirm()

      const titleInput = await InputBox.create()
      expect(await titleInput.getPlaceHolder()).to.be.equal('Title')
      expect(await titleInput.getText()).to.be.equal('screenshot.png')
      expect(await titleInput.getMessage()).to.be.equal(
        "Please input title (Press 'Enter' to confirm or 'Escape' to cancel)"
      )
      await titleInput.confirm()

      const loadingNotification = (await driver.wait(() => {
        return notificationExists('Uploading image...')
      }, 2000)) as Notification

      expect(await loadingNotification.getMessage()).to.be.equal('Uploading image...')
      expect(await loadingNotification.getType()).equals(NotificationType.Info)

      await driver.sleep(10000)

      const notification = (await driver.wait(() => {
        return notificationExists('Successfully image uploaded!')
      }, 10000)) as Notification

      expect(await notification.getMessage()).to.be.equal('Successfully image uploaded!')
      expect(await notification.getType()).equals(NotificationType.Info)

      const editor = await new EditorView().openEditor(fileName)
      const text = await editor.getText()

      expect(text).match(/!\[screenshot\.png]\(https:\/\/.*\)/)
    })
  })
})

const openFile = async (filename: string) => {
  const prompt = await new Workbench().openCommandPrompt()
  await prompt.setText(`${process.cwd()}/src/ui-test/fixture/${filename}`)
  await prompt.confirm()
}

const setConfiguration = async ({ hatenaId, blogId, apiKey }: { hatenaId: string; blogId: string; apiKey: string }) => {
  const settingsEditor = await new Workbench().openSettings()

  const valueMap = {
    'Hatena ID': hatenaId,
    'Blog ID': blogId,
    'Api Key': apiKey,
  }
  for (const [key, value] of Object.entries(valueMap)) {
    const setting = await settingsEditor.findSetting(key, 'Hatenablogger')
    await setting.setValue(value)
  }
}

async function notificationExists(text: string): Promise<Notification | undefined> {
  const notifications = await new Workbench().getNotifications()

  let result
  for (const notification of notifications) {
    const message = await notification.getMessage()
    if (message.indexOf(text) >= 0) {
      result = notification
    }
  }
  return result
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

  const updatedAtInput = await InputBox.create()
  expect(await updatedAtInput.getMessage()).to.be.equal(
    "Please input `updated at` (Press 'Enter' to confirm or 'Escape' to cancel)"
  )
  await updatedAtInput.confirm()

  const publicationInput = await InputBox.create()
  expect(await publicationInput.getMessage()).to.be.equal(
    "Do you want to publish it? Type \"yes\" or save as draft (Press 'Enter' to confirm or 'Escape' to cancel)"
  )
  await publicationInput.setText(publicationStatus)
  await publicationInput.confirm()
}
