"""Deploy generated HTML to Netlify or save locally."""
import hashlib
import os
from pathlib import Path
from typing import Optional

import httpx
from pydantic import BaseModel

from leadmachine.config import get_settings


class DeployResult(BaseModel):
    url: str
    deploy_id: Optional[str]
    is_local: bool

class NetlifyDeployer:
    """Deploys sites to Netlify using the file digest method."""

    def __init__(self):
        self.settings = get_settings()
        self.token = (
            getattr(self.settings, "netlify_auth_token", None)
            or getattr(self.settings, "netlify_token", None)
            or os.getenv("NETLIFY_AUTH_TOKEN")
            or os.getenv("NETLIFY_TOKEN")
        )
        self.site_id = getattr(self.settings, "netlify_site_id", None) or os.getenv("NETLIFY_SITE_ID")
        self.api_base = "https://api.netlify.com/api/v1"
        self.output_dir = Path(__file__).resolve().parent.parent.parent / "output" / "offers"

        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def deploy(self, html_content: str, slug: str, site_id: Optional[str] = None) -> DeployResult:
        """
        Deploy HTML to Netlify or save locally if no token is available.
        """
        # Save locally regardless or as fallback
        local_dir = self.output_dir / slug
        local_dir.mkdir(parents=True, exist_ok=True)
        local_file = local_dir / "index.html"
        local_file.write_text(html_content, encoding="utf-8")

        target_site_id = site_id or self.site_id
        if not self.token or not target_site_id:
            return DeployResult(
                url=f"file://{local_file.absolute()}",
                deploy_id=None,
                is_local=True,
            )

        try:
            return self._deploy_to_netlify(html_content, site_id)
        except Exception:
            # Fallback to local on error
            return DeployResult(
                url=f"file://{local_file.absolute()}",
                deploy_id=None,
                is_local=True
            )

    def _deploy_to_netlify(self, html_content: str, site_id: str) -> DeployResult:
        """Execute Netlify deploy via API v1."""
        content_bytes = html_content.encode("utf-8")
        sha1 = hashlib.sha1(content_bytes).hexdigest()

        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

        # 1. Create a deploy with file manifest
        files = {
            "/index.html": sha1
        }

        manifest_data = {
            "files": files
        }

        with httpx.Client(timeout=30.0) as client:
            deploy_resp = client.post(
                f"{self.api_base}/sites/{site_id}/deploys",
                headers=headers,
                json=manifest_data
            )
            deploy_resp.raise_for_status()
            deploy_data = deploy_resp.json()

            deploy_id = deploy_data["id"]
            required_hashes = deploy_data.get("required", [])

            # 2. Upload required files (if the file isn't already cached on Netlify)
            if sha1 in required_hashes:
                upload_headers = {
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/octet-stream"
                }

                upload_resp = client.put(
                    f"{self.api_base}/deploys/{deploy_id}/files/index.html",
                    headers=upload_headers,
                    content=content_bytes
                )
                upload_resp.raise_for_status()

            return DeployResult(
                url=deploy_data.get("deploy_ssl_url", deploy_data.get("ssl_url", "")),
                deploy_id=deploy_id,
                is_local=False
            )
