import { appendFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const sha = process.env.GITHUB_SHA;
const timeoutMs = Number(process.env.PREVIEW_TIMEOUT_MS ?? 900000);
const pollIntervalMs = Number(process.env.PREVIEW_POLL_INTERVAL_MS ?? 10000);
const outputPath = process.env.GITHUB_OUTPUT;

if (!token || !repository || !sha) {
  throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, dan GITHUB_SHA wajib untuk polling preview.");
}

const [owner, repo] = repository.split("/");

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "aio-testing-ci",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${path} gagal: ${response.status}`);
  }

  return response.json();
}

function normalizePreviewUrl(status) {
  const url = status.environment_url ?? status.environmentUrl ?? status.target_url ?? status.targetUrl;

  if (!url || typeof url !== "string") {
    return null;
  }

  if (!/^https?:\/\//i.test(url)) {
    return null;
  }

  return url;
}

async function findPreviewUrl() {
  const deployments = await github(
    `/repos/${owner}/${repo}/deployments?sha=${encodeURIComponent(sha)}&per_page=20`,
  );

  for (const deployment of deployments) {
    const environment = String(deployment.environment ?? "").toLowerCase();

    if (environment === "production") {
      continue;
    }

    const statuses = await github(
      `/repos/${owner}/${repo}/deployments/${deployment.id}/statuses?per_page=20`,
    );

    for (const status of statuses) {
      const previewUrl = normalizePreviewUrl(status);

      if (status.state === "success" && previewUrl) {
        return previewUrl;
      }
    }
  }

  return null;
}

const startedAt = Date.now();

while (Date.now() - startedAt < timeoutMs) {
  const previewUrl = await findPreviewUrl();

  if (previewUrl) {
    console.log(`Preview URL siap: ${previewUrl}`);

    if (outputPath) {
      await appendFile(outputPath, `preview_url=${previewUrl}\n`);
    }

    process.exit(0);
  }

  console.log("Preview belum siap, tunggu polling berikutnya...");
  await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
}

throw new Error(`Preview Vercel tidak ditemukan dalam ${timeoutMs}ms.`);
