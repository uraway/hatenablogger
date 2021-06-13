import * as vscode from 'vscode'
import axios, { Method } from 'axios'
import * as xml2js from 'xml2js'
import wsse from 'wsse'

type UpdateOption = {
  id: string
  title: string
  content: string
  categories: string[]
  draft: 'yes' | 'no'
  updated: string
}

type PostOption = {
  title: string
  content: string
  categories: string[]
  draft: 'yes' | 'no'
  updated: string
}

type Option = UpdateOption | PostOption

type RequestBody = {
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

export type ResponseBody = {
  entry: {
    id: {
      _: string
    }
    link: Array<{ $: { href: string } }>
    title: { _: string }
    updated: { _: string }
    category:
      | {
          $: {
            term: string
          }
        }
      | {
          $: {
            term: string
          }
        }[]
    'app:control': {
      'app:draft': {
        _: 'yes' | 'no'
      }
    }
    content: {
      _: string
    }
    'app:edited': {
      _: string
    }
    published: {
      _: string
    }
  }
}

type Links =
  | [{ $: { href: string; rel: 'first' } }]
  | [{ $: { href: string; rel: 'first' } }, { $: { href: string; rel: 'next' } }]

type ListResponse = {
  feed: {
    link: Links
    entry: ResponseBody['entry'][]
  }
}

type ResponseCategories = {
  'app:categories': {
    'atom:category':
      | {
          $: {
            term: string
          }
        }
      | {
          $: {
            term: string
          }
        }[]
  }
}

/** Cache storage */
let results: ListResponse['feed']['entry'] = []

export default class Hatenablog {
  private hatenaId: string
  private blogId: string
  private apiKey: string

  constructor() {
    const { hatenaId, blogId, apiKey } = vscode.workspace.getConfiguration('hatenablogger')
    this.hatenaId = hatenaId
    this.blogId = blogId
    this.apiKey = apiKey
  }

  postOrUpdate = (options: Option): Promise<ResponseBody> => {
    return 'id' in options && options.id ? this.update(options) : this.post(options)
  }

  getEntry = (id: string): Promise<ResponseBody> => {
    const path = `/${this.hatenaId}/${this.blogId}/atom/entry/${id}`
    return this.request({ method: 'GET', path })
  }

  allCategories = (): Promise<ResponseCategories> => {
    const path = `/${this.hatenaId}/${this.blogId}/atom/category`
    return this.request({ method: 'GET', path })
  }

  listEntry = (page?: string): Promise<ListResponse> => {
    let path = `/${this.hatenaId}/${this.blogId}/atom/entry`

    if (page) {
      path = path + `?page=${page}`
    }

    return this.request({ method: 'GET', path })
  }

  allEntries = async (discardCache = false): Promise<ListResponse['feed']['entry']> => {
    /** Cache hit */
    if (results.length > 0 && !discardCache) return results

    /** Clear cache */
    results = []
    let page: string | undefined
    while (true) {
      const res = await this.listEntry(page)
      results = [...results, ...res.feed.entry]

      const nextLink = res.feed.link.find((l) => l.$.rel === 'next')
      const newPage = nextLink?.$.href.match(/\page=(.*)/)?.[1]
      if (!newPage || newPage === page) break
      page = newPage
    }

    return results
  }

  private createBody = (options: Option): RequestBody => {
    const { title, content, categories, draft, updated } = options
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
        updated: {
          _: updated,
        },
        'app:control': { 'app:draft': { _: draft } },
      },
    }

    return body
  }

  private post = (options: PostOption): Promise<ResponseBody> => {
    const body = this.createBody(options)
    const path = `/${this.hatenaId}/${this.blogId}/atom/entry`
    return this.request({ method: 'POST', path, body })
  }

  private update = (options: UpdateOption): Promise<ResponseBody> => {
    const { id } = options
    const body = this.createBody(options)
    const path = `/${this.hatenaId}/${this.blogId}/atom/entry/${id}`
    return this.request({ method: 'PUT', path, body })
  }

  private request = async <T>(options: { method: Method; path: string; body?: RequestBody }): Promise<T> => {
    const { method, path, body } = options
    const token = wsse({
      username: this.hatenaId,
      password: this.apiKey,
    })
    try {
      console.log(`https://blog.hatena.ne.jp${path}`)
      const res = await axios({
        method,
        url: `https://blog.hatena.ne.jp${path}`,
        data: body && (await this.toXml(body)),
        headers: {
          'Content-Type': 'text/xml',
          Authorization: 'WSSE profile="UsernameToken',
          'X-WSSE': token.getWSSEHeader(),
        },
      })
      return this.toJson<T>(res.data)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        throw err?.response?.data
      } else {
        throw err
      }
    }
  }

  private toJson = <T>(xml: string): Promise<T> => {
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

  private toXml = (json: Record<string, unknown>): Promise<unknown> => {
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

  private sanitize = (text: string): string => {
    // Remove invalid control characters
    return text.replace(/\u08/g, '')
  }
}
