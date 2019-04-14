import * as vscode from "vscode";
import fotolife from "hatena-fotolife-api";

export default class Hatenafotolife {
  private client: any;

  constructor() {
    const { hatenaId, apiKey } = vscode.workspace.getConfiguration(
      "hatenablogger"
    );
    this.client = fotolife({
      type: "wsse",
      username: hatenaId,
      apikey: apiKey
    });
  }

  upload = (options: { title: string; file: string }) => {
    return this.client.create(options);
  }
}
