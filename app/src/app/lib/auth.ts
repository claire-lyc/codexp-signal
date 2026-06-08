export const accessTokenKey = 'signal-access-token';
export const refreshTokenKey = 'signal-refresh-token';

export function getAccessToken() {
  return localStorage.getItem(accessTokenKey) ?? localStorage.getItem('accessToken');
}

export function authHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function clearAuthTokens() {
  localStorage.removeItem(accessTokenKey);
  localStorage.removeItem(refreshTokenKey);
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}
