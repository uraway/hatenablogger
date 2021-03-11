import * as vscode from 'vscode'
import axios, { AxiosRequestConfig } from 'axios'
import * as xml2js from 'xml2js'
import wsse from 'wsse'

type Body = {
  entry: {
    $: {
      xmlns: string
      'xmlns:app': string
    }
    title: {
      _: string
    }
    content: {
      $: {
        type: string
      }
      _: string
    }
    category: {
      $: {
        term: string
      }
    }[]
    'app:control': {
      'app:draft': {
        _: 'yes' | 'no'
      }
    }
  }
}

type Response = {
  entry: {
    id: {
      _: string
    }
    link: Array<{ $: { href: string } }>
    title: { _: string }
    updated: { _: string }
  }
}

export default class Hatenablog {
  private hatenaId: string
  private blogId: string
  private apiKey: string

  constructor() {
    const { hatenaId, blogId, apiKey } = vscode.workspace.getConfiguration(
      'hatenablogger'
    )
    this.hatenaId = hatenaId
    this.blogId = blogId
    this.apiKey = apiKey
  }

  postOrUpdate = (options: {
    id?: string
    title: string
    content: string
    categories: string[]
    draft: 'yes' | 'no'
  }): Promise<Response> => {
    return options.id ? this.update(options) : this.post(options)
  }

  createBody = (options: {
    title: string
    content: string
    updated?: string
    categories: string[]
    draft: 'yes' | 'no'
  }): Body => {
    const { title, content, categories, draft } = options
    const body = {
      entry: {
        $: {
          xmlns: 'http://www.w3.org/2005/Atom',
          'xmlns:app': 'http://www.w3.org/2007/app',
        },
        title: {
          _: title,
        },
        content: {
          $: {
            type: 'text/plain',
          },
          _: this.sanitize(content),
        },
        category: categories.map((c) => ({
          $: { term: c },
        })),
        // updated: {
        //   _: updated,
        // },
        'app:control': { 'app:draft': { _: draft } },
      },
    }

    return body
  }

  post = (options: {
    title: string
    content: string
    categories: string[]
    updated?: string
    draft: 'yes' | 'no'
  }): Promise<Response> => {
    const body = this.createBody(options)
    const path = `/${this.hatenaId}/${this.blogId}/atom/entry`
    return this.request({ method: 'POST', path, body })
  }

  update = (options: {
    id?: string
    title: string
    content: string
    categories: string[]
    updated?: string
    draft: 'yes' | 'no'
  }): Promise<Response> => {
    const { id } = options
    const body = this.createBody(options)
    const path = `/${this.hatenaId}/${this.blogId}/atom/entry/${id}`
    return this.request({ method: 'PUT', path, body })
  }

  request = async (options: {
    method: AxiosRequestConfig['method']
    path: string
    body: Body
  }): Promise<Response> => {
    const { method, path, body } = options
    const token = wsse({
      username: this.hatenaId,
      password: this.apiKey,
    })
    const xml = await this.toXml(body)
    try {
      const res = await axios({
        method,
        url: `https://blog.hatena.ne.jp${path}`,
        data: xml,
        headers: {
          'Content-Type': 'text/xml',
          Authorization: 'WSSE profile="UsernameToken',
          'X-WSSE': token.getWSSEHeader(),
        },
      })
      return this.toJson<Response>(res.data)
    } catch (err) {
      throw err.response.data
    }
  }

  toJson = <T>(xml: string): Promise<T> => {
    return new Promise((resolve, reject) => {
      const parser = new xml2js.Parser({
        explicitArray: false,
        explicitCharkey: true,
      })
      parser.parseString(xml, (err: Error, result: T) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
    })
  }

  toXml = (json: Record<string, unknown>): Promise<unknown> => {
    const builder = new xml2js.Builder()
    return new Promise((resolve, reject) => {
      try {
        const xml = builder.buildObject(json)
        resolve(xml)
      } catch (err) {
        reject(err)
      }
    })
  }

  sanitize = (text: string): string => {
    // Remove invalid control characters
    return text.replace(/\u08/g, '')
  }
}
