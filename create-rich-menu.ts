import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../src/config.js";

const config = loadConfig();
const headers = {
  Authorization: `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
};
const definition = await fs.readFile(
  path.join(process.cwd(), "rich-menu", "rich-menu.json"),
  "utf8",
);

const createResponse = await fetch("https://api.line.me/v2/bot/richmenu", {
  method: "POST",
  headers,
  body: definition,
});
if (!createResponse.ok) {
  throw new Error(`Create rich menu failed: ${await createResponse.text()}`);
}
const { richMenuId } = (await createResponse.json()) as { richMenuId: string };
const image = await fs.readFile(path.join(process.cwd(), "rich-menu", "rich-menu.png"));
const uploadResponse = await fetch(
  `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "image/png",
    },
    body: image,
  },
);
if (!uploadResponse.ok) {
  throw new Error(`Upload rich menu image failed: ${await uploadResponse.text()}`);
}
const defaultResponse = await fetch(
  `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
  {
    method: "POST",
    headers: { Authorization: `Bearer ${config.LINE_CHANNEL_ACCESS_TOKEN}` },
  },
);
if (!defaultResponse.ok) {
  throw new Error(`Set default rich menu failed: ${await defaultResponse.text()}`);
}
console.log(`Created and set default rich menu: ${richMenuId}`);
