import fs from "fs";
import https from "https";
import { logGM } from "../logger.js";
import path from "path";

/**
 * Downloads the latest gitmastery.exe from the GitHub releases API into
 * the given destination directory. Follows up to one HTTP redirect (GitHub
 * releases use a CDN redirect before serving the binary).
 */
export const downloadGitMasteryExe = (destDir: string): Promise<void> => {
  const RELEASES_API = 'https://api.github.com/repos/git-mastery/app/releases/latest';
  const ASSET_NAME = 'gitmastery.exe';

  return new Promise((resolve, reject) => {
    const apiOpts = {
      headers: {
        'User-Agent': 'electron-git-mastery',
        'Accept': 'application/vnd.github+json',
      },
    };

    // Step 1 – resolve the download URL from the releases API
    https.get(RELEASES_API, apiOpts, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
      res.on('error', reject);
      res.on('end', () => {
        let downloadUrl: string;
        try {
          const release = JSON.parse(raw) as {
            assets: { name: string; browser_download_url: string }[];
          };
          const asset = release.assets.find((a) => a.name === ASSET_NAME);
          if (!asset) {
            return reject(new Error(`${ASSET_NAME} not found in the latest GitHub release`));
          }
          downloadUrl = asset.browser_download_url;
        } catch (err) {
          return reject(new Error(`Failed to parse GitHub releases API response: ${err}`));
        }

        logGM('download', 'exe', `Downloading ${ASSET_NAME} from ${downloadUrl}`);
        const destPath = path.join(destDir, ASSET_NAME);

        // Step 2 – download the binary (following the CDN redirect)
        const doDownload = (url: string) => {
          https.get(url, apiOpts, (fileRes) => {
            // GitHub returns a 302 redirect to the actual CDN URL
            if (fileRes.statusCode === 301 || fileRes.statusCode === 302) {
              const redirectUrl = fileRes.headers.location;
              if (!redirectUrl) {
                return reject(new Error('Redirect with no Location header'));
              }
              fileRes.resume(); // discard the body
              return doDownload(redirectUrl);
            }

            if (fileRes.statusCode !== 200) {
              return reject(new Error(`Download failed with HTTP ${fileRes.statusCode}`));
            }

            fs.mkdirSync(destDir, { recursive: true });
            const out = fs.createWriteStream(destPath);
            fileRes.pipe(out);
            out.on('finish', () => {
              logGM('download', 'exe', `Saved to ${destPath}`);
              resolve();
            });
            out.on('error', reject);
            fileRes.on('error', reject);
          }).on('error', reject);
        };

        doDownload(downloadUrl);
      });
    }).on('error', reject);
  });
};
