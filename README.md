# Al 配合計算 PWA Ver.1.0.3

純Al～高純度Alを母材とした、Cu / Si / Ti等の微量添加向け配合支援PWAです。

## 実装済み

- 配合計算（複数元素、共通の最終総重量を連立で考慮）
- 添加確認
- 歩留まり手動入力 / 逆算 / 実績保存 / 統計
- 希釈計算
- 純元素・母合金の添加材マスタ
- 天秤マスタ、四捨五入 / 切上げ / 切捨て、上下候補
- wt% / ppm / ppb、mg / g / kg / t
- 表示桁数設定（内部精度とは分離）
- IndexedDB履歴、localStorage設定
- JSONバックアップ / 復元、UTF-8 BOM付きCSV
- オフラインヘルプ、初回チュートリアル
- manifest / Service WorkerによるPWA・オフラインキャッシュ
- 依存CDNなし
- Node / ブラウザ向け計算エンジンテスト

## Windowsで起動

1. `start_local_server.bat` をダブルクリックします。
2. `http://localhost:8080` が開きます。
3. Edge / Chromeの「アプリをインストール」からPWAとして追加できます。
4. 一度キャッシュされた後は主要機能をオフラインで利用できます。

`index.html`を直接開いて計算UIを見ることもできますが、Service Worker / PWAインストールはHTTP(S)またはlocalhostでの起動が必要です。

## テスト

Node.jsがある場合、フォルダで次を実行します。

```bash
npm test
```

または `tests/test.html` をブラウザで開きます。

## 保存データ

- localStorage: 表示設定、最後の画面、チュートリアル既読
- IndexedDB: 添加材、天秤、歩留まり実績、計算履歴等

ブラウザデータの消去に備え、「設定・データ」からJSONバックアップを定期的に保存してください。
