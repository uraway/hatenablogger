import * as vscode from "vscode";
import * as hatenablog from "hatena-blog-api";

export default class Hatenablog {
  private client: any;

  constructor() {
    const { hatenaId, blogId, apiKey } = vscode.workspace.getConfiguration(
      "hatenablogger"
    );
    this.client = hatenablog({
      type: "wsse",
      username: hatenaId,
      blogId: blogId,
      apiKey: apiKey
    });
  }

  post = (options: {
    title: string;
    content: string;
    categories: string[];
    draft: boolean;
  }) => {
    return this.client.create(options);
  }

  update = (options: {
    id: string;
    title: string;
    content: string;
    categories: string[];
    draft: boolean;
  }) => {
    return this.client.update(options);
  }

  postOrUpdate = (options: {
    id?: string;
    title: string;
    content: string;
    categories: string[];
    draft: boolean;
  }) => {
    return options.id
      ? this.client.update(options)
      : this.client.create(options);
  }
}
