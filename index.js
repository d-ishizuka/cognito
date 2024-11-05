'use strict';

const https = require('https');
const jwt = require('jsonwebtoken');

const region = 'your-region'; // e.g., us-east-1
const userPoolId = 'your-user-pool-id';
const cognitoIssuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
let jwks;

function getJwks() {
    return new Promise((resolve, reject) => {
        if (jwks) {
            resolve(jwks);
        } else {
            https.get(`${cognitoIssuer}/.well-known/jwks.json`, (resp) => {
                let data = '';
                resp.on('data', (chunk) => { data += chunk; });
                resp.on('end', () => {
                    jwks = JSON.parse(data).keys;
                    resolve(jwks);
                });
            }).on("error", (err) => {
                reject(err);
            });
        }
    });
}

function getKey(header, callback) {
    getJwks().then((keys) => {
        const signingKey = keys.find(key => key.kid === header.kid);
        if (signingKey) {
            const publicKey = `-----BEGIN PUBLIC KEY-----\n${signingKey.x5c[0]}\n-----END PUBLIC KEY-----\n`;
            callback(null, publicKey);
        } else {
            callback(new Error('Public key not found.'));
        }
    });
}

exports.handler = async (event) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;
    const cookies = headers['cookie'] ? headers['cookie'][0].value : '';
    
    const token = cookies.match(/id_token=([^;]+)/);
    
    if (!token) {
        return redirectToLogin();
    }
    
    try {
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token[1], getKey, { issuer: cognitoIssuer }, (err, decoded) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(decoded);
                }
            });
        });
        
        // トークンが正当であればリクエストをそのまま返す
        return request;
    } catch (err) {
        // トークンが無効な場合はログインページにリダイレクト
        return redirectToLogin();
    }
};

function redirectToLogin() {
    return {
        status: '302',
        statusDescription: 'Found',
        headers: {
            'location': [{
                key: 'Location',
                value: `https://your-cognito-domain.auth.${region}.amazoncognito.com/login?client_id=YOUR_CLIENT_ID&response_type=token&scope=openid&redirect_uri=https://your-cloudfront-url`
            }],
        },
    };
}
