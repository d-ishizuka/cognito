export const handler = async (event) => {
    const response = event.Records[0].cf.response;
    const request = event.Records[0].cf.request;

    const idTokenHeader = request.headers['x-id-token'];
    const idToken = idTokenHeader && idTokenHeader[0]?.value;

    if (idToken) {
        response.headers['set-cookie'] = [
            {
                key: 'Set-Cookie',
                value: `id_token=${idToken}; Secure; HttpOnly; Path=/;`
            }
        ]
    }
    
    return response
}