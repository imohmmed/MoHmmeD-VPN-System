let token: string | null = null;
let tokenExpiry = 0;

function getBaseUrl(): string {
  return process.env.MARZBAN_URL || "http://127.0.0.1:8000";
}

async function getToken(): Promise<string> {
  if (token && Date.now() < tokenExpiry) return token;

  const url = `${getBaseUrl()}/api/admin/token`;
  const body = new URLSearchParams({
    grant_type: "password",
    username: process.env.MARZBAN_USERNAME || "admin",
    password: process.env.MARZBAN_PASSWORD || "admin",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Marzban auth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  token = data.access_token;
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  return token;
}

export async function createMarzbanUser(username: string, expireTimestamp: number): Promise<{
  subscription_url: string;
  links: string[];
}> {
  const tok = await getToken();
  const res = await fetch(`${getBaseUrl()}/api/user`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${tok}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      status: "active",
      proxies: { vmess: {} },
      inbounds: {},
      expire: expireTimestamp,
      data_limit: 0,
      data_limit_reset_strategy: "no_reset",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Marzban create user failed: ${res.status} - ${err}`);
  }

  const data = await res.json() as {
    subscription_url: string;
    links: string[];
  };
  return { subscription_url: data.subscription_url, links: data.links };
}

export async function toggleMarzbanUser(username: string, active: boolean): Promise<void> {
  const tok = await getToken();
  const res = await fetch(`${getBaseUrl()}/api/user/${username}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${tok}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: active ? "active" : "disabled",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Marzban toggle user failed: ${res.status} - ${err}`);
  }
}

export async function deleteMarzbanUser(username: string): Promise<void> {
  const tok = await getToken();
  const res = await fetch(`${getBaseUrl()}/api/user/${username}`, {
    method: "DELETE",
    headers: { "Authorization": `Bearer ${tok}` },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Marzban delete user failed: ${res.status} - ${err}`);
  }
}

export async function getMarzbanInbounds(): Promise<Record<string, any[]>> {
  const tok = await getToken();
  const res = await fetch(`${getBaseUrl()}/api/inbounds`, {
    headers: { "Authorization": `Bearer ${tok}` },
  });
  if (!res.ok) throw new Error(`Marzban get inbounds failed: ${res.status}`);
  return await res.json() as Record<string, any[]>;
}

export async function testMarzbanConnection(): Promise<boolean> {
  try {
    await getToken();
    return true;
  } catch {
    return false;
  }
}
