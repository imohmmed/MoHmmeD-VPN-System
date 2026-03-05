let token: string | null = null;
let tokenExpiry = 0;

function getBaseUrl(): string {
  return process.env.MARZBAN_URL || "http://127.0.0.1:8000";
}

function clearToken() {
  token = null;
  tokenExpiry = 0;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && token && Date.now() < tokenExpiry) return token;

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

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`Marzban auth failed: status=${res.status}, url=${url}, username=${process.env.MARZBAN_USERNAME}, body=${errBody}`);
    throw new Error(`Marzban auth failed: ${res.status}`);
  }
  const data = await res.json() as { access_token: string };
  token = data.access_token;
  tokenExpiry = Date.now() + 10 * 60 * 1000;
  return token;
}

async function marzbanFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let tok = await getToken();
  options.headers = { ...options.headers as Record<string, string>, "Authorization": `Bearer ${tok}` };

  let res = await fetch(url, options);

  if (res.status === 401) {
    clearToken();
    tok = await getToken(true);
    options.headers = { ...options.headers as Record<string, string>, "Authorization": `Bearer ${tok}` };
    res = await fetch(url, options);
  }

  return res;
}

export async function createMarzbanUser(username: string, expireTimestamp: number): Promise<{
  subscription_url: string;
  links: string[];
}> {
  const res = await marzbanFetch(`${getBaseUrl()}/api/user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      status: "active",
      proxies: { vless: { flow: "xtls-rprx-vision" } },
      inbounds: { vless: ["VLESS_REALITY"] },
      expire: expireTimestamp,
      data_limit: 0,
      data_limit_reset_strategy: "no_reset",
      ip_limit: 1,
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
  const res = await marzbanFetch(`${getBaseUrl()}/api/user/${username}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
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
  const res = await marzbanFetch(`${getBaseUrl()}/api/user/${username}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Marzban delete user failed: ${res.status} - ${err}`);
  }
}

export async function getMarzbanUserLinks(username: string): Promise<string[]> {
  const res = await marzbanFetch(`${getBaseUrl()}/api/user/${username}`);
  if (!res.ok) throw new Error(`Marzban get user failed: ${res.status}`);
  const data = await res.json() as { links: string[]; subscription_url: string };
  return data.links || [];
}

export async function getMarzbanInbounds(): Promise<Record<string, any[]>> {
  const res = await marzbanFetch(`${getBaseUrl()}/api/inbounds`);
  if (!res.ok) throw new Error(`Marzban get inbounds failed: ${res.status}`);
  return await res.json() as Record<string, any[]>;
}

export async function testMarzbanConnection(): Promise<boolean> {
  try {
    await getToken(true);
    return true;
  } catch {
    return false;
  }
}
