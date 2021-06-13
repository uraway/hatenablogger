[![](https://vsmarketplacebadge.apphb.com/version-short/uraway.hatenablogger.svg)](https://marketplace.visualstudio.com/items?itemName=uraway.hatenablogger)
[![](https://vsmarketplacebadge.apphb.com/downloads-short/uraway.hatenablogger.svg)](https://marketplace.visualstudio.com/items?itemName=uraway.hatenablogger)
[![All Contributors](https://img.shields.io/badge/all_contributors-1-orange.svg?style=flat-square)](#contributors)
[![<uraway>](https://circleci.com/gh/uraway/hatenablogger.svg?style=svg)](https://circleci.com/gh/uraway/hatenablogger)

# hatenablogger

This VSCode extension helps you to manage entries on HatenaBlog and images on HatenaFotolife.

はてなブログエントリーを VSCode から投稿・更新するための VSCode 拡張です。はてなフォトライフへ画像をアップロードすることもできます。

## オプション設定

| プロパティ            | 型     | 必須 | 説明                                                                              |
| --------------------- | ------ | ---- | --------------------------------------------------------------------------------- |
| hatenaId              | 文字列 | ○    | Hatena ID                                                                         |
| blogId                | 文字列 | ○    | [Blog ID](http://blog.hatena.ne.jp/my/config/detail) (デフォルトはブログドメイン) |
| apiKey                | 文字列 | ○    | [API キー](http://blog.hatena.ne.jp/my/config/detail)                             |
| askCategory           | 真偽値 |      | エントリの投稿・更新時にカテゴリを API から取得して選択可能にします               |
| openAfterPostOrUpdate | 真偽値 |      | エントリの投稿・更新後に URL を開きます                                           |

![](./images/api-key.png)

| プロパティ             | 型     | 必須 | 説明                                                                                           |
| ---------------------- | ------ | ---- | ---------------------------------------------------------------------------------------------- |
| allowedImageExtensions | 配列   | ○    | アップロード可能なファイルの拡張子を指定します。デフォルト: `["png","jpg","jpeg","gif","bmp"]` |
| fotolifeFolder         | 文字列 |      | 画像をアップロードするフォルダを指定します                                                     |
| askCaption             | 真偽値 |      | 画像をアップロードする際に、キャプションを追加するか尋ねます                                   |

## 機能

### エントリのダンプ: `Hatenablogger: Dump All Entries`

エントリをすべて取得し、指定したフォルダにダンプします

### エントリの投稿: `Hatenablogger: Post or Update`

マークダウンファイル内にコンテキストコメントがない場合は、エントリを投稿し、コンテキストコメントを挿入します

![post-entry](./images/post-entry.gif)

### エントリの更新: `Hatenablogger: Post or Update`

マークダウンファイル内にコンテキストコメントが存在する場合は、エントリとコンテキストコメントを更新します

![update-entry](./images/update-entry.gif)

### エントリの取得: `Hatenablogger: Retrieve Entry`

マークダウンファイル内にコンテキストコメントが存在する場合は、エントリを取得し、マークダウンファイルとコンテキストコメントを同期します

![retrieve-entry](./images/retrieve-entry.gif)

### エントリの置換: `Hatenablogger: Replace Content In All Entries`

正規表現でエントリを検索し、そのワードを置換して更新します

### イメージのアップロード: `Hatenablogger: Upload Image`

はてなフォトライフへ画像をアップロードし、マークダウン形式で画像 URL を挿入します

![upload-image](./images/upload-image.gif)

## Contributing

1. Fork this repo and Clone it!
2. Commit and Push your changes.
3. If you contributed something new, run yarn contrib:add <your GitHub username>
4. Finally submit a pull request :D

## Contributors

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->
<table><tr><td align="center"><a href="http://uraway.hatenablog.com/"><img src="https://avatars3.githubusercontent.com/u/15242484?v=4" width="100px;" alt="Masato Urai (@uraway_)"/><br /><sub><b>Masato Urai (@uraway_)</b></sub></a><br /><a href="https://github.com/uraway/hatenablogger/commits?author=uraway" title="Documentation">📖</a> <a href="https://github.com/uraway/hatenablogger/commits?author=uraway" title="Code">💻</a></td></tr></table>

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
