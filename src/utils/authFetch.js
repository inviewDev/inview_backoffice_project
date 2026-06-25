let isInstalled = false;
let hasDispatchedExpiration = false;

function isApiRequest(input) {
  const url = typeof input === 'string' ? input : input?.url || '';
  return url.startsWith('/api/') || url.includes('/api/');
}

async function isExpiredTokenResponse(response) {
  if (response.status === 401) return true;
  if (response.status !== 403) return false;

  try {
    const payload = await response.clone().json();
    return payload?.error === '유효하지 않은 토큰입니다.';
  } catch {
    return false;
  }
}

export function dispatchAuthExpired() {
  if (hasDispatchedExpiration) return;
  hasDispatchedExpiration = true;
  window.dispatchEvent(new CustomEvent('auth:expired'));
}

export function resetAuthExpirationGuard() {
  hasDispatchedExpiration = false;
}

export function installAuthFetchInterceptor() {
  if (isInstalled || typeof window === 'undefined') return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const hadAccessToken = Boolean(localStorage.getItem('access_token'));
    const response = await originalFetch(...args);

    if (
      hadAccessToken &&
      isApiRequest(args[0]) &&
      await isExpiredTokenResponse(response)
    ) {
      dispatchAuthExpired();
    }

    return response;
  };

  isInstalled = true;
}
