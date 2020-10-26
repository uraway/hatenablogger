import * as vscode from "vscode";
import axios from "axios";
import * as xml2js from "xml2js";
import * as wsse from "wsse";

type ResponseBody = {
  entry: {
    id: {
      _: string;
    };
    link: {
      $: {
        href: string;
      };
    }[];
  };
};

type RequestBody = {
  entry: {
    $: {
      xmlns: "http://www.w3.org/2005/Atom";
      "xmlns:app": "http://www.w3.org/2007/app";
    };
    title: {
      _: string;
    };
    content: {
      $: {
        type: "text/plain";
      };
      _: string;
    };
    category: { $: { term: string } }[];
    "app:control": { "app:draft": { _: "yes" | "no" } };
  };
};

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
  }): Promise<ResponseBody> => {
    return options.id ? this.update(options) : this.post(options);
  };

  createBody = (options: {
    title: string;
    content: string;
    updated?: string;
    categories: string[];
    draft: "yes" | "no";
  }): RequestBody => {
    const { title, content, updated, categories, draft } = options;
    const body: RequestBody = {
      entry: {
        $: {
          xmlns: "http://www.w3.org/2005/Atom",
          "xmlns:app": "http://www.w3.org/2007/app",
        },
        title: {
          _: title,
        },
        content: {
          $: {
            type: "text/plain",
          },
          _: this.sanitize(content),
        },
        category: categories.map((c) => ({
          $: { term: c },
        })),
        "app:control": { "app:draft": { _: draft } },
      },
    };
    if (updated) {
      Object.assign(body.entry, {
        body: { entry: { updated: { _: updated } } },
      });
    }
    return body;
  };

  post = (options: {
    title: string;
    content: string;
    categories: string[];
    updated?: string;
    draft: "yes" | "no";
  }): Promise<ResponseBody> => {
    const body = this.createBody(options);
    const path = `/${this.hatenaId}/${this.blogId}/atom/entry`;
    return this.request({ method: "POST", path, body });
  };

  update = (options: {
    id?: string;
    title: string;
    content: string;
    categories: string[];
    updated?: string;
    draft: "yes" | "no";
  }): Promise<ResponseBody> => {
    const { id } = options;
    const body = this.createBody(options);
    const path = `/${this.hatenaId}/${this.blogId}/atom/entry/${id}`;
    return this.request({ method: "PUT", path, body });
  };

  request = async (options: {
    method: string;
    path: string;
    body: Record<string, unknown>;
  }): Promise<ResponseBody> => {
    const { method, path, body } = options;
    const token = wsse({
      username: this.hatenaId,
      password: this.apiKey,
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
          "X-WSSE": token.getWSSEHeader(),
        },
      });
      return this.toJson(res.data);
    } catch (err) {
      throw err.ResponseBody.data;
    }
  };

  toJson = <T>(xml: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      const parser = new xml2js.Parser({
        explicitArray: false,
        explicitCharkey: true,
      });
      parser.parseString(xml, (err: Record<string, unknown>, result: T) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };

  toXml = (json: Record<string, unknown>): Promise<string> => {
    const builder = new xml2js.Builder();
    return new Promise((resolve, reject) => {
      try {
        const xml = builder.buildObject(json);
        resolve(xml);
      } catch (err) {
        reject(err);
      }
    });
  };

  sanitize = (text: string): string => {
    // Remove invalid control characters
    return text.replace(/\u08/g, "");
  };
}
