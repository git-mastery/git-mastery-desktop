import fs from "fs";
import https from "https";
import path from "path";
import { logGM } from "../logger.js";

type ReleaseAsset = { name: string; browser_download_url: string };

type DownloadReleaseAssetOptions = {
  pickAsset: (assets: ReleaseAsset[]) => ReleaseAsset | undefined;
  fileName: string;
  executable?: boolean;
};

const RELEASES_API =
  "https://api.github.com/repos/git-mastery/app/releases/latest";

/**
 * Downloads a GitHub release asset into `destDir`. Writes to `<name>.part`
 * and renames on finish so an interrupted download cannot leave a truncated
 * file that still passes an existence check.
 */
export const downloadReleaseAsset = (
  destDir: string,
  { pickAsset, fileName, executable = false }: DownloadReleaseAssetOptions,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const apiOpts = {
      headers: {
        "User-Agent": "electron-git-mastery",
        Accept: "application/vnd.github+json",
      },
    };

    https
      .get(RELEASES_API, apiOpts, (res) => {
        let raw = "";
        res.on("data", (chunk: Buffer) => {
          raw += chunk.toString();
        });
        res.on("error", reject);
        res.on("end", () => {
          let downloadUrl: string;
          let assetName: string;
          try {
            const release = JSON.parse(raw) as { assets: ReleaseAsset[] };
            const asset = pickAsset(release.assets);
            if (!asset) {
              return reject(
                new Error(`${fileName} not found in the latest GitHub release`),
              );
            }
            downloadUrl = asset.browser_download_url;
            assetName = asset.name;
          } catch (err) {
            return reject(
              new Error(`Failed to parse GitHub releases API response: ${err}`),
            );
          }

          logGM(
            "download",
            "cli",
            `Downloading ${assetName} from ${downloadUrl}`,
          );
          const destPath = path.join(destDir, fileName);
          const partPath = `${destPath}.part`;

          const cleanupPart = () => {
            try {
              fs.unlinkSync(partPath);
            } catch {
              // ignore leftover temp file
            }
          };

          const doDownload = (url: string) => {
            https
              .get(url, apiOpts, (fileRes) => {
                if (fileRes.statusCode === 301 || fileRes.statusCode === 302) {
                  const redirectUrl = fileRes.headers.location;
                  if (!redirectUrl) {
                    return reject(
                      new Error("Redirect with no Location header"),
                    );
                  }
                  fileRes.resume();
                  return doDownload(redirectUrl);
                }

                if (fileRes.statusCode !== 200) {
                  return reject(
                    new Error(
                      `Download failed with HTTP ${fileRes.statusCode}`,
                    ),
                  );
                }

                fs.mkdirSync(destDir, { recursive: true });
                const out = fs.createWriteStream(partPath);
                fileRes.pipe(out);
                out.on("finish", () => {
                  out.close((closeErr) => {
                    if (closeErr) {
                      cleanupPart();
                      return reject(closeErr);
                    }
                    try {
                      fs.rmSync(destPath, { force: true });
                      fs.renameSync(partPath, destPath);
                      if (executable) fs.chmodSync(destPath, 0o755);
                      logGM("download", "cli", `Saved to ${destPath}`);
                      resolve();
                    } catch (err) {
                      cleanupPart();
                      reject(err);
                    }
                  });
                });
                out.on("error", (err) => {
                  cleanupPart();
                  reject(err);
                });
                fileRes.on("error", (err) => {
                  cleanupPart();
                  reject(err);
                });
              })
              .on("error", reject);
          };

          doDownload(downloadUrl);
        });
      })
      .on("error", reject);
  });
};
