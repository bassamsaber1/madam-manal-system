import fs from 'fs';
import path from 'path';

export type SystemUser = {
  username: string;
  password: string;
  role: string;
};

const LOCAL_PATH = path.join(process.cwd(), 'src', 'data', 'system_users.json');

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'bassamsaber1/madam-manal-system';
  const filePath = process.env.GITHUB_USERS_PATH || 'src/data/system_users.json';
  if (!token) return null;
  return { token, repo, filePath };
}

function readLocalUsers(): SystemUser[] {
  if (!fs.existsSync(LOCAL_PATH)) return [];
  return JSON.parse(fs.readFileSync(LOCAL_PATH, 'utf-8'));
}

function writeLocalUsers(users: SystemUser[]) {
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

async function readGitHubUsers(): Promise<SystemUser[]> {
  const config = getGitHubConfig();
  if (!config) return readLocalUsers();

  const res = await fetch(
    `https://api.github.com/repos/${config.repo}/contents/${config.filePath}`,
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      cache: 'no-store',
    }
  );

  if (!res.ok) return readLocalUsers();

  const data = await res.json();
  const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
  return JSON.parse(content);
}

async function writeGitHubUsers(users: SystemUser[]): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    writeLocalUsers(users);
    return;
  }

  const getRes = await fetch(
    `https://api.github.com/repos/${config.repo}/contents/${config.filePath}`,
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    }
  );

  let sha: string | undefined;
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  const content = Buffer.from(JSON.stringify(users, null, 2), 'utf-8').toString('base64');

  const putRes = await fetch(
    `https://api.github.com/repos/${config.repo}/contents/${config.filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Update users: add ${users[users.length - 1]?.username || 'user'}`,
        content,
        sha,
      }),
    }
  );

  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(err.message || 'فشل حفظ اليوزرات على GitHub');
  }

  writeLocalUsers(users);
}

export async function getUsers(): Promise<SystemUser[]> {
  return readGitHubUsers();
}

export async function saveUsers(users: SystemUser[]): Promise<void> {
  await writeGitHubUsers(users);
}
