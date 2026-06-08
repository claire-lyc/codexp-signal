export const accessTokenKey = 'signal-access-token';
export const refreshTokenKey = 'signal-refresh-token';

export function getAccessToken() {
  return localStorage.getItem(accessTokenKey) ?? localStorage.getItem('accessToken');
}

export function getRefreshToken() {
  return localStorage.getItem(refreshTokenKey) ?? localStorage.getItem('refreshToken');
}

export function hasAuthToken() {
  return Boolean(getAccessToken());
}

export function saveAuthTokens(tokens: { accessToken: string; refreshToken?: string }) {
  localStorage.setItem(accessTokenKey, tokens.accessToken);
  localStorage.setItem('accessToken', tokens.accessToken);

  if (tokens.refreshToken) {
    localStorage.setItem(refreshTokenKey, tokens.refreshToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }
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
