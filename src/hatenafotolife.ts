import * as vscode from 'vscode'
import fotolife, { Fotolife } from 'hatena-fotolife-api'

type Response = {
  entry: {
    'hatena:imageurl': {
      _: string
    }
  }
}

export default class Hatenafotolife {
  private client: Fotolife

  constructor() {
    const { hatenaId, apiKey } = vscode.workspace.getConfiguration('hatenablogger')
    this.client = fotolife({
      type: 'wsse',
      username: hatenaId,
      apikey: apiKey,
    })
  }

  upload = (options: { file: string; title: string }): Promise<Response> => {
    const { fotolifeFolder } = vscode.workspace.getConfiguration('hatenablogger')
    return this.client.create({
      ...options,
      folder: fotolifeFolder,
    })
  }
}
