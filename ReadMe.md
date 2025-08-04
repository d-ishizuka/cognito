# AWS Cognito認証フロー図

この図は、AWS Cognitoを使用した認証フローのシーケンス図です。

```mermaid
sequenceDiagram
  actor line_1 as ユーザー
  box AWS
    participant line_2 as Lamnda@Edge<br>Viewer Request
    participant line_3 as Lambda@Edge<br>Viewer Response
    participant line_4 as CloudFront
    participant line_5 as Cognito
    participant line_6 as S3
  end
  line_1 ->> line_2: ページリクエスト<br>(/index.html)
  line_2 ->> line_2: クエリパラメータ&Cookie確認
  line_2 -->> line_1: Cognito認証画面
  line_1 ->> line_5: 認証情報入力
  line_5 ->> line_5: 認証情報確認
  line_5 -->> line_1: 成功 : 認証コード発行, リダイレクト
  line_1 ->> line_2: ページリクエスト<br>(/index.html?code=xxx)
  line_2 ->> line_2: クエリパラメータ&Cookie確認
  line_2 ->> line_5: 認証コード(code=xxx)
  line_5 -->> line_2: 成功 : token発行(id_token=yyy)
  line_2 ->> line_2: requestヘッダーに<br>id_token=yyyの情報を追加
  line_2 ->> line_4: ページリクエスト(index.html)
  line_4 ->> line_6: (キャッシュヒットなし) ページリクエスト(index.html)
  line_6 -->> line_4: ページ(index.html)
  line_4 -->> line_3: ページ(index.html)
  line_3 ->> line_3: responseヘッダーに<br>set-cookie(id_token)を追加
  line_3 -->> line_1: /index.html with set-cookieヘッダー
  line_1 ->> line_2: ログイン後ぺージリクエスト<br>(/index.html with cookie)
  line_2 ->> line_2: クエリパラメータ&Cookie確認
  line_2 ->> line_5: トークン(id_token=yyy)
  line_5 ->> line_5: 認証情報確認
  line_5 -->> line_2: 成功
  line_2 --> line_2: (※もしid_tokenが期限切れなら<br>refresh_tokenを使用してid_tokenを更新)
  line_2 ->> line_4: ページリクエスト(index.html)
  line_4 -->> line_3: ページ(index.html)
  line_3 -->> line_1: /index.html
```

## 説明

このシーケンス図は以下の認証フローを示しています：

1. **初期アクセス**: ユーザーがページにアクセス
2. **認証チェック**: Lambda@Edgeが認証状態を確認
3. **認証画面表示**: 未認証の場合、Cognito認証画面を表示
4. **認証処理**: ユーザーが認証情報を入力
5. **トークン取得**: 認証成功後、認証コードを取得
6. **トークン交換**: 認証コードをIDトークンに交換
7. **Cookie設定**: レスポンスヘッダーにCookieを設定
8. **継続アクセス**: 以降のアクセスではCookieを使用して認証

このフローにより、セキュアな認証システムを構築できます。