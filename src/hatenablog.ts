import * as vscode from "vscode";
import axios, { AxiosRequestConfig } from "axios";
import * as xml2js from "xml2js";
import wsse from "wsse";

export default class Hatenablog {
  private hatenaId: string;
  private blogId: string;
  private apiKey: string;

  constructor() {
    const { hatenaId, blogId, apiKey } = vscode.workspace.getConfiguration(
      "hatenablogger"
    );
    this.hatenaId = hatenaId;
    this.blogId = blogId;
    this.apiKey = apiKey;
  }

  postOrUpdate = (options: {
    id?: string;
    title: string;
    content: string;
    categories: string[];
    draft: "yes" | "no";
  }) => {
    return options.id ? this.update(options) : this.post(options);
  }

  createBody = (options: {
    title: string;
    content: string;
    updated?: string;
    categories: string[];
    draft: "yes" | "no";
  }) => {
    const { title, content, updated, categories, draft } = options;
    const body = {
      entry: {
        $: {
          xmlns: "http://www.w3.org/2005/Atom",
          "xmlns:app": "http://www.w3.org/2007/app"
        },
        title: {
          _: title
        },
        content: {
          $: {
            type: "text/plain"
          },
          _: this.sanitize(content)
        },
        category: categories.map(c => ({
          $: { term: c }
        })),
        "app:control": { "app:draft": { _: draft } }
      }
    };
    if (updated) {
      Object.assign(body.entry, {
        body: { entry: { updated: { _: updated } } }
      });
    }
    return body;
  }

  post = (options: {
    title: string;
    content: string;
    categories: string[];
    updated?: string;
    draft: "yes" | "no";
  }) => {
    const body = this.createBody(options);
    const path = `/${this.hatenaId}/${this.blogId}/atom/entry`;
    return this.request({ method: "POST", path, body });
  }

  update = (options: {
    id?: string;
    title: string;
    content: string;
    categories: string[];
    updated?: string;
    draft: "yes" | "no";
  }) => {
    const { id } = options;
    const body = this.createBody(options);
    const path = `/${this.hatenaId}/${this.blogId}/atom/entry/${id}`;
    return this.request({ method: "PUT", path, body });
  }

  request = async (options: { method: AxiosRequestConfig['method'], path: string; body: object }) => {
    const { method, path, body } = options;
    const token = wsse({
      username: this.hatenaId,
      password: this.apiKey
    });
    const xml = await this.toXml(body);
    try {
      const res = await axios({
        method,
        url: `https://blog.hatena.ne.jp${path}`,
        data: xml,
        headers: {
          "Content-Type": "text/xml",
          Authorization: 'WSSE profile="UsernameToken',
          "X-WSSE": token.getWSSEHeader()
        }
      });
      return this.toJson(res.data);
    } catch (err) {
      throw err.response.data;
    }
  }

  toJson = (xml: string) => {
    return new Promise((resolve, reject) => {
      const parser = new xml2js.Parser({
        explicitArray: false,
        explicitCharkey: true
      });
      parser.parseString(xml, (err: object, result: object) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  toXml = (json: object) => {
    const builder = new xml2js.Builder();
    return new Promise((resolve, reject) => {
      try {
        const xml = builder.buildObject(json);
        resolve(xml);
      } catch (err) {
        reject(err);
      }
    });
  }

  sanitize = (text: string) => {
    // Remove invalid control characters
    return text.replace(/\u0008/g, "");
  }
}
