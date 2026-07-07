/**
 * Google OAuth2 utilities — uses native fetch (Node 18+), no external library needed.
 */

/** Build the Google OAuth2 authorization URL. */
export function getGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    state,
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Exchange an authorization code for access + id tokens. */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ access_token: string; id_token: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; id_token: string };
  return { access_token: data.access_token, id_token: data.id_token };
}

/** Fetch the authenticated user's profile from Google. */
export async function getGoogleUserInfo(
  accessToken: string,
): Promise<{ email: string; name: string; picture: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google userinfo request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { email: string; name: string; picture: string };
  return { email: data.email, name: data.name, picture: data.picture };
}
