'use strict';

import {
    SecretsManagerClient,
    GetSecretValueCommand,
  } from "@aws-sdk/client-secrets-manager";
import fetch from "node-fetch"
import { CognitoJwtVerifier } from "aws-jwt-verify";

const clientId = 'your_client_id_here'; // Replace with your actual client ID
const cognitoDomain = 'your_cognito_domain_here'; // Replace with your actual Cognito domain
const redirectUri = 'your_redirect_uri_here'; // Replace with your actual redirect URI
const region = 'your_region'; // Replace with your actual AWS region

export const handler = async(event) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;
  const queryString = request.querystring || "";

  const secrets = await getSecrets();
  
  const idToken = setIdToken(headers);
  const authCode = setQueyStringContent(queryString);
  
  const req = await handleAuth(idToken, authCode, secrets, request);
  
  return req;
}

const setIdToken = (headers) => {
  const cookieHeader = headers.cookie? headers.cookie[0].value : null;

  if (!cookieHeader) {
    return null
  }

  const match = cookieHeader.match(/(?:^|;\s*)id_token=([^;]*)/);
  const idToken = match ? match[1] : null;

  return idToken
}

const setQueyStringContent = (queryString) => {
  const params = Object.fromEntries(
    queryString.split('&').map((pair) => pair.split('=').map(decodeURIComponent))
  )

  return params['code']
}

const getSecrets = async() => {
  const secret_name = 'cognito/client_credentials';
  const client = new SecretsManagerClient({
    region: region
  });

  let response;

  try {
    response = await client.send(
        new GetSecretValueCommand({
            SecretId: secret_name,
            VersionStage: "AWSCURRENT",
        })
    );
  } catch (error) {
    throw error
  }

  const secret = JSON.parse(response.SecretString);

  return secret
}

const getAccessToken = async(authCode, clientId, clientSecret, redirectUri, domain) => {
  const tokenEndpoint = `${domain}/oauth2/token`;
  
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: redirectUri,
    client_id: clientId,
  });
  
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`
    },
    body: body.toString(),
    });
  
    if (!response.ok) {
      const error = await response.json();
      console.error('Error:', error);
      throw new Error(`Failed to get token: ${error.error_description}`);
    }
  
    const data = await response.json();
    return data; // アクセストークンやリフレッシュトークンが含まれる
  } catch (error) {
    console.error('Error fetching token:', error);
    throw error;
  }
}

const redirectToLogin = (cognitoDomain, clientId) => {
  return {
    status: '302',
    statusDescription: 'Found',
    headers: {
      'location': [{
        key: 'Location',
        value: `${cognitoDomain}/login?client_id=${clientId}&response_type=code&scope=email+openid+phone&redirect_uri=${redirectUri}`
      }],
    },
  };
}

const handleAuth = async(token, authCode, secrets, request) => {    
    // 1. cookieにid_tokenがセットされていれば検証
    if (token) {
      const verifier = CognitoJwtVerifier.create({
        userPoolId: secrets.user_poor_id,
        tokenUse: 'id',
        clientId: clientId,
      });

      try {
        await verifier.verify(token);
        return request
      } catch(e) {
        return redirectToLogin(cognitoDomain, clientId);
      }
    }

    // 2. 認証コードが設定されていれば検証後、id_tokenをcookieにセットする
    if (authCode) {
      const tokenData = await getAccessToken(authCode, clientId, secrets.client_secret, redirectUri, cognitoDomain);
      if (tokenData && tokenData.id_token) {
        request.headers['x-id-token'] = [
          { key: 'X-ID-Token', value: tokenData.id_token }
        ]

        return request;
      } else {
        return redirectToLogin(cognitoDomain, clientId)
      }
    }

    // 3. Congnitoの認証ページ飛ばす
    return redirectToLogin(cognitoDomain, clientId)
}