Narou.rb ― 「小説家になろう」「小説を読もう！」ダウンローダ＆縦書用整形スクリプト
============================================================

[![Gem Version](https://badge.fury.io/rb/narou.svg)](http://badge.fury.io/rb/narou)

概要 - Summary
--------------
このアプリは[小説家になろう](http://syosetu.com/)、[小説を読もう！](http://yomou.syosetu.com/)で公開されている小説の管理、
及び電子書籍データへの変換を支援します。縦書き用に特化されており、
横書き用に特化されたWEB小説を違和感なく縦書きで読むことが出来るようになります。
また、校正機能もありますので、小説としての一般的な整形ルールに矯正します。（例：感嘆符のあとにはスペースが必ずくる）

[ノクターンノベルズ](http://noc.syosetu.com/)及び[ムーンライトノベルズ](http://mnlt.syosetu.com/)にも対応しています。

**NEW!!**
[ハーメルン](http://syosetu.org/)、[Arcadia](http://www.mai-net.net/)（理想郷）、[暁](http://www.akatsuki-novels.com/)にも対応しました！

全てコンソールで操作するCUIアプリケーションです。

主な機能は小説家になろうの小説のダウンロード、更新管理、テキスト整形、AozoraEpub3・kindlegen連携によるEPUB/MOBI出力です。

詳細な説明やインストール方法は **[Narou.rb 説明書](https://github.com/whiteleaf7/narou/wiki)** を御覧ください。

![ScreenCapture](https://raw.github.com/wiki/whiteleaf7/narou/images/narou_cap.gif)

更新履歴 - ChangeLog
--------------------

### 2.0.2 : 2015/01/16

#### 仕様変更
- 青空文庫形式のコメントの削除はWEB小説を変換する場合は無効にするように変更
- `web` コマンド実行時すでにサーバが立ち上がっていてもブラウザを開くように変更
- ダウンロード時に表示する節のタイトルを表示するタイミングを調整

#### Bug Fix
- WEB UI起動時には送信失敗リスト表示時に入力を求めないように修正
- ハーメルンの小説が非公開設定になるとエラーになるのを修正 #59
- `mail` コマンドで送信時にエラーが出る場合がある問題に対応


### 2.0.1 : 2014/12/26

#### Bug Fix
- ヘルプ画面の画像が表示出来ない場合があるのを修正


### 2.0.0 : 2014/12/26

#### 追加機能
- `web` コマンドを実装しました。ブラウザベースによるWEB UIを使うことが出来ます
	+ `narou web` でWEBサーバを起動し、自動的にブラウザが開きます
	+ ブラウザは可能な限り最新を推奨。IEは9以下は動きません
- `download.use-subdirectory` オプションが追加されました。小説IDの先頭数文字で
  サブフォルダを作成しグループ分けすることで、大量の小説を管理する場合のパフォ
  ーマンス劣化に対応します
	+ `narou s download.use-subdirectory=true` として設定出来ます
	+ すでに管理済みの小説の保存フォルダは変更されません
- ダウンロード時やアップデート時の最後に、容量不足等で書籍データを送信出来なか
  ったファイル一覧を表示するようにしました

#### 仕様変更
- 終了コードを整理しました
	+ 正常終了時：0
	+ 異常終了時：127
	+ updateコマンド及びdownloadコマンドで失敗した場合：失敗した小説の数
	+ settingコマンド：設定でエラーになった数
- 見出しリスト.txt を保存しなくなりました

#### Bug Fix
- 新規ダウンロードする際にエラーになる場合があったのを修正 #53
- 小説家になろうのルビ仕様に準拠していない書式があったのを修正

		｜が存在していなく、かつ《 》内に自動ルビ化対象文字以外がある場合に
		ルビ化はされない

- 上記修正に伴い、ログ・ホライズン（n8725k）の converter.rb を差し替えました
- Java がインストールされていない場合でも EPUB ファイルの作成が成功したと表示
  されてしまうのを修正 #55

----

### 1.7.2 : 2014/11/26

#### Bug Fix
- デバイスの容量不足で送信に失敗した小説が、再度送信されない問題を修正

----

過去の更新履歴は[こちらを参照](https://github.com/whiteleaf7/narou/blob/master/ChangeLog.md)

----

「小説家になろう」は株式会社ヒナプロジェクトの登録商標です
