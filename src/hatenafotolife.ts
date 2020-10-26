import * as vscode from "vscode";
import fotolife, { Fotolife } from "hatena-fotolife-api";

type ResponseBody = {
  entry: {
    "hatena:imageurl": {
      _: string;
    };
  };
};

export default class Hatenafotolife {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: Fotolife;

  constructor() {
    const { hatenaId, apiKey } = vscode.workspace.getConfiguration(
      "hatenablogger"
    );
    this.client = fotolife({
      type: "wsse",
      username: hatenaId,
      apikey: apiKey,
    });
  }

  upload = (options: {
    file: string;
    title: string;
  }): Promise<ResponseBody> => {
    const { fotolifeFolder } = vscode.workspace.getConfiguration(
      "hatenablogger"
    );
    return this.client.create({
      ...options,
      folder: fotolifeFolder,
    });
  };
}
