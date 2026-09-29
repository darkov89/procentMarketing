import crypto from "crypto";

export interface DeployResult {
  url: string;
  deployId: string | null;
  isLocal: boolean;
}

export async function deployToNetlify(
  htmlContent: string,
  slug: string
): Promise<DeployResult> {
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!token || !siteId) {
    // Return placeholder web url or local preview indicator
    return {
      url: `/offers/${slug}`,
      deployId: null,
      isLocal: true,
    };
  }

  try {
    const contentBytes = Buffer.from(htmlContent, "utf-8");
    const sha1 = crypto.createHash("sha1").update(contentBytes).digest("hex");

    const manifest = {
      files: {
        "/index.html": sha1,
      },
    };

    const createDeployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(manifest),
      }
    );

    if (!createDeployRes.ok) {
      throw new Error(`Netlify deploy creation failed: ${createDeployRes.statusText}`);
    }

    const deployData = await createDeployRes.json();
    const deployId = deployData.id;
    const requiredHashes: string[] = deployData.required || [];

    if (requiredHashes.includes(sha1)) {
      const uploadRes = await fetch(
        `https://api.netlify.com/api/v1/deploys/${deployId}/files/index.html`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
          },
          body: contentBytes,
        }
      );

      if (!uploadRes.ok) {
        throw new Error(`Netlify file upload failed: ${uploadRes.statusText}`);
      }
    }

    const liveUrl =
      deployData.deploy_ssl_url ||
      deployData.ssl_url ||
      `https://${slug}.netlify.app`;

    return {
      url: liveUrl,
      deployId,
      isLocal: false,
    };
  } catch (err) {
    console.warn("Netlify upload failed, falling back to local:", err);
    return {
      url: `/offers/${slug}`,
      deployId: null,
      isLocal: true,
    };
  }
}
